/**
 * PacIOOS WaveWatch III Hawaii Regional swell forecast.
 * Data source: ERDDAP griddap ww3_hawaii
 *
 * Variables:
 *   Thgt  - total significant wave height (m)
 *   Tper  - total peak period (s)
 *   Tdir  - total peak direction (deg true)
 *
 * Coordinate notes:
 *   - Longitude is 0-360 format: Lanai = 203.08 (not -156.92)
 *   - Latitude: Lanai = 20.83
 *   - Resolution: 0.05 deg (~5.5 km), hourly
 */

import { API_BASE } from './config.js';

const LANAI_LAT = 20.83;
const LANAI_LON_360 = 203.08; // 360-format longitude

// Bounding box around Lanai (small area, ~2 grid cells each direction)
const LAT_MIN = 20.6;
const LAT_MAX = 21.0;
const LON_MIN = 202.8;
const LON_MAX = 203.4;

// Client-side cache (2 hours, since WW3 updates infrequently)
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 2 * 3600_000;

/**
 * Fetch 72h swell forecast from PacIOOS WW3 Hawaii model.
 * Returns array of { time: Date, height: number (ft), period: number (s), direction: number (deg) }
 */
export async function fetchSwellForecast() {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return cache.data;
  }

  const vars = ['Thgt', 'Tper', 'Tdir'];
  const timeRange = '(last-72hours):1:(last)';
  const depth = '(0.0)';
  const latRange = `(${LAT_MIN}):(${LAT_MAX})`;
  const lonRange = `(${LON_MIN}):(${LON_MAX})`;

  const fields = vars.map(v =>
    `${v}[${timeRange}]${depth}[${latRange}][${lonRange}]`
  ).join(',');

  const url = `${API_BASE}/api/erddap/griddap/ww3_hawaii.csv?${fields}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ERDDAP WW3 error: ${res.status}`);

  const text = await res.text();
  const parsed = parseErddapCsv(text);

  cache = { data: parsed, timestamp: now };
  return parsed;
}

/**
 * Parse ERDDAP CSV response.
 * First row: column headers
 * Second row: units
 * Remaining rows: data
 *
 * We average across the spatial grid to get a single value per timestep.
 */
function parseErddapCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 3) return [];

  const headers = lines[0].split(',');
  // Skip units row (lines[1])

  // Find column indices
  const timeIdx = headers.indexOf('time');
  const heightIdx = headers.indexOf('Thgt');
  const periodIdx = headers.indexOf('Tper');
  const dirIdx = headers.indexOf('Tdir');

  if (timeIdx < 0 || heightIdx < 0) return [];

  // Group by time, average spatial points
  const byTime = new Map();

  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < Math.max(timeIdx, heightIdx, periodIdx, dirIdx) + 1) continue;

    const timeStr = cols[timeIdx];
    const height = parseFloat(cols[heightIdx]);
    const period = periodIdx >= 0 ? parseFloat(cols[periodIdx]) : NaN;
    const dir = dirIdx >= 0 ? parseFloat(cols[dirIdx]) : NaN;

    if (isNaN(height)) continue;

    if (!byTime.has(timeStr)) {
      byTime.set(timeStr, { heights: [], periods: [], dirs: [] });
    }
    const entry = byTime.get(timeStr);
    entry.heights.push(height);
    if (!isNaN(period)) entry.periods.push(period);
    if (!isNaN(dir)) entry.dirs.push(dir);
  }

  const result = [];
  for (const [timeStr, { heights, periods, dirs }] of byTime) {
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const avgPeriod = periods.length ? periods.reduce((a, b) => a + b, 0) / periods.length : 0;
    const avgDir = dirs.length ? circularMean(dirs) : 0;

    result.push({
      time: new Date(timeStr),
      height: avgHeight * 3.28084, // meters to feet
      period: avgPeriod,
      direction: avgDir,
    });
  }

  // Sort by time
  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Circular mean for angles (degrees).
 */
function circularMean(angles) {
  let sinSum = 0, cosSum = 0;
  for (const a of angles) {
    const rad = a * Math.PI / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  const mean = Math.atan2(sinSum / angles.length, cosSum / angles.length) * 180 / Math.PI;
  return (mean + 360) % 360;
}
