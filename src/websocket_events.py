"""
WebSocket Event Handlers for FridgeNotes Real-time Collaboration

This module handles all WebSocket communication for real-time features:
- Note content synchronization across multiple clients
- User presence in note editing sessions  
- Checklist item toggling
- Note sharing notifications
- Drag-and-drop reordering

Architecture:
- Uses Flask-SocketIO for WebSocket support
- Room-based communication (one room per note)
- Connection tracking for user presence
- Broadcast helpers for API-triggered events
"""

from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
import json

# Initialize SocketIO instance with CORS enabled for cross-origin requests
socketio = SocketIO(cors_allowed_origins="*")

# Track active WebSocket connections and their associated data
# Structure: {session_id: {'user_id': int, 'notes': set(note_ids)}}
active_connections = {}

@socketio.on('connect')
def handle_connect():
    """
    Handle new WebSocket connection.
    
    Initializes connection tracking for the new client session.
    Each connection maintains user info and set of note rooms they're subscribed to.
    """
    print(f'Client {request.sid} connected')
    active_connections[request.sid] = {'user_id': None, 'notes': set()}

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle WebSocket disconnection and cleanup.
    
    Removes the client from all note rooms they were subscribed to
    and cleans up connection tracking data.
    """
    print(f'Client {request.sid} disconnected')
    if request.sid in active_connections:
        # Leave all note rooms this client was subscribed to
        for note_id in active_connections[request.sid]['notes']:
            leave_room(f'note_{note_id}')
        # Clean up connection data
        del active_connections[request.sid]

@socketio.on('join_note')
def handle_join_note(data):
    """Join a note room for real-time updates"""
    note_id = data['note_id']
    user_id = data['user_id']
    
    # Update user info
    if request.sid in active_connections:
        active_connections[request.sid]['user_id'] = user_id
        active_connections[request.sid]['notes'].add(note_id)
    
    # Join the note room
    join_room(f'note_{note_id}')
    emit('joined_note', {'note_id': note_id, 'message': f'Joined note {note_id}'})
    
    # Notify others in the room
    emit('user_joined', {
        'user_id': user_id,
        'note_id': note_id
    }, room=f'note_{note_id}', include_self=False)

@socketio.on('leave_note')
def handle_leave_note(data):
    """Leave a note room"""
    note_id = data['note_id']
    user_id = data['user_id']
    
    # Update connection info
    if request.sid in active_connections:
        active_connections[request.sid]['notes'].discard(note_id)
    
    # Leave the note room
    leave_room(f'note_{note_id}')
    emit('left_note', {'note_id': note_id, 'message': f'Left note {note_id}'})
    
    # Notify others in the room
    emit('user_left', {
        'user_id': user_id,
        'note_id': note_id
    }, room=f'note_{note_id}', include_self=False)

@socketio.on('note_updated')
def handle_note_updated(data):
    """Handle note content updates"""
    note_id = data['note_id']
    user_id = data['user_id']
    update_type = data.get('update_type', 'content')  # 'content', 'title', 'checklist_item'
    
    # Broadcast the update to all users in the note room except sender
    emit('note_update_received', {
        'note_id': note_id,
        'user_id': user_id,
        'update_type': update_type,
        'data': data.get('data', {})
    }, room=f'note_{note_id}', include_self=False)

@socketio.on('checklist_item_toggled')
def handle_checklist_item_toggled(data):
    """Handle checklist item toggle"""
    note_id = data['note_id']
    item_id = data['item_id']
    completed = data['completed']
    user_id = data['user_id']
    
    # Broadcast the toggle to all users in the note room except sender
    emit('checklist_item_toggle_received', {
        'note_id': note_id,
        'item_id': item_id,
        'completed': completed,
        'user_id': user_id
    }, room=f'note_{note_id}', include_self=False)

@socketio.on('note_shared')
def handle_note_shared(data):
    """Handle note sharing events"""
    note_id = data['note_id']
    shared_with_user_id = data['shared_with_user_id']
    access_level = data['access_level']
    
    # This could be used to notify the shared user in real-time
    # For now, we'll just broadcast to the note room
    emit('note_share_received', {
        'note_id': note_id,
        'shared_with_user_id': shared_with_user_id,
        'access_level': access_level
    }, room=f'note_{note_id}')

@socketio.on('notes_reordered')
def handle_notes_reordered(data):
    """Handle notes reordering events"""
    print(f'📋 Received notes_reordered event with data: {data}')
    
    user_id = data.get('user_id')
    note_ids = data.get('note_ids')
    
    if not user_id or not note_ids:
        print(f'❌ Invalid reorder data - user_id: {user_id}, note_ids: {note_ids}')
        return
    
    print(f'📋 User {user_id} reordered notes: {note_ids}')
    
    # Broadcast to all connected clients except the sender
    # This will update other tabs/devices of the same user
    print(f'📡 Broadcasting reorder event to all clients...')
    emit('notes_reorder_received', {
        'user_id': user_id,
        'note_ids': note_ids
    }, broadcast=True, include_self=False)
    print(f'✅ Broadcast completed')

def broadcast_note_update(note_id, update_type, data, exclude_user=None):
    """Helper function to broadcast updates from API endpoints"""
    socketio.emit('note_update_received', {
        'note_id': note_id,
        'update_type': update_type,
        'data': data
    }, room=f'note_{note_id}')

def broadcast_checklist_toggle(note_id, item_id, completed, user_id=None):
    """Helper function to broadcast checklist toggles from API endpoints"""
    socketio.emit('checklist_item_toggle_received', {
        'note_id': note_id,
        'item_id': item_id,
        'completed': completed,
        'user_id': user_id
    }, room=f'note_{note_id}')

def broadcast_notes_reorder(user_id, note_ids):
    """Helper function to broadcast notes reordering from API endpoints"""
    socketio.emit('notes_reorder_received', {
        'user_id': user_id,
        'note_ids': note_ids
    }, broadcast=True)

