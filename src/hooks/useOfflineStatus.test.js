/**
 * useOfflineStatus & Cache Utility Tests
 *
 * Tests the offline detection hook (via renderHook), caching/restoring
 * conditions data, Date rehydration, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useOfflineStatus, {
  cacheConditions,
  restoreCachedConditions,
  CACHE_KEY,
  STALE_THRESHOLD,
} from './useOfflineStatus.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// cacheConditions / restoreCachedConditions (pure utility, no hooks)
// ---------------------------------------------------------------------------
describe('cacheConditions', () => {
  it('stores data in localStorage under CACHE_KEY', () => {
    cacheConditions({ score: 75, fetchedAt: new Date('2025-06-15T12:00:00Z') });
    expect(localStorage.getItem(CACHE_KEY)).toBeTruthy();
  });

  it('serializes Date fetchedAt to ISO string', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    cacheConditions({ score: 75, fetchedAt: date });
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(stored.fetchedAt).toBe('2025-06-15T12:00:00.000Z');
  });

  it('truncates tidePredictions to 50 entries', () => {
    const predictions = Array.from({ length: 100 }, (_, i) => ({
      time: new Date(2025, 0, 1, 0, i * 6),
      level: i * 0.1,
    }));
    cacheConditions({ fetchedAt: Date.now(), tidePredictions: predictions });
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(stored.tidePredictions).toHaveLength(50);
  });

  it('truncates tideExtremes to 20 entries', () => {
    const extremes = Array.from({ length: 30 }, (_, i) => ({
      time: new Date(2025, 0, 1, i),
      type: i % 2 ? 'H' : 'L',
    }));
    cacheConditions({ fetchedAt: Date.now(), tideExtremes: extremes });
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(stored.tideExtremes).toHaveLength(20);
  });

  it('strips hourlyForecast (too large)', () => {
    cacheConditions({ fetchedAt: Date.now(), hourlyForecast: [1, 2, 3] });
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(stored.hourlyForecast).toEqual([]);
  });

  it('handles non-Date fetchedAt (timestamp number) gracefully', () => {
    const ts = Date.now();
    cacheConditions({ score: 50, fetchedAt: ts });
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(stored.fetchedAt).toBe(ts);
  });

  it('silently fails if localStorage is unavailable', () => {
    const origSet = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    expect(() => cacheConditions({ fetchedAt: Date.now() })).not.toThrow();
    localStorage.setItem = origSet;
  });
});

describe('restoreCachedConditions', () => {
  it('returns null when nothing is cached', () => {
    expect(restoreCachedConditions()).toBeNull();
  });

  it('rehydrates fetchedAt to a Date object', () => {
    cacheConditions({ score: 75, fetchedAt: new Date('2025-06-15T12:00:00Z') });
    const restored = restoreCachedConditions();
    expect(restored.fetchedAt).toBeInstanceOf(Date);
    expect(restored.fetchedAt.toISOString()).toBe('2025-06-15T12:00:00.000Z');
  });

  it('rehydrates tidePredictions times to Date objects', () => {
    cacheConditions({
      fetchedAt: Date.now(),
      tidePredictions: [{ time: new Date('2025-01-01T06:00:00Z'), level: 1.5 }],
    });
    const restored = restoreCachedConditions();
    expect(restored.tidePredictions[0].time).toBeInstanceOf(Date);
  });

  it('rehydrates tideExtremes times to Date objects', () => {
    cacheConditions({
      fetchedAt: Date.now(),
      tideExtremes: [{ time: new Date('2025-01-01T06:00:00Z'), type: 'H' }],
    });
    const restored = restoreCachedConditions();
    expect(restored.tideExtremes[0].time).toBeInstanceOf(Date);
  });

  it('rehydrates forecastScores times to Date objects', () => {
    cacheConditions({
      fetchedAt: Date.now(),
      forecastScores: [{ time: new Date('2025-01-01T06:00:00Z'), score: 80 }],
    });
    const restored = restoreCachedConditions();
    expect(restored.forecastScores[0].time).toBeInstanceOf(Date);
  });

  it('sets hourlyForecast to empty array', () => {
    cacheConditions({ fetchedAt: Date.now(), hourlyForecast: [1, 2] });
    const restored = restoreCachedConditions();
    expect(restored.hourlyForecast).toEqual([]);
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(CACHE_KEY, 'not-json{{{');
    expect(restoreCachedConditions()).toBeNull();
  });

  it('round-trips arbitrary properties intact', () => {
    cacheConditions({
      fetchedAt: Date.now(),
      score: 82,
      conditions: { windSpeedMph: 12 },
    });
    const restored = restoreCachedConditions();
    expect(restored.score).toBe(82);
    expect(restored.conditions.windSpeedMph).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// useOfflineStatus hook
// ---------------------------------------------------------------------------
describe('useOfflineStatus', () => {
  it('returns isOffline=false when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOfflineStatus(Date.now()));
    expect(result.current.isOffline).toBe(false);
  });

  it('returns dataAge=null when fetchedAt is null', () => {
    const { result } = renderHook(() => useOfflineStatus(null));
    expect(result.current.dataAge).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.staleSummary).toBeNull();
  });

  it('computes dataAge from a Date object fetchedAt', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const { result } = renderHook(() => useOfflineStatus(fiveMinAgo));
    // dataAge should be ~5 minutes (allow 2s of test execution time)
    expect(result.current.dataAge).toBeGreaterThan(4 * 60_000);
    expect(result.current.dataAge).toBeLessThan(6 * 60_000);
  });

  it('computes dataAge from a numeric timestamp', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    const { result } = renderHook(() => useOfflineStatus(fiveMinAgo));
    expect(result.current.dataAge).toBeGreaterThan(4 * 60_000);
  });

  it('reports isStale=false for fresh data', () => {
    const { result } = renderHook(() => useOfflineStatus(Date.now()));
    expect(result.current.isStale).toBe(false);
  });

  it('reports isStale=true for data older than threshold', () => {
    const old = Date.now() - STALE_THRESHOLD - 60_000;
    const { result } = renderHook(() => useOfflineStatus(old));
    expect(result.current.isStale).toBe(true);
  });

  // --- staleSummary formatting ---
  it('returns "just now" for data less than 1 minute old', () => {
    const { result } = renderHook(() => useOfflineStatus(Date.now()));
    expect(result.current.staleSummary).toBe('just now');
  });

  it('returns "X min ago" for data a few minutes old', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    const { result } = renderHook(() => useOfflineStatus(fiveMinAgo));
    expect(result.current.staleSummary).toMatch(/\d+ min ago/);
  });

  it('returns "X hr ago" / "X hrs ago" for data hours old', () => {
    const twoHoursAgo = Date.now() - 2 * 3600_000;
    const { result } = renderHook(() => useOfflineStatus(twoHoursAgo));
    expect(result.current.staleSummary).toMatch(/\d+ hrs? ago/);
  });

  it('returns "X day(s) ago" for data days old', () => {
    const twoDaysAgo = Date.now() - 2 * 86400_000;
    const { result } = renderHook(() => useOfflineStatus(twoDaysAgo));
    expect(result.current.staleSummary).toMatch(/\d+ days? ago/);
  });

  it('returns "1 hr ago" (no plural) for exactly 1 hour', () => {
    const oneHourAgo = Date.now() - 3600_000;
    const { result } = renderHook(() => useOfflineStatus(oneHourAgo));
    expect(result.current.staleSummary).toBe('1 hr ago');
  });

  // --- offline/online events ---
  it('goes offline when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOfflineStatus(Date.now()));
    expect(result.current.isOffline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);
  });

  it('comes back online when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useOfflineStatus(Date.now()));
    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('constants', () => {
  it('STALE_THRESHOLD is 20 minutes in ms', () => {
    expect(STALE_THRESHOLD).toBe(20 * 60 * 1000);
  });

  it('CACHE_KEY is a namespaced string', () => {
    expect(CACHE_KEY).toBe('lanaidive:lastConditions');
  });
});
