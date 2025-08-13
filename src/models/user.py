from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    notes = db.relationship('Note', backref='user', lazy=True, cascade='all, delete-orphan')
    shared_notes = db.relationship('SharedNote', backref='user', lazy=True, cascade='all, delete-orphan')

    def __init__(self, username, email, password=None, is_admin=False):
        self.username = username
        self.email = email
        self.is_admin = is_admin
        if password:
            self.set_password(password)

    def set_password(self, password):
        """Hash and set the user's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if the provided password matches the user's password."""
        return check_password_hash(self.password_hash, password)

    def update_last_login(self):
        """Update the user's last login timestamp."""
        self.last_login = datetime.utcnow()
        db.session.commit()

    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary, optionally including sensitive fields."""
        user_dict = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
        
        if include_sensitive:
            user_dict['password_hash'] = self.password_hash
            
        return user_dict

    def to_public_dict(self):
        """Convert user to dictionary with only public information."""
        return {
            'id': self.id,
            'username': self.username,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @staticmethod
    def create_admin_user(username="admin", email="admin@example.com", password="admin123"):
        """Create an admin user if none exists."""
        existing_admin = User.query.filter_by(is_admin=True).first()
        if not existing_admin:
            admin_user = User(
                username=username,
                email=email,
                password=password,
                is_admin=True
            )
            db.session.add(admin_user)
            db.session.commit()
            return admin_user
        return existing_admin

    @staticmethod
    def get_by_username(username):
        """Get user by username."""
        return User.query.filter_by(username=username).first()

    @staticmethod
    def get_by_email(email):
        """Get user by email."""
        return User.query.filter_by(email=email).first()

    @staticmethod
    def get_by_username_or_email(identifier):
        """Get user by username or email."""
        return User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()

    def __repr__(self):
        return f'<User {self.username}>'