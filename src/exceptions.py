"""Application-level exceptions mapped to HTTP responses in error_handlers."""


class ConflictError(Exception):
    """Raised when an update conflicts with concurrent server state (HTTP 409).

    Carries the current server representation of the resource so the client can
    reconcile (e.g. show the version it lost to).
    """

    def __init__(self, message='Conflict', current=None):
        super().__init__(message)
        self.current = current
