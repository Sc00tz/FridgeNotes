from functools import wraps
from flask import jsonify, request
from flask_login import current_user

def admin_required(f):
    """Decorator to require admin privileges"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not current_user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def active_user_required(f):
    """Decorator to require active user account"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not current_user.is_active:
            return jsonify({'error': 'Account is disabled'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def owner_or_admin_required(user_id_param='user_id'):
    """Decorator to require user to be owner of resource or admin"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({'error': 'Authentication required'}), 401
            
            if not current_user.is_active:
                return jsonify({'error': 'Account is disabled'}), 403
            
            # Get user_id from URL parameters or kwargs
            user_id = kwargs.get(user_id_param) or request.view_args.get(user_id_param)
            
            # Allow if user is admin or owns the resource
            if not current_user.is_admin and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def api_key_or_login_required(f):
    """Decorator for API endpoints that accept either login or API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for API key in headers (for future API key implementation)
        api_key = request.headers.get('X-API-Key')
        
        if api_key:
            # TODO: Implement API key validation
            # For now, just require login
            pass
        
        # Fall back to login requirement
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not current_user.is_active:
            return jsonify({'error': 'Account is disabled'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def validate_json_input(required_fields=None):
    """Decorator to validate JSON input and required fields"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'Request must be JSON'}), 400
            
            data = request.get_json()
            if data is None:
                return jsonify({'error': 'Invalid JSON'}), 400
            
            if required_fields:
                missing_fields = []
                for field in required_fields:
                    if field not in data or data[field] is None or data[field] == '':
                        missing_fields.append(field)
                
                if missing_fields:
                    return jsonify({
                        'error': f'Missing required fields: {", ".join(missing_fields)}'
                    }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def rate_limit_by_user(max_requests=100, window_seconds=3600):
    """Simple rate limiting by user (placeholder for future implementation)"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # TODO: Implement rate limiting logic
            # For now, just pass through
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_user_action(action_type):
    """Decorator to log user actions (placeholder for future implementation)"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # TODO: Implement action logging
            # For now, just pass through
            result = f(*args, **kwargs)
            
            # Could log to database or file here
            if current_user.is_authenticated:
                print(f"User {current_user.username} performed action: {action_type}")
            
            return result
        return decorated_function
    return decorator

def cors_preflight_handler(f):
    """Handle CORS preflight requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            return response
        
        return f(*args, **kwargs)
    return decorated_function