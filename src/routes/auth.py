from flask import Blueprint, jsonify, request
from flask_login import login_user, logout_user, login_required, current_user
from src.models.user import User, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    
    # Validate required fields
    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400
    
    # Validate password length
    if len(data['password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long'}), 400
    
    # Check if user already exists
    if User.get_by_username(data['username']):
        return jsonify({'error': 'Username already exists'}), 409
    
    if User.get_by_email(data['email']):
        return jsonify({'error': 'Email already exists'}), 409
    
    try:
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            is_admin=False  # New users are not admins by default
        )
        db.session.add(user)
        db.session.commit()
        
        # Automatically log in the new user
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
def login():
    """Log in a user"""
    data = request.json
    
    # Validate required fields
    if not data.get('username') and not data.get('email'):
        return jsonify({'error': 'Username or email is required'}), 400
    
    if not data.get('password'):
        return jsonify({'error': 'Password is required'}), 400
    
    # Find user by username or email
    identifier = data.get('username') or data.get('email')
    user = User.get_by_username_or_email(identifier)
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if user is active
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 401
    
    # Verify password
    if not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Log in user
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
    """Log out the current user"""
    logout_user()
    return jsonify({'message': 'Logout successful'})

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current authenticated user"""
    return jsonify({
        'user': current_user.to_dict(),
        'authenticated': True
    })

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict()
        })
    else:
        return jsonify({
            'authenticated': False,
            'user': None
        })

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change current user's password"""
    data = request.json
    
    # Validate required fields
    if not data.get('current_password') or not data.get('new_password'):
        return jsonify({'error': 'Current password and new password are required'}), 400
    
    # Validate new password length
    if len(data['new_password']) < 6:
        return jsonify({'error': 'New password must be at least 6 characters long'}), 400
    
    # Verify current password
    if not current_user.check_password(data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    try:
        # Update password
        current_user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to change password'}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset (placeholder for future implementation)"""
    data = request.json
    
    if not data.get('email'):
        return jsonify({'error': 'Email is required'}), 400
    
    user = User.get_by_email(data['email'])
    
    # Always return success to prevent email enumeration
    return jsonify({
        'message': 'If an account with that email exists, password reset instructions have been sent'
    })

@auth_bp.route('/admin/users', methods=['GET'])
@login_required
def admin_get_users():
    """Get all users (admin only)"""
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
    """Toggle user active status (admin only)"""
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
    """Toggle user admin status (admin only)"""
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