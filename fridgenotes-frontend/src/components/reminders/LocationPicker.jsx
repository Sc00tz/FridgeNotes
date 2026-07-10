import React, { useState, useEffect } from 'react';
import { MapPin, X, Crosshair, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '../../lib/api';

/**
 * Sets a location-based reminder on a note: latitude, longitude, radius (m),
 * and a human label. Supports "use my current location" via the browser
 * Geolocation API or manual entry. Geofence triggering itself is client/OS
 * work (mobile); this just captures the target the server stores.
 *
 * Reports changes via onLocationChange({ reminder_latitude, reminder_longitude,
 * reminder_radius, reminder_location_name }) — or nulls to clear.
 */
const DEFAULT_RADIUS = 150;

const LocationPicker = ({ note, onLocationChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [name, setName] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const hasLocation = note?.reminder_latitude != null && note?.reminder_longitude != null;

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setError(null);
    setSearching(true);
    setSearchResults([]);
    try {
      const results = await apiClient.geocode(q);
      if (!results.length) setError('No matching places found');
      setSearchResults(results);
    } catch (e) {
      setError(e.message || 'Location search failed');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r) => {
    setLat(r.latitude.toFixed(6));
    setLng(r.longitude.toFixed(6));
    // Use a short label: first segment of the display name (e.g. business or street).
    if (!name) setName((r.name || '').split(',')[0]);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Seed local fields from the note when it changes.
  useEffect(() => {
    setLat(note?.reminder_latitude != null ? String(note.reminder_latitude) : '');
    setLng(note?.reminder_longitude != null ? String(note.reminder_longitude) : '');
    setRadius(note?.reminder_radius || DEFAULT_RADIUS);
    setName(note?.reminder_location_name || '');
  }, [note?.reminder_latitude, note?.reminder_longitude, note?.reminder_radius, note?.reminder_location_name]);

  const useCurrentLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation not supported in this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError('Enter a valid latitude and longitude');
      return;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setError('Coordinates out of range');
      return;
    }
    onLocationChange({
      reminder_latitude: latNum,
      reminder_longitude: lngNum,
      reminder_radius: parseInt(radius, 10) || DEFAULT_RADIUS,
      reminder_location_name: name.trim() || null,
    });
    setIsOpen(false);
  };

  const clear = () => {
    onLocationChange({
      reminder_latitude: null,
      reminder_longitude: null,
      reminder_radius: null,
      reminder_location_name: null,
    });
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {hasLocation ? (
        <div className="flex items-center gap-2 p-2 rounded-md border border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/40 dark:text-green-300">
          <MapPin size={16} />
          <span className="text-sm font-medium">
            {note.reminder_location_name || `${note.reminder_latitude.toFixed(4)}, ${note.reminder_longitude.toFixed(4)}`}
            {note.reminder_radius ? ` · ${note.reminder_radius}m` : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="ml-auto h-6 px-2 text-xs hover:bg-green-100"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="h-6 w-6 p-0 hover:bg-red-100"
          >
            <X size={12} />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
        >
          <MapPin size={16} />
          Add location reminder
        </Button>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 p-4 bg-popover text-popover-foreground border rounded-lg shadow-lg min-w-[280px]">
          <div className="space-y-3">
            <h3 className="font-medium">Location Reminder</h3>

            {/* Address / business search */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Search address or place
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                    placeholder="e.g. Safeway, 123 Main St"
                    className="pl-7"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto border rounded-md divide-y">
                  {searchResults.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => pickResult(r)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/60"
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={useCurrentLocation}
              disabled={locating}
              className="w-full flex items-center gap-2"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
              Use my current location
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Latitude</label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="47.6062" inputMode="decimal" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Longitude</label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-122.3321" inputMode="decimal" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Label (optional)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Safeway" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Radius: {radius}m</label>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={save} className="flex-1">Save</Button>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
