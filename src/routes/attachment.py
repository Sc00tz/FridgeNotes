"""Blueprint for note file attachments (images and audio).

Access control mirrors the note endpoints: reading requires ownership or any
share; uploading/deleting requires ownership or an 'edit' share. Binary files
live on disk (see src/attachments.py); this layer stores/serves metadata and
enforces permissions.
"""

import logging

from flask import Blueprint, jsonify, request, send_file
from flask_login import login_required, current_user

from src.models.note import Note, SharedNote, Attachment, db
from src import attachments as storage
from src.websocket_events import broadcast_note_update

logger = logging.getLogger(__name__)

attachment_bp = Blueprint('attachment', __name__)


def _get_note_with_access(note_id, require_edit=False):
    """Return (note, error_response). Enforces ownership or share access.

    If require_edit is True, a shared user must have 'edit' access. On failure
    returns (None, (json, status)); on success returns (note, None).
    """
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        share = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not share:
            return None, (jsonify({'error': 'Access denied'}), 403)
        if require_edit and share.access_level != 'edit':
            return None, (jsonify({'error': 'Access denied - edit permission required'}), 403)

    return note, None


@attachment_bp.route('/notes/<int:note_id>/attachments', methods=['GET'])
@login_required
def list_attachments(note_id):
    """List metadata for all attachments on a note (owner or any share)."""
    note, error = _get_note_with_access(note_id)
    if error:
        return error
    return jsonify([a.to_dict() for a in note.attachments])


@attachment_bp.route('/notes/<int:note_id>/attachments', methods=['POST'])
@login_required
def upload_attachment(note_id):
    """Upload a file to a note (owner or 'edit' share). Multipart field: 'file'."""
    note, error = _get_note_with_access(note_id, require_edit=True)
    if error:
        return error

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file_storage = request.files['file']
    if not file_storage or not file_storage.filename:
        return jsonify({'error': 'No file provided'}), 400

    mime_type = file_storage.mimetype
    # save_upload validates the type and size, raising InvalidInput -> 400.
    saved = storage.save_upload(note_id, file_storage, mime_type)

    attachment = Attachment(
        note_id=note_id,
        uploader_id=current_user.id,
        filename=saved['stored_filename'],
        original_filename=storage._sanitize_original_name(file_storage.filename),
        mime_type=mime_type,
        file_size=saved['file_size'],
        attachment_type=saved['attachment_type'],
    )
    db.session.add(attachment)

    # Bump the note's updated_at so attachment changes participate in sync.
    from datetime import datetime
    note.updated_at = datetime.utcnow()

    db.session.commit()

    try:
        broadcast_note_update(note_id, 'attachment_added', attachment.to_dict(), exclude_user=current_user.id)
    except Exception as e:
        logger.warning("Error broadcasting attachment_added: %s", e)

    return jsonify(attachment.to_dict()), 201


@attachment_bp.route('/notes/<int:note_id>/attachments/<int:attachment_id>', methods=['GET'])
@login_required
def download_attachment(note_id, attachment_id):
    """Stream an attachment's file (owner or any share)."""
    note, error = _get_note_with_access(note_id)
    if error:
        return error

    attachment = Attachment.query.filter_by(id=attachment_id, note_id=note_id).first_or_404()
    path = storage.get_file_path(note_id, attachment.filename)
    if not path:
        return jsonify({'error': 'File not found'}), 404

    return send_file(
        path,
        mimetype=attachment.mime_type,
        download_name=attachment.original_filename or attachment.filename,
    )


@attachment_bp.route('/notes/<int:note_id>/attachments/<int:attachment_id>', methods=['DELETE'])
@login_required
def delete_attachment(note_id, attachment_id):
    """Delete an attachment and its file (owner or 'edit' share)."""
    note, error = _get_note_with_access(note_id, require_edit=True)
    if error:
        return error

    attachment = Attachment.query.filter_by(id=attachment_id, note_id=note_id).first_or_404()
    stored_filename = attachment.filename

    db.session.delete(attachment)

    from datetime import datetime
    note.updated_at = datetime.utcnow()

    db.session.commit()

    # Remove the file only after the row is gone, so a failed commit doesn't
    # orphan the metadata pointing at a deleted file.
    storage.delete_file(note_id, stored_filename)

    try:
        broadcast_note_update(note_id, 'attachment_removed', {'attachment_id': attachment_id}, exclude_user=current_user.id)
    except Exception as e:
        logger.warning("Error broadcasting attachment_removed: %s", e)

    return '', 204
