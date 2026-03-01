/**
 * API Proxy Lambda -- routes /api/{service} to the corresponding
 * government API, adding required headers and handling CORS.
 *
 * Routes:
 *   /api/tides?...   -> https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?...
 *   /api/weather/...  -> https://api.weather.gov/...
 *   /api/buoy/...     -> https://www.ndbc.noaa.gov/data/realtime2/...
 *   /api/erddap/...   -> https://pae-paha.pacioos.hawaii.edu/erddap/...
 */

const ROUTES = {
  tides: {
    base: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
    rewrite: (path, qs) => `${ROUTES.tides.base}${qs ? '?' + qs : ''}`,
    headers: {},
  },
  weather: {
    base: 'https://api.weather.gov',
    rewrite: (path, _qs) => {
      // /api/weather/points/20.83,-156.92 -> https://api.weather.gov/points/20.83,-156.92
      const suffix = path.replace(/^\/api\/weather/, '');
      return `${ROUTES.weather.base}${suffix}`;
    },
    headers: {
      'User-Agent': '(lanai-dive, jared.m.hamm@gmail.com)',
      Accept: 'application/geo+json',
    },
  },
  buoy: {
    base: 'https://www.ndbc.noaa.gov/data/realtime2',
    rewrite: (path, _qs) => {
      // /api/buoy/51213.txt -> https://www.ndbc.noaa.gov/data/realtime2/51213.txt
      const suffix = path.replace(/^\/api\/buoy/, '');
      return `${ROUTES.buoy.base}${suffix}`;
    },
    headers: {},
  },
  erddap: {
    base: 'https://pae-paha.pacioos.hawaii.edu/erddap',
    rewrite: (path, qs) => {
      const suffix = path.replace(/^\/api\/erddap/, '');
      return `${ROUTES.erddap.base}${suffix}${qs ? '?' + qs : ''}`;
    },
    headers: {},
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const rawPath = event.rawPath || event.path || '/';
  const rawQuery = event.rawQueryString || '';

  // Determine which service to proxy
  const match = rawPath.match(/^\/api\/(tides|weather|buoy|erddap)(\/.*)?$/);
  if (!match) {
    return {
      statusCode: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unknown API route', path: rawPath }),
    };
  }

  const service = match[1];
  const route = ROUTES[service];
  const targetUrl = route.rewrite(rawPath, rawQuery);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        ...route.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = res.headers.get('content-type') || 'text/plain';
    const body = await res.text();

    return {
      statusCode: res.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': service === 'erddap' ? 'public, max-age=1800' : 'public, max-age=300',
      },
      body,
    };
  } catch (err) {
    console.error(`Proxy error [${service}]:`, err.message);
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Upstream request failed',
        service,
        message: err.message,
      }),
    };
  }
}
