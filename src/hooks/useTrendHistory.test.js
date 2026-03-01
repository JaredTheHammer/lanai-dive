/**
 * useTrendHistory Hook Unit Tests
 * Tests ring buffer, dedup, time-range filtering, and snapshot extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTrendHistory, { extractSnapshot, STORAGE_KEY, MAX_ENTRIES } from './useTrendHistory.js';

describe('extractSnapshot', () => {
  const MOCK_DATA = {
    score: { overall: 72, overallLabel: 'Good' },
    conditions: {
      windSpeedMph: 12,
      windDirectionDeg: 45,
      swellHeightFt: 3.0,
      swellPeriodSec: 12,
      tideLevel: 1.5,
      rain24h: 0.1,
    },
    waterTemp: 77.5,
    zoneScores: {
      south_shore: { overall: 80 },
      southwest: { overall: 65 },
      west: { overall: 50 },
    },
  };

  it('extracts compact snapshot with correct keys', () => {
    const snap = extractSnapshot(MOCK_DATA);
    expect(snap).not.toBeNull();
    expect(snap.s).toBe(72);
    expect(snap.w).toBe(12);
    expect(snap.wd).toBe(45);
    expect(snap.sh).toBe(3.0);
    expect(snap.sp).toBe(12);
    expect(snap.tl).toBe(1.5);
    expect(snap.r).toBe(0.1);
    expect(snap.wt).toBe(77.5);
    expect(snap.t).toBeDefined();
  });

  it('identifies the best zone', () => {
    const snap = extractSnapshot(MOCK_DATA);
    expect(snap.bz).toBe('south_shore');
    expect(snap.bs).toBe(80);
  });

  it('builds zone score map', () => {
    const snap = extractSnapshot(MOCK_DATA);
    expect(snap.zs).toEqual({
      south_shore: 80,
      southwest: 65,
      west: 50,
    });
  });

  it('returns null when data is missing score', () => {
    expect(extractSnapshot({})).toBeNull();
    expect(extractSnapshot({ score: null })).toBeNull();
    expect(extractSnapshot(null)).toBeNull();
  });

  it('returns null when conditions are missing', () => {
    expect(extractSnapshot({ score: { overall: 50 } })).toBeNull();
  });

  it('handles null waterTemp', () => {
    const data = { ...MOCK_DATA, waterTemp: null };
    const snap = extractSnapshot(data);
    expect(snap.wt).toBeNull();
  });

  it('handles undefined waterTemp', () => {
    const data = { ...MOCK_DATA, waterTemp: undefined };
    const snap = extractSnapshot(data);
    expect(snap.wt).toBeNull();
  });

  it('handles empty zoneScores', () => {
    const data = { ...MOCK_DATA, zoneScores: {} };
    const snap = extractSnapshot(data);
    expect(snap.bz).toBeNull();
    expect(snap.bs).toBe(0);
    expect(snap.zs).toEqual({});
  });
});

describe('useTrendHistory hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const MOCK_DATA = {
    score: { overall: 72 },
    conditions: {
      windSpeedMph: 12,
      windDirectionDeg: 45,
      swellHeightFt: 3.0,
      swellPeriodSec: 12,
      tideLevel: 1.5,
      rain24h: 0.1,
    },
    waterTemp: 77.5,
    zoneScores: { south_shore: { overall: 80 } },
  };

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useTrendHistory());
    expect(result.current.history).toEqual([]);
  });

  it('records a snapshot', () => {
    const { result } = renderHook(() => useTrendHistory());

    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].s).toBe(72);
  });

  it('deduplicates snapshots within minimum interval', () => {
    const { result } = renderHook(() => useTrendHistory());

    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });
    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });

    // Second snapshot should be rejected (too close in time)
    expect(result.current.history).toHaveLength(1);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useTrendHistory());

    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
  });

  it('loads from localStorage on init', () => {
    const existingData = [
      { t: Date.now() - 3600000, s: 65, w: 10, wd: 90, sh: 2, sp: 10, tl: 1, r: 0, wt: 75, bz: 'south_shore', bs: 70, zs: {} },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

    const { result } = renderHook(() => useTrendHistory());
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].s).toBe(65);
  });

  it('clears history', () => {
    const { result } = renderHook(() => useTrendHistory());

    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });
    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
    // After clearing, the useEffect persists the empty array back,
    // so localStorage contains '[]' rather than being null
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored === null || stored === '[]').toBe(true);
  });

  it('enforces MAX_ENTRIES ring buffer limit', () => {
    // Pre-fill localStorage with MAX_ENTRIES - 1 items
    const entries = [];
    for (let i = 0; i < MAX_ENTRIES; i++) {
      entries.push({
        t: Date.now() - (MAX_ENTRIES - i) * 15 * 60000,
        s: 50 + (i % 30),
        w: 10, wd: 45, sh: 2, sp: 10, tl: 1, r: 0, wt: 75,
        bz: 'south_shore', bs: 60, zs: {},
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

    const { result } = renderHook(() => useTrendHistory());
    expect(result.current.history).toHaveLength(MAX_ENTRIES);

    // Add one more -- should trim oldest
    act(() => {
      result.current.recordSnapshot(MOCK_DATA);
    });
    expect(result.current.history).toHaveLength(MAX_ENTRIES);
    // Most recent should be the new one
    expect(result.current.history[result.current.history.length - 1].s).toBe(72);
  });

  it('does not record null snapshots', () => {
    const { result } = renderHook(() => useTrendHistory());

    act(() => {
      result.current.recordSnapshot({});
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json');

    const { result } = renderHook(() => useTrendHistory());
    expect(result.current.history).toEqual([]);
  });
});

describe('getRange', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeHistoryEntries(count, intervalMs, startTime) {
    const entries = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        t: startTime + i * intervalMs,
        s: 50 + i, w: 10, wd: 45, sh: 2, sp: 10, tl: 1, r: 0, wt: 75,
        bz: 'south_shore', bs: 60, zs: {},
      });
    }
    return entries;
  }

  it('filters history by 6h range', () => {
    const now = Date.now();
    const entries = [
      ...makeHistoryEntries(2, 900000, now - 8 * 3600000),  // 8h ago (outside range)
      ...makeHistoryEntries(3, 900000, now - 5 * 3600000),  // 5h ago (inside range)
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

    const { result } = renderHook(() => useTrendHistory());
    const filtered = result.current.getRange('6h');
    expect(filtered.length).toBe(3);
  });

  it('filters history by 24h range', () => {
    const now = Date.now();
    const entries = [
      ...makeHistoryEntries(2, 900000, now - 30 * 3600000), // 30h ago
      ...makeHistoryEntries(5, 900000, now - 20 * 3600000), // 20h ago
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

    const { result } = renderHook(() => useTrendHistory());
    const filtered = result.current.getRange('24h');
    expect(filtered.length).toBe(5);
  });

  it('defaults to 24h for unknown range key', () => {
    const now = Date.now();
    const entries = [
      ...makeHistoryEntries(1, 900000, now - 30 * 3600000), // outside 24h
      ...makeHistoryEntries(1, 900000, now - 12 * 3600000), // inside 24h
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

    const { result } = renderHook(() => useTrendHistory());
    const filtered = result.current.getRange('unknown');
    expect(filtered.length).toBe(1);
  });
});
