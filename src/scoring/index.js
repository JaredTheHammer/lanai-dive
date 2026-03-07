/**
 * Dive Condition Scoring Algorithm
 *
 * Produces a 0-100 composite score for skin diving / spearfishing conditions
 * near Lanai, Hawaii. Designed for south and west shore access (Hulopo'e Bay,
 * Kaumalapau Harbor, Shark's Cove, etc.).
 *
 * Factor weights:
 *   Wind       0.25  - speed and direction relative to dive shore
 *   Swell      0.25  - wave height, period, and direction
 *   Tide       0.15  - phase, rate of change, current estimate
 *   Rain       0.20  - recent precipitation affecting visibility via runoff
 *   Visibility 0.15  - composite estimate derived from other factors
 */

import { LANAI_ZONES } from '../data/zones.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  wind: 0.25,
  swell: 0.25,
  tide: 0.15,
  rain: 0.2,
  visibility: 0.15,
};

/** Visibility sub-factor weights (within the visibility score calculation). */
const VIS_WEIGHTS = { rain: 0.4, swell: 0.3, wind: 0.15, tide: 0.15 };

/** Score thresholds for label tiers (used across all factor and overall labels). */
const SCORE_EXCELLENT = 80;
const SCORE_GOOD = 60;
const SCORE_FAIR = 40;
const SCORE_POOR = 20;

/** Precipitation probability thresholds for forecast rain estimation. */
const PRECIP_PROB_LIKELY = 60;
const PRECIP_PROB_CHANCE = 30;

/** Estimated rain amounts (inches) when probability exceeds thresholds. */
const PRECIP_EST_LIKELY = 0.3;
const PRECIP_EST_CHANCE = 0.1;

/** Decay multipliers applied to existing rain totals in future forecasts. */
const RAIN_DECAY_24H = 0.5;
const RAIN_DECAY_48H = 0.3;

/**
 * Lanai south/west shore: typical dive sites face south (180) and west (270).
 * Offshore winds for these shores blow from N/NE (trade winds).
 * Onshore winds from S/SW are problematic.
 */
const SHORE_NORMALS = {
  south: 180, // Hulopo'e Bay
  west: 270, // Kaumalapau, Shark's Cove
};

// ---------------------------------------------------------------------------
// Individual Factor Scorers
// ---------------------------------------------------------------------------

/**
 * Score wind conditions.
 * @param {number} speedMph - Wind speed in mph
 * @param {number} directionDeg - Wind coming FROM direction (0 = N, 90 = E)
 * @returns {{ score: number, label: string, detail: string }}
 */
export function scoreWind(speedMph, directionDeg) {
  // Base score from speed (piecewise linear)
  const base = windSpeedBase(speedMph);

  // Direction modifier: how offshore/onshore is the wind relative to dive shores?
  const offshoreBonus = computeOffshoreModifier(directionDeg);
  const score = clamp(base + offshoreBonus, 0, 100);

  const compassDir = degreesToCompass(directionDeg);
  const label = windLabel(score);

  return {
    score: Math.round(score),
    label,
    detail: `${Math.round(speedMph)} mph from ${compassDir}`,
    raw: { speedMph, directionDeg },
  };
}

/**
 * Score swell / surf conditions.
 * @param {number} heightFt - Significant wave height in feet
 * @param {number} periodSec - Dominant wave period in seconds
 * @param {number} directionDeg - Swell coming FROM direction
 * @returns {{ score: number, label: string, detail: string }}
 */
export function scoreSwell(heightFt, periodSec, directionDeg) {
  // Base score from height
  const base = swellHeightBase(heightFt);

  // Period modifier: long period (ground swell) = cleaner, less turbulent
  const periodMod = swellPeriodModifier(periodSec);

  // Direction: swell from south/southwest directly hits south shore
  const swellExposure = computeSwellExposure(directionDeg);
  const dirMod = -swellExposure * 10; // 0 to -10 penalty for direct exposure

  const score = clamp(base + periodMod + dirMod, 0, 100);

  const label = swellLabel(score);

  return {
    score: Math.round(score),
    label,
    detail: `${heightFt.toFixed(1)} ft @ ${Math.round(periodSec)}s`,
    raw: { heightFt, periodSec, directionDeg },
  };
}

/**
 * Score tide conditions.
 * @param {number} currentLevel - Current tide level in feet (MLLW)
 * @param {number} rateOfChange - Rate of change (ft/hr), positive = rising
 * @param {object} nextSlack - { time: Date, type: 'high'|'low', level: number }
 * @returns {{ score: number, label: string, detail: string }}
 */
export function scoreTide(currentLevel, rateOfChange, nextSlack) {
  // Score based on rate of change (proxy for current strength)
  // Slack tide = minimal current = best for visibility and safety
  const absRate = Math.abs(rateOfChange);

  let base;
  if (absRate <= 0.1)
    base = 100; // Near slack
  else if (absRate <= 0.3) base = 85;
  else if (absRate <= 0.5) base = 65;
  else if (absRate <= 0.8) base = 45;
  else base = 25;

  // Slight preference for incoming (rising) tide: cleaner water pushed in
  const tideMod = rateOfChange > 0.05 ? 5 : 0;

  const score = clamp(base + tideMod, 0, 100);

  let label;
  if (absRate <= 0.15) label = 'Slack';
  else if (rateOfChange > 0) label = 'Rising';
  else label = 'Falling';

  const minutesToSlack = nextSlack
    ? Math.round((nextSlack.time.getTime() - Date.now()) / 60000)
    : null;

  let detail = `${currentLevel.toFixed(1)} ft, ${label.toLowerCase()}`;
  if (minutesToSlack !== null && minutesToSlack > 0) {
    const hrs = Math.floor(minutesToSlack / 60);
    const mins = minutesToSlack % 60;
    detail += ` | ${nextSlack.type} in ${hrs}h ${mins}m`;
  }

  return {
    score: Math.round(score),
    label,
    detail,
    raw: { currentLevel, rateOfChange, nextSlack },
  };
}

/**
 * Score recent rainfall / runoff conditions.
 * @param {number} rain24h - Precipitation in last 24h (inches)
 * @param {number} rain48h - Precipitation in last 48h (inches)
 * @param {boolean} currentlyRaining - Is it raining now?
 * @returns {{ score: number, label: string, detail: string }}
 */
export function scoreRain(rain24h, rain48h, currentlyRaining) {
  if (currentlyRaining && rain24h > 0.5) {
    return {
      score: 5,
      label: 'Heavy Rain',
      detail: `${rain24h.toFixed(2)}" in 24h, raining now`,
      raw: { rain24h, rain48h, currentlyRaining },
    };
  }
  if (currentlyRaining) {
    return {
      score: 30,
      label: 'Light Rain',
      detail: 'Currently raining',
      raw: { rain24h, rain48h, currentlyRaining },
    };
  }

  // Score based on recent rainfall (affects runoff / turbidity)
  // Lanai is drier than windward shores, so thresholds are lower
  let base;
  if (rain48h <= 0.01)
    base = 100; // Bone dry
  else if (rain48h <= 0.1)
    base = 90; // Trace
  else if (rain24h <= 0.1)
    base = 80; // Light rain > 24h ago, mostly cleared
  else if (rain24h <= 0.25)
    base = 65; // Light rain recent
  else if (rain24h <= 0.5)
    base = 45; // Moderate rain
  else if (rain24h <= 1.0)
    base = 25; // Heavy rain
  else base = 10; // Very heavy rain

  let label;
  if (base >= 80) label = 'Dry / Clear';
  else if (base >= 60) label = 'Light Rain';
  else if (base >= 40) label = 'Moderate Rain';
  else label = 'Heavy Runoff';

  let detail;
  if (rain48h <= 0.01) detail = 'No rain in 48+ hrs';
  else detail = `${rain24h.toFixed(2)}" last 24h, ${rain48h.toFixed(2)}" last 48h`;

  return { score: Math.round(base), label, detail, raw: { rain24h, rain48h, currentlyRaining } };
}

/**
 * Estimate underwater visibility from other factors.
 * This is a derived score -- no direct sensor data available from free APIs.
 * @param {object} params
 * @param {number} params.swellScore
 * @param {number} params.rainScore
 * @param {number} params.windScore
 * @param {number} params.tideScore
 * @returns {{ score: number, label: string, detail: string }}
 */
export function scoreVisibility({ swellScore, rainScore, windScore, tideScore }) {
  // Visibility is primarily affected by:
  //   1. Runoff (rain) -- biggest factor for turbidity
  //   2. Swell -- bottom stirring, surge
  //   3. Wind -- surface chop scatters light
  //   4. Tide -- current can carry turbid water
  const score = Math.round(
    rainScore * VIS_WEIGHTS.rain +
      swellScore * VIS_WEIGHTS.swell +
      windScore * VIS_WEIGHTS.wind +
      tideScore * VIS_WEIGHTS.tide,
  );

  let label, detail;
  if (score >= SCORE_EXCELLENT) {
    label = 'Excellent';
    detail = '60-100+ ft estimated';
  } else if (score >= SCORE_GOOD) {
    label = 'Good';
    detail = '30-60 ft estimated';
  } else if (score >= SCORE_FAIR) {
    label = 'Fair';
    detail = '15-30 ft estimated';
  } else if (score >= SCORE_POOR) {
    label = 'Poor';
    detail = '5-15 ft estimated';
  } else {
    label = 'Very Poor';
    detail = '< 5 ft estimated';
  }

  return { score, label, detail, raw: {} };
}

// ---------------------------------------------------------------------------
// Composite Score
// ---------------------------------------------------------------------------

/**
 * Compute overall dive condition score from all factors.
 * @param {object} conditions - Raw condition data
 * @returns {object} Full scoring breakdown
 */
export function computeDiveScore(conditions) {
  const {
    windSpeedMph,
    windDirectionDeg,
    swellHeightFt,
    swellPeriodSec,
    swellDirectionDeg,
    tideLevel,
    tideRate,
    nextSlack,
    rain24h,
    rain48h,
    currentlyRaining,
  } = conditions;

  const wind = scoreWind(windSpeedMph, windDirectionDeg);
  const swell = scoreSwell(swellHeightFt, swellPeriodSec, swellDirectionDeg);
  const tide = scoreTide(tideLevel, tideRate, nextSlack);
  const rain = scoreRain(rain24h, rain48h, currentlyRaining);
  const visibility = scoreVisibility({
    swellScore: swell.score,
    rainScore: rain.score,
    windScore: wind.score,
    tideScore: tide.score,
  });

  const overall = Math.round(
    wind.score * WEIGHTS.wind +
      swell.score * WEIGHTS.swell +
      tide.score * WEIGHTS.tide +
      rain.score * WEIGHTS.rain +
      visibility.score * WEIGHTS.visibility,
  );

  const { label: overallLabel, color: overallColor } = getOverallLabel(overall);

  return {
    overall,
    overallLabel,
    overallColor,
    factors: { wind, swell, tide, rain, visibility },
    weights: WEIGHTS,
    timestamp: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Piecewise-linear wind speed base score (0-100). */
function windSpeedBase(speedMph) {
  if (speedMph <= 5) return 100;
  if (speedMph <= 10) return 100 - (speedMph - 5) * 4; // 100 -> 80
  if (speedMph <= 15) return 80 - (speedMph - 10) * 6; // 80 -> 50
  if (speedMph <= 20) return 50 - (speedMph - 15) * 6; // 50 -> 20
  if (speedMph <= 25) return 20 - (speedMph - 20) * 4; // 20 -> 0
  return 0;
}

/** Piecewise-linear swell height base score (0-100). */
function swellHeightBase(heightFt) {
  if (heightFt <= 1) return 100;
  if (heightFt <= 2) return 100 - (heightFt - 1) * 10; // 100 -> 90
  if (heightFt <= 3) return 90 - (heightFt - 2) * 15; // 90 -> 75
  if (heightFt <= 5) return 75 - (heightFt - 3) * 15; // 75 -> 45
  if (heightFt <= 8) return 45 - (heightFt - 5) * 10; // 45 -> 15
  if (heightFt <= 12) return 15 - (heightFt - 8) * 3.75; // 15 -> 0
  return 0;
}

/** Period modifier: long period ground swell = cleaner. */
function swellPeriodModifier(periodSec) {
  if (periodSec > 14) return 5;
  if (periodSec > 10) return 2;
  if (periodSec < 7) return -5; // short-period wind swell = choppy
  return 0;
}

function degreesToCompass(deg) {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

function windLabel(score) {
  if (score >= SCORE_EXCELLENT) return 'Light / Offshore';
  if (score >= SCORE_GOOD) return 'Moderate';
  if (score >= SCORE_FAIR) return 'Choppy';
  return 'Strong / Onshore';
}

function swellLabel(score) {
  if (score >= SCORE_EXCELLENT) return 'Flat / Clean';
  if (score >= SCORE_GOOD) return 'Small Swell';
  if (score >= SCORE_FAIR) return 'Moderate Surf';
  return 'High Surf';
}

/**
 * How offshore is the wind for Lanai's south/west shores?
 * Returns -10 to +10 modifier.
 */
function computeOffshoreModifier(windFromDeg) {
  // For south shore (normal = 180): offshore = wind from N (0/360)
  // For west shore  (normal = 270): offshore = wind from E (90)
  // Average the two since we care about both coasts
  let bestMod = -10;
  for (const [, normal] of Object.entries(SHORE_NORMALS)) {
    // offshore = wind blowing FROM the opposite of shore normal
    const offshoreDir = (normal + 180) % 360;
    const diff = angleDiff(windFromDeg, offshoreDir);
    // diff = 0 -> perfectly offshore (+10)
    // diff = 90 -> cross-shore (0)
    // diff = 180 -> perfectly onshore (-10)
    const mod = 10 * (1 - diff / 90);
    bestMod = Math.max(bestMod, clamp(mod, -10, 10));
  }
  return bestMod;
}

/**
 * How exposed are the dive shores to the incoming swell direction?
 * Returns 0 (no exposure) to 1 (direct hit).
 */
function computeSwellExposure(swellFromDeg) {
  let maxExposure = 0;
  for (const [, normal] of Object.entries(SHORE_NORMALS)) {
    const diff = angleDiff(swellFromDeg, normal);
    // diff = 0 means swell hitting shore dead on
    const exposure = diff < 90 ? 1 - diff / 90 : 0;
    maxExposure = Math.max(maxExposure, exposure);
  }
  return maxExposure;
}

function angleDiff(a, b) {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export function getOverallLabel(score) {
  if (score >= SCORE_EXCELLENT) return { label: 'Excellent', color: '#22c55e', emoji: '\u{1F91F}' };
  if (score >= SCORE_GOOD) return { label: 'Good', color: '#84cc16', emoji: '\u{1F44D}' };
  if (score >= SCORE_FAIR) return { label: 'Fair', color: '#eab308', emoji: '\u{1F914}' };
  if (score >= SCORE_POOR) return { label: 'Poor', color: '#f97316', emoji: '\u26A0\uFE0F' };
  return { label: 'Dangerous', color: '#ef4444', emoji: '\u{1F6AB}' };
}

// ---------------------------------------------------------------------------
// Zone-Aware Scoring (for interactive map)
// ---------------------------------------------------------------------------

/**
 * Compute location-specific dive scores for each zone around Lanai.
 * Wind and swell scores are adapted per-zone based on shore orientation.
 * Tide, rain, and visibility remain island-wide.
 *
 * @param {object} conditions - Same shape as computeDiveScore input
 * @returns {Object.<string, object>} Map of zoneId -> scoring breakdown
 */
export function computeZoneScores(conditions) {
  const {
    windSpeedMph,
    windDirectionDeg,
    swellHeightFt,
    swellPeriodSec,
    swellDirectionDeg,
    tideLevel,
    tideRate,
    nextSlack,
    rain24h,
    rain48h,
    currentlyRaining,
  } = conditions;

  const tide = scoreTide(tideLevel, tideRate, nextSlack);
  const rain = scoreRain(rain24h, rain48h, currentlyRaining);

  const zoneScores = {};

  for (const [zoneId, zone] of Object.entries(LANAI_ZONES)) {
    const wind = scoreWindForZone(windSpeedMph, windDirectionDeg, zone.offshoreDirection);
    const swell = scoreSwellForZone(
      swellHeightFt,
      swellPeriodSec,
      swellDirectionDeg,
      zone.faceOrientation,
    );

    const visibility = scoreVisibility({
      swellScore: swell.score,
      rainScore: rain.score,
      windScore: wind.score,
      tideScore: tide.score,
    });

    const overall = Math.round(
      wind.score * WEIGHTS.wind +
        swell.score * WEIGHTS.swell +
        tide.score * WEIGHTS.tide +
        rain.score * WEIGHTS.rain +
        visibility.score * WEIGHTS.visibility,
    );

    const { label: overallLabel, color: overallColor } = getOverallLabel(overall);

    zoneScores[zoneId] = {
      overall,
      overallLabel,
      overallColor,
      factors: { wind, swell, tide, rain, visibility },
      weights: WEIGHTS,
      zone: { id: zone.id, name: zone.name, faceOrientation: zone.faceOrientation },
    };
  }

  return zoneScores;
}

/**
 * Wind scoring adapted for a specific zone's offshore direction.
 * Same piecewise-linear speed curve as scoreWind(), but the direction
 * modifier is relative to THIS zone's offshore direction rather than
 * the generic south/west average.
 */
function scoreWindForZone(speedMph, directionDeg, zoneOffshoreDir) {
  const base = windSpeedBase(speedMph);

  // Direction modifier: offshore for THIS zone
  const diff = angleDiff(directionDeg, zoneOffshoreDir);
  // diff = 0  -> perfectly offshore (+10)
  // diff = 90 -> cross-shore (0)
  // diff > 90 -> onshore (negative, down to -10)
  const offshoreBonus = clamp(10 * (1 - diff / 90), -10, 10);
  const score = clamp(base + offshoreBonus, 0, 100);

  const compassDir = degreesToCompass(directionDeg);
  const label = windLabel(score);

  return {
    score: Math.round(score),
    label,
    detail: `${Math.round(speedMph)} mph from ${compassDir}`,
    raw: { speedMph, directionDeg },
  };
}

/**
 * Swell scoring adapted for a specific zone's shore-facing direction.
 * Exposure penalty is relative to THIS zone's face orientation.
 */
function scoreSwellForZone(heightFt, periodSec, directionDeg, zoneFaceDir) {
  const base = swellHeightBase(heightFt);
  const periodMod = swellPeriodModifier(periodSec);

  // Zone-specific exposure: how directly is swell hitting THIS zone?
  const diff = angleDiff(directionDeg, zoneFaceDir);
  const exposure = diff < 90 ? 1 - diff / 90 : 0;
  const dirMod = -exposure * 10;

  const score = clamp(base + periodMod + dirMod, 0, 100);

  const label = swellLabel(score);

  return {
    score: Math.round(score),
    label,
    detail: `${heightFt.toFixed(1)} ft @ ${Math.round(periodSec)}s`,
    raw: { heightFt, periodSec, directionDeg },
  };
}

export {
  WEIGHTS,
  VIS_WEIGHTS,
  SCORE_EXCELLENT,
  SCORE_GOOD,
  SCORE_FAIR,
  SCORE_POOR,
  PRECIP_PROB_LIKELY,
  PRECIP_PROB_CHANCE,
  PRECIP_EST_LIKELY,
  PRECIP_EST_CHANCE,
  RAIN_DECAY_24H,
  RAIN_DECAY_48H,
  scoreWindForZone,
  scoreSwellForZone,
};
