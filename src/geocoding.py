"""Address/business geocoding via OpenStreetMap Nominatim.

Proxied through the server (not called from the browser) so we can send the
User-Agent that Nominatim's usage policy requires, keep the browser talking
only to our own origin, and centralize rate limiting. No API key needed.

Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- A valid User-Agent identifying the app is required.
- Max ~1 request/second (enforced at the endpoint via Flask-Limiter).
"""

import json
import os
import urllib.parse
import urllib.request

from src.datetime_utils import InvalidInput

# Overridable so self-hosters can point at their own Nominatim instance.
NOMINATIM_URL = os.environ.get('NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search')
# Nominatim asks that the User-Agent identify the application and include a
# contact; overridable via env for deployments that want their own.
USER_AGENT = os.environ.get(
    'GEOCODER_USER_AGENT',
    'FridgeNotes/1.0 (self-hosted note app; https://github.com/Sc00tz/FridgeNotes)'
)
REQUEST_TIMEOUT = 8  # seconds
MAX_RESULTS = 5


def geocode(query):
    """Look up an address or place name, returning a list of location matches.

    Args:
        query: Free-text address or business/place name.

    Returns:
        A list of dicts: {name, latitude, longitude}. Empty if no matches.

    Raises:
        InvalidInput: If the query is blank.
        RuntimeError: If the geocoding service is unreachable or errors.
    """
    q = (query or '').strip()
    if not q:
        raise InvalidInput('Search query is required')

    params = urllib.parse.urlencode({
        'q': q,
        'format': 'jsonv2',
        'limit': MAX_RESULTS,
        'addressdetails': 1,
    })
    url = f'{NOMINATIM_URL}?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
    except Exception as e:
        raise RuntimeError(f'Geocoding service unavailable: {e}')

    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        raise RuntimeError('Geocoding service returned an invalid response')

    results = []
    for item in data if isinstance(data, list) else []:
        try:
            lat = float(item['lat'])
            lon = float(item['lon'])
        except (KeyError, TypeError, ValueError):
            continue
        results.append({
            'name': item.get('display_name', q),
            'latitude': lat,
            'longitude': lon,
        })
    return results
