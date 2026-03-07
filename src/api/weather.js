/**
 * NWS Weather API integration
 * Endpoint: api.weather.gov
 * Provides: wind speed/direction, precipitation, temperature
 *
 * The NWS API requires a User-Agent header (handled by Vite proxy in dev,
 * Lambda proxy in production).
 */

import { API_BASE, LANAI_LAT, LANAI_LON, MM_TO_IN } from './config.js';

let gridpointPromise = null;

/**
 * Resolve the NWS gridpoint for Lanai coordinates.
 * Caches the promise so concurrent callers share a single request.
 * Clears the cache on failure so the next call retries.
 */
async function getGridpoint() {
  if (!gridpointPromise) {
    gridpointPromise = (async () => {
      const res = await fetch(`${API_BASE}/api/weather/points/${LANAI_LAT},${LANAI_LON}`, {
        headers: { Accept: 'application/geo+json' },
      });
      if (!res.ok) throw new Error(`NWS points API error: ${res.status}`);

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('NWS points API returned non-JSON response');
      }
      const props = data.properties;
      if (!props || !props.gridId || props.gridX == null || props.gridY == null) {
        throw new Error('NWS points API returned unexpected response shape');
      }
      return { gridId: props.gridId, gridX: props.gridX, gridY: props.gridY };
    })().catch((err) => {
      gridpointPromise = null; // Allow retry on next call
      throw err;
    });
  }
  return gridpointPromise;
}

/**
 * Fetch hourly forecast for the next 48+ hours.
 * Returns array of {
 *   time: Date,
 *   windSpeedMph: number,
 *   windDirectionDeg: number,
 *   temperature: number,
 *   precipProbability: number,
 *   shortForecast: string,
 *   isRaining: boolean
 * }
 */
export async function fetchHourlyForecast() {
  const { gridId, gridX, gridY } = await getGridpoint();

  const res = await fetch(
    `${API_BASE}/api/weather/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`,
    { headers: { Accept: 'application/geo+json' } },
  );
  if (!res.ok) throw new Error(`NWS hourly forecast error: ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('NWS hourly forecast returned non-JSON response');
  }
  const periods = data.properties?.periods || [];

  return periods.map((p) => ({
    time: new Date(p.startTime),
    windSpeedMph: parseWindSpeed(p.windSpeed),
    windDirectionDeg: compassToDegrees(p.windDirection),
    temperature: p.temperature,
    temperatureUnit: p.temperatureUnit,
    precipProbability: p.probabilityOfPrecipitation?.value || 0,
    shortForecast: p.shortForecast,
    isRaining: isRainForecast(p.shortForecast),
    isDaytime: p.isDaytime,
  }));
}

/**
 * Fetch detailed grid data for precipitation amounts.
 * Returns { rain24h, rain48h }
 *
 * Note: currentlyRaining is derived from hourly forecast in fetchAllConditions
 * to avoid a redundant fetch of the hourly endpoint.
 */
export async function fetchPrecipitation() {
  const { gridId, gridX, gridY } = await getGridpoint();

  const res = await fetch(`${API_BASE}/api/weather/gridpoints/${gridId}/${gridX},${gridY}`, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NWS gridpoint data error: ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('NWS gridpoint data returned non-JSON response');
  }
  const precip = data.properties?.quantitativePrecipitation?.values || [];

  const now = Date.now();
  const h24 = now - 24 * 3600000;
  const h48 = now - 48 * 3600000;

  let rain24h = 0;
  let rain48h = 0;

  for (const v of precip) {
    if (!v.validTime || typeof v.validTime !== 'string') continue;
    const t = new Date(v.validTime.split('/')[0]).getTime();
    if (isNaN(t)) continue; // Skip malformed timestamps
    const amount = (v.value || 0) / MM_TO_IN;
    if (t >= h24) rain24h += amount;
    if (t >= h48) rain48h += amount;
  }

  return { rain24h, rain48h };
}

/**
 * Get current wind conditions from the latest hourly forecast period.
 */
export async function fetchCurrentWind() {
  const hourly = await fetchHourlyForecast();
  const current = hourly[0];
  if (!current) throw new Error('No current forecast data');
  return {
    speedMph: current.windSpeedMph,
    directionDeg: current.windDirectionDeg,
    forecast: current.shortForecast,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseWindSpeed(windStr) {
  // "15 mph" or "10 to 15 mph"
  if (!windStr) return 0;
  const matches = windStr.match(/(\d+)/g);
  if (!matches) return 0;
  const nums = matches.map(Number);
  return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
}

const COMPASS_MAP = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

function compassToDegrees(dir) {
  return COMPASS_MAP[dir] ?? 0;
}

function isRainForecast(forecast) {
  if (!forecast) return false;
  const lower = forecast.toLowerCase();
  return lower.includes('rain') || lower.includes('shower') || lower.includes('thunderstorm');
}
