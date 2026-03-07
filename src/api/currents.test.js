/**
 * Ocean Currents Tests
 *
 * Tests fetchCurrents() with mocked fetch, CSV parsing, vector math
 * (speed/direction from u/v components), caching, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SAMPLE_CSV = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7,-157.0,0.1,0.2
2025-01-15T00:00:00Z,20.8,-156.9,-0.05,0.15
2025-01-15T00:00:00Z,20.9,-156.8,0.0,0.0`;

let fetchCurrents;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  const mod = await import('./currents.js');
  fetchCurrents = mod.fetchCurrents;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchCurrents', () => {
  // --- Happy path ---
  it('returns array of current vectors with correct structure', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchCurrents();

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('lat');
    expect(result[0]).toHaveProperty('lon');
    expect(result[0]).toHaveProperty('u');
    expect(result[0]).toHaveProperty('v');
    expect(result[0]).toHaveProperty('speed');
    expect(result[0]).toHaveProperty('direction');
  });

  it('computes speed as magnitude of u/v vector', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchCurrents();

    // First row: u=0.1, v=0.2 → speed = sqrt(0.01 + 0.04) = sqrt(0.05)
    expect(result[0].speed).toBeCloseTo(Math.sqrt(0.05), 5);
  });

  it('computes direction from u/v using atan2 (oceanographic convention)', async () => {
    // Pure northward current (u=0, v=1) → direction 0°
    const northCsv = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7,-157.0,0.0,1.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => northCsv });
    const result = await fetchCurrents();
    expect(result[0].direction).toBeCloseTo(0, 1);
  });

  it('computes eastward direction as ~90°', async () => {
    const eastCsv = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7,-157.0,1.0,0.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => eastCsv });
    const result = await fetchCurrents();
    expect(result[0].direction).toBeCloseTo(90, 1);
  });

  it('computes southward direction as ~180°', async () => {
    const southCsv = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7,-157.0,0.0,-1.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => southCsv });
    const result = await fetchCurrents();
    expect(result[0].direction).toBeCloseTo(180, 1);
  });

  it('handles zero current (speed = 0, direction = 0)', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });
    const result = await fetchCurrents();
    // Third row: u=0, v=0
    expect(result[2].speed).toBe(0);
    expect(result[2].direction).toBe(0);
  });

  // --- Caching ---
  it('caches results and does not re-fetch within TTL', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV });

    const first = await fetchCurrents();
    const second = await fetchCurrents();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  // --- Edge cases ---
  it('returns empty array for CSV with fewer than 3 lines', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'headers\nunits' });
    const result = await fetchCurrents();
    expect(result).toEqual([]);
  });

  it('returns empty array when required columns are missing', async () => {
    const badCsv = `time,latitude,longitude,foo
UTC,deg,deg,bar
2025-01-15T00:00:00Z,20.7,-157.0,1.0`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => badCsv });
    const result = await fetchCurrents();
    expect(result).toEqual([]);
  });

  it('skips rows with NaN values', async () => {
    const nanCsv = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7,-157.0,NaN,0.2
2025-01-15T00:00:00Z,20.8,-156.9,0.1,0.3`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => nanCsv });
    const result = await fetchCurrents();
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(20.8, 1);
  });

  it('skips rows with insufficient columns', async () => {
    const shortCsv = `time,latitude,longitude,u_eastward,v_northward
UTC,degrees_north,degrees_east,m/s,m/s
2025-01-15T00:00:00Z,20.7
2025-01-15T00:00:00Z,20.8,-156.9,0.1,0.3`;
    fetch.mockResolvedValueOnce({ ok: true, text: async () => shortCsv });
    const result = await fetchCurrents();
    expect(result).toHaveLength(1);
  });

  // --- Error handling ---
  it('throws on non-ok HTTP response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchCurrents()).rejects.toThrow('ERDDAP ROMS error: 500');
  });

  it('propagates network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Timeout'));
    await expect(fetchCurrents()).rejects.toThrow('Timeout');
  });
});
