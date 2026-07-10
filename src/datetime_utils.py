"""Datetime parsing helpers.

The database stores naive datetimes in UTC (models default to ``datetime.utcnow``).
Client payloads may send ISO 8601 strings that are tz-aware (with a ``Z`` or offset)
or naive. To keep stored values and comparisons consistent, all incoming datetimes
are normalized to naive UTC before persistence.
"""

from datetime import datetime, timezone


class InvalidInput(Exception):
    """Client-supplied data that failed validation. Mapped to HTTP 400."""


def parse_iso_datetime(value):
    """Parse an ISO 8601 string into a naive UTC datetime.

    Accepts a trailing ``Z`` (Zulu/UTC) as well as explicit offsets. tz-aware
    inputs are converted to UTC and stripped of tzinfo so they can be compared
    with the naive UTC datetimes stored elsewhere. Returns None for empty input.

    Raises:
        InvalidInput: If the value is not a valid ISO 8601 datetime string. This
            surfaces as an HTTP 400 rather than a 500 (see error_handlers).
    """
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        if not isinstance(value, str):
            raise InvalidInput('Invalid datetime')
        raw = value[:-1] + '+00:00' if value.endswith('Z') else value
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            raise InvalidInput(f'Invalid datetime: {value!r}')

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

    return dt
