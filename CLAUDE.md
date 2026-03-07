# CLAUDE.md

## Project

Lanai dive condition scoring PWA. Vite + vanilla JS frontend, Cloudflare Worker API proxy.

## Commands

- `npx vitest run` — run all tests
- `npx vitest run <path>` — run specific test file
- Linter (Prettier-style) runs automatically on save

## Architecture

- `src/api/` — API clients (NOAA tides, NWS weather, NDBC buoy, PacIOOS ERDDAP swell/currents)
- `src/scoring/index.js` — composite dive score (wind/swell/tide/rain/visibility, 0-100)
- `src/api/index.js` — unified aggregator, forecast timeline computation
- `src/data/zones.js` — Lanai dive zone definitions with shore orientations
- `src/data/species.js` — seasonal species/harvest rules
- `src/push.js` — Web Push subscription manager (VAPID)
- `api-proxy/` — Cloudflare Worker that proxies external APIs

## Scoring helpers (single source of truth — do not duplicate)

- `windSpeedBase(mph)` / `swellHeightBase(ft)` / `swellPeriodModifier(sec)` — piecewise-linear base curves in `src/scoring/index.js`
- `interpolateTideAt(t, predictions, extremes)` — tide state interpolation in `src/api/index.js`
- `fetchTideData(interval)` — shared NOAA fetch in `src/api/tides.js`

## API integration pitfalls

- NWS can return HTTP 200 with HTML error pages — always try/catch `.json()` calls
- NWS `validTime` field can be missing or malformed — guard before `.split('/')`
- Tide rate division: always guard `dtHours > 0` before dividing (duplicate timestamps happen)
- `circularMean()` must handle empty arrays (return 0)
- All fetch calls must check `res.ok` before reading body

## Coordinate conventions

- NOAA/NWS use standard longitude: -156.92
- PacIOOS ERDDAP uses 0-360 format: 203.08
- Lanai lat: 20.83 (defined in `src/api/config.js`, do not redeclare)

## Unit conversions (use these exact constants)

- meters → feet: `* 3.28084`
- mm → inches: `/ 25.4`
- °C → °F: `* 9/5 + 32`
- m/s → mph: `* 2.23694`

## ERDDAP CSV format

- Row 0: headers, Row 1: units (skip), Row 2+: data
- Group spatial points by time, average to single value per timestep
