"""Blueprint for all note-related API endpoints."""

import logging

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from src.models.note import Note, ChecklistItem, SharedNote, db
from src.models.user import User
from src.services.note_service import get_notes_for_user, create_note, update_note, delete_note, get_changes_for_user
from src.websocket_events import broadcast_note_update, broadcast_checklist_toggle, broadcast_notes_reorder
from src.datetime_utils import parse_iso_datetime, InvalidInput
from src.limiter import limiter
from datetime import datetime

logger = logging.getLogger(__name__)

note_bp = Blueprint('note', __name__)


@note_bp.route('/geocode', methods=['GET'])
@login_required
@limiter.limit('30 per minute;1 per second')
def geocode_address():
    """Look up an address or business name -> coordinates (for location reminders).

    Proxies OpenStreetMap Nominatim server-side (auth-only, rate-limited to
    respect its usage policy). Query param `q`. Returns a list of
    {name, latitude, longitude}.
    """
    from src.geocoding import geocode
    query = request.args.get('q', '')
    try:
        results = geocode(query)
    except InvalidInput:
        raise  # -> 400 via the registered handler
    except RuntimeError as e:
        logger.warning("Geocoding failed: %s", e)
        return jsonify({'error': 'Location search is temporarily unavailable'}), 503
    return jsonify(results)

@note_bp.route('/debug/auth', methods=['GET'])
@login_required
def debug_auth():
    """Return the current user's authentication status (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    return jsonify({
        'authenticated': True,
        'user_id': current_user.id,
        'username': current_user.username,
        'is_admin': current_user.is_admin
    })


@note_bp.route('/debug/schema', methods=['GET'])
@login_required
def debug_schema():
    """Return the current database schema and migration history (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    try:
        from sqlalchemy import text
        from flask import current_app

        result = db.session.execute(text("PRAGMA table_info(shared_notes)"))
        columns = [{'name': row[1], 'type': row[2], 'nullable': not row[3]} for row in result.fetchall()]

        result = db.session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        all_tables = [row[0] for row in result.fetchall()]

        has_migration_table = 'migration_history' in all_tables

        migration_history = []
        if has_migration_table:
            result = db.session.execute(text("SELECT * FROM migration_history ORDER BY applied_at"))
            migration_history = [{'id': row[0], 'name': row[1], 'applied_at': row[2]} for row in result.fetchall()]

        return jsonify({
            'shared_notes_columns': columns,
            'all_tables': all_tables,
            'has_migration_table': has_migration_table,
            'migration_history': migration_history,
            'database_path': current_app.config.get('SQLALCHEMY_DATABASE_URI', 'Not set')
        })
    except Exception as e:
        logger.exception('Error in debug_schema')
        return jsonify({'error': 'Internal server error'}), 500

@note_bp.route('/notes', methods=['GET'])
@login_required
def get_all_notes():
    """Gets all notes for the current user."""
    notes = get_notes_for_user(current_user.id)
    return jsonify(notes)


@note_bp.route('/sync', methods=['GET'])
@login_required
def sync_changes():
    """Delta-sync: return notes changed and deleted since the `since` timestamp.

    Query param `since` is an ISO datetime cursor (from a prior response's
    `server_time`); omit it for a full initial sync. Returns
    {changed: [...notes], deleted: [...note_ids], server_time: <cursor>}.
    """
    since_raw = request.args.get('since')
    since = parse_iso_datetime(since_raw) if since_raw else None
    return jsonify(get_changes_for_user(current_user.id, since))

@note_bp.route('/notes', methods=['POST'])
@login_required
def create_new_note():
    """Creates a new note."""
    data = request.json
    note = create_note(current_user.id, data)
    return jsonify(note.to_dict(current_user_id=current_user.id)), 201

@note_bp.route('/notes/<int:note_id>', methods=['GET'])
@login_required
def get_single_note(note_id):
    """Return a single note by ID, checking ownership or share access.

    Private notes are returned redacted (title only, content withheld); use
    POST /notes/<id>/unlock with the PIN to retrieve full content.
    """
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify(note.to_dict(current_user_id=current_user.id, redact=note.is_private))


@note_bp.route('/notes/<int:note_id>/unlock', methods=['POST'])
@login_required
@limiter.limit('20 per minute')
def unlock_note(note_id):
    """Return a private note's full content if the provided PIN verifies.

    Per-note unlock: the PIN is checked on every call and nothing is persisted
    server-side, so each open re-verifies. Rate-limited to deter brute force.
    """
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note:
            return jsonify({'error': 'Access denied'}), 403

    if not current_user.has_private_pin:
        return jsonify({'error': 'No PIN set'}), 400

    data = request.json or {}
    if not current_user.check_private_pin(data.get('pin', '')):
        return jsonify({'error': 'Incorrect PIN'}), 401

    # PIN verified — return the full (unredacted) note.
    return jsonify(note.to_dict(current_user_id=current_user.id, redact=False))

@note_bp.route('/notes/<int:note_id>', methods=['PUT'])
@login_required
def update_existing_note(note_id):
    """Updates a note."""
    data = request.json
    note = update_note(note_id, current_user.id, data)
    return jsonify(note.to_dict(current_user_id=current_user.id))

@note_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_existing_note(note_id):
    """Deletes a note."""
    delete_note(note_id, current_user.id)
    return '', 204

@note_bp.route('/notes/<int:note_id>/checklist-items/<int:item_id>', methods=['PUT'])
@login_required
def update_checklist_item(note_id, item_id):
    """Update a checklist item's text or completion state."""
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note or shared_note.access_level != 'edit':
            return jsonify({'error': 'Access denied'}), 403
    
    item = ChecklistItem.query.filter_by(id=item_id, note_id=note_id).first_or_404()
    data = request.json
    
    old_completed = item.completed
    item.text = data.get('text', item.text)
    item.completed = data.get('completed', item.completed)

    # Bump the parent note's updated_at: SQLAlchemy's onupdate only fires when a
    # column on the note row itself changes, so editing a child item alone would
    # otherwise leave updated_at stale and break updated_at-based sync/ordering.
    note.updated_at = datetime.utcnow()

    db.session.commit()
    
    # Broadcast the checklist item update if completion status changed
    if 'completed' in data and old_completed != item.completed:
        broadcast_checklist_toggle(note_id, item_id, item.completed, current_user.id)
    
    return jsonify(item.to_dict())

@note_bp.route('/notes/<int:note_id>/share', methods=['POST'])
@login_required
def share_note(note_id):
    """Share a note with another user by username."""
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.json or {}

    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    access_level = data.get('access_level', 'read')
    if access_level not in ('read', 'edit'):
        return jsonify({'error': "access_level must be 'read' or 'edit'"}), 400

    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    if target_user.id == current_user.id:
        return jsonify({'error': 'Cannot share a note with yourself'}), 400

    existing_share = SharedNote.query.filter_by(note_id=note_id, user_id=target_user.id).first()
    if existing_share:
        return jsonify({'error': 'Note already shared with this user'}), 400

    shared_note = SharedNote(
        note_id=note_id,
        user_id=target_user.id,
        access_level=access_level
    )

    db.session.add(shared_note)
    db.session.commit()

    broadcast_note_update(note_id, 'shared', {
        'shared_with': target_user.username,
        'access_level': shared_note.access_level
    })
    
    return jsonify(shared_note.to_dict()), 201

@note_bp.route('/notes/<int:note_id>/shares', methods=['GET'])
@login_required
def get_note_shares(note_id):
    """Return all share records for a note."""
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note:
            return jsonify({'error': 'Access denied'}), 403

    shares = SharedNote.query.filter_by(note_id=note_id).all()
    return jsonify([share.to_dict() for share in shares])


@note_bp.route('/notes/<int:note_id>/shares/<int:share_id>', methods=['DELETE'])
@login_required
def unshare_note(note_id, share_id):
    """Remove a share record, restricted to the note owner."""
    note = Note.query.get_or_404(note_id)

    if note.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    share = SharedNote.query.filter_by(id=share_id, note_id=note_id).first_or_404()

    broadcast_note_update(note_id, 'unshared', {
        'unshared_from': share.user.username if hasattr(share, 'user') and share.user else 'Unknown'
    })

    db.session.delete(share)
    db.session.commit()

    return '', 204


@note_bp.route('/notes/<int:note_id>/shares/<int:share_id>/hide', methods=['PUT'])
@login_required
def toggle_shared_note_visibility(note_id, share_id):
    """Toggle whether the current user has hidden a note shared with them."""
    share = SharedNote.query.filter_by(id=share_id, note_id=note_id).first_or_404()

    if share.user_id != current_user.id:
        return jsonify({'error': 'Access denied - you can only hide notes shared with you'}), 403

    data = request.json
    hidden = data.get('hidden', not share.hidden_by_recipient)

    share.hidden_by_recipient = hidden
    db.session.commit()

    return jsonify({
        'share_id': share.id,
        'note_id': note_id,
        'hidden': share.hidden_by_recipient,
        'message': 'Note hidden from your view' if hidden else 'Note restored to your view'
    })


@note_bp.route('/notes/hidden', methods=['GET'])
@login_required
def get_hidden_shared_notes():
    """Return all shared notes the current user has hidden."""
    user_id = current_user.id

    hidden_notes_query = db.session.query(Note).join(SharedNote).filter(
        SharedNote.user_id == user_id,
        SharedNote.hidden_by_recipient == True
    ).all()

    return jsonify([note.to_dict(current_user_id=current_user.id) for note in hidden_notes_query])


@note_bp.route('/notes/reorder', methods=['PUT'])
@login_required
def reorder_notes():
    """Update position of the current user's notes based on the provided order."""
    data = request.json
    note_ids = data.get('note_ids', [])

    if not note_ids:
        return jsonify({'error': 'No note IDs provided'}), 400

    try:
        user_notes = Note.query.filter(
            Note.id.in_(note_ids),
            Note.user_id == current_user.id
        ).all()

        if len(user_notes) != len(note_ids):
            return jsonify({'error': 'Some notes not found or access denied'}), 403

        for position, note_id in enumerate(note_ids):
            note = next((n for n in user_notes if n.id == note_id), None)
            if note:
                note.position = position

        db.session.commit()

        try:
            broadcast_notes_reorder(current_user.id, note_ids)
        except Exception as e:
            logger.warning("Error broadcasting reorder: %s", e)

        return jsonify({
            'message': 'Notes reordered successfully',
            'note_ids': note_ids
        })

    except Exception as e:
        logger.exception("Error in reorder_notes")
        db.session.rollback()
        return jsonify({'error': 'Failed to reorder notes'}), 500


@note_bp.route('/notes/<int:note_id>/pin', methods=['PUT'])
@login_required
def toggle_note_pin(note_id):
    """Set the pinned status of a note."""
    data = request.json
    pinned = data.get('pinned', None)

    if pinned is None:
        return jsonify({'error': 'pinned field is required'}), 400

    try:
        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403

        note.pinned = pinned
        db.session.commit()

        try:
            from src.websocket_events import broadcast_note_update
            broadcast_note_update(note_id, 'pinned', {
                'pinned': pinned,
                'user_id': current_user.id
            })
        except Exception as e:
            logger.warning("Error broadcasting pin change: %s", e)

        return jsonify({
            'note_id': note_id,
            'pinned': note.pinned,
            'message': 'Note pinned' if pinned else 'Note unpinned'
        })

    except Exception as e:
        logger.exception("Error in toggle_note_pin")
        db.session.rollback()
        return jsonify({'error': 'Failed to update note pin status'}), 500


@note_bp.route('/notes/<int:note_id>/reminder/complete', methods=['POST'])
@login_required
def complete_reminder(note_id):
    """Mark a note's reminder as completed and clear any active snooze."""
    try:
        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403

        note.reminder_completed = True
        note.reminder_snoozed_until = None
        db.session.commit()

        note_dict = note.to_dict(current_user_id=current_user.id)
        broadcast_note_update(note_id, 'reminder_completed', note_dict)

        return jsonify({
            'note_id': note_id,
            'reminder_completed': True,
            'message': 'Reminder marked as completed'
        })

    except Exception as e:
        logger.exception("Error in complete_reminder")
        db.session.rollback()
        return jsonify({'error': 'Failed to complete reminder'}), 500


@note_bp.route('/notes/<int:note_id>/reminder/snooze', methods=['POST'])
@login_required
def snooze_reminder(note_id):
    """Snooze a note's reminder until a specified ISO datetime."""
    try:
        data = request.json
        snooze_until = data.get('snooze_until')

        if not snooze_until:
            return jsonify({'error': 'snooze_until is required'}), 400

        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403

        try:
            snooze_datetime = parse_iso_datetime(snooze_until)
        except InvalidInput:
            return jsonify({'error': 'Invalid snooze_until datetime'}), 400

        note.reminder_snoozed_until = snooze_datetime
        db.session.commit()

        note_dict = note.to_dict(current_user_id=current_user.id)
        broadcast_note_update(note_id, 'reminder_snoozed', note_dict)

        return jsonify({
            'note_id': note_id,
            'reminder_snoozed_until': snooze_until,
            'message': f'Reminder snoozed until {snooze_datetime.strftime("%Y-%m-%d %H:%M")}'
        })

    except Exception as e:
        logger.exception("Error in snooze_reminder")
        db.session.rollback()
        return jsonify({'error': 'Failed to snooze reminder'}), 500


@note_bp.route('/notes/<int:note_id>/reminder/dismiss', methods=['POST'])
@login_required
def dismiss_reminder(note_id):
    """Dismiss a reminder notification for the current session without completing it."""
    try:
        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note:
                return jsonify({'error': 'Access denied'}), 403

        return jsonify({
            'note_id': note_id,
            'message': 'Reminder notification dismissed'
        })

    except Exception as e:
        logger.exception("Error in dismiss_reminder")
        return jsonify({'error': 'Failed to dismiss reminder'}), 500
