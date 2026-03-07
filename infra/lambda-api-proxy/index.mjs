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

/**
 * Validate a path suffix to prevent path traversal attacks.
 * Rejects paths containing "..", encoded traversals, or null bytes.
 */
function sanitizeSuffix(suffix) {
  if (!suffix || suffix === '/') return suffix || '';
  // Block path traversal sequences
  if (/(\.\.|%2e%2e|%2e\.|\.%2e|%00)/i.test(suffix)) {
    return null; // signals rejection
  }
  // Collapse double slashes
  return suffix.replace(/\/+/g, '/');
}

// Allowed NWS path prefixes (only proxy expected endpoints)
const WEATHER_PATH_ALLOWLIST = [
  '/points/',
  '/gridpoints/',
  '/alerts',
  '/stations/',
];

// Allowed buoy file patterns (station data files only)
const BUOY_FILE_PATTERN = /^\/\w+\.(txt|spec|data_spec|swdir|swdir2|swr1|swr2)$/;

// Allowed ERDDAP path prefixes
const ERDDAP_PATH_ALLOWLIST = [
  '/tabledap/',
  '/griddap/',
];

const ROUTES = {
  tides: {
    base: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
    rewrite: (_path, qs) => `${ROUTES.tides.base}${qs ? '?' + qs : ''}`,
    headers: {},
  },
  weather: {
    base: 'https://api.weather.gov',
    rewrite: (path, _qs) => {
      const suffix = sanitizeSuffix(path.replace(/^\/api\/weather/, ''));
      if (suffix === null) return null;
      if (suffix && !WEATHER_PATH_ALLOWLIST.some(p => suffix.startsWith(p))) return null;
      return `${ROUTES.weather.base}${suffix}`;
    },
    headers: {
      'User-Agent': `(lanai-dive, ${process.env.CONTACT_EMAIL || 'contact@lanaidive.app'})`,
      Accept: 'application/geo+json',
    },
  },
  buoy: {
    base: 'https://www.ndbc.noaa.gov/data/realtime2',
    rewrite: (path, _qs) => {
      const suffix = sanitizeSuffix(path.replace(/^\/api\/buoy/, ''));
      if (suffix === null) return null;
      if (suffix && !BUOY_FILE_PATTERN.test(suffix)) return null;
      return `${ROUTES.buoy.base}${suffix}`;
    },
    headers: {},
  },
  erddap: {
    base: 'https://pae-paha.pacioos.hawaii.edu/erddap',
    rewrite: (path, qs) => {
      const suffix = sanitizeSuffix(path.replace(/^\/api\/erddap/, ''));
      if (suffix === null) return null;
      if (suffix && !ERDDAP_PATH_ALLOWLIST.some(p => suffix.startsWith(p))) return null;
      return `${ROUTES.erddap.base}${suffix}${qs ? '?' + qs : ''}`;
    },
    headers: {},
  },
};

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid path for service', service }),
    };
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        ...route.headers,
      },
      redirect: 'error', // Do not follow redirects to prevent SSRF
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
