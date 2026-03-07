/**
 * Swell Forecast Tests
 *
 * Tests fetchSwellForecast() with mocked fetch, ERDDAP CSV parsing,
 * caching behavior, spatial averaging, circular mean, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Sample ERDDAP CSV response (headers, units, then data rows)
// Two spatial grid points per timestep, two timesteps
const SAMPLE_CSV = `time,latitude,longitude,Thgt,Tper,Tdir
UTC,degrees_north,degrees_east,m,s,degrees_true
2025-01-15T00:00:00Z,20.7,203.0,1.0,10.0,180.0
2025-01-15T00:00:00Z,20.8,203.1,1.2,11.0,190.0
2025-01-15T01:00:00Z,20.7,203.0,1.5,12.0,200.0
2025-01-15T01:00:00Z,20.8,203.1,1.3,11.5,210.0`;

// CSV with missing Tper/Tdir columns
const CSV_MINIMAL = `time,latitude,longitude,Thgt
UTC,degrees_north,degrees_east,m
2025-01-15T00:00:00Z,20.7,203.0,1.0
2025-01-15T00:00:00Z,20.8,203.1,1.2`;

// CSV with NaN wave heights (should be skipped)
const CSV_WITH_NAN = `time,latitude,longitude,Thgt,Tper,Tdir
UTC,degrees_north,degrees_east,m,s,degrees_true
2025-01-15T00:00:00Z,20.7,203.0,NaN,10.0,180.0
2025-01-15T00:00:00Z,20.8,203.1,1.0,11.0,190.0`;

let fetchSwellForecast;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  const mod = await import('./swellforecast.js');
  fetchSwellForecast = mod.fetchSwellForecast;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchSwellForecast', () => {
  // --- Happy path ---
  it('parses ERDDAP CSV and returns array with correct structure', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchSwellForecast();

    expect(result).toHaveLength(2); // Two timesteps
    expect(result[0]).toHaveProperty('time');
    expect(result[0]).toHaveProperty('height');
    expect(result[0]).toHaveProperty('period');
    expect(result[0]).toHaveProperty('direction');
    expect(result[0].time).toBeInstanceOf(Date);
  });

  it('converts wave height from meters to feet', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchSwellForecast();

    // First timestep: avg of 1.0 and 1.2 = 1.1m = 3.609 ft
    expect(result[0].height).toBeCloseTo(1.1 * 3.28084, 1);
  });

  it('averages spatial grid points per timestep', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchSwellForecast();

    // First timestep period: avg of 10.0 and 11.0 = 10.5
    expect(result[0].period).toBeCloseTo(10.5, 1);
  });

  it('sorts results by time ascending', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchSwellForecast();

    expect(result[0].time.getTime()).toBeLessThan(result[1].time.getTime());
  });

  // --- Caching ---
  it('caches results and returns cached data on second call', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });

    const first = await fetchSwellForecast();
    const second = await fetchSwellForecast();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  // --- Edge cases ---
  it('returns empty array for CSV with fewer than 3 lines', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'time,Thgt\nUTC,m' });
    const result = await fetchSwellForecast();
    expect(result).toEqual([]);
  });

  it('returns empty array when required columns are missing', async () => {
    const noThgt = `time,latitude,longitude,foo\nUTC,deg,deg,bar\n2025-01-15T00:00:00Z,20.7,203.0,1.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => noThgt });
    const result = await fetchSwellForecast();
    expect(result).toEqual([]);
  });

  it('skips rows with NaN wave height', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => CSV_WITH_NAN });
    const result = await fetchSwellForecast();

    // Only one valid data point at the single timestep
    expect(result).toHaveLength(1);
    expect(result[0].height).toBeCloseTo(1.0 * 3.28084, 1);
  });

  it('handles CSV without Tper/Tdir columns gracefully', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => CSV_MINIMAL });
    const result = await fetchSwellForecast();

    expect(result).toHaveLength(1);
    expect(result[0].period).toBe(0);
    expect(result[0].direction).toBe(0);
  });

  // --- Error handling ---
  it('throws on non-ok HTTP response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchSwellForecast()).rejects.toThrow('ERDDAP WW3 error: 503');
  });

  it('propagates network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'));
    await expect(fetchSwellForecast()).rejects.toThrow('Network failure');
  });

  // --- Circular mean for direction ---
  it('computes circular mean for direction averaging', async () => {
    // Directions 350 and 10 should average to ~0 (north), not 180
    const csv = `time,latitude,longitude,Thgt,Tper,Tdir
UTC,degrees_north,degrees_east,m,s,degrees_true
2025-01-15T00:00:00Z,20.7,203.0,1.0,10.0,350.0
2025-01-15T00:00:00Z,20.8,203.1,1.0,10.0,10.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => csv });
    const result = await fetchSwellForecast();

    // Circular mean of 350° and 10° should be ~0° (or 360°)
    expect(result[0].direction).toBeCloseTo(0, 0);
  });
});
