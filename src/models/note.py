"""Data models for notes, checklist items, and note sharing."""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Note(db.Model):
    """Note model supporting both plain text and interactive checklists."""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # Optional client-generated UUID for offline creation. Lets the client
    # reference a note before the server assigns an id, and makes create
    # idempotent so replaying a queued offline create doesn't duplicate.
    client_id = db.Column(db.String(64), nullable=True, index=True)
    title = db.Column(db.String(200), nullable=True)
    content = db.Column(db.Text, nullable=True)
    note_type = db.Column(db.String(20), nullable=False, default='text')  # 'text' or 'checklist'
    color = db.Column(db.String(20), nullable=False, default='default')
    position = db.Column(db.Integer, nullable=False, default=0)
    pinned = db.Column(db.Boolean, nullable=False, default=False)
    archived = db.Column(db.Boolean, default=False)
    # Private notes are PIN-gated: list/sync return the title but withhold the
    # content/items/attachments until the user unlocks the note with their PIN.
    is_private = db.Column(db.Boolean, nullable=False, default=False)
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
    attachments = db.relationship('Attachment', backref='note', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Note {self.id}: {self.title}>'

    def to_dict(self, current_user_id=None, redact=False):
        """Serialize the note to a dict, optionally including per-user sharing details.

        When ``redact`` is True (a private note the caller hasn't unlocked), the
        title and metadata are returned but the content, checklist items, and
        attachments are withheld so locked notes appear in lists without leaking
        their contents.
        """
        result = {
            'id': self.id,
            'client_id': self.client_id,
            'user_id': self.user_id,
            'title': self.title,
            'content': None if redact else self.content,
            'note_type': self.note_type,
            'color': self.color,
            'position': self.position,
            'pinned': self.pinned,
            'archived': self.archived,
            'is_private': self.is_private,
            'is_locked': redact,  # true means content was withheld pending unlock
            'reminder_datetime': self.reminder_datetime.strftime('%Y-%m-%dT%H:%M:%S') if self.reminder_datetime else None,
            'reminder_completed': self.reminder_completed,
            'reminder_snoozed_until': self.reminder_snoozed_until.strftime('%Y-%m-%dT%H:%M:%S') if self.reminder_snoozed_until else None,
            'reminder_latitude': self.reminder_latitude,
            'reminder_longitude': self.reminder_longitude,
            'reminder_radius': self.reminder_radius,
            'reminder_location_name': self.reminder_location_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'checklist_items': [] if redact else ([item.to_dict() for item in self.checklist_items] if self.note_type == 'checklist' else []),
            'labels': [label.to_dict() for label in self.labels],
            'attachments': [] if redact else [attachment.to_dict() for attachment in self.attachments]
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


class Attachment(db.Model):
    """File attached to a note (image or audio). The binary lives on disk; this
    row holds only metadata. Deleting a note cascades to its attachment rows;
    the on-disk files are removed by the delete/service layer."""

    __tablename__ = 'attachments'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # Sanitized name used on disk (unique per note); original name kept for display.
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False, default=0)
    attachment_type = db.Column(db.String(10), nullable=False)  # 'image' or 'audio'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Attachment {self.id}: {self.original_filename}>'

    def to_dict(self):
        """Serialize the attachment metadata to a dict. Includes a download URL."""
        return {
            'id': self.id,
            'note_id': self.note_id,
            'uploader_id': self.uploader_id,
            'filename': self.original_filename or self.filename,
            'mime_type': self.mime_type,
            'file_size': self.file_size,
            'attachment_type': self.attachment_type,
            'url': f'/api/notes/{self.note_id}/attachments/{self.id}',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class DeletedNote(db.Model):
    """Tombstone recording that a note was deleted, per affected user.

    Delta-sync (GET /api/sync) returns these so a client that was offline when
    a note was deleted learns to drop it locally. One row is written per user
    who had access at delete time (owner + share recipients), because access is
    otherwise gone once the note row is removed.
    """

    __tablename__ = 'deleted_notes'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, nullable=False)  # not an FK: the note is gone
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    deleted_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (db.Index('idx_deleted_notes_user_deleted', 'user_id', 'deleted_at'),)

    def to_dict(self):
        return {
            'note_id': self.note_id,
            'deleted_at': self.deleted_at.strftime('%Y-%m-%dT%H:%M:%S') if self.deleted_at else None,
        }
