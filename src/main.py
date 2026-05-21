"""
FridgeNotes backend - Flask application entry point.

Initializes the database, runs migrations, creates the initial admin account,
and registers all route blueprints and WebSocket event handlers.
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

from src.limiter import limiter
from src.routes.user import user_bp
from src.routes.note import note_bp
from src.routes.auth import auth_bp
from src.routes.label import label_bp
from src.websocket_events import socketio
from src.error_handlers import register_error_handlers

def log_with_flush(message):
    """Print a message and flush stdout immediately (required for Docker log visibility)."""
    print(message)
    sys.stdout.flush()


app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

_secret_key = os.environ.get('SECRET_KEY')
_is_production = os.environ.get('FLASK_ENV') == 'production'
if not _secret_key:
    if _is_production:
        raise RuntimeError('SECRET_KEY environment variable must be set in production')
    _secret_key = 'dev_secret_key_not_for_production'
app.config['SECRET_KEY'] = _secret_key

# Restrict CORS to the configured origin; fall back to same-origin only.
_allowed_origin = os.environ.get('ALLOWED_ORIGIN', '')
CORS(app, supports_credentials=True, origins=[_allowed_origin] if _allowed_origin else [])

limiter.init_app(app)


@app.after_request
def after_request(response):
    """Add security and PWA headers to every response."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'

    if 'Service-Worker-Allowed' not in response.headers:
        response.headers['Service-Worker-Allowed'] = '/'

    return response


login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    """Load a user object from the session by ID."""
    return User.query.get(int(user_id))


try:
    socketio.init_app(app, cors_allowed_origins=[_allowed_origin] if _allowed_origin else [])
    log_with_flush("✅ SocketIO initialized successfully")
except Exception as e:
    log_with_flush(f"⚠️ SocketIO initialization failed: {e}")
    log_with_flush("App will continue without real-time features")

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(note_bp, url_prefix='/api')
app.register_blueprint(label_bp, url_prefix='/api')

register_error_handlers(app)

@app.route('/debug/pwa')
def debug_pwa():
    """Return debug information about PWA file availability (admin only)."""
    from flask_login import current_user
    if not current_user.is_authenticated or not current_user.is_admin:
        from flask import abort
        abort(403)
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


app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['SESSION_COOKIE_SECURE'] = _is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

db.init_app(app)

def generate_secure_password(length=10):
    """Generate a cryptographically secure random password with mixed character types.

    Args:
        length (int): Password length, minimum 3 (default: 10).

    Returns:
        str: Secure random password containing at least one uppercase, lowercase, and digit.
    """
    alphabet = string.ascii_letters + string.digits

    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits)
    ]

    for _ in range(length - 3):
        password.append(secrets.choice(alphabet))

    secrets.SystemRandom().shuffle(password)

    return ''.join(password)

def create_initial_admin():
    """Create the initial admin user on first run; skipped if any users already exist.

    Returns:
        User: The newly created admin user, or None if users already exist.
    """
    try:
        user_count = User.query.count()

        if user_count == 0:
            admin_password = generate_secure_password(10)

            admin = User(
                username='admin',
                email='admin@fridgenotes.local',
                password=admin_password,
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()

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

    log_with_flush("👥 User accounts already exist - skipping admin creation")
    return None


def run_post_init_migrations():
    """Run schema migrations that depend on tables and data already being in place."""
    log_with_flush("🔄 Running post-initialization migrations...")

    try:
        from src.migrations import (
            run_migration_001_add_hidden_by_recipient,
            run_migration_002_add_color_field,
            run_migration_003_create_labels_system
        )

        migration_success = True

        if not run_migration_001_add_hidden_by_recipient():
            migration_success = False

        if not run_migration_002_add_color_field():
            migration_success = False

        if not run_migration_003_create_labels_system():
            migration_success = False

        if migration_success:
            log_with_flush("✅ Post-initialization migrations completed successfully!")
        else:
            log_with_flush("⚠️ Post-initialization migration had issues, but app will continue")

    except Exception as migration_error:
        log_with_flush(f"⚠️ Post-initialization migration warning: {migration_error}")
        log_with_flush("App will continue with fallback compatibility mode")


with app.app_context():
    try:
        log_with_flush("🚀 Initializing FridgeNotes during app creation...")

        log_with_flush("Creating database tables...")
        db.create_all()

        log_with_flush("Running database migrations...")
        try:
            from src.migrations import run_all_migrations
            run_all_migrations()
        except Exception as migration_error:
            log_with_flush(f"⚠️ Migration warning: {migration_error}")
            log_with_flush("App will continue with fallback compatibility mode")

        log_with_flush("Checking for admin user...")
        create_initial_admin()

        run_post_init_migrations()

        log_with_flush("✅ Initialization complete!")
    except Exception as e:
        log_with_flush(f"❌ Initialization error: {e}")


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve the React SPA, adding appropriate headers for PWA assets."""
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        response = send_from_directory(static_folder_path, path)

        if path.endswith('.webmanifest'):
            response.headers['Content-Type'] = 'application/manifest+json'
            response.headers['Cache-Control'] = 'no-cache'
        elif path.endswith('sw.js') or path.endswith('registerSW.js'):
            response.headers['Content-Type'] = 'application/javascript'
            response.headers['Cache-Control'] = 'no-cache'
            response.headers['Service-Worker-Allowed'] = '/'
        elif path.startswith('pwa-') and path.endswith('.png'):
            response.headers['Cache-Control'] = 'public, max-age=31536000'  # 1 year

        return response
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    is_production = os.environ.get('FLASK_ENV') == 'production'

    if is_production:
        log_with_flush("🐳 Starting in production mode...")
        socketio.run(app, host='0.0.0.0', port=5009, debug=False, allow_unsafe_werkzeug=True)
    else:
        log_with_flush("🔧 Starting in development mode...")
        app.run(host='0.0.0.0', port=5009, debug=True)