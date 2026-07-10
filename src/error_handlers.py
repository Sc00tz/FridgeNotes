from flask import jsonify

def handle_404(err):
    """Handles 404 Not Found errors."""
    return jsonify({'error': 'Not Found'}), 404

def handle_403(err):
    """Handles 403 Forbidden errors."""
    return jsonify({'error': 'Forbidden'}), 403

def handle_500(err):
    """Handles 500 Internal Server Error."""
    return jsonify({'error': 'Internal Server Error'}), 500

def handle_permission_error(err):
    """Handles PermissionError exceptions."""
    return jsonify({'error': str(err)}), 403

def handle_invalid_input(err):
    """Handles InvalidInput (client-supplied data that failed validation) as a 400."""
    return jsonify({'error': str(err) or 'Invalid input'}), 400

def register_error_handlers(app):
    """Registers all error handlers with the Flask app."""
    from src.datetime_utils import InvalidInput
    app.register_error_handler(404, handle_404)
    app.register_error_handler(403, handle_403)
    app.register_error_handler(500, handle_500)
    app.register_error_handler(PermissionError, handle_permission_error)
    app.register_error_handler(InvalidInput, handle_invalid_input)
