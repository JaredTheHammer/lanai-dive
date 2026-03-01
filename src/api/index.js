/**
 * Unified API layer -- aggregates all data sources into a single
 * conditions object suitable for the scoring algorithm.
 */

import { fetchTidePredictions, fetchTideExtremes, computeTideState } from './tides.js';
import { fetchCurrentWind, fetchPrecipitation, fetchHourlyForecast } from './weather.js';
import { fetchBuoyData } from './buoy.js';
import { computeDiveScore, computeZoneScores, scoreWindForZone, scoreSwellForZone } from '../scoring/index.js';
import { LANAI_ZONES } from '../data/zones.js';
import { getMoonPhase } from './moonphase.js';
import {
  getSeasonScoreModifier,
  getLobsterSeasonStatus,
  getInSeasonSpecies,
  getHarvestableSpeciesForZone,
  SPECIES,
} from '../data/species.js';

/**
 * Fetch all condition data and compute the dive score.
 * Handles partial failures gracefully -- uses fallback values
 * rather than failing the entire request.
 */
export async function fetchAllConditions() {
  const errors = [];

  // Fire all requests concurrently
  const [tideResult, extremeResult, windResult, precipResult, buoyResult, hourlyResult] =
    await Promise.allSettled([
      fetchTidePredictions(),
      fetchTideExtremes(),
      fetchCurrentWind(),
      fetchPrecipitation(),
      fetchBuoyData(),
      fetchHourlyForecast()
    ]);

  // --- Tides ---
  let tideState = { level: 1.0, rateOfChange: 0, nextSlack: null };
  let tidePredictions = [];
  let tideExtremes = [];

  if (tideResult.status === 'fulfilled' && extremeResult.status === 'fulfilled') {
    tidePredictions = tideResult.value;
    tideExtremes = extremeResult.value;
    tideState = computeTideState(tidePredictions, tideExtremes);
  } else {
    errors.push({ source: 'tides', error: tideResult.reason?.message || extremeResult.reason?.message });
  }

  // --- Wind ---
  let wind = { speedMph: 10, directionDeg: 45, forecast: 'Data unavailable' };
  if (windResult.status === 'fulfilled') {
    wind = windResult.value;
  } else {
    errors.push({ source: 'wind', error: windResult.reason?.message });
    // Try buoy wind as fallback
    if (buoyResult.status === 'fulfilled' && buoyResult.value.windSpeed !== null) {
      wind = {
        speedMph: buoyResult.value.windSpeed,
        directionDeg: buoyResult.value.windDirection || 45,
        forecast: 'From buoy (NWS unavailable)'
      };
    }
  }

  // --- Precipitation ---
  let precip = { rain24h: 0, rain48h: 0, currentlyRaining: false };
  if (precipResult.status === 'fulfilled') {
    precip = precipResult.value;
  } else {
    errors.push({ source: 'precipitation', error: precipResult.reason?.message });
  }

  // --- Buoy / Swell ---
  let swell = { heightFt: 2, periodSec: 10, directionDeg: 180, waterTempF: null };
  if (buoyResult.status === 'fulfilled') {
    const b = buoyResult.value;
    swell = {
      heightFt: b.waveHeight ?? 2,
      periodSec: b.dominantPeriod ?? 10,
      directionDeg: b.meanDirection ?? 180,
      waterTempF: b.waterTemp
    };
  } else {
    errors.push({ source: 'buoy', error: buoyResult.reason?.message });
  }

  // --- Hourly Forecast (for timeline) ---
  let hourlyForecast = [];
  if (hourlyResult.status === 'fulfilled') {
    hourlyForecast = hourlyResult.value;
  } else {
    errors.push({ source: 'hourly', error: hourlyResult.reason?.message });
  }

  // --- Compute dive score ---
  const conditions = {
    windSpeedMph: wind.speedMph,
    windDirectionDeg: wind.directionDeg,
    swellHeightFt: swell.heightFt,
    swellPeriodSec: swell.periodSec,
    swellDirectionDeg: swell.directionDeg,
    tideLevel: tideState.level,
    tideRate: tideState.rateOfChange,
    nextSlack: tideState.nextSlack,
    rain24h: precip.rain24h,
    rain48h: precip.rain48h,
    currentlyRaining: precip.currentlyRaining
  };

  const score = computeDiveScore(conditions);

  // Zone-specific scores for map view
  const zoneScores = computeZoneScores(conditions);

  // Moon phase (client-side, no API call)
  const moonPhase = getMoonPhase();

  // Compute forecast scores for the timeline
  const forecastScores = computeForecastTimeline(hourlyForecast, tideExtremes, tidePredictions, swell, precip);

  // Per-zone forecast timelines
  const zoneForecastScores = computeZoneForecastTimeline(hourlyForecast, tideExtremes, tidePredictions, swell, precip);

  // --- Season & Species Annotations ---
  const now = new Date();
  const seasonInfo = {
    lobster: getLobsterSeasonStatus(now),
    spearfishing: getSeasonScoreModifier(now, 'spearfishing'),
    all: getSeasonScoreModifier(now, 'all'),
    inSeasonSpecies: getInSeasonSpecies(now),
    totalSpecies: SPECIES.length,
  };

  // Per-zone harvestable species counts
  const zoneSpecies = {};
  for (const zoneId of Object.keys(zoneScores)) {
    const harvestable = getHarvestableSpeciesForZone(zoneId, now);
    zoneSpecies[zoneId] = {
      count: harvestable.length,
      species: harvestable.map(s => ({
        id: s.id,
        commonName: s.commonName,
        hawaiianName: s.hawaiianName,
        category: s.category,
      })),
    };
  }

  return {
    score,
    zoneScores,
    moonPhase,
    seasonInfo,
    zoneSpecies,
    conditions,
    tidePredictions,
    tideExtremes,
    hourlyForecast,
    forecastScores,
    zoneForecastScores,
    waterTemp: swell.waterTempF,
    buoyTime: buoyResult.status === 'fulfilled' ? buoyResult.value.time : null,
    errors,
    fetchedAt: new Date()
  };
}

/**
 * Project dive scores into the future based on hourly forecast data.
 * Returns array of { time, score, label, color } for the next 48 hours.
 */
function computeForecastTimeline(hourlyForecast, tideExtremes, tidePredictions, currentSwell, currentPrecip) {
  if (!hourlyForecast.length) return [];

  return hourlyForecast.slice(0, 48).map(hour => {
    // Find tide state at this hour
    let tideLevel = 1.0, tideRate = 0, nextSlack = null;
    if (tidePredictions.length) {
      const t = hour.time.getTime();
      for (let i = 0; i < tidePredictions.length - 1; i++) {
        if (tidePredictions[i].time.getTime() <= t && tidePredictions[i + 1].time.getTime() > t) {
          const frac = (t - tidePredictions[i].time.getTime()) /
                       (tidePredictions[i + 1].time.getTime() - tidePredictions[i].time.getTime());
          tideLevel = tidePredictions[i].height + frac * (tidePredictions[i + 1].height - tidePredictions[i].height);
          const dt = (tidePredictions[i + 1].time.getTime() - tidePredictions[i].time.getTime()) / 3600000;
          tideRate = (tidePredictions[i + 1].height - tidePredictions[i].height) / dt;
          break;
        }
      }
      nextSlack = tideExtremes.find(e => e.time.getTime() > t);
      if (nextSlack) {
        nextSlack = { time: nextSlack.time, type: nextSlack.type === 'H' ? 'high' : 'low', level: nextSlack.height };
      }
    }

    // Estimate rain at this hour from precip probability
    const precipEst = hour.precipProbability > 60 ? 0.3 : hour.precipProbability > 30 ? 0.1 : 0;

    const conditions = {
      windSpeedMph: hour.windSpeedMph,
      windDirectionDeg: hour.windDirectionDeg,
      swellHeightFt: currentSwell.heightFt,     // Swell doesn't change much hour-to-hour
      swellPeriodSec: currentSwell.periodSec,
      swellDirectionDeg: currentSwell.directionDeg,
      tideLevel,
      tideRate,
      nextSlack,
      rain24h: precipEst + currentPrecip.rain24h * 0.5,  // Decay previous rain
      rain48h: precipEst + currentPrecip.rain48h * 0.3,
      currentlyRaining: hour.isRaining
    };

    const result = computeDiveScore(conditions);

    return {
      time: hour.time,
      score: result.overall,
      label: result.overallLabel,
      color: result.overallColor,
      wind: hour.windSpeedMph,
      forecast: hour.shortForecast,
      isDaytime: hour.isDaytime
    };
  });
}

/**
 * Per-zone forecast timeline: compute zone-specific scores for each forecast hour.
 * Returns { [zoneId]: [{ time, score, color, label, wind, forecast, isDaytime }] }
 */
function computeZoneForecastTimeline(hourlyForecast, tideExtremes, tidePredictions, currentSwell, currentPrecip) {
  if (!hourlyForecast.length) return {};

  const result = {};
  for (const zoneId of Object.keys(LANAI_ZONES)) {
    result[zoneId] = [];
  }

  const hours = hourlyForecast.slice(0, 48);

  for (const hour of hours) {
    // Find tide state at this hour (same logic as computeForecastTimeline)
    let tideLevel = 1.0, tideRate = 0, nextSlack = null;
    if (tidePredictions.length) {
      const t = hour.time.getTime();
      for (let i = 0; i < tidePredictions.length - 1; i++) {
        if (tidePredictions[i].time.getTime() <= t && tidePredictions[i + 1].time.getTime() > t) {
          const frac = (t - tidePredictions[i].time.getTime()) /
                       (tidePredictions[i + 1].time.getTime() - tidePredictions[i].time.getTime());
          tideLevel = tidePredictions[i].height + frac * (tidePredictions[i + 1].height - tidePredictions[i].height);
          const dt = (tidePredictions[i + 1].time.getTime() - tidePredictions[i].time.getTime()) / 3600000;
          tideRate = (tidePredictions[i + 1].height - tidePredictions[i].height) / dt;
          break;
        }
      }
      nextSlack = tideExtremes.find(e => e.time.getTime() > t);
      if (nextSlack) {
        nextSlack = { time: nextSlack.time, type: nextSlack.type === 'H' ? 'high' : 'low', level: nextSlack.height };
      }
    }

    const precipEst = hour.precipProbability > 60 ? 0.3 : hour.precipProbability > 30 ? 0.1 : 0;

    const conditions = {
      windSpeedMph: hour.windSpeedMph,
      windDirectionDeg: hour.windDirectionDeg,
      swellHeightFt: currentSwell.heightFt,
      swellPeriodSec: currentSwell.periodSec,
      swellDirectionDeg: currentSwell.directionDeg,
      tideLevel,
      tideRate,
      nextSlack,
      rain24h: precipEst + currentPrecip.rain24h * 0.5,
      rain48h: precipEst + currentPrecip.rain48h * 0.3,
      currentlyRaining: hour.isRaining,
    };

    // Score each zone at this hour
    const zoneScoresAtHour = computeZoneScores(conditions);
    for (const [zoneId, zs] of Object.entries(zoneScoresAtHour)) {
      result[zoneId].push({
        time: hour.time,
        score: zs.overall,
        color: zs.overallColor,
        label: zs.overallLabel,
        wind: hour.windSpeedMph,
        forecast: hour.shortForecast,
        isDaytime: hour.isDaytime,
      });
    }
  }

  return result;
}

// Re-export for convenience
export { fetchTidePredictions, fetchTideExtremes } from './tides.js';
export { fetchHourlyForecast } from './weather.js';
export { fetchBuoyData } from './buoy.js';
