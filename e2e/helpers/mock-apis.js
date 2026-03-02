/**
 * Mock API helper for Playwright E2E tests.
 * Intercepts all external API routes with fixture data before page navigation.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

function fixture(name) {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

/**
 * Set up all API route mocks on the given page.
 * Call this BEFORE page.goto().
 */
export async function mockAllApis(page) {
  const tidesPredictions = fixture('tides-predictions.json');
  const tidesHilo = fixture('tides-hilo.json');
  const weatherPoints = fixture('weather-points.json');
  const weatherHourly = fixture('weather-hourly.json');
  const weatherGriddata = fixture('weather-griddata.json');
  const buoyData = fixture('buoy-51213.txt');
  const swellCsv = fixture('erddap-ww3-swell.csv');
  const currentsCsv = fixture('erddap-roms-currents.csv');

  // Tide predictions (6-min interval)
  await page.route('**/api/tides?*interval=6*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: tidesPredictions,
    });
  });

  // Tide hi/lo extremes
  await page.route('**/api/tides?*interval=hilo*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: tidesHilo,
    });
  });

  // NWS points (gridpoint resolution)
  await page.route('**/api/weather/points/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: weatherPoints,
    });
  });

  // NWS hourly forecast (must be before generic gridpoints route)
  await page.route('**/api/weather/gridpoints/**/forecast/hourly', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: weatherHourly,
    });
  });

  // NWS gridpoint data (precipitation)
  await page.route('**/api/weather/gridpoints/**', async (route) => {
    // Only match if NOT the hourly forecast route
    const url = route.request().url();
    if (url.includes('/forecast/hourly')) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: weatherGriddata,
    });
  });

  // NDBC buoy data
  await page.route('**/api/buoy/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: buoyData,
    });
  });

  // PacIOOS WW3 swell forecast
  await page.route('**/api/erddap/griddap/ww3_hawaii*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: swellCsv,
    });
  });

  // PacIOOS ROMS currents
  await page.route('**/api/erddap/griddap/roms_hiig_assimilation*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: currentsCsv,
    });
  });

  // Block map tile requests to prevent flakiness
  await page.route('**/basemaps.cartocdn.com/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });
}

/**
 * Set up all API routes to return errors (for error-state testing).
 */
export async function mockAllApisError(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    // Don't intercept Vite module requests (e.g., /src/api/index.js)
    if (url.includes('/src/')) {
      return route.fallback();
    }
    await route.fulfill({ status: 500, body: 'Internal Server Error' });
  });
  await page.route('**/basemaps.cartocdn.com/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });
}
