"""Blueprint for authentication endpoints: register, login, logout, and admin user management."""

import os

from flask import Blueprint, jsonify, request
from flask_login import login_user, logout_user, login_required, current_user
from src.models.user import User, db
from src.limiter import limiter

auth_bp = Blueprint('auth', __name__)


def registration_enabled():
    """Return True if public self-registration is enabled via ALLOW_REGISTRATION.

    Disabled by default; admins create accounts through the admin panel. Set
    ALLOW_REGISTRATION to a truthy value (1/true/yes/on) to allow self-signup.
    """
    return os.environ.get('ALLOW_REGISTRATION', '').strip().lower() in ('1', 'true', 'yes', 'on')


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('10 per hour')
def register():
    """Register a new user and log them in automatically."""
    if not registration_enabled():
        return jsonify({'error': 'Public registration is disabled'}), 403

    data = request.json

    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400

    # Generic message to prevent username/email enumeration
    if User.get_by_username(data['username']) or User.get_by_email(data['email']):
        return jsonify({'error': 'Username or email already in use'}), 409

    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            is_admin=False
        )
        db.session.add(user)
        db.session.commit()

        login_user(user, remember=True)
        user.update_last_login()

        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create account'}), 500


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('20 per minute;100 per hour')
def login():
    """Authenticate a user by username or email and start a session."""
    data = request.json

    if not data.get('username') and not data.get('email'):
        return jsonify({'error': 'Username or email is required'}), 400

    if not data.get('password'):
        return jsonify({'error': 'Password is required'}), 400

    identifier = data.get('username') or data.get('email')
    user = User.get_by_username_or_email(identifier)

    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 401

    if not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    remember_me = data.get('remember', False)
    login_user(user, remember=remember_me)
    user.update_last_login()

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict()
    })


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Log out the current user."""
    logout_user()
    return jsonify({'message': 'Logout successful'})


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Return the current authenticated user's profile."""
    return jsonify({
        'user': current_user.to_dict(),
        'authenticated': True
    })


@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Return authentication status for the current session and server auth config."""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict(),
            'registration_enabled': registration_enabled()
        })
    else:
        return jsonify({
            'authenticated': False,
            'user': None,
            'registration_enabled': registration_enabled()
        })


@auth_bp.route('/change-password', methods=['POST'])
@login_required
@limiter.limit('10 per hour')
def change_password():
    """Change the current user's password."""
    data = request.json

    if not data.get('current_password') or not data.get('new_password'):
        return jsonify({'error': 'Current password and new password are required'}), 400

    if len(data['new_password']) < 8:
        return jsonify({'error': 'New password must be at least 8 characters long'}), 400

    if not current_user.check_password(data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 401

    try:
        current_user.set_password(data['new_password'])
        db.session.commit()

        return jsonify({'message': 'Password changed successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to change password'}), 500


def _valid_pin(pin):
    """A PIN must be 4-12 digits."""
    return isinstance(pin, str) and pin.isdigit() and 4 <= len(pin) <= 12


@auth_bp.route('/private-pin', methods=['POST'])
@login_required
@limiter.limit('20 per hour')
def set_private_pin():
    """Set or change the current user's private-notes PIN.

    Setting the first PIN requires the account password. Changing an existing
    PIN requires the current PIN (or the account password as a recovery path).
    """
    data = request.json or {}
    new_pin = data.get('new_pin')

    if not _valid_pin(new_pin):
        return jsonify({'error': 'PIN must be 4-12 digits'}), 400

    # Authorize the change: password always works; current PIN works if one is set.
    authorized = False
    if data.get('password') and current_user.check_password(data['password']):
        authorized = True
    elif current_user.has_private_pin and data.get('current_pin') and current_user.check_private_pin(data['current_pin']):
        authorized = True

    if not authorized:
        msg = 'Current PIN or account password required' if current_user.has_private_pin else 'Account password required to set a PIN'
        return jsonify({'error': msg}), 401

    try:
        current_user.set_private_pin(new_pin)
        db.session.commit()
        return jsonify({'message': 'PIN set successfully', 'has_private_pin': True})
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to set PIN'}), 500


@auth_bp.route('/private-pin', methods=['GET'])
@login_required
def private_pin_status():
    """Return whether the current user has a private-notes PIN set."""
    return jsonify({'has_private_pin': current_user.has_private_pin})


@auth_bp.route('/admin/users', methods=['GET'])
@login_required
def admin_get_users():
    """Return all users (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    users = User.query.all()
    return jsonify({
        'users': [user.to_dict() for user in users],
        'total': len(users)
    })


@auth_bp.route('/admin/users/<int:user_id>/toggle-active', methods=['POST'])
@login_required
def admin_toggle_user_active(user_id):
    """Toggle a user's active status (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    if current_user.id == user_id:
        return jsonify({'error': 'Cannot modify your own account status'}), 400

    user = User.query.get_or_404(user_id)

    try:
        user.is_active = not user.is_active
        db.session.commit()

        return jsonify({
            'message': f'User {"activated" if user.is_active else "deactivated"} successfully',
            'user': user.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user status'}), 500


@auth_bp.route('/admin/users/<int:user_id>/toggle-admin', methods=['POST'])
@login_required
def admin_toggle_user_admin(user_id):
    """Toggle a user's admin role (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    if current_user.id == user_id:
        return jsonify({'error': 'Cannot modify your own admin status'}), 400

    user = User.query.get_or_404(user_id)

    try:
        user.is_admin = not user.is_admin
        db.session.commit()

        return jsonify({
            'message': f'User {"promoted to admin" if user.is_admin else "removed from admin"} successfully',
            'user': user.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user admin status'}), 500