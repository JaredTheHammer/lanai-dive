/**
 * Weather API Unit Tests
 * Tests NWS wind/precip parsing and compass conversion.
 *
 * Note: weather.js caches the gridpoint internally (module-level `let cachedGridpoint`).
 * We use vi.resetModules() + dynamic import to get a fresh module per test group
 * so that the cache starts empty each time.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sample NWS hourly forecast response
const SAMPLE_HOURLY = {
  properties: {
    periods: [
      {
        startTime: '2025-01-15T18:00:00-10:00',
        windSpeed: '15 mph',
        windDirection: 'NE',
        temperature: 78,
        temperatureUnit: 'F',
        probabilityOfPrecipitation: { value: 20 },
        shortForecast: 'Partly Cloudy',
        isDaytime: true,
      },
      {
        startTime: '2025-01-15T19:00:00-10:00',
        windSpeed: '10 to 20 mph',
        windDirection: 'ENE',
        temperature: 76,
        temperatureUnit: 'F',
        probabilityOfPrecipitation: { value: 65 },
        shortForecast: 'Scattered Showers',
        isDaytime: false,
      },
      {
        startTime: '2025-01-15T20:00:00-10:00',
        windSpeed: '5 mph',
        windDirection: 'S',
        temperature: 74,
        temperatureUnit: 'F',
        probabilityOfPrecipitation: { value: 0 },
        shortForecast: 'Clear',
        isDaytime: false,
      },
    ],
  },
};

const SAMPLE_POINTS = {
  properties: {
    gridId: 'HFO',
    gridX: 42,
    gridY: 118,
  },
};

/**
 * Helper: set up global.fetch to return points first, then the forecast/gridpoint data.
 * Since getGridpoint() is cached per-module, after the first call in a module instance
 * only the second URL will be fetched.
 */
function setupFetch(forecastResponse) {
  global.fetch = vi.fn((url) => {
    if (url.includes('/points/')) {
      return Promise.resolve({
        ok: true,
        json: async () => SAMPLE_POINTS,
      });
    }
    // Forecast or gridpoint data
    return Promise.resolve(forecastResponse);
  });
}

describe('fetchHourlyForecast', () => {
  let fetchHourlyForecast;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchHourlyForecast = mod.fetchHourlyForecast;
  });

  it('parses wind speed from simple format (e.g. "15 mph")', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    expect(result[0].windSpeedMph).toBe(15);
  });

  it('averages wind speed from range format (e.g. "10 to 20 mph")', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    // "10 to 20 mph" => (10+20)/2 = 15
    expect(result[1].windSpeedMph).toBe(15);
  });

  it('converts compass direction to degrees', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    expect(result[0].windDirectionDeg).toBe(45); // NE
    expect(result[1].windDirectionDeg).toBe(67.5); // ENE
    expect(result[2].windDirectionDeg).toBe(180); // S
  });

  it('detects rain in short forecast', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    expect(result[0].isRaining).toBe(false); // Partly Cloudy
    expect(result[1].isRaining).toBe(true); // Scattered Showers
    expect(result[2].isRaining).toBe(false); // Clear
  });

  it('passes through precip probability', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    expect(result[0].precipProbability).toBe(20);
    expect(result[1].precipProbability).toBe(65);
  });

  it('parses time as Date object', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchHourlyForecast();
    expect(result[0].time).toBeInstanceOf(Date);
  });

  it('handles missing precipProbability (defaults to 0)', async () => {
    const noPrecip = {
      properties: {
        periods: [
          {
            startTime: '2025-01-15T18:00:00-10:00',
            windSpeed: '10 mph',
            windDirection: 'N',
            temperature: 78,
            temperatureUnit: 'F',
            probabilityOfPrecipitation: {},
            shortForecast: 'Sunny',
            isDaytime: true,
          },
        ],
      },
    };
    setupFetch({ ok: true, json: async () => noPrecip });
    const result = await fetchHourlyForecast();
    expect(result[0].precipProbability).toBe(0);
  });

  it('throws on HTTP error from points API', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchHourlyForecast()).rejects.toThrow('NWS points API error');
  });

  it('throws on HTTP error from forecast API', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/points/')) {
        return Promise.resolve({ ok: true, json: async () => SAMPLE_POINTS });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });
    await expect(fetchHourlyForecast()).rejects.toThrow('NWS hourly forecast error');
  });

  it('handles empty periods array', async () => {
    setupFetch({ ok: true, json: async () => ({ properties: { periods: [] } }) });
    const result = await fetchHourlyForecast();
    expect(result).toEqual([]);
  });

  it('handles null windSpeed string', async () => {
    const nullWind = {
      properties: {
        periods: [
          {
            startTime: '2025-01-15T18:00:00-10:00',
            windSpeed: null,
            windDirection: 'N',
            temperature: 78,
            temperatureUnit: 'F',
            probabilityOfPrecipitation: { value: 0 },
            shortForecast: 'Sunny',
            isDaytime: true,
          },
        ],
      },
    };
    setupFetch({ ok: true, json: async () => nullWind });
    const result = await fetchHourlyForecast();
    expect(result[0].windSpeedMph).toBe(0);
  });

  it('detects thunderstorm as rain', async () => {
    const storm = {
      properties: {
        periods: [
          {
            startTime: '2025-01-15T18:00:00-10:00',
            windSpeed: '25 mph',
            windDirection: 'SW',
            temperature: 80,
            temperatureUnit: 'F',
            probabilityOfPrecipitation: { value: 90 },
            shortForecast: 'Thunderstorm Likely',
            isDaytime: true,
          },
        ],
      },
    };
    setupFetch({ ok: true, json: async () => storm });
    const result = await fetchHourlyForecast();
    expect(result[0].isRaining).toBe(true);
  });
});

describe('fetchPrecipitation', () => {
  let fetchPrecipitation;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchPrecipitation = mod.fetchPrecipitation;
  });

  it('sums precipitation within 24h and 48h windows', async () => {
    const now = Date.now();
    const gridData = {
      properties: {
        quantitativePrecipitation: {
          values: [
            { validTime: new Date(now - 12 * 3600000).toISOString() + '/PT1H', value: 2.54 }, // ~0.1 in, within 24h
            { validTime: new Date(now - 36 * 3600000).toISOString() + '/PT1H', value: 5.08 }, // ~0.2 in, within 48h only
          ],
        },
      },
    };
    setupFetch({ ok: true, json: async () => gridData });
    const result = await fetchPrecipitation();
    expect(result.rain24h).toBeCloseTo(2.54 / 25.4, 2);
    expect(result.rain48h).toBeCloseTo((2.54 + 5.08) / 25.4, 2);
  });

  it('returns zero when no precipitation data', async () => {
    const gridData = { properties: { quantitativePrecipitation: { values: [] } } };
    setupFetch({ ok: true, json: async () => gridData });
    const result = await fetchPrecipitation();
    expect(result.rain24h).toBe(0);
    expect(result.rain48h).toBe(0);
  });

  it('skips entries with malformed validTime', async () => {
    const gridData = {
      properties: {
        quantitativePrecipitation: {
          values: [
            { validTime: 'not-a-date/PT1H', value: 10 },
            { validTime: null, value: 5 },
            { validTime: 123, value: 3 },
          ],
        },
      },
    };
    setupFetch({ ok: true, json: async () => gridData });
    const result = await fetchPrecipitation();
    expect(result.rain24h).toBe(0);
    expect(result.rain48h).toBe(0);
  });

  it('throws on HTTP error', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/points/')) {
        return Promise.resolve({ ok: true, json: async () => SAMPLE_POINTS });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });
    await expect(fetchPrecipitation()).rejects.toThrow('NWS gridpoint data error');
  });

  it('handles missing quantitativePrecipitation property', async () => {
    const gridData = { properties: {} };
    setupFetch({ ok: true, json: async () => gridData });
    const result = await fetchPrecipitation();
    expect(result.rain24h).toBe(0);
    expect(result.rain48h).toBe(0);
  });
});

describe('fetchCurrentWind', () => {
  let fetchCurrentWind;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchCurrentWind = mod.fetchCurrentWind;
  });

  it('returns first period wind data', async () => {
    setupFetch({ ok: true, json: async () => SAMPLE_HOURLY });
    const result = await fetchCurrentWind();
    expect(result.speedMph).toBe(15);
    expect(result.directionDeg).toBe(45);
    expect(result.forecast).toBe('Partly Cloudy');
  });

  it('throws when no forecast data', async () => {
    setupFetch({ ok: true, json: async () => ({ properties: { periods: [] } }) });
    await expect(fetchCurrentWind()).rejects.toThrow('No current forecast data');
  });
});

// ---------------------------------------------------------------------------
// Error handling for non-JSON responses
// ---------------------------------------------------------------------------
describe('NWS error handling', () => {
  it('throws descriptive error when points API returns non-JSON', async () => {
    let fetchHourlyForecast;
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchHourlyForecast = mod.fetchHourlyForecast;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });

    await expect(fetchHourlyForecast()).rejects.toThrow('non-JSON');
  });

  it('throws descriptive error when forecast API returns non-JSON', async () => {
    let fetchHourlyForecast;
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchHourlyForecast = mod.fetchHourlyForecast;

    global.fetch = vi.fn((url) => {
      if (url.includes('/points/')) {
        return Promise.resolve({ ok: true, json: async () => SAMPLE_POINTS });
      }
      return Promise.resolve({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });
    });

    await expect(fetchHourlyForecast()).rejects.toThrow('non-JSON');
  });

  it('throws error when points API returns unexpected shape', async () => {
    let fetchHourlyForecast;
    vi.resetModules();
    const mod = await import('./weather.js');
    fetchHourlyForecast = mod.fetchHourlyForecast;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ properties: {} }), // missing gridId, gridX, gridY
    });

    await expect(fetchHourlyForecast()).rejects.toThrow('unexpected response shape');
  });
});
