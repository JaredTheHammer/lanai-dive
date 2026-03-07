/**
 * API Proxy Lambda Handler Tests
 *
 * Tests routing logic, URL construction, header injection,
 * CORS headers, error handling, and unknown route responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from './handler.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Helper to make a minimal Lambda event
const makeEvent = (path, qs = '') => ({
  rawPath: path,
  rawQueryString: qs,
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
describe('route: /api/tides', () => {
  it('proxies to NOAA CO-OPS tides API with query string', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{"predictions":[]}',
    });

    const result = await handler(makeEvent('/api/tides', 'station=1615680&product=predictions'));

    expect(fetch).toHaveBeenCalledTimes(1);
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('tidesandcurrents.noaa.gov');
    expect(calledUrl).toContain('station=1615680');
    expect(result.statusCode).toBe(200);
  });
});

describe('route: /api/weather', () => {
  it('proxies to NWS API and appends subpath', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/geo+json']]),
      text: async () => '{"type":"Feature"}',
    });

    await handler(makeEvent('/api/weather/gridpoints/HFO/6,157/forecast/hourly'));

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('api.weather.gov');
    expect(calledUrl).toContain('/gridpoints/HFO/6,157/forecast/hourly');
  });

  it('sets User-Agent and Accept headers for NWS requests', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/geo+json']]),
      text: async () => '{}',
    });

    await handler(makeEvent('/api/weather/points/20.83,-156.92'));

    const calledHeaders = fetch.mock.calls[0][1].headers;
    expect(calledHeaders['User-Agent']).toContain('lanai-dive');
    expect(calledHeaders['Accept']).toBe('application/geo+json');
  });

  it('appends query string when present', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{}',
    });

    await handler(makeEvent('/api/weather/alerts', 'point=20.83,-156.92'));

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('?point=20.83,-156.92');
  });
});

describe('route: /api/buoy', () => {
  it('proxies to NDBC buoy data endpoint', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      text: async () => '#header\ndata',
    });

    await handler(makeEvent('/api/buoy/51213.txt'));

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('ndbc.noaa.gov');
    expect(calledUrl).toContain('/51213.txt');
  });
});

describe('route: unknown', () => {
  it('returns 404 for unrecognized paths', async () => {
    const result = await handler(makeEvent('/api/unknown'));
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Unknown route');
  });

  it('returns 404 for root path', async () => {
    const result = await handler(makeEvent('/'));
    expect(result.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
describe('CORS headers', () => {
  it('includes CORS headers on success responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{}',
    });

    const result = await handler(makeEvent('/api/tides', 'station=1615680'));
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('includes CORS headers on 404 responses', async () => {
    const result = await handler(makeEvent('/api/unknown'));
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('includes Cache-Control header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{}',
    });

    const result = await handler(makeEvent('/api/tides'));
    expect(result.headers['Cache-Control']).toContain('max-age=300');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
  it('returns upstream status code for non-ok responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{"error":"service unavailable"}',
    });

    const result = await handler(makeEvent('/api/tides'));
    expect(result.statusCode).toBe(503);
  });

  it('returns 502 when fetch throws a network error', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await handler(makeEvent('/api/tides'));
    expect(result.statusCode).toBe(502);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Upstream API error');
    expect(body.message).toBe('ECONNREFUSED');
  });

  it('includes CORS headers on 502 error responses', async () => {
    fetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await handler(makeEvent('/api/tides'));
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

// ---------------------------------------------------------------------------
// Content-Type passthrough
// ---------------------------------------------------------------------------
describe('content-type', () => {
  it('passes through content-type from upstream response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/csv; charset=utf-8']]),
      text: async () => 'a,b\n1,2',
    });

    const result = await handler(makeEvent('/api/tides'));
    expect(result.headers['Content-Type']).toBe('text/csv; charset=utf-8');
  });

  it('defaults to application/json when upstream has no content-type', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map(),
      text: async () => '{}',
    });

    const result = await handler(makeEvent('/api/tides'));
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Event shape variations
// ---------------------------------------------------------------------------
describe('event shape handling', () => {
  it('uses event.path when rawPath is absent', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => '{}',
    });

    await handler({ path: '/api/tides', rawQueryString: '' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles missing path gracefully (returns 404)', async () => {
    const result = await handler({});
    expect(result.statusCode).toBe(404);
  });
});
