"""Business logic for note operations including CRUD and real-time broadcast."""

import logging

from src.models.note import Note, ChecklistItem, SharedNote, db
from src.models.user import User
from src.websocket_events import broadcast_note_update, broadcast_checklist_toggle, broadcast_notes_reorder
from src.datetime_utils import parse_iso_datetime, InvalidInput
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy import and_, or_

logger = logging.getLogger(__name__)


def _apply_location_reminder(note, data):
    """Apply location-reminder fields from a request payload onto a note.

    Only keys present in ``data`` are touched, so partial updates leave other
    fields alone. Coordinates and radius are validated; passing an explicit
    null clears the field. Raises InvalidInput (-> HTTP 400) on bad values.
    """
    if 'reminder_latitude' in data:
        note.reminder_latitude = _validate_coordinate(data['reminder_latitude'], 'latitude', 90)
    if 'reminder_longitude' in data:
        note.reminder_longitude = _validate_coordinate(data['reminder_longitude'], 'longitude', 180)
    if 'reminder_radius' in data:
        note.reminder_radius = _validate_radius(data['reminder_radius'])
    if 'reminder_location_name' in data:
        name = data['reminder_location_name']
        note.reminder_location_name = name.strip()[:200] if isinstance(name, str) and name.strip() else None


def _validate_coordinate(value, label, limit):
    """Validate a latitude/longitude value; None clears it. Returns a float or None."""
    if value is None or value == '':
        return None
    try:
        coord = float(value)
    except (TypeError, ValueError):
        raise InvalidInput(f'Invalid {label}')
    if not -limit <= coord <= limit:
        raise InvalidInput(f'{label} out of range')
    return coord


def _validate_radius(value):
    """Validate a geofence radius in meters; None clears it. Returns an int or None."""
    if value is None or value == '':
        return None
    try:
        radius = int(value)
    except (TypeError, ValueError):
        raise InvalidInput('Invalid radius')
    if radius <= 0 or radius > 100000:  # cap at 100 km to reject nonsense values
        raise InvalidInput('radius out of range')
    return radius


def get_notes_for_user(user_id):
    """Return all notes for a user, including notes shared with them.

    Args:
        user_id: The ID of the user to fetch notes for.

    Returns:
        A list of note dictionaries.
    """
    try:
        notes_query = db.session.query(Note).options(
            selectinload(Note.checklist_items),
            joinedload(Note.labels),
            selectinload(Note.shared_notes)
        ).filter(
            or_(
                # User's own notes
                Note.user_id == user_id,
                # Notes shared with user (not hidden)
                and_(
                    Note.shared_notes.any(
                        and_(
                            SharedNote.user_id == user_id,
                            SharedNote.hidden_by_recipient == False
                        )
                    )
                )
            )
        ).order_by(Note.pinned.desc(), Note.position.asc()).all()

    except Exception as e:
        logger.warning("Error in optimized query, falling back to legacy method: %s", e)
        return _get_notes_for_user_legacy(user_id)

    return [note.to_dict(current_user_id=user_id, redact=note.is_private) for note in notes_query]


def _user_notes_access_filter(user_id):
    """SQLAlchemy filter matching notes a user can see (owned or shared, not hidden)."""
    return or_(
        Note.user_id == user_id,
        Note.shared_notes.any(
            and_(
                SharedNote.user_id == user_id,
                SharedNote.hidden_by_recipient == False
            )
        )
    )


def get_changes_for_user(user_id, since):
    """Return notes changed and notes deleted for a user since a timestamp.

    Args:
        user_id: The user syncing.
        since: A naive-UTC datetime; only rows changed strictly after this are
            returned. If None, all accessible notes are returned (initial sync).

    Returns:
        dict with 'changed' (list of note dicts), 'deleted' (list of note ids),
        and 'server_time' (ISO string) the client should store as its next
        'since' cursor.
    """
    from src.models.note import DeletedNote
    from datetime import datetime

    # Capture the cursor BEFORE querying. A row updated in the tiny window
    # between now and the query runs would then be re-sent on the next sync
    # (a harmless duplicate) rather than being missed entirely.
    server_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')

    changed_query = db.session.query(Note).options(
        selectinload(Note.checklist_items),
        joinedload(Note.labels),
        selectinload(Note.shared_notes),
        selectinload(Note.attachments),
    ).filter(_user_notes_access_filter(user_id))

    if since is not None:
        changed_query = changed_query.filter(Note.updated_at > since)

    changed = changed_query.order_by(Note.pinned.desc(), Note.position.asc()).all()

    deleted_ids = []
    if since is not None:
        # Tombstones only matter for incremental syncs; on a full sync the
        # absence of a note is enough for the client to know it's gone.
        deleted_rows = db.session.query(DeletedNote.note_id).filter(
            DeletedNote.user_id == user_id,
            DeletedNote.deleted_at > since,
        ).all()
        deleted_ids = [row[0] for row in deleted_rows]

    return {
        'changed': [note.to_dict(current_user_id=user_id, redact=note.is_private) for note in changed],
        'deleted': deleted_ids,
        'server_time': server_time,
    }


def _get_notes_for_user_legacy(user_id):
    """Fallback note query for older database schemas missing hidden_by_recipient."""
    own_notes = Note.query.options(
        selectinload(Note.checklist_items),
        joinedload(Note.labels),
        selectinload(Note.shared_notes)
    ).filter_by(user_id=user_id).order_by(Note.pinned.desc(), Note.position.asc()).all()

    shared_note_ids = db.session.query(SharedNote.note_id).filter_by(user_id=user_id).all()
    if shared_note_ids:
        shared_notes_query = Note.query.options(
            selectinload(Note.checklist_items),
            joinedload(Note.labels),
            selectinload(Note.shared_notes)
        ).filter(Note.id.in_([id[0] for id in shared_note_ids])).all()
    else:
        shared_notes_query = []

    all_notes = {note.id: note for note in own_notes + shared_notes_query}

    return [note.to_dict(current_user_id=user_id, redact=note.is_private) for note in all_notes.values()]


def create_note(user_id, data):
    """Create a new note for the given user.

    Args:
        user_id: The ID of the user creating the note.
        data: A dictionary containing the note's data.

    Returns:
        The newly created note object.
    """
    # Idempotent create: if the client supplied a client_id and a note with it
    # already exists for this user, return that note instead of creating a
    # duplicate. This makes replaying a queued offline create safe.
    client_id = data.get('client_id')
    if client_id:
        existing = Note.query.filter_by(user_id=user_id, client_id=client_id).first()
        if existing:
            return existing

    max_position = db.session.query(db.func.max(Note.position)).filter_by(user_id=user_id).scalar()
    next_position = (max_position or -1) + 1

    note = Note(
        user_id=user_id,
        client_id=client_id,
        title=data.get('title', ''),
        content=data.get('content', ''),
        note_type=data.get('note_type', 'text'),
        color=data.get('color', 'default'),
        position=next_position,
        is_private=bool(data.get('is_private', False))
    )

    # Reminder fields may be set at creation time, not just via update.
    if data.get('reminder_datetime'):
        note.reminder_datetime = parse_iso_datetime(data['reminder_datetime'])
    if 'reminder_completed' in data:
        note.reminder_completed = data.get('reminder_completed', False)
    if data.get('reminder_snoozed_until'):
        note.reminder_snoozed_until = parse_iso_datetime(data['reminder_snoozed_until'])

    _apply_location_reminder(note, data)

    db.session.add(note)
    db.session.flush()

    if note.note_type == 'checklist' and 'checklist_items' in data:
        for i, item_data in enumerate(data['checklist_items']):
            item = ChecklistItem(
                note_id=note.id,
                text=item_data['text'],
                completed=item_data.get('completed', False),
                order=i,
                category=item_data.get('category')
            )
            db.session.add(item)

    if 'label_ids' in data and data['label_ids']:
        from src.models.label import Label, NoteLabel
        for label_id in data['label_ids']:
            label = Label.query.filter_by(id=label_id, user_id=user_id).first()
            if label:
                note_label = NoteLabel(note_id=note.id, label_id=label_id)
                db.session.add(note_label)

    db.session.commit()

    broadcast_note_update(note.id, 'created', note.to_dict(current_user_id=user_id))

    return note


def update_note(note_id, current_user_id, data):
    """Update an existing note, enforcing ownership and share-level permissions.

    Args:
        note_id: The ID of the note to update.
        current_user_id: The ID of the user requesting the update.
        data: A dictionary containing the updated note data.

    Returns:
        The updated note object.

    Raises:
        PermissionError: If the user does not have permission to update the note.
    """
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user_id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user_id).first()
        if not shared_note:
            raise PermissionError('Access denied')

        # Shared users with 'read' access can only archive/unarchive.
        is_archive_only = set(data.keys()) <= {'archived', 'base_updated_at'}
        if not is_archive_only and shared_note.access_level != 'edit':
            raise PermissionError('Access denied - edit permission required')

    # Optimistic-concurrency check: if the client tells us which version its
    # edit was based on (base_updated_at) and the note has changed since, reject
    # so the caller can reconcile instead of silently clobbering the newer edit.
    # Opt-in: updates without base_updated_at are unaffected.
    base_updated_at = data.get('base_updated_at')
    if base_updated_at and note.updated_at:
        base = parse_iso_datetime(base_updated_at)
        # Compare at second resolution: to_dict serializes updated_at without
        # microseconds, so a client echoing that value must not false-conflict.
        if base and note.updated_at.replace(microsecond=0) > base.replace(microsecond=0):
            from src.exceptions import ConflictError
            raise ConflictError(
                'Note was modified elsewhere',
                current=note.to_dict(current_user_id=current_user_id),
            )

    note.title = data.get('title', note.title)
    note.content = data.get('content', note.content)
    note.color = data.get('color', note.color)
    note.pinned = data.get('pinned', note.pinned)
    note.archived = data.get('archived', note.archived)
    if 'is_private' in data:
        note.is_private = bool(data['is_private'])

    if 'reminder_datetime' in data:
        note.reminder_datetime = parse_iso_datetime(data['reminder_datetime'])

    if 'reminder_completed' in data:
        note.reminder_completed = data.get('reminder_completed', note.reminder_completed)

    if 'reminder_snoozed_until' in data:
        note.reminder_snoozed_until = parse_iso_datetime(data['reminder_snoozed_until'])

    _apply_location_reminder(note, data)

    if note.note_type == 'checklist' and 'checklist_items' in data:
        ChecklistItem.query.filter_by(note_id=note_id).delete()
        for i, item_data in enumerate(data['checklist_items']):
            item = ChecklistItem(
                note_id=note_id,
                text=item_data['text'],
                completed=item_data.get('completed', False),
                order=i,
                category=item_data.get('category')
            )
            db.session.add(item)

    if 'label_ids' in data:
        from src.models.label import Label, NoteLabel
        NoteLabel.query.filter_by(note_id=note_id).delete()
        if data['label_ids']:
            for label_id in data['label_ids']:
                label = Label.query.filter_by(id=label_id, user_id=current_user_id).first()
                if label:
                    note_label = NoteLabel(note_id=note_id, label_id=label_id)
                    db.session.add(note_label)

    db.session.commit()

    try:
        note_dict = note.to_dict(current_user_id=current_user_id)
    except Exception as e:
        logger.warning("Error getting note dict, using fallback: %s", e)
        note_dict = note.to_dict()

    try:
        broadcast_note_update(note_id, 'updated', note_dict)
    except Exception as e:
        logger.warning("Error broadcasting update: %s", e)

    return note


def delete_note(note_id, current_user_id):
    """Delete a note, restricted to the owner only.

    Args:
        note_id: The ID of the note to delete.
        current_user_id: The ID of the user requesting the deletion.

    Raises:
        PermissionError: If the user does not have permission to delete the note.
    """
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user_id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user_id).first()
        if shared_note:
            raise PermissionError('Cannot delete shared notes - only the owner can delete. Use "Hide from my view" instead.')
        else:
            raise PermissionError('Access denied - only the owner can delete this note')

    # Collect affected user IDs before deleting (relationships unavailable after commit).
    from src.websocket_events import _get_shared_user_ids
    affected_user_ids = _get_shared_user_ids(note_id)

    # Write a tombstone per affected user so clients that were offline during
    # the delete can discover it via delta-sync (GET /api/sync).
    from src.models.note import DeletedNote
    for uid in affected_user_ids:
        db.session.add(DeletedNote(note_id=note_id, user_id=uid))

    db.session.delete(note)
    db.session.commit()

    # The DB cascade removes attachment rows, but the on-disk files are ours to
    # clean up. Do this after commit so a failed delete doesn't lose files.
    try:
        from src import attachments as storage
        storage.delete_note_dir(note_id)
    except Exception as e:
        logger.warning("Error removing attachment files for note %s: %s", note_id, e)

    try:
        from src.websocket_events import socketio
        payload = {'note_id': note_id, 'update_type': 'deleted', 'data': {'id': note_id}}
        for uid in affected_user_ids:
            socketio.emit('note_update_received', payload, room=f'user_{uid}')
    except Exception as e:
        logger.warning("Error broadcasting deletion: %s", e)
