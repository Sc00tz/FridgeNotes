"""
FridgeNotes Backend - Main Flask Application

This is the primary Flask application that serves as the backend for FridgeNotes,
a self-hosted note-taking application with real-time collaboration features.

Key Features:
- Real-time WebSocket communication for collaborative editing
- Automatic admin user creation with secure password generation
- RESTful API with proper error handling
- Database migrations and schema management
- PWA (Progressive Web App) support
- Session-based authentication with Flask-Login

Architecture:
- Flask backend with SQLAlchemy ORM
- WebSocket support via Flask-SocketIO
- Modular route blueprints for clean separation
- Automatic database initialization and migrations
"""

import os
import sys
import secrets
import string

# Path setup for proper module imports
# DON'T CHANGE THIS - Required for Docker and various deployment scenarios
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager

# Import models in the correct order to avoid circular imports
from src.models.user import db, User
# Import note models AFTER user model is loaded
from src.models.note import Note, ChecklistItem, SharedNote
# Import label models
from src.models.label import Label, NoteLabel

from src.routes.user import user_bp
from src.routes.note import note_bp
from src.routes.auth import auth_bp
from src.routes.label import label_bp
from src.websocket_events import socketio
from src.error_handlers import register_error_handlers

def log_with_flush(message):
    """Print message and force flush to ensure it appears in Docker logs"""
    print(message)
    sys.stdout.flush()

# Initialize Flask application with static folder for serving built frontend
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Security configuration - use environment variable in production
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_key')

# Enable Cross-Origin Resource Sharing for frontend-backend communication
# This allows the React frontend (running on different port in development) to communicate with Flask
CORS(app, supports_credentials=True)

# Add security headers for PWA behind proxy
@app.after_request
def after_request(response):
    # Add security headers for PWA
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Allow service worker to be registered from any scope
    if 'Service-Worker-Allowed' not in response.headers:
        response.headers['Service-Worker-Allowed'] = '/'
    
    return response

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Initialize SocketIO
try:
    socketio.init_app(app, cors_allowed_origins="*")
    log_with_flush("✅ SocketIO initialized successfully")
except Exception as e:
    log_with_flush(f"⚠️ SocketIO initialization failed: {e}")
    log_with_flush("📋 App will continue without real-time features")

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(note_bp, url_prefix='/api')
app.register_blueprint(label_bp, url_prefix='/api')

# Register error handlers
register_error_handlers(app)

# Debug endpoint for PWA files
@app.route('/debug/pwa')
def debug_pwa():
    """Debug endpoint to check PWA file availability"""
    import json
    debug_info = {
        'static_folder': app.static_folder,
        'files_exist': {},
        'manifest_content': None
    }
    
    pwa_files = ['manifest.webmanifest', 'sw.js', 'pwa-192x192.png', 'pwa-512x512.png']
    
    for file in pwa_files:
        file_path = os.path.join(app.static_folder, file)
        debug_info['files_exist'][file] = os.path.exists(file_path)
        if file == 'manifest.webmanifest' and os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    debug_info['manifest_content'] = json.load(f)
            except Exception as e:
                debug_info['manifest_content'] = f"Error reading manifest: {str(e)}"
    
    return debug_info

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Session configuration
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

db.init_app(app)

def generate_secure_password(length=10):
    """
    Generate a cryptographically secure random password for admin account creation.
    
    Uses Python's secrets module for cryptographic randomness. Ensures password complexity
    by including at least one uppercase letter, one lowercase letter, and one digit.
    
    Args:
        length (int): Password length, minimum 3 (default: 10)
        
    Returns:
        str: Secure random password meeting complexity requirements
    """
    # Character sets for password generation
    alphabet = string.ascii_letters + string.digits
    
    # Ensure password contains at least one of each required type
    password = [
        secrets.choice(string.ascii_uppercase),  # At least one uppercase
        secrets.choice(string.ascii_lowercase),  # At least one lowercase
        secrets.choice(string.digits)            # At least one digit
    ]
    
    # Fill remaining positions with random characters from full alphabet
    for _ in range(length - 3):
        password.append(secrets.choice(alphabet))
    
    # Shuffle the password to prevent predictable patterns (uppercase first, etc.)
    secrets.SystemRandom().shuffle(password)
    
    return ''.join(password)

def create_initial_admin():
    """
    Create initial admin user for first-time application setup.
    
    This function runs during application initialization to ensure there's always
    an admin account available. Only creates an admin if no users exist in the database.
    
    Security considerations:
    - Uses cryptographically secure password generation
    - Displays password prominently in logs for Docker/production environments
    - Password is only shown once and cannot be recovered
    
    Returns:
        User: Created admin user object, or None if users already exist
    """
    try:
        # Check if ANY users exist in the database
        user_count = User.query.count()
        
        if user_count == 0:
            # Generate a secure random password for the admin account
            admin_password = generate_secure_password(10)
            
            # Create the admin user
            admin = User(
                username='admin',
                email='admin@fridgenotes.local',
                password=admin_password,
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            
            # Display the credentials prominently in logs with forced flushing
            log_with_flush("=" * 80)
            log_with_flush("🔐 FridgeNotes - INITIAL ADMIN ACCOUNT CREATED")
            log_with_flush("=" * 80)
            log_with_flush(f"📧 Username: admin")
            log_with_flush(f"🔑 Password: {admin_password}")
            log_with_flush("=" * 80)
            log_with_flush("⚠️  IMPORTANT: Save this password! It will not be shown again.")
            log_with_flush("🛡️  You can change this password after logging in.")
            log_with_flush("👥 Create additional users through the admin panel.")
            log_with_flush("=" * 80)
            
            return admin
            
    except Exception as e:
        log_with_flush(f"❌ Error during admin creation: {e}")
        db.session.rollback()
        return None
    
    # Users already exist, don't create anything
    log_with_flush("👥 User accounts already exist - skipping admin creation")
    return None

def run_post_init_migrations():
    """Run migrations that need to happen after database tables are created"""
    log_with_flush("🔄 Running post-initialization migrations...")
    
    try:
        from src.migrations import (
            run_migration_001_add_hidden_by_recipient, 
            run_migration_002_add_color_field,
            run_migration_003_create_labels_system
        )
        
        # Try to run all post-initialization migrations
        migration_success = True
        
        if not run_migration_001_add_hidden_by_recipient():
            migration_success = False
        
        # Try to run the color field migration
        if not run_migration_002_add_color_field():
            migration_success = False
            
        # Try to run the labels system migration
        if not run_migration_003_create_labels_system():
            migration_success = False
        
        if migration_success:
            log_with_flush("✅ Post-initialization migrations completed successfully!")
        else:
            log_with_flush("⚠️ Post-initialization migration had issues, but app will continue")
            
    except Exception as migration_error:
        log_with_flush(f"⚠️ Post-initialization migration warning: {migration_error}")
        log_with_flush("📋 App will continue with fallback compatibility mode")

# Initialize immediately when the app is created
with app.app_context():
    try:
        log_with_flush("🚀 Initializing FridgeNotes during app creation...")
        
        # Create all database tables
        log_with_flush("📋 Creating database tables...")
        db.create_all()
        
        # Run automatic migrations
        log_with_flush("🔄 Running database migrations...")
        try:
            from src.migrations import run_all_migrations
            run_all_migrations()
        except Exception as migration_error:
            log_with_flush(f"⚠️ Migration warning: {migration_error}")
            log_with_flush("📝 App will continue with fallback compatibility mode")
        
        # Create initial admin user
        log_with_flush("👤 Checking for admin user...")
        create_initial_admin()
        
        # Run post-initialization migrations (after tables and data exist)
        run_post_init_migrations()
        
        log_with_flush("✅ Initialization complete!")
    except Exception as e:
        log_with_flush(f"❌ Initialization error: {e}")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        response = send_from_directory(static_folder_path, path)
        
        # Add PWA-specific headers
        if path.endswith('.webmanifest'):
            response.headers['Content-Type'] = 'application/manifest+json'
            response.headers['Cache-Control'] = 'no-cache'
        elif path.endswith('sw.js') or path.endswith('registerSW.js'):
            response.headers['Content-Type'] = 'application/javascript'
            response.headers['Cache-Control'] = 'no-cache'
            response.headers['Service-Worker-Allowed'] = '/'
        elif path.startswith('pwa-') and path.endswith('.png'):
            response.headers['Cache-Control'] = 'public, max-age=31536000'  # Cache icons for 1 year
        
        return response
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

if __name__ == '__main__':
    # This block only runs when started with "python src/main.py"
    # The initialization above handles other startup methods
    
    # Check if running in production (Docker container)
    is_production = os.environ.get('FLASK_ENV') == 'production'
    
    if is_production:
        log_with_flush("🐳 Starting in production mode...")
        # Production settings - allow unsafe werkzeug for containerized deployment
        socketio.run(app, host='0.0.0.0', port=5009, debug=False, allow_unsafe_werkzeug=True)
    else:
        log_with_flush("🔧 Starting in development mode...")
        # Development settings - use Flask's built-in server for Python 3.13 compatibility
        app.run(host='0.0.0.0', port=5009, debug=True)