"""Data models for notes, checklist items, and note sharing."""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Note(db.Model):
    """Note model supporting both plain text and interactive checklists."""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    content = db.Column(db.Text, nullable=True)
    note_type = db.Column(db.String(20), nullable=False, default='text')  # 'text' or 'checklist'
    color = db.Column(db.String(20), nullable=False, default='default')
    position = db.Column(db.Integer, nullable=False, default=0)
    pinned = db.Column(db.Boolean, nullable=False, default=False)
    archived = db.Column(db.Boolean, default=False)
    reminder_datetime = db.Column(db.DateTime, nullable=True)
    reminder_completed = db.Column(db.Boolean, default=False)
    reminder_snoozed_until = db.Column(db.DateTime, nullable=True)
    # Location-based reminder: geofence center, trigger radius (meters), and a
    # human-readable label. Geofence triggering is performed client-side; the
    # server only stores and serves these fields. reminder_completed is shared
    # with the time-based reminder above.
    reminder_latitude = db.Column(db.Float, nullable=True)
    reminder_longitude = db.Column(db.Float, nullable=True)
    reminder_radius = db.Column(db.Integer, nullable=True)
    reminder_location_name = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    checklist_items = db.relationship('ChecklistItem', backref='note', lazy=True, cascade='all, delete-orphan')
    shared_notes = db.relationship('SharedNote', backref='note', lazy=True, cascade='all, delete-orphan')
    labels = db.relationship('Label', secondary='note_labels', lazy=True)

    def __repr__(self):
        return f'<Note {self.id}: {self.title}>'

    def to_dict(self, current_user_id=None):
        """Serialize the note to a dict, optionally including per-user sharing details."""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'content': self.content,
            'note_type': self.note_type,
            'color': self.color,
            'position': self.position,
            'pinned': self.pinned,
            'archived': self.archived,
            'reminder_datetime': self.reminder_datetime.strftime('%Y-%m-%dT%H:%M:%S') if self.reminder_datetime else None,
            'reminder_completed': self.reminder_completed,
            'reminder_snoozed_until': self.reminder_snoozed_until.strftime('%Y-%m-%dT%H:%M:%S') if self.reminder_snoozed_until else None,
            'reminder_latitude': self.reminder_latitude,
            'reminder_longitude': self.reminder_longitude,
            'reminder_radius': self.reminder_radius,
            'reminder_location_name': self.reminder_location_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'checklist_items': [item.to_dict() for item in self.checklist_items] if self.note_type == 'checklist' else [],
            'labels': [label.to_dict() for label in self.labels]
        }

        if current_user_id:
            shared_with_user = next((s for s in self.shared_notes if s.user_id == current_user_id), None)

            if shared_with_user:
                result.update({
                    'is_shared': True,
                    'shared_with_current_user': True,
                    'current_user_share_id': shared_with_user.id,
                    'current_user_access_level': shared_with_user.access_level,
                    'hidden_by_current_user': shared_with_user.hidden_by_recipient
                })
            else:
                result.update({
                    'is_shared': len(self.shared_notes) > 0,
                    'shared_with_current_user': False,
                    'shares_count': len(self.shared_notes)
                })
        
        return result

class ChecklistItem(db.Model):
    """Individual item within a checklist-type note."""

    __tablename__ = 'checklist_items'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)
    category = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ChecklistItem {self.id}: {self.text}>'

    def to_dict(self):
        """Serialize the checklist item to a dict."""
        return {
            'id': self.id,
            'note_id': self.note_id,
            'text': self.text,
            'completed': self.completed,
            'order': self.order,
            'category': self.category,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SharedNote(db.Model):
    """Share record granting a user access to a note they do not own."""

    __tablename__ = 'shared_notes'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    access_level = db.Column(db.String(10), nullable=False, default='read')    # 'read' or 'edit'
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    hidden_by_recipient = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return f'<SharedNote {self.note_id} shared with {self.user_id}>'

    def to_dict(self):
        """Serialize the share record to a dict."""
        return {
            'id': self.id,
            'note_id': self.note_id,
            'user_id': self.user_id,
            'access_level': self.access_level,
            'shared_at': self.shared_at.isoformat() if self.shared_at else None,
            'hidden_by_recipient': self.hidden_by_recipient,
            'user': self.user.to_dict() if hasattr(self, 'user') and self.user else None
        }
