"""File-attachment storage helpers.

Binary uploads (images and audio) are stored on disk under a media directory
that lives on the same mounted volume as the SQLite database, so uploads
survive container restarts. The database stores only metadata (see the
Attachment model). This module owns the type allowlist, size limit, filename
sanitization, and save/delete/path resolution.
"""

import os
import re
import uuid

from src.datetime_utils import InvalidInput

# Per-file upload cap (25 MB). Enforced here on the actual bytes written, in
# addition to Flask's MAX_CONTENT_LENGTH guard on the whole request.
MAX_FILE_SIZE = 25 * 1024 * 1024

# Allowed MIME types -> canonical file extension and attachment category.
ALLOWED_TYPES = {
    'image/jpeg': ('.jpg', 'image'),
    'image/png': ('.png', 'image'),
    'image/webp': ('.webp', 'image'),
    'image/gif': ('.gif', 'image'),
    'audio/mpeg': ('.mp3', 'audio'),
    'audio/mp4': ('.m4a', 'audio'),
    'audio/aac': ('.aac', 'audio'),
    'audio/ogg': ('.ogg', 'audio'),
    'audio/webm': ('.webm', 'audio'),
    'audio/wav': ('.wav', 'audio'),
    'audio/x-wav': ('.wav', 'audio'),
}


def get_media_root():
    """Return the base directory for stored attachments, creating it if needed.

    Placed next to the SQLite database (same mounted volume) so files persist
    across restarts. Overridable via the ATTACHMENTS_DIR env var.
    """
    configured = os.environ.get('ATTACHMENTS_DIR')
    if configured:
        root = configured
    else:
        db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'database')
        root = os.path.join(db_dir, 'attachments')
    os.makedirs(root, exist_ok=True)
    return root


def _note_dir(note_id):
    """Return (and create) the storage directory for a single note's attachments."""
    path = os.path.join(get_media_root(), str(int(note_id)))
    os.makedirs(path, exist_ok=True)
    return path


def _sanitize_original_name(name):
    """Reduce a client-supplied filename to a safe display string (no paths)."""
    if not name:
        return None
    # Keep only the basename, strip anything but a conservative character set.
    base = os.path.basename(name)
    base = re.sub(r'[^A-Za-z0-9._-]', '_', base)
    return base[:255] or None


def validate_upload(mime_type):
    """Validate the declared MIME type against the allowlist.

    Returns (extension, attachment_type). Raises InvalidInput (-> HTTP 400) if
    the type is not allowed.
    """
    if mime_type not in ALLOWED_TYPES:
        raise InvalidInput('Unsupported file type')
    return ALLOWED_TYPES[mime_type]


def save_upload(note_id, file_storage, mime_type):
    """Persist an uploaded file to disk under the note's directory.

    Streams to a randomly-named file (avoiding collisions and path traversal),
    enforces MAX_FILE_SIZE while writing, and removes a partial file if the
    limit is exceeded.

    Returns a dict: {stored_filename, attachment_type, file_size}.
    Raises InvalidInput on disallowed type or oversized file.
    """
    extension, attachment_type = validate_upload(mime_type)

    stored_filename = f'{uuid.uuid4().hex}{extension}'
    dest = os.path.join(_note_dir(note_id), stored_filename)

    size = 0
    chunk_size = 64 * 1024
    try:
        with open(dest, 'wb') as out:
            while True:
                chunk = file_storage.stream.read(chunk_size)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    out.close()
                    os.remove(dest)
                    raise InvalidInput('File exceeds maximum allowed size')
                out.write(chunk)
    except InvalidInput:
        raise
    except Exception:
        # Clean up a partial write on any unexpected error.
        if os.path.exists(dest):
            os.remove(dest)
        raise

    if size == 0:
        os.remove(dest)
        raise InvalidInput('Empty file')

    return {
        'stored_filename': stored_filename,
        'attachment_type': attachment_type,
        'file_size': size,
    }


def get_file_path(note_id, stored_filename):
    """Resolve the on-disk path for a stored attachment, guarding against traversal.

    Returns the absolute path if it exists and is safely within the note's
    directory, otherwise None.
    """
    note_dir = os.path.realpath(_note_dir(note_id))
    candidate = os.path.realpath(os.path.join(note_dir, stored_filename))
    # Reject anything that escapes the note directory.
    if os.path.commonpath([note_dir, candidate]) != note_dir:
        return None
    return candidate if os.path.isfile(candidate) else None


def delete_file(note_id, stored_filename):
    """Delete a stored attachment file if present. Safe to call if already gone."""
    path = get_file_path(note_id, stored_filename)
    if path:
        try:
            os.remove(path)
        except OSError:
            pass


def delete_note_dir(note_id):
    """Remove a note's entire attachment directory (used when a note is deleted).

    Safe to call when the directory does not exist.
    """
    import shutil
    note_dir = os.path.join(get_media_root(), str(int(note_id)))
    if os.path.isdir(note_dir):
        shutil.rmtree(note_dir, ignore_errors=True)
