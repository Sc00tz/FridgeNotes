"""Label and NoteLabel models for the note tagging system."""

from datetime import datetime
from src.models.user import db


class Label(db.Model):
    """Hierarchical tag that can be applied to notes."""

    __tablename__ = 'labels'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    # NULL means "inherit from parent" (or the default when there is no parent),
    # which lets a label be deliberately set to any color, including the default.
    color = db.Column(db.String(20), nullable=True)
    DEFAULT_COLOR = '#3b82f6'
    parent_id = db.Column(db.Integer, db.ForeignKey('labels.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    children = db.relationship('Label', backref=db.backref('parent', remote_side=[id]), lazy=True)

    def __repr__(self):
        return f'<Label {self.id}: {self.name}>'
    
    @property
    def full_name(self):
        """Get the full hierarchical name like 'Work: Projects: Client A'"""
        if self.parent:
            return f"{self.parent.full_name}: {self.name}"
        return self.name
    
    @property
    def display_name(self):
        """Get display name for badges - shows parent: child or just name"""
        if self.parent:
            return f"{self.parent.name}: {self.name}"
        return self.name
    
    def get_color(self):
        """Resolve the effective color, inheriting from the parent when unset (NULL)."""
        if self.color:  # Explicitly set (any color, including the default blue)
            return self.color
        elif self.parent:  # Not set: inherit from parent
            return self.parent.get_color()
        else:  # Not set and no parent: fall back to the default
            return self.DEFAULT_COLOR
    
    def to_dict(self, include_hierarchy=False):
        """Serialize the label to a dict, optionally including parent/children."""
        result = {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'full_name': self.full_name,
            'color': self.get_color(),
            'parent_id': self.parent_id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_hierarchy:
            result.update({
                'parent': self.parent.to_dict() if self.parent else None,
                'children': [child.to_dict() for child in self.children],
                'children_count': len(self.children)
            })
        
        return result


class NoteLabel(db.Model):
    """Association table linking notes to labels (many-to-many)."""

    __tablename__ = 'note_labels'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    label_id = db.Column(db.Integer, db.ForeignKey('labels.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('note_id', 'label_id', name='unique_note_label'),)
    
    def __repr__(self):
        return f'<NoteLabel {self.note_id}:{self.label_id}>'
    
    def to_dict(self):
        """Serialize the note-label association to a dict."""
        return {
            'id': self.id,
            'note_id': self.note_id,
            'label_id': self.label_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
