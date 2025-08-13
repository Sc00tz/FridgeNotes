from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

# Import Note model for relationship - avoid circular import by importing after Label is defined
# We'll define the relationship in the Note model instead

class Label(db.Model):
    __tablename__ = 'labels'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), nullable=False, default='#3b82f6')  # Default blue
    parent_id = db.Column(db.Integer, db.ForeignKey('labels.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Self-referential relationship for hierarchical labels
    children = db.relationship('Label', backref=db.backref('parent', remote_side=[id]), lazy=True)
    
    # Note: The many-to-many relationship with notes is defined in the Note model to avoid circular imports
    
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
        """Get color, inheriting from parent if this label doesn't have one"""
        if self.color and self.color != '#3b82f6':  # Has custom color
            return self.color
        elif self.parent:  # Inherit from parent
            return self.parent.get_color()
        else:  # Use default
            return self.color
    
    def to_dict(self, include_hierarchy=False):
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
    __tablename__ = 'note_labels'
    
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('notes.id'), nullable=False)
    label_id = db.Column(db.Integer, db.ForeignKey('labels.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint to prevent duplicate label assignments
    __table_args__ = (db.UniqueConstraint('note_id', 'label_id', name='unique_note_label'),)
    
    def __repr__(self):
        return f'<NoteLabel {self.note_id}:{self.label_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'note_id': self.note_id,
            'label_id': self.label_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
