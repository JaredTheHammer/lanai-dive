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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300' // 5-minute cache
};

export async function handler(event) {
  const path = event.rawPath || event.path || '';
  const qs = event.rawQueryString || '';

  try {
    let url;

    if (path.startsWith('/api/tides')) {
      url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${qs}`;
    } else if (path.startsWith('/api/weather')) {
      const subpath = path.replace('/api/weather', '');
      url = `https://api.weather.gov${subpath}${qs ? '?' + qs : ''}`;
    } else if (path.startsWith('/api/buoy')) {
      const subpath = path.replace('/api/buoy', '');
      url = `https://www.ndbc.noaa.gov/data/realtime2${subpath}`;
    } else {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Unknown route' })
      };
    }

    const headers = {};
    if (url.includes('api.weather.gov')) {
      headers['User-Agent'] = '(lanai-dive, jared.m.hamm@gmail.com)';
      headers['Accept'] = 'application/geo+json';
    }

    const response = await fetch(url, { headers });

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType
      },
      body
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Upstream API error', message: err.message })
    };
  }
}
