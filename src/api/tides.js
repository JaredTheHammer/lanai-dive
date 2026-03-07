/**
 * NOAA CO-OPS Tides API integration
 * Station: 1615680 (Kahului Harbor, Maui)
 * API Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
 */

import { API_BASE, TIDE_STATION } from './config.js';
import { format, addDays } from 'date-fns';

/**
 * Fetch tide predictions for the next 48 hours.
 * Returns array of { time: Date, height: number (ft) }
 */
export async function fetchTidePredictions() {
  const now = new Date();
  const beginDate = format(now, 'yyyyMMdd');
  const endDate = format(addDays(now, 2), 'yyyyMMdd');

  const params = new URLSearchParams({
    station: TIDE_STATION,
    begin_date: beginDate,
    end_date: endDate,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    units: 'english',
    interval: '6', // 6-minute intervals for smooth curve
    format: 'json',
  });

  const res = await fetch(`${API_BASE}/api/tides?${params}`);
  if (!res.ok) throw new Error(`Tides API error: ${res.status}`);

  const data = await res.json();
  if (!data.predictions) throw new Error('No tide prediction data');

  return data.predictions.map((p) => ({
    time: new Date(p.t.replace(' ', 'T')),
    height: parseFloat(p.v),
  }));
}

/**
 * Fetch hi/lo tide extremes for the next 48 hours.
 * Returns array of { time: Date, height: number, type: 'H'|'L' }
 */
export async function fetchTideExtremes() {
  const now = new Date();
  const beginDate = format(now, 'yyyyMMdd');
  const endDate = format(addDays(now, 2), 'yyyyMMdd');

  const params = new URLSearchParams({
    station: TIDE_STATION,
    begin_date: beginDate,
    end_date: endDate,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    units: 'english',
    interval: 'hilo',
    format: 'json',
  });

  const res = await fetch(`${API_BASE}/api/tides?${params}`);
  if (!res.ok) throw new Error(`Tides hilo API error: ${res.status}`);

  const data = await res.json();
  if (!data.predictions) throw new Error('No tide extreme data');

  return data.predictions.map((p) => ({
    time: new Date(p.t.replace(' ', 'T')),
    height: parseFloat(p.v),
    type: p.type, // 'H' or 'L'
  }));
}

/**
 * Compute current tide state from predictions.
 * Returns { level, rateOfChange (ft/hr), nextSlack }
 */
export function computeTideState(predictions, extremes) {
  const now = Date.now();

  // Find the two predictions bracketing now
  let before = null,
    after = null;
  for (let i = 0; i < predictions.length - 1; i++) {
    if (predictions[i].time.getTime() <= now && predictions[i + 1].time.getTime() > now) {
      before = predictions[i];
      after = predictions[i + 1];
      break;
    }
  }

  if (!before || !after) {
    // Fallback
    return { level: predictions[0]?.height || 0, rateOfChange: 0, nextSlack: null };
  }

  // Interpolate current level
  const frac = (now - before.time.getTime()) / (after.time.getTime() - before.time.getTime());
  const level = before.height + frac * (after.height - before.height);

  // Rate of change in ft/hr
  const dtHours = (after.time.getTime() - before.time.getTime()) / 3600000;
  const rateOfChange = dtHours > 0 ? (after.height - before.height) / dtHours : 0;

  // Next slack = next hi/lo extreme
  const nextSlack = extremes.find((e) => e.time.getTime() > now);

  return {
    level,
    rateOfChange,
    nextSlack: nextSlack
      ? {
          time: nextSlack.time,
          type: nextSlack.type === 'H' ? 'high' : 'low',
          level: nextSlack.height,
        }
      : null,
  };
}
