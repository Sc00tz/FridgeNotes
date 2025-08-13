"""
This blueprint handles all API endpoints related to notes.
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from src.models.note import Note, ChecklistItem, SharedNote, db
from src.models.user import User
from src.services.note_service import get_notes_for_user, create_note, update_note, delete_note
from src.websocket_events import broadcast_note_update, broadcast_checklist_toggle, broadcast_notes_reorder

note_bp = Blueprint('note', __name__)

@note_bp.route('/debug/auth', methods=['GET'])
@login_required
def debug_auth():
    """A debug endpoint to check the current user's authentication status."""
    return jsonify({
        'authenticated': True,
        'user_id': current_user.id,
        'username': current_user.username,
        'is_admin': current_user.is_admin
    })

@note_bp.route('/debug/schema', methods=['GET'])
@login_required
def debug_schema():
    """A debug endpoint to inspect the current database schema."""
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
        
        duplicate_tables = []
        for table in all_tables:
            if table.endswith('s') and table[:-1] in all_tables:
                duplicate_tables.append({'old': table[:-1], 'new': table})
        
        return jsonify({
            'shared_notes_columns': columns,
            'all_tables': all_tables,
            'has_migration_table': has_migration_table,
            'migration_history': migration_history,
            'duplicate_tables': duplicate_tables,
            'database_path': current_app.config.get('SQLALCHEMY_DATABASE_URI', 'Not set')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@note_bp.route('/notes', methods=['GET'])
@login_required
def get_all_notes():
    """Gets all notes for the current user."""
    notes = get_notes_for_user(current_user.id)
    return jsonify(notes)

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
    """Gets a single note by its ID."""
    note = Note.query.get_or_404(note_id)
    
    # Check if the user owns the note or has access through sharing.
    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note:
            return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(note.to_dict(current_user_id=current_user.id))

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
    """Update a checklist item"""
    note = Note.query.get_or_404(note_id)
    
    # Check permissions
    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note or shared_note.access_level != 'edit':
            return jsonify({'error': 'Access denied'}), 403
    
    item = ChecklistItem.query.filter_by(id=item_id, note_id=note_id).first_or_404()
    data = request.json
    
    old_completed = item.completed
    item.text = data.get('text', item.text)
    item.completed = data.get('completed', item.completed)
    
    db.session.commit()
    
    # Broadcast the checklist item update if completion status changed
    if 'completed' in data and old_completed != item.completed:
        broadcast_checklist_toggle(note_id, item_id, item.completed, current_user.id)
    
    return jsonify(item.to_dict())

@note_bp.route('/notes/<int:note_id>/share', methods=['POST'])
@login_required
def share_note(note_id):
    """Share a note with another user"""
    note = Note.query.get_or_404(note_id)
    
    # Only the owner can share
    if note.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.json
    
    # Check if user exists
    target_user = User.query.filter_by(username=data['username']).first()
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if already shared
    existing_share = SharedNote.query.filter_by(note_id=note_id, user_id=target_user.id).first()
    if existing_share:
        return jsonify({'error': 'Note already shared with this user'}), 400
    
    shared_note = SharedNote(
        note_id=note_id,
        user_id=target_user.id,
        access_level=data.get('access_level', 'read')
    )
    
    db.session.add(shared_note)
    db.session.commit()
    
    # Broadcast the sharing event
    broadcast_note_update(note_id, 'shared', {
        'shared_with': target_user.username,
        'access_level': shared_note.access_level
    })
    
    return jsonify(shared_note.to_dict()), 201

@note_bp.route('/notes/<int:note_id>/shares', methods=['GET'])
@login_required
def get_note_shares(note_id):
    """Get all shares for a note"""
    note = Note.query.get_or_404(note_id)
    
    # Check permissions
    if note.user_id != current_user.id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
        if not shared_note:
            return jsonify({'error': 'Access denied'}), 403
    
    shares = SharedNote.query.filter_by(note_id=note_id).all()
    return jsonify([share.to_dict() for share in shares])

@note_bp.route('/notes/<int:note_id>/shares/<int:share_id>', methods=['DELETE'])
@login_required
def unshare_note(note_id, share_id):
    """Remove a share"""
    note = Note.query.get_or_404(note_id)
    
    # Only the owner can unshare
    if note.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403
    
    share = SharedNote.query.filter_by(id=share_id, note_id=note_id).first_or_404()
    
    # Broadcast the unsharing event
    broadcast_note_update(note_id, 'unshared', {
        'unshared_from': share.user.username if hasattr(share, 'user') and share.user else 'Unknown'
    })
    
    db.session.delete(share)
    db.session.commit()
    
    return '', 204

# NEW ENDPOINT: Hide/Unhide shared notes
@note_bp.route('/notes/<int:note_id>/shares/<int:share_id>/hide', methods=['PUT'])
@login_required
def toggle_shared_note_visibility(note_id, share_id):
    """Toggle visibility of a shared note for the recipient"""
    # Find the share record
    share = SharedNote.query.filter_by(id=share_id, note_id=note_id).first_or_404()
    
    # Only the recipient can hide/unhide the note
    if share.user_id != current_user.id:
        return jsonify({'error': 'Access denied - you can only hide notes shared with you'}), 403
    
    data = request.json
    hidden = data.get('hidden', not share.hidden_by_recipient)  # Toggle if not specified
    
    share.hidden_by_recipient = hidden
    db.session.commit()
    
    return jsonify({
        'share_id': share.id,
        'note_id': note_id,
        'hidden': share.hidden_by_recipient,
        'message': 'Note hidden from your view' if hidden else 'Note restored to your view'
    })

# NEW ENDPOINT: Get hidden shared notes
@note_bp.route('/notes/hidden', methods=['GET'])
@login_required
def get_hidden_shared_notes():
    """Get all hidden shared notes for the current user"""
    user_id = current_user.id
    
    # Get hidden shared notes
    hidden_notes_query = db.session.query(Note).join(SharedNote).filter(
        SharedNote.user_id == user_id,
        SharedNote.hidden_by_recipient == True
    ).all()
    
    return jsonify([note.to_dict(current_user_id=current_user.id) for note in hidden_notes_query])

# NEW ENDPOINT: Reorder notes
@note_bp.route('/notes/reorder', methods=['PUT'])
@login_required
def reorder_notes():
    """Reorder notes for the current user"""
    data = request.json
    note_ids = data.get('note_ids', [])
    
    if not note_ids:
        return jsonify({'error': 'No note IDs provided'}), 400
    
    try:
        # Verify all notes belong to the current user
        user_notes = Note.query.filter(
            Note.id.in_(note_ids),
            Note.user_id == current_user.id
        ).all()
        
        if len(user_notes) != len(note_ids):
            return jsonify({'error': 'Some notes not found or access denied'}), 403
        
        # Update positions
        for position, note_id in enumerate(note_ids):
            note = next((n for n in user_notes if n.id == note_id), None)
            if note:
                note.position = position
        
        db.session.commit()
        
        # Broadcast reorder event
        try:
            broadcast_notes_reorder(current_user.id, note_ids)
        except Exception as e:
            print(f"Warning: Error broadcasting reorder: {e}")
        
        return jsonify({
            'message': 'Notes reordered successfully',
            'note_ids': note_ids
        })
        
    except Exception as e:
        print(f"Error in reorder_notes: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to reorder notes'}), 500

# NEW ENDPOINT: Pin/Unpin notes
@note_bp.route('/notes/<int:note_id>/pin', methods=['PUT'])
@login_required
def toggle_note_pin(note_id):
    """Toggle pin status of a note"""
    data = request.json
    pinned = data.get('pinned', None)
    
    if pinned is None:
        return jsonify({'error': 'pinned field is required'}), 400
    
    try:
        note = Note.query.get_or_404(note_id)
        
        # Check permissions - user must own the note or have edit access
        if note.user_id != current_user.id:
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403
        
        # Update the pinned status
        note.pinned = pinned
        db.session.commit()
        
        # Broadcast the pin change event
        try:
            from src.websocket_events import broadcast_note_update
            broadcast_note_update(note_id, 'pinned', {
                'pinned': pinned,
                'user_id': current_user.id
            })
        except Exception as e:
            print(f"Warning: Error broadcasting pin change: {e}")
        
        return jsonify({
            'note_id': note_id,
            'pinned': note.pinned,
            'message': 'Note pinned' if pinned else 'Note unpinned'
        })
        
    except Exception as e:
        print(f"Error in toggle_note_pin: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update note pin status'}), 500
