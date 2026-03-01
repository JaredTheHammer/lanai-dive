/**
 * API configuration for Lanai dive conditions.
 *
 * In dev mode, Vite's proxy rewrites /api/* to the actual NOAA/NWS endpoints.
 * In production, set VITE_API_BASE to your API Gateway URL (which fronts
 * a Lambda that proxies these same endpoints to handle CORS).
 */

export const API_BASE = import.meta.env.VITE_API_BASE || '';

// NOAA CO-OPS: Kahului Harbor, Maui (closest active tide station to Lanai)
export const TIDE_STATION = '1615680';

// NDBC Buoy: PacIOOS 51213 (Lanai Southwest, ~4km from Kaumalapau Harbor)
export const BUOY_STATION = '51213';

// NWS gridpoint for Lanai (south/west coast area)
export const LANAI_LAT = 20.83;
export const LANAI_LON = -156.92;

// Polling intervals
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
