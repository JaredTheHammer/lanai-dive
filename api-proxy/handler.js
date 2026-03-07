/**
 * AWS Lambda proxy for NOAA/NWS/NDBC APIs.
 *
 * Deployed behind API Gateway, this handler proxies requests to
 * external marine data APIs that don't support CORS.
 *
 * Routes:
 *   GET /api/tides?...   -> NOAA CO-OPS Tides API
 *   GET /api/weather/...  -> NWS api.weather.gov
 *   GET /api/buoy/...     -> NDBC buoy data
 */

/**
 * Validate a path suffix to prevent path traversal attacks.
 * Rejects paths containing "..", encoded traversals, or null bytes.
 */
function sanitizeSuffix(suffix) {
  if (!suffix || suffix === '/') return suffix || '';
  if (/(\.\.|%2e%2e|%2e\.|\.%2e|%00)/i.test(suffix)) return null;
  return suffix.replace(/\/+/g, '/');
}

const WEATHER_PATH_ALLOWLIST = ['/points/', '/gridpoints/', '/alerts', '/stations/'];
const BUOY_FILE_PATTERN = /^\/\w+\.(txt|spec|data_spec|swdir|swdir2|swr1|swr2)$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300', // 5-minute cache
};

export async function handler(event) {
  const path = event.rawPath || event.path || '';
  const qs = event.rawQueryString || '';

  try {
    let url;

    if (path.startsWith('/api/tides')) {
      url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${qs}`;
    } else if (path.startsWith('/api/weather')) {
      const subpath = sanitizeSuffix(path.replace('/api/weather', ''));
      if (
        subpath === null ||
        (subpath && !WEATHER_PATH_ALLOWLIST.some((p) => subpath.startsWith(p)))
      ) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid weather path' }),
        };
      }
      url = `https://api.weather.gov${subpath}${qs ? '?' + qs : ''}`;
    } else if (path.startsWith('/api/buoy')) {
      const subpath = sanitizeSuffix(path.replace('/api/buoy', ''));
      if (subpath === null || (subpath && !BUOY_FILE_PATTERN.test(subpath))) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid buoy path' }),
        };
      }
      url = `https://www.ndbc.noaa.gov/data/realtime2${subpath}`;
    } else {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Unknown route' }),
      };
    }

    const headers = {};
    if (url.includes('api.weather.gov')) {
      headers['User-Agent'] = '(lanai-dive, contact@lanaidive.app)';
      headers['Accept'] = 'application/geo+json';
    }

    const response = await fetch(url, { headers });

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
      },
      body,
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Upstream API error', message: err.message }),
    };
  }
}
