/**
 * PacIOOS ROMS Hawaii Regional ocean current data.
 * Data source: ERDDAP griddap roms_hiig_assimilation
 *
 * Variables:
 *   u_eastward  - eastward sea water velocity (m/s)
 *   v_northward - northward sea water velocity (m/s)
 *
 * Coordinate notes:
 *   - Longitude is -180/180 format: Lanai = -156.92
 *   - Latitude: Lanai = 20.83
 *   - Resolution: ~4 km, 3-hourly
 *   - Depth: surface layer (index 0)
 */

import { API_BASE } from './config.js';

// Bounding box around Lanai (wider than swell to capture surrounding currents)
const LAT_MIN = 20.6;
const LAT_MAX = 21.1;
const LON_MIN = -157.1;
const LON_MAX = -156.7;

// Client-side cache (6 hours, ROMS assimilation updates infrequently)
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 6 * 3600_000;

/**
 * Fetch latest surface currents from PacIOOS ROMS.
 * Returns array of { lat, lon, u, v, speed, direction }
 */
export async function fetchCurrents() {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return cache.data;
  }

  const vars = ['u_eastward', 'v_northward'];
  const timeRange = '(last)';
  const depth = '(0)';
  const latRange = `(${LAT_MIN}):(${LAT_MAX})`;
  const lonRange = `(${LON_MIN}):(${LON_MAX})`;

  const fields = vars.map(v =>
    `${v}[${timeRange}][${depth}][${latRange}][${lonRange}]`
  ).join(',');

  const url = `${API_BASE}/api/erddap/griddap/roms_hiig_assimilation.csv?${fields}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ERDDAP ROMS error: ${res.status}`);

  const text = await res.text();
  const parsed = parseCurrentsCsv(text);

  cache = { data: parsed, timestamp: now };
  return parsed;
}

/**
 * Parse ERDDAP CSV response for current vectors.
 * First row: column headers
 * Second row: units
 * Remaining rows: data
 */
function parseCurrentsCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 3) return [];

  const headers = lines[0].split(',');

  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const uIdx = headers.indexOf('u_eastward');
  const vIdx = headers.indexOf('v_northward');

  if (latIdx < 0 || lonIdx < 0 || uIdx < 0 || vIdx < 0) return [];

  const result = [];

  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < Math.max(latIdx, lonIdx, uIdx, vIdx) + 1) continue;

    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    const u = parseFloat(cols[uIdx]);
    const v = parseFloat(cols[vIdx]);

    if (isNaN(lat) || isNaN(lon) || isNaN(u) || isNaN(v)) continue;

    const speed = Math.sqrt(u * u + v * v);
    // Direction current is flowing TO (oceanographic convention)
    const direction = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;

    result.push({ lat, lon, u, v, speed, direction });
  }

  return result;
}
