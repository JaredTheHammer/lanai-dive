/**
 * Buoy API Unit Tests
 * Tests NDBC fixed-width text parsing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBuoyData } from './buoy.js';

// Sample NDBC text output
const SAMPLE_BUOY_TEXT = `#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft
2025 01 15 18 00 045  3.5  4.2   0.9    10   7.2  200  1015  24.5  25.1  20.3   99 -0.2    99
2025 01 15 17 30 050  3.0  3.8   0.8     9   7.0  195  1015  24.3  25.0  20.1   99 -0.1    99`;

describe('fetchBuoyData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses wave height from meters to feet', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    // 0.9m * 3.28084 = ~2.95 ft
    expect(result.waveHeight).toBeCloseTo(0.9 * 3.28084, 1);
  });

  it('parses dominant period', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    expect(result.dominantPeriod).toBe(10);
  });

  it('parses mean wave direction', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    expect(result.meanDirection).toBe(200);
  });

  it('converts water temp from C to F', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    // 25.1C * 9/5 + 32 = 77.18F
    expect(result.waterTemp).toBeCloseTo(25.1 * 9 / 5 + 32, 1);
  });

  it('converts wind speed from m/s to mph', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    // 3.5 m/s * 2.23694 = ~7.83 mph
    expect(result.windSpeed).toBeCloseTo(3.5 * 2.23694, 1);
  });

  it('parses UTC time correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    expect(result.time).toBeInstanceOf(Date);
    expect(result.time.getUTCHours()).toBe(18);
    expect(result.time.getUTCMinutes()).toBe(0);
  });

  it('returns station ID', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_BUOY_TEXT,
    });

    const result = await fetchBuoyData();
    expect(result.stationId).toBe('51213');
  });

  it('handles missing data (999 sentinel values)', async () => {
    const textWith999 = `#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft
2025 01 15 18 00 999  999  999   0.9    10   7.2  200  9999  999   999   999   99  999    99`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => textWith999,
    });

    const result = await fetchBuoyData();
    expect(result.windSpeed).toBeNull();
    expect(result.windDirection).toBeNull();
    expect(result.waterTemp).toBeNull();
    // Wave data should still be available
    expect(result.waveHeight).not.toBeNull();
  });

  it('throws on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchBuoyData()).rejects.toThrow('Buoy API error');
  });

  it('throws on insufficient data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '#YY MM\n#yr mo',
    });

    await expect(fetchBuoyData()).rejects.toThrow('Insufficient buoy data');
  });
});
