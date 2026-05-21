"""
WebSocket event handlers for FridgeNotes real-time collaboration.

Handles note content synchronization, user presence, checklist toggling,
note sharing notifications, and drag-and-drop reordering via Flask-SocketIO.
Room-based communication uses one room per user plus per-note rooms for presence.
"""

from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from flask_login import current_user


def _get_shared_user_ids(note_id):
    """Return list of user IDs that have access to note_id (owner + shared recipients)."""
    try:
        from src.models.note import Note, SharedNote
        note = Note.query.get(note_id)
        if not note:
            return []
        ids = [note.user_id]
        for share in note.shared_notes:
            ids.append(share.user_id)
        return ids
    except Exception:
        return []


socketio = SocketIO(cors_allowed_origins="*")

# Structure: {session_id: {'user_id': int, 'notes': set(note_ids)}}
active_connections = {}


def _authenticated_user_id():
    """Return the current user's ID from the session, or None if not authenticated."""
    if current_user and current_user.is_authenticated:
        return current_user.id
    return None


@socketio.on('connect')
def handle_connect():
    """Reject unauthenticated WebSocket connections and initialize connection tracking."""
    if not current_user.is_authenticated:
        return False  # Reject the connection
    active_connections[request.sid] = {'user_id': current_user.id, 'notes': set()}


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection, leaving all rooms and cleaning up tracking."""
    if request.sid in active_connections:
        for note_id in active_connections[request.sid]['notes']:
            leave_room(f'note_{note_id}')
        del active_connections[request.sid]


@socketio.on('join_user')
def handle_join_user(data):
    """Join the authenticated user's private room for general updates."""
    user_id = _authenticated_user_id()
    if not user_id:
        return

    if request.sid in active_connections:
        active_connections[request.sid]['user_id'] = user_id

    join_room(f'user_{user_id}')
    emit('joined_user', {'user_id': user_id})


@socketio.on('join_note')
def handle_join_note(data):
    """Join a note room for real-time presence and editing updates."""
    user_id = _authenticated_user_id()
    if not user_id:
        return

    note_id = data['note_id']

    if request.sid in active_connections:
        active_connections[request.sid]['notes'].add(note_id)

    join_room(f'note_{note_id}')
    emit('joined_note', {'note_id': note_id})
    emit('user_joined', {'user_id': user_id, 'note_id': note_id},
         room=f'note_{note_id}', include_self=False)


@socketio.on('leave_note')
def handle_leave_note(data):
    """Leave a note room and notify other participants."""
    user_id = _authenticated_user_id()
    note_id = data['note_id']

    if request.sid in active_connections:
        active_connections[request.sid]['notes'].discard(note_id)

    leave_room(f'note_{note_id}')
    emit('left_note', {'note_id': note_id})
    if user_id:
        emit('user_left', {'user_id': user_id, 'note_id': note_id},
             room=f'note_{note_id}', include_self=False)


@socketio.on('note_updated')
def handle_note_updated(data):
    """Fan out note content updates to all users with access, skipping the sender."""
    user_id = _authenticated_user_id()
    if not user_id:
        return

    note_id = data['note_id']
    update_type = data.get('update_type', 'content')

    payload = {
        'note_id': note_id,
        'user_id': user_id,
        'update_type': update_type,
        'data': data.get('data', {})
    }
    for uid in _get_shared_user_ids(note_id):
        if uid != user_id:
            socketio.emit('note_update_received', payload, room=f'user_{uid}')


@socketio.on('checklist_item_toggled')
def handle_checklist_item_toggled(data):
    """Fan out checklist item toggles to all users with access, skipping the sender."""
    user_id = _authenticated_user_id()
    if not user_id:
        return

    note_id = data['note_id']
    item_id = data['item_id']
    completed = data['completed']

    payload = {
        'note_id': note_id,
        'item_id': item_id,
        'completed': completed,
        'user_id': user_id
    }
    for uid in _get_shared_user_ids(note_id):
        if uid != user_id:
            socketio.emit('checklist_item_toggle_received', payload, room=f'user_{uid}')


@socketio.on('note_shared')
def handle_note_shared(data):
    """Broadcast note sharing events to the note room."""
    note_id = data['note_id']
    shared_with_user_id = data['shared_with_user_id']
    access_level = data['access_level']

    emit('note_share_received', {
        'note_id': note_id,
        'shared_with_user_id': shared_with_user_id,
        'access_level': access_level
    }, room=f'note_{note_id}')


@socketio.on('notes_reordered')
def handle_notes_reordered(data):
    """Broadcast note reorder events to all other clients of the same user."""
    user_id = _authenticated_user_id()
    note_ids = data.get('note_ids')

    if not user_id or not note_ids:
        return

    emit('notes_reorder_received', {
        'user_id': user_id,
        'note_ids': note_ids
    }, broadcast=True, include_self=False)


def broadcast_note_update(note_id, update_type, data, exclude_user=None):
    """Broadcast a note update to the owner and all users the note is shared with."""
    payload = {
        'note_id': note_id,
        'update_type': update_type,
        'data': data
    }
    for uid in _get_shared_user_ids(note_id):
        if uid != exclude_user:
            socketio.emit('note_update_received', payload, room=f'user_{uid}')


def broadcast_checklist_toggle(note_id, item_id, completed, user_id=None):
    """Broadcast a checklist toggle to the owner and all users the note is shared with."""
    payload = {
        'note_id': note_id,
        'item_id': item_id,
        'completed': completed,
        'user_id': user_id
    }
    for uid in _get_shared_user_ids(note_id):
        if uid != user_id:
            socketio.emit('checklist_item_toggle_received', payload, room=f'user_{uid}')


def broadcast_notes_reorder(user_id, note_ids):
    """Broadcast note reorder event to the user's room from API endpoints."""
    socketio.emit('notes_reorder_received', {
        'user_id': user_id,
        'note_ids': note_ids
    }, room=f'user_{user_id}')
