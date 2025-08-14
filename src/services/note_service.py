"""
This service handles the business logic for notes.

It provides functions to get, create, update, and delete notes,
handling all database interactions and business rules.
"""

from src.models.note import Note, ChecklistItem, SharedNote, db
from src.models.user import User
from src.websocket_events import broadcast_note_update, broadcast_checklist_toggle, broadcast_notes_reorder
from sqlalchemy.orm import joinedload, subqueryload

def get_notes_for_user(user_id):
    """Gets all notes for a given user, including shared notes.

    Args:
        user_id: The ID of the user to fetch notes for.

    Returns:
        A list of note dictionaries.
    """
    # Get user's own notes, ordered by pinned status first, then by position.
    own_notes = Note.query.options(
        subqueryload(Note.checklist_items),
        joinedload(Note.labels),
        subqueryload(Note.shared_notes)
    ).filter_by(user_id=user_id).order_by(Note.pinned.desc(), Note.position.asc()).all()

    # Get notes shared with the user that they have not hidden.
    # This includes a fallback for older database schemas that may not have the
    # 'hidden_by_recipient' column yet.
    try:
        shared_notes_query = db.session.query(Note).options(
            subqueryload(Note.checklist_items),
            joinedload(Note.labels),
            subqueryload(Note.shared_notes)
        ).join(SharedNote).filter(
            SharedNote.user_id == user_id,
            SharedNote.hidden_by_recipient == False
        ).all()
    except Exception as e:
        print(f"Warning: Error filtering hidden shared notes, falling back to all shared notes: {e}")
        # Fallback for older schemas: get all shared notes.
        shared_note_ids = db.session.query(SharedNote.note_id).filter_by(user_id=user_id).all()
        shared_notes_query = Note.query.options(
            subqueryload(Note.checklist_items),
            joinedload(Note.labels),
            subqueryload(Note.shared_notes)
        ).filter(Note.id.in_([id[0] for id in shared_note_ids])).all()

    # Combine the user's own notes and shared notes, removing duplicates.
    all_notes = {note.id: note for note in own_notes + shared_notes_query}

    # Convert the note objects to dictionaries for the API response.
    return [note.to_dict(current_user_id=user_id) for note in all_notes.values()]

def create_note(user_id, data):
    """Creates a new note for a given user.

    Args:
        user_id: The ID of the user creating the note.
        data: A dictionary containing the note's data.

    Returns:
        The newly created note object.
    """
    # Determine the position for the new note.
    max_position = db.session.query(db.func.max(Note.position)).filter_by(user_id=user_id).scalar()
    next_position = (max_position or -1) + 1

    # Create the new note object.
    note = Note(
        user_id=user_id,
        title=data.get('title', ''),
        content=data.get('content', ''),
        note_type=data.get('note_type', 'text'),
        color=data.get('color', 'default'),
        position=next_position
    )

    db.session.add(note)
    db.session.flush()  # Flush to get the new note's ID.

    # If it's a checklist, create the checklist items.
    if note.note_type == 'checklist' and 'checklist_items' in data:
        for i, item_data in enumerate(data['checklist_items']):
            item = ChecklistItem(
                note_id=note.id,
                text=item_data['text'],
                completed=item_data.get('completed', False),
                order=i
            )
            db.session.add(item)

    # If labels are provided, associate them with the note.
    if 'label_ids' in data and data['label_ids']:
        from src.models.label import Label, NoteLabel
        for label_id in data['label_ids']:
            # Ensure the user owns the label before associating it.
            label = Label.query.filter_by(id=label_id, user_id=user_id).first()
            if label:
                note_label = NoteLabel(note_id=note.id, label_id=label_id)
                db.session.add(note_label)

    db.session.commit()

    # Notify connected clients about the new note.
    broadcast_note_update(note.id, 'created', note.to_dict(current_user_id=user_id))

    return note

def update_note(note_id, current_user_id, data):
    """Updates an existing note.

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

    # Check if the user has permission to update the note.
    if note.user_id != current_user_id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user_id).first()
        if not shared_note:
            raise PermissionError('Access denied')

        # Shared users with 'read' access can only archive/unarchive.
        is_archive_only = set(data.keys()) <= {'archived'}
        if not is_archive_only and shared_note.access_level != 'edit':
            raise PermissionError('Access denied - edit permission required')

    # Update the note's fields.
    note.title = data.get('title', note.title)
    note.content = data.get('content', note.content)
    note.color = data.get('color', note.color)
    note.pinned = data.get('pinned', note.pinned)
    note.archived = data.get('archived', note.archived)
    
    # Update reminder fields if provided
    if 'reminder_datetime' in data:
        from datetime import datetime
        if data['reminder_datetime']:
            # Parse ISO string as local time - frontend sends format like "2024-08-14T22:40:00"
            print(f"BACKEND DEBUG - Received reminder_datetime: '{data['reminder_datetime']}'")
            parsed_dt = datetime.fromisoformat(data['reminder_datetime'])
            print(f"BACKEND DEBUG - Parsed datetime object: {parsed_dt}")
            note.reminder_datetime = parsed_dt
            print(f"BACKEND DEBUG - Stored in note.reminder_datetime: {note.reminder_datetime}")
        else:
            note.reminder_datetime = None
    
    if 'reminder_completed' in data:
        note.reminder_completed = data.get('reminder_completed', note.reminder_completed)
    
    if 'reminder_snoozed_until' in data:
        from datetime import datetime
        if data['reminder_snoozed_until']:
            # Parse ISO string as local time
            note.reminder_snoozed_until = datetime.fromisoformat(data['reminder_snoozed_until'])
        else:
            note.reminder_snoozed_until = None

    # If it's a checklist, update the checklist items.
    if note.note_type == 'checklist' and 'checklist_items' in data:
        ChecklistItem.query.filter_by(note_id=note_id).delete()
        for i, item_data in enumerate(data['checklist_items']):
            item = ChecklistItem(
                note_id=note_id,
                text=item_data['text'],
                completed=item_data.get('completed', False),
                order=i
            )
            db.session.add(item)

    # If labels are provided, update the label associations.
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

    # Get the updated note as a dictionary.
    try:
        note_dict = note.to_dict(current_user_id=current_user_id)
    except Exception as e:
        print(f"Warning: Error getting note dict, using fallback: {e}")
        note_dict = note.to_dict()

    # Notify connected clients about the update.
    try:
        broadcast_note_update(note_id, 'updated', note_dict)
    except Exception as e:
        print(f"Warning: Error broadcasting update: {e}")

    return note

def delete_note(note_id, current_user_id):
    """Deletes a note.

    Args:
        note_id: The ID of the note to delete.
        current_user_id: The ID of the user requesting the deletion.

    Raises:
        PermissionError: If the user does not have permission to delete the note.
    """
    note = Note.query.get_or_404(note_id)

    # Only the owner of the note can delete it.
    if note.user_id != current_user_id:
        shared_note = SharedNote.query.filter_by(note_id=note_id, user_id=current_user_id).first()
        if shared_note:
            raise PermissionError('Cannot delete shared notes - only the owner can delete. Use "Hide from my view" instead.')
        else:
            raise PermissionError('Access denied - only the owner can delete this note')

    # Notify connected clients about the deletion.
    try:
        broadcast_note_update(note_id, 'deleted', {'id': note_id})
    except Exception as e:
        print(f"Warning: Error broadcasting deletion: {e}")

    db.session.delete(note)
    db.session.commit()
