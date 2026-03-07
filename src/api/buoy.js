/**
 * NDBC Buoy Data integration
 * Station: 51213 (PacIOOS Lanai Southwest)
 * Data: real-time text files, updated every 30 minutes
 *
 * Format reference: https://www.ndbc.noaa.gov/measdes.shtml
 */

import {
  API_BASE,
  BUOY_STATION,
  M_TO_FT,
  C_TO_F_RATIO,
  C_TO_F_OFFSET,
  MS_TO_MPH,
} from './config.js';

/**
 * Fetch latest buoy observations.
 * Parses the NDBC fixed-width text format.
 *
 * Returns {
 *   waveHeight: number (ft),
 *   dominantPeriod: number (s),
 *   meanDirection: number (deg),
 *   waterTemp: number (F) | null,
 *   windSpeed: number (mph) | null,
 *   windDirection: number (deg) | null,
 *   time: Date,
 *   stationId: string
 * }
 */
export async function fetchBuoyData() {
  const res = await fetch(`${API_BASE}/api/buoy/${BUOY_STATION}.txt`);
  if (!res.ok) throw new Error(`Buoy API error: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n');

  // First two lines are headers
  // Line 0: column names  #YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
  // Line 1: units         #yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft
  // Line 2+: data

  if (lines.length < 3) throw new Error('Insufficient buoy data');

  const headers = lines[0].replace(/^#/, '').trim().split(/\s+/);
  const dataLine = lines[2].trim().split(/\s+/);

  const getVal = (name) => {
    const idx = headers.indexOf(name);
    if (idx === -1) return null;
    const val = parseFloat(dataLine[idx]);
    return isNaN(val) || val === 99 || val === 999 || val === 9999 ? null : val;
  };

  // Parse time
  const yr = parseInt(dataLine[0]);
  const mo = parseInt(dataLine[1]) - 1;
  const dy = parseInt(dataLine[2]);
  const hr = parseInt(dataLine[3]);
  const mn = parseInt(dataLine[4]);
  const time = new Date(Date.UTC(yr, mo, dy, hr, mn));

  // Wave height in meters -> feet
  const wvhtM = getVal('WVHT');
  const waveHeight = wvhtM !== null ? wvhtM * M_TO_FT : null;

  // Dominant period (seconds)
  const dominantPeriod = getVal('DPD');

  // Mean wave direction (degrees)
  const meanDirection = getVal('MWD');

  // Water temperature (C -> F)
  const wtmpC = getVal('WTMP');
  const waterTemp = wtmpC !== null ? wtmpC * C_TO_F_RATIO + C_TO_F_OFFSET : null;

  // Wind (backup source if NWS is down)
  const wspdMs = getVal('WSPD');
  const windSpeed = wspdMs !== null ? wspdMs * MS_TO_MPH : null;
  const windDirection = getVal('WDIR');

  return {
    waveHeight,
    dominantPeriod,
    meanDirection,
    waterTemp,
    windSpeed,
    windDirection,
    time,
    stationId: BUOY_STATION,
  };
}

/**
 * Parse spectral wave data for more detailed swell breakdown.
 * (Future enhancement: fetch .spec file for primary/secondary swell separation)
 */
export async function fetchBuoySpectral() {
  // Placeholder for future enhancement
  return null;
}
