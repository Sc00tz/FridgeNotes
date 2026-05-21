"""Blueprint for user management endpoints (admin and self-service)."""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from src.models.user import User, db

user_bp = Blueprint('user', __name__)


@user_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    """Return all users (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


@user_bp.route('/users', methods=['POST'])
@login_required
def create_user():
    """Create a new user (admin only)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    data = request.json

    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if User.get_by_username(data['username']):
        return jsonify({'error': 'Username already exists'}), 409

    if User.get_by_email(data['email']):
        return jsonify({'error': 'Email already exists'}), 409

    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            is_admin=data.get('is_admin', False)
        )
        db.session.add(user)
        db.session.commit()
        return jsonify(user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create user'}), 500


@user_bp.route('/users/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    """Return a user's profile (own profile or any user for admins)."""
    if not current_user.is_admin and current_user.id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@user_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """Update a user's profile (own profile or any user for admins)."""
    if not current_user.is_admin and current_user.id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    user = User.query.get_or_404(user_id)
    data = request.json

    try:
        if 'username' in data:
            existing_user = User.get_by_username(data['username'])
            if existing_user and existing_user.id != user.id:
                return jsonify({'error': 'Username already exists'}), 409
            user.username = data['username']

        if 'email' in data:
            existing_user = User.get_by_email(data['email'])
            if existing_user and existing_user.id != user.id:
                return jsonify({'error': 'Email already exists'}), 409
            user.email = data['email']

        if 'password' in data and data['password']:
            user.set_password(data['password'])

        if current_user.is_admin:
            if 'is_admin' in data:
                user.is_admin = data['is_admin']
            if 'is_active' in data:
                user.is_active = data['is_active']

        db.session.commit()
        return jsonify(user.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user'}), 500


@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Delete a user account (admin only, cannot delete own account)."""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    if current_user.id == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    user = User.query.get_or_404(user_id)

    try:
        db.session.delete(user)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete user'}), 500


@user_bp.route('/users/me', methods=['GET'])
@login_required
def get_current_user():
    """Return the current user's profile."""
    return jsonify(current_user.to_dict())


@user_bp.route('/users/me', methods=['PUT'])
@login_required
def update_current_user():
    """Update the current user's profile."""
    data = request.json

    try:
        if 'username' in data:
            existing_user = User.get_by_username(data['username'])
            if existing_user and existing_user.id != current_user.id:
                return jsonify({'error': 'Username already exists'}), 409
            current_user.username = data['username']

        if 'email' in data:
            existing_user = User.get_by_email(data['email'])
            if existing_user and existing_user.id != current_user.id:
                return jsonify({'error': 'Email already exists'}), 409
            current_user.email = data['email']

        if 'password' in data and data['password']:
            current_user.set_password(data['password'])

        db.session.commit()
        return jsonify(current_user.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500