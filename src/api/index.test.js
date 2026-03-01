/**
 * Unified API layer integration tests.
 * Tests fetchAllConditions with fully mocked sub-modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllConditions } from './index.js';

// Mock all sub-modules
vi.mock('./tides.js', () => ({
  fetchTidePredictions: vi.fn(),
  fetchTideExtremes: vi.fn(),
  computeTideState: vi.fn(),
}));

vi.mock('./weather.js', () => ({
  fetchCurrentWind: vi.fn(),
  fetchPrecipitation: vi.fn(),
  fetchHourlyForecast: vi.fn(),
}));

vi.mock('./buoy.js', () => ({
  fetchBuoyData: vi.fn(),
}));

vi.mock('./moonphase.js', () => ({
  getMoonPhase: vi.fn(() => ({
    phase: 'waxing_crescent',
    illumination: 0.25,
    emoji: '🌒',
    label: 'Waxing Crescent',
  })),
}));

vi.mock('../scoring/index.js', () => ({
  computeDiveScore: vi.fn(() => ({
    overall: 72,
    overallLabel: 'Good',
    overallColor: '#84cc16',
    wind: 80,
    swell: 70,
    tide: 65,
    visibility: 75,
  })),
  computeZoneScores: vi.fn(() => ({
    south_shore: { overall: 80, overallLabel: 'Good', overallColor: '#84cc16' },
    southwest: { overall: 65, overallLabel: 'Good', overallColor: '#84cc16' },
    west: { overall: 50, overallLabel: 'Fair', overallColor: '#eab308' },
    northwest: { overall: 30, overallLabel: 'Poor', overallColor: '#f97316' },
    north: { overall: 25, overallLabel: 'Poor', overallColor: '#f97316' },
    east: { overall: 45, overallLabel: 'Fair', overallColor: '#eab308' },
  })),
}));

vi.mock('../data/species.js', () => ({
  getSeasonScoreModifier: vi.fn(() => 0),
  getLobsterSeasonStatus: vi.fn(() => ({ open: true, label: 'Open Season' })),
  getInSeasonSpecies: vi.fn(() => []),
  getHarvestableSpeciesForZone: vi.fn(() => []),
  SPECIES: [],
}));

// Import mocked modules for per-test configuration
import { fetchTidePredictions, fetchTideExtremes, computeTideState } from './tides.js';
import { fetchCurrentWind, fetchPrecipitation, fetchHourlyForecast } from './weather.js';
import { fetchBuoyData } from './buoy.js';

const MOCK_PREDICTIONS = [
  { time: new Date(Date.now() - 60000), height: 1.2 },
  { time: new Date(Date.now() + 60000), height: 1.3 },
];

const MOCK_EXTREMES = [
  { time: new Date(Date.now() + 3600000), height: 2.0, type: 'H' },
];

function setDefaultMocks() {
  fetchTidePredictions.mockResolvedValue(MOCK_PREDICTIONS);
  fetchTideExtremes.mockResolvedValue(MOCK_EXTREMES);
  computeTideState.mockReturnValue({
    level: 1.25,
    rateOfChange: 0.1,
    nextSlack: { time: new Date(Date.now() + 3600000), type: 'high', level: 2.0 },
  });
  fetchCurrentWind.mockResolvedValue({
    speedMph: 12,
    directionDeg: 45,
    forecast: 'Partly Cloudy',
  });
  fetchPrecipitation.mockResolvedValue({
    rain24h: 0.1,
    rain48h: 0.3,
    currentlyRaining: false,
  });
  fetchBuoyData.mockResolvedValue({
    waveHeight: 3.0,
    dominantPeriod: 12,
    meanDirection: 190,
    waterTemp: 77.5,
    windSpeed: 8,
    windDirection: 50,
    time: new Date(),
    stationId: '51213',
  });
  fetchHourlyForecast.mockResolvedValue([]);
}

describe('fetchAllConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('returns a complete result object', async () => {
    const result = await fetchAllConditions();

    expect(result.score).toBeDefined();
    expect(result.score.overall).toBe(72);
    expect(result.zoneScores).toBeDefined();
    expect(result.conditions).toBeDefined();
    expect(result.moonPhase).toBeDefined();
    expect(result.fetchedAt).toBeInstanceOf(Date);
    expect(result.errors).toEqual([]);
  });

  it('assembles conditions from wind, swell, tide, and precip', async () => {
    const result = await fetchAllConditions();

    expect(result.conditions.windSpeedMph).toBe(12);
    expect(result.conditions.windDirectionDeg).toBe(45);
    expect(result.conditions.swellHeightFt).toBe(3.0);
    expect(result.conditions.swellPeriodSec).toBe(12);
    expect(result.conditions.tideLevel).toBe(1.25);
    expect(result.conditions.rain24h).toBe(0.1);
  });

  it('includes water temperature from buoy', async () => {
    const result = await fetchAllConditions();
    expect(result.waterTemp).toBe(77.5);
  });

  it('handles tide API failure gracefully', async () => {
    fetchTidePredictions.mockRejectedValue(new Error('timeout'));
    fetchTideExtremes.mockRejectedValue(new Error('timeout'));

    const result = await fetchAllConditions();

    // Should use fallback tide values
    expect(result.conditions.tideLevel).toBe(1.0);
    expect(result.conditions.tideRate).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].source).toBe('tides');
  });

  it('falls back to buoy wind when NWS wind fails', async () => {
    fetchCurrentWind.mockRejectedValue(new Error('NWS down'));

    const result = await fetchAllConditions();

    // Should use buoy wind as fallback
    expect(result.conditions.windSpeedMph).toBe(8);
    expect(result.conditions.windDirectionDeg).toBe(50);
    expect(result.errors.some(e => e.source === 'wind')).toBe(true);
  });

  it('uses default wind when both NWS and buoy fail', async () => {
    fetchCurrentWind.mockRejectedValue(new Error('NWS down'));
    fetchBuoyData.mockRejectedValue(new Error('buoy down'));

    const result = await fetchAllConditions();

    // Should use hardcoded fallback
    expect(result.conditions.windSpeedMph).toBe(10);
    expect(result.conditions.windDirectionDeg).toBe(45);
  });

  it('handles precipitation failure gracefully', async () => {
    fetchPrecipitation.mockRejectedValue(new Error('precip error'));

    const result = await fetchAllConditions();

    expect(result.conditions.rain24h).toBe(0);
    expect(result.conditions.currentlyRaining).toBe(false);
    expect(result.errors.some(e => e.source === 'precipitation')).toBe(true);
  });

  it('handles buoy failure with fallback swell', async () => {
    fetchBuoyData.mockRejectedValue(new Error('buoy unreachable'));

    const result = await fetchAllConditions();

    expect(result.conditions.swellHeightFt).toBe(2);  // fallback
    expect(result.conditions.swellPeriodSec).toBe(10); // fallback
    expect(result.waterTemp).toBeNull();
  });

  it('handles all APIs failing simultaneously', async () => {
    fetchTidePredictions.mockRejectedValue(new Error('fail'));
    fetchTideExtremes.mockRejectedValue(new Error('fail'));
    fetchCurrentWind.mockRejectedValue(new Error('fail'));
    fetchPrecipitation.mockRejectedValue(new Error('fail'));
    fetchBuoyData.mockRejectedValue(new Error('fail'));
    fetchHourlyForecast.mockRejectedValue(new Error('fail'));

    const result = await fetchAllConditions();

    // Should still return a result with fallback values
    expect(result.score).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('includes buoyTime when buoy succeeds', async () => {
    const now = new Date();
    fetchBuoyData.mockResolvedValue({
      waveHeight: 3.0,
      dominantPeriod: 12,
      meanDirection: 190,
      waterTemp: 77.5,
      windSpeed: 8,
      windDirection: 50,
      time: now,
      stationId: '51213',
    });

    const result = await fetchAllConditions();
    expect(result.buoyTime).toEqual(now);
  });

  it('buoyTime is null when buoy fails', async () => {
    fetchBuoyData.mockRejectedValue(new Error('fail'));

    const result = await fetchAllConditions();
    expect(result.buoyTime).toBeNull();
  });

  it('includes seasonInfo and zoneSpecies', async () => {
    const result = await fetchAllConditions();

    expect(result.seasonInfo).toBeDefined();
    expect(result.seasonInfo.lobster).toBeDefined();
    expect(result.zoneSpecies).toBeDefined();
  });
});
