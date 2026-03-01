/**
 * useOfflineStatus -- Tracks network connectivity and data staleness.
 *
 * Returns:
 *   isOffline      -- boolean, true when navigator.onLine is false
 *   dataAge        -- milliseconds since last successful fetch, or null
 *   isStale        -- boolean, true when data is older than threshold
 *   staleSummary   -- human-readable age string ("5 min ago", "2 hrs ago")
 */

import { useState, useEffect, useMemo } from 'react';

const STALE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

export default function useOfflineStatus(fetchedAt) {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [now, setNow] = useState(() => Date.now());

  // Listen for online/offline events
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Tick every 30s to update staleness
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const dataAge = useMemo(() => {
    if (!fetchedAt) return null;
    const ts = fetchedAt instanceof Date ? fetchedAt.getTime() : fetchedAt;
    return now - ts;
  }, [fetchedAt, now]);

  const isStale = dataAge !== null && dataAge > STALE_THRESHOLD_MS;

  const staleSummary = useMemo(() => {
    if (dataAge === null) return null;
    const mins = Math.floor(dataAge / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
    return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
  }, [dataAge]);

  return { isOffline, dataAge, isStale, staleSummary };
}

/**
 * Cache key for localStorage persistence of the last good fetch.
 */
export const CACHE_KEY = 'lanaidive:lastConditions';
export const STALE_THRESHOLD = STALE_THRESHOLD_MS;

/**
 * Persist conditions data to localStorage.
 * Serializes Date objects to ISO strings.
 */
export function cacheConditions(data) {
  try {
    const serializable = {
      ...data,
      fetchedAt: data.fetchedAt instanceof Date ? data.fetchedAt.toISOString() : data.fetchedAt,
      // Strip non-serializable/large items that can be recomputed
      tidePredictions: data.tidePredictions?.slice(0, 50),
      tideExtremes: data.tideExtremes?.slice(0, 20),
      forecastScores: data.forecastScores?.slice(0, 24),
      hourlyForecast: [], // Too large, skip
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
  } catch {
    // localStorage full or unavailable -- silent fail
  }
}

/**
 * Restore conditions data from localStorage.
 * Rehydrates Date strings back to Date objects.
 */
export function restoreCachedConditions() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Rehydrate dates
    if (data.fetchedAt) data.fetchedAt = new Date(data.fetchedAt);
    if (data.tidePredictions) {
      data.tidePredictions = data.tidePredictions.map(p => ({
        ...p,
        time: new Date(p.time),
      }));
    }
    if (data.tideExtremes) {
      data.tideExtremes = data.tideExtremes.map(e => ({
        ...e,
        time: new Date(e.time),
      }));
    }
    if (data.forecastScores) {
      data.forecastScores = data.forecastScores.map(f => ({
        ...f,
        time: new Date(f.time),
      }));
    }
    data.hourlyForecast = [];
    return data;
  } catch {
    return null;
  }
}
