"""
FridgeNotes Database Models for Notes, Checklist Items, and Sharing

This module defines the core data models for the FridgeNotes application:
- Note: Primary content storage with support for text notes and checklists
- ChecklistItem: Individual checklist entries with completion tracking
- SharedNote: Note sharing permissions and visibility controls

Features:
- Rich note metadata (color, position, pinning, archiving)
- Reminder system with snooze functionality
- Hierarchical checklist items with ordering
- Flexible sharing with read/edit permissions and hiding
- Label system integration for organization
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Note(db.Model):
    """
    Main Note model supporting both text notes and checklists.
    
    Attributes:
        id: Primary key
        user_id: Owner of the note (foreign key to users table)
        title: Optional note title (can be empty for quick notes)
        content: Note text content (for text type notes)
        note_type: Either 'text' or 'checklist' determining note behavior
        color: Visual color theme for the note UI
        position: Sort order for drag-and-drop functionality  
        pinned: Whether note appears at top of list
        archived: Hidden from main view but not deleted
        reminder_datetime: When to show reminder notification
        reminder_completed: Whether user marked reminder as done
        reminder_snoozed_until: Temporary postponement of reminder
        created_at/updated_at: Automatic timestamps
        
    Relationships:
        checklist_items: Child checklist entries (for checklist type)
        shared_notes: Sharing permissions with other users
        labels: Tags/categories for organization
    """
    __tablename__ = 'notes'
    
    # Primary identification
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Content fields
    title = db.Column(db.String(200), nullable=True)                    # Optional title
    content = db.Column(db.Text, nullable=True)                        # Text content for 'text' notes
    note_type = db.Column(db.String(20), nullable=False, default='text')  # 'text' or 'checklist'
    
    # UI and organization
    color = db.Column(db.String(20), nullable=False, default='default')   # Visual theme
    position = db.Column(db.Integer, nullable=False, default=0)           # Drag & drop ordering
    pinned = db.Column(db.Boolean, nullable=False, default=False)         # Pin to top of list
    archived = db.Column(db.Boolean, default=False)                      # Hide from main view
    
    # Reminder system
    reminder_datetime = db.Column(db.DateTime, nullable=True)             # When to show reminder
    reminder_completed = db.Column(db.Boolean, default=False)            # User marked as done
    reminder_snoozed_until = db.Column(db.DateTime, nullable=True)       # Temporary postponement
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships with cascade delete for data integrity
    checklist_items = db.relationship('ChecklistItem', backref='note', lazy=True, cascade='all, delete-orphan')
    shared_notes = db.relationship('SharedNote', backref='note', lazy=True, cascade='all, delete-orphan')
    labels = db.relationship('Label', secondary='note_labels', lazy=True)

    def __repr__(self):
        return f'<Note {self.id}: {self.title}>'

    def to_dict(self, current_user_id=None):
        """
        Convert note to dictionary for API responses.
        
        Args:
            current_user_id: If provided, includes sharing information relevant to this user
            
        Returns:
            dict: Note data with all fields, including sharing permissions if applicable
        """
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'checklist_items': [item.to_dict() for item in self.checklist_items] if self.note_type == 'checklist' else [],
            'labels': [label.to_dict() for label in self.labels]
        }
        
        # Add sharing information if current_user_id is provided
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
    """
    Individual checklist item for checklist-type notes.
    
    Each checklist note can have multiple ChecklistItems that users can
    check off as completed. Items maintain order for consistent display
    and can be categorized by store sections for better shopping organization.
    
    Attributes:
        id: Primary key
        note_id: Parent note (foreign key, must be checklist type)  
        text: The checklist item content/description
        completed: Whether item is checked off by user
        order: Sort position within the checklist
        category: Store section category (Produce, Dairy, Meat, etc.)
        created_at: When item was added
    """
    __tablename__ = 'checklist_items'
    
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)                  # Position in checklist
    category = db.Column(db.String(50), nullable=True)        # Store section category
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ChecklistItem {self.id}: {self.text}>'

    def to_dict(self):
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
    """
    Note sharing permissions between users.
    
    Allows note owners to share their notes with other users with specific
    access levels. Recipients can hide shared notes from their view without
    affecting the sharing for other users.
    
    Attributes:
        id: Primary key
        note_id: The note being shared (foreign key)
        user_id: User receiving access (foreign key) 
        access_level: 'read' for view-only, 'edit' for modification rights
        shared_at: When sharing was granted
        hidden_by_recipient: Whether recipient chose to hide from their view
    """
    __tablename__ = 'shared_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    access_level = db.Column(db.String(10), nullable=False, default='read')     # 'read' or 'edit'
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    hidden_by_recipient = db.Column(db.Boolean, nullable=False, default=False)  # User-controlled visibility

    def __repr__(self):
        return f'<SharedNote {self.note_id} shared with {self.user_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'note_id': self.note_id,
            'user_id': self.user_id,
            'access_level': self.access_level,
            'shared_at': self.shared_at.isoformat() if self.shared_at else None,
            'hidden_by_recipient': self.hidden_by_recipient,  # NEW FIELD
            'user': self.user.to_dict() if hasattr(self, 'user') and self.user else None
        }
    
