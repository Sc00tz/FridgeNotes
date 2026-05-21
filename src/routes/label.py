"""Blueprint for label management and note-label association endpoints."""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from src.models.label import Label, NoteLabel, db
from src.models.note import Note, SharedNote
from sqlalchemy import or_, func

label_bp = Blueprint('label', __name__)


@label_bp.route('/labels', methods=['GET'])
@login_required
def get_labels():
    """Return all labels for the current user."""
    try:
        labels = Label.query.filter_by(user_id=current_user.id).order_by(Label.name).all()
        return jsonify([label.to_dict(include_hierarchy=True) for label in labels])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@label_bp.route('/labels', methods=['POST'])
@login_required
def create_label():
    """Create a new label for the current user."""
    try:
        data = request.json
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'error': 'Label name is required'}), 400
        
        # Check for duplicate label names for this user
        existing = Label.query.filter_by(
            user_id=current_user.id,
            name=name,
            parent_id=data.get('parent_id')
        ).first()
        
        if existing:
            return jsonify({'error': 'Label with this name already exists'}), 400
        
        # Validate parent_id if provided
        parent_id = data.get('parent_id')
        if parent_id:
            parent = Label.query.filter_by(id=parent_id, user_id=current_user.id).first()
            if not parent:
                return jsonify({'error': 'Invalid parent label'}), 400
        
        label = Label(
            name=name,
            color=data.get('color', '#3b82f6'),
            parent_id=parent_id,
            user_id=current_user.id
        )
        
        db.session.add(label)
        db.session.commit()
        
        return jsonify(label.to_dict(include_hierarchy=True)), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@label_bp.route('/labels/<int:label_id>', methods=['PUT'])
@login_required
def update_label(label_id):
    """Update a label's name, color, or parent."""
    try:
        label = Label.query.filter_by(id=label_id, user_id=current_user.id).first_or_404()
        data = request.json
        
        # Update fields if provided
        if 'name' in data:
            new_name = data['name'].strip()
            if not new_name:
                return jsonify({'error': 'Label name cannot be empty'}), 400
            
            # Check for duplicate names (excluding current label)
            existing = Label.query.filter(
                Label.user_id == current_user.id,
                Label.name == new_name,
                Label.parent_id == label.parent_id,
                Label.id != label_id
            ).first()
            
            if existing:
                return jsonify({'error': 'Label with this name already exists'}), 400
            
            label.name = new_name
        
        if 'color' in data:
            label.color = data['color']
        
        if 'parent_id' in data:
            parent_id = data['parent_id']
            if parent_id:
                # Validate parent exists and prevent circular references
                parent = Label.query.filter_by(id=parent_id, user_id=current_user.id).first()
                if not parent:
                    return jsonify({'error': 'Invalid parent label'}), 400
                
                # Check for circular reference
                if parent_id == label_id:
                    return jsonify({'error': 'A label cannot be its own parent'}), 400
                
                # Check if the parent is a descendant of current label (would create a cycle)
                def is_descendant(potential_parent, ancestor_id):
                    if potential_parent.parent_id == ancestor_id:
                        return True
                    if potential_parent.parent_id:
                        parent_label = Label.query.get(potential_parent.parent_id)
                        if parent_label:
                            return is_descendant(parent_label, ancestor_id)
                    return False
                
                if is_descendant(parent, label_id):
                    return jsonify({'error': 'Cannot create circular reference'}), 400
            
            label.parent_id = parent_id
        
        db.session.commit()
        return jsonify(label.to_dict(include_hierarchy=True))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@label_bp.route('/labels/<int:label_id>', methods=['DELETE'])
@login_required
def delete_label(label_id):
    """Delete a label and remove all its note associations."""
    try:
        label = Label.query.filter_by(id=label_id, user_id=current_user.id).first_or_404()
        
        # Remove all note associations
        NoteLabel.query.filter_by(label_id=label_id).delete()
        
        # Delete the label (cascading will handle children)
        db.session.delete(label)
        db.session.commit()
        
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@label_bp.route('/labels/search', methods=['GET'])
@login_required
def search_labels():
    """Search labels by name for autocomplete (query param: q)."""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify([])
        
        # Search in label names (case insensitive)
        labels = Label.query.filter(
            Label.user_id == current_user.id,
            Label.name.ilike(f'%{query}%')
        ).order_by(Label.name).limit(10).all()
        
        results = []
        for label in labels:
            results.append({
                'id': label.id,
                'name': label.name,
                'display_name': label.display_name,
                'full_name': label.full_name,
                'color': label.get_color(),
                'parent_id': label.parent_id
            })
        
        # Also include parent labels that match
        parent_labels = Label.query.filter(
            Label.user_id == current_user.id,
            Label.parent_id.is_(None),
            Label.name.ilike(f'%{query}%')
        ).order_by(Label.name).limit(5).all()
        
        for parent in parent_labels:
            if not any(r['id'] == parent.id for r in results):
                results.append({
                    'id': parent.id,
                    'name': parent.name,
                    'display_name': parent.display_name,
                    'full_name': parent.full_name,
                    'color': parent.get_color(),
                    'parent_id': parent.parent_id,
                    'is_parent': True
                })
        
        return jsonify(results[:10])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@label_bp.route('/notes/<int:note_id>/labels', methods=['POST'])
@login_required
def add_label_to_note(note_id):
    """Associate a label with a note."""
    try:
        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            from src.models.note import SharedNote
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403

        data = request.json
        label_id = data.get('label_id')

        if not label_id:
            return jsonify({'error': 'Label ID is required'}), 400

        label = Label.query.filter_by(id=label_id, user_id=current_user.id).first()
        if not label:
            return jsonify({'error': 'Label not found'}), 404

        existing = NoteLabel.query.filter_by(note_id=note_id, label_id=label_id).first()
        if existing:
            return jsonify(existing.to_dict()), 200

        note_label = NoteLabel(note_id=note_id, label_id=label_id)
        db.session.add(note_label)
        db.session.commit()

        return jsonify(note_label.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@label_bp.route('/notes/<int:note_id>/labels/<int:label_id>', methods=['DELETE'])
@login_required
def remove_label_from_note(note_id, label_id):
    """Remove a label association from a note."""
    try:
        note = Note.query.get_or_404(note_id)

        if note.user_id != current_user.id:
            from src.models.note import SharedNote
            shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user.id).first()
            if not shared_note or shared_note.access_level != 'edit':
                return jsonify({'error': 'Access denied'}), 403

        label = Label.query.filter_by(id=label_id, user_id=current_user.id).first()
        if not label:
            return jsonify({'error': f'Label {label_id} not found'}), 404

        note_label = NoteLabel.query.filter(
            NoteLabel.note_id == int(note_id),
            NoteLabel.label_id == int(label_id)
        ).first()

        if not note_label:
            return jsonify({'message': 'Label was not associated with note'}), 200

        association_id = note_label.id

        db.session.delete(note_label)
        db.session.flush()

        verify_check = NoteLabel.query.get(association_id)
        if verify_check:
            db.session.rollback()
            return jsonify({'error': 'Failed to delete association'}), 500

        db.session.commit()

        final_check = NoteLabel.query.filter(
            NoteLabel.note_id == int(note_id),
            NoteLabel.label_id == int(label_id)
        ).first()

        if final_check:
            return jsonify({'error': 'Association deletion failed - database inconsistency'}), 500

        try:
            from src.websocket_events import socketio
            socketio.emit('label_removed', {
                'note_id': note_id,
                'label_id': label_id
            }, room=f'user_{current_user.id}')
        except Exception:
            pass

        return '', 204

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@label_bp.route('/labels/<int:label_id>/notes', methods=['GET'])
@login_required
def get_notes_by_label(label_id):
    """Return all notes tagged with a specific label."""
    try:
        # Verify label ownership
        label = Label.query.filter_by(id=label_id, user_id=current_user.id).first_or_404()
        
        # Get notes with this label
        notes = Note.query.join(NoteLabel).filter(
            NoteLabel.label_id == label_id,
            or_(
                Note.user_id == current_user.id,  # User's own notes
                Note.id.in_(  # Or shared notes
                    db.session.query(SharedNote.note_id).filter_by(user_id=current_user.id)
                )
            )
        ).order_by(Note.updated_at.desc()).all()
        
        return jsonify([note.to_dict(current_user_id=current_user.id) for note in notes])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@label_bp.route('/labels/stats', methods=['GET'])
@login_required
def get_label_stats():
    """Return per-label note counts for the current user."""
    try:
        # Get label counts
        label_counts = db.session.query(
            Label.id,
            Label.name,
            Label.display_name,
            Label.color,
            func.count(NoteLabel.id).label('note_count')
        ).join(
            NoteLabel, Label.id == NoteLabel.label_id, isouter=True
        ).filter(
            Label.user_id == current_user.id
        ).group_by(Label.id).order_by(func.count(NoteLabel.id).desc()).all()
        
        results = []
        for label_id, name, display_name, color, count in label_counts:
            results.append({
                'id': label_id,
                'name': name,
                'display_name': display_name,
                'color': color,
                'note_count': count
            })
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
