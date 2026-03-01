/**
 * Scoring Algorithm Unit Tests
 *
 * Tests every factor scorer, composite scoring, zone-specific scoring,
 * helper functions, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreWind,
  scoreSwell,
  scoreTide,
  scoreRain,
  scoreVisibility,
  computeDiveScore,
  computeZoneScores,
  getOverallLabel,
  WEIGHTS,
} from './index.js';

// ---------------------------------------------------------------------------
// scoreWind
// ---------------------------------------------------------------------------
describe('scoreWind', () => {
  it('scores calm wind (<= 5 mph) as 100 base', () => {
    expect(scoreWind(0, 0).score).toBeGreaterThanOrEqual(95);
    expect(scoreWind(5, 0).score).toBeGreaterThanOrEqual(95);
  });

  it('degrades linearly through speed brackets', () => {
    const s5 = scoreWind(5, 90).score;
    const s10 = scoreWind(10, 90).score;
    const s15 = scoreWind(15, 90).score;
    const s20 = scoreWind(20, 90).score;
    expect(s5).toBeGreaterThan(s10);
    expect(s10).toBeGreaterThan(s15);
    expect(s15).toBeGreaterThan(s20);
  });

  it('scores gale wind (> 25 mph) near 0', () => {
    const result = scoreWind(30, 180);
    expect(result.score).toBeLessThanOrEqual(5);
  });

  it('rewards offshore direction for south shore (wind from N)', () => {
    // North wind (0 deg) is offshore for south shore (normal=180, offshore=0)
    const offshore = scoreWind(12, 0).score;
    const onshore = scoreWind(12, 180).score;
    expect(offshore).toBeGreaterThan(onshore);
  });

  it('rewards offshore direction for west shore (wind from E)', () => {
    // East wind (90 deg) is offshore for west shore (normal=270, offshore=90)
    const offshore = scoreWind(12, 90).score;
    const onshore = scoreWind(12, 270).score;
    expect(offshore).toBeGreaterThan(onshore);
  });

  it('detail includes speed and compass direction', () => {
    const result = scoreWind(15, 45);
    expect(result.detail).toContain('15');
    expect(result.detail).toContain('NE');
  });

  it('labels match score ranges', () => {
    expect(scoreWind(3, 0).label).toContain('Light');
    expect(scoreWind(22, 180).label).toContain('Strong');
  });

  it('returns raw data', () => {
    const result = scoreWind(10, 90);
    expect(result.raw.speedMph).toBe(10);
    expect(result.raw.directionDeg).toBe(90);
  });

  it('clamps score to [0, 100]', () => {
    // Very calm + perfectly offshore should not exceed 100
    const result = scoreWind(0, 0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// scoreSwell
// ---------------------------------------------------------------------------
describe('scoreSwell', () => {
  it('scores flat conditions (<= 1 ft) as 100', () => {
    expect(scoreSwell(0.5, 12, 0).score).toBe(100);
    expect(scoreSwell(1.0, 12, 0).score).toBeGreaterThanOrEqual(95);
  });

  it('degrades with increasing height', () => {
    const s1 = scoreSwell(1, 10, 90).score;
    const s3 = scoreSwell(3, 10, 90).score;
    const s6 = scoreSwell(6, 10, 90).score;
    const s10 = scoreSwell(10, 10, 90).score;
    expect(s1).toBeGreaterThan(s3);
    expect(s3).toBeGreaterThan(s6);
    expect(s6).toBeGreaterThan(s10);
  });

  it('scores huge surf (> 12 ft) near 0', () => {
    expect(scoreSwell(15, 10, 180).score).toBeLessThanOrEqual(5);
  });

  it('rewards long period (ground swell)', () => {
    const longPeriod = scoreSwell(3, 16, 90).score;
    const shortPeriod = scoreSwell(3, 6, 90).score;
    expect(longPeriod).toBeGreaterThan(shortPeriod);
  });

  it('penalizes short period (wind swell)', () => {
    const medPeriod = scoreSwell(3, 10, 90).score;
    const shortPeriod = scoreSwell(3, 5, 90).score;
    expect(medPeriod).toBeGreaterThan(shortPeriod);
  });

  it('penalizes swell hitting south shore head-on', () => {
    // South swell (180) hits south shore (normal 180) directly
    const headOn = scoreSwell(3, 10, 180).score;
    // North swell (0) wraps around, does not hit south shore
    const sheltered = scoreSwell(3, 10, 0).score;
    expect(sheltered).toBeGreaterThan(headOn);
  });

  it('detail shows height and period', () => {
    const result = scoreSwell(4.2, 11, 200);
    expect(result.detail).toContain('4.2');
    expect(result.detail).toContain('11s');
  });
});

// ---------------------------------------------------------------------------
// scoreTide
// ---------------------------------------------------------------------------
describe('scoreTide', () => {
  const futureSlack = { time: new Date(Date.now() + 3600000), type: 'high', level: 2.0 };

  it('scores near-slack (rate ~ 0) as excellent', () => {
    const result = scoreTide(1.0, 0.05, futureSlack);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.label).toBe('Slack');
  });

  it('degrades with increasing rate of change', () => {
    const slack = scoreTide(1.0, 0.05, futureSlack).score;
    const moderate = scoreTide(1.0, 0.4, futureSlack).score;
    const strong = scoreTide(1.0, 0.9, futureSlack).score;
    expect(slack).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(strong);
  });

  it('gives bonus for rising tide', () => {
    const rising = scoreTide(1.0, 0.3, futureSlack).score;
    const falling = scoreTide(1.0, -0.3, futureSlack).score;
    expect(rising).toBeGreaterThan(falling);
  });

  it('handles null nextSlack gracefully', () => {
    const result = scoreTide(1.5, 0.2, null);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.detail).toBeDefined();
  });

  it('shows time to next slack in detail', () => {
    const result = scoreTide(1.0, 0.2, futureSlack);
    expect(result.detail).toContain('high in');
  });
});

// ---------------------------------------------------------------------------
// scoreRain
// ---------------------------------------------------------------------------
describe('scoreRain', () => {
  it('scores bone dry as 100', () => {
    const result = scoreRain(0, 0, false);
    expect(result.score).toBe(100);
    expect(result.label).toBe('Dry / Clear');
  });

  it('degrades with increasing rainfall', () => {
    const dry = scoreRain(0, 0, false).score;
    const light = scoreRain(0.15, 0.2, false).score;
    const heavy = scoreRain(0.8, 1.2, false).score;
    expect(dry).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(heavy);
  });

  it('heavily penalizes current rain + accumulation', () => {
    const result = scoreRain(0.6, 1.0, true);
    expect(result.score).toBe(5);
    expect(result.label).toBe('Heavy Rain');
  });

  it('penalizes current rain alone', () => {
    const result = scoreRain(0, 0, true);
    expect(result.score).toBe(30);
    expect(result.label).toBe('Light Rain');
  });

  it('distinguishes 24h vs 48h rainfall windows', () => {
    // Light rain only in 48h window, not recent 24h
    const old = scoreRain(0, 0.08, false).score;
    // Same total but within 24h
    const recent = scoreRain(0.08, 0.08, false).score;
    expect(old).toBeGreaterThanOrEqual(recent);
  });
});

// ---------------------------------------------------------------------------
// scoreVisibility
// ---------------------------------------------------------------------------
describe('scoreVisibility', () => {
  it('excellent when all factors are high', () => {
    const result = scoreVisibility({ rainScore: 100, swellScore: 100, windScore: 100, tideScore: 100 });
    expect(result.score).toBe(100);
    expect(result.label).toBe('Excellent');
  });

  it('poor when all factors are low', () => {
    const result = scoreVisibility({ rainScore: 10, swellScore: 10, windScore: 10, tideScore: 10 });
    expect(result.score).toBe(10);
    expect(result.label).toBe('Very Poor');
  });

  it('weights rain most heavily (0.40)', () => {
    const goodRain = scoreVisibility({ rainScore: 100, swellScore: 50, windScore: 50, tideScore: 50 }).score;
    const badRain = scoreVisibility({ rainScore: 0, swellScore: 50, windScore: 50, tideScore: 50 }).score;
    // Difference should be ~40 points (rain weight is 0.40)
    expect(goodRain - badRain).toBeGreaterThanOrEqual(35);
  });

  it('weights swell second (0.30)', () => {
    const goodSwell = scoreVisibility({ rainScore: 50, swellScore: 100, windScore: 50, tideScore: 50 }).score;
    const badSwell = scoreVisibility({ rainScore: 50, swellScore: 0, windScore: 50, tideScore: 50 }).score;
    expect(goodSwell - badSwell).toBeGreaterThanOrEqual(25);
  });

  it('provides estimated depth range in detail', () => {
    const excellent = scoreVisibility({ rainScore: 100, swellScore: 100, windScore: 100, tideScore: 100 });
    expect(excellent.detail).toContain('100');
  });
});

// ---------------------------------------------------------------------------
// computeDiveScore (composite)
// ---------------------------------------------------------------------------
describe('computeDiveScore', () => {
  const goodConditions = {
    windSpeedMph: 5,
    windDirectionDeg: 0,
    swellHeightFt: 1,
    swellPeriodSec: 12,
    swellDirectionDeg: 0,
    tideLevel: 1.0,
    tideRate: 0.05,
    nextSlack: { time: new Date(Date.now() + 3600000), type: 'high', level: 2 },
    rain24h: 0,
    rain48h: 0,
    currentlyRaining: false,
  };

  const badConditions = {
    windSpeedMph: 25,
    windDirectionDeg: 180,
    swellHeightFt: 10,
    swellPeriodSec: 6,
    swellDirectionDeg: 180,
    tideLevel: 1.0,
    tideRate: 0.9,
    nextSlack: null,
    rain24h: 1.0,
    rain48h: 2.0,
    currentlyRaining: true,
  };

  it('returns score between 0 and 100', () => {
    const result = computeDiveScore(goodConditions);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('good conditions produce high score', () => {
    const result = computeDiveScore(goodConditions);
    expect(result.overall).toBeGreaterThanOrEqual(80);
  });

  it('bad conditions produce low score', () => {
    const result = computeDiveScore(badConditions);
    expect(result.overall).toBeLessThanOrEqual(20);
  });

  it('returns all 5 factor breakdowns', () => {
    const result = computeDiveScore(goodConditions);
    expect(result.factors.wind).toBeDefined();
    expect(result.factors.swell).toBeDefined();
    expect(result.factors.tide).toBeDefined();
    expect(result.factors.rain).toBeDefined();
    expect(result.factors.visibility).toBeDefined();
  });

  it('returns label and color', () => {
    const result = computeDiveScore(goodConditions);
    expect(result.overallLabel).toBeDefined();
    expect(result.overallColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('returns timestamp', () => {
    const result = computeDiveScore(goodConditions);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// computeZoneScores
// ---------------------------------------------------------------------------
describe('computeZoneScores', () => {
  const conditions = {
    windSpeedMph: 12,
    windDirectionDeg: 45,   // NE trade wind
    swellHeightFt: 3,
    swellPeriodSec: 10,
    swellDirectionDeg: 200, // SSW swell
    tideLevel: 1.0,
    tideRate: 0.2,
    nextSlack: null,
    rain24h: 0,
    rain48h: 0,
    currentlyRaining: false,
  };

  it('returns scores for all 6 zones', () => {
    const result = computeZoneScores(conditions);
    const zoneIds = Object.keys(result);
    expect(zoneIds).toHaveLength(6);
    expect(zoneIds).toContain('south_shore');
    expect(zoneIds).toContain('southwest');
    expect(zoneIds).toContain('west');
    expect(zoneIds).toContain('northwest');
    expect(zoneIds).toContain('north');
    expect(zoneIds).toContain('east');
  });

  it('each zone has valid score structure', () => {
    const result = computeZoneScores(conditions);
    for (const [, zone] of Object.entries(result)) {
      expect(zone.overall).toBeGreaterThanOrEqual(0);
      expect(zone.overall).toBeLessThanOrEqual(100);
      expect(zone.overallLabel).toBeDefined();
      expect(zone.overallColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(zone.factors).toBeDefined();
      expect(zone.zone).toBeDefined();
    }
  });

  it('zones differ in wind score based on orientation', () => {
    const result = computeZoneScores(conditions);
    // NE wind (45 deg) is offshore for southwest zone (offshoreDir = 45)
    const swWind = result.southwest.factors.wind.score;
    // NE wind is onshore for north zone (offshoreDir = 180)
    const nWind = result.north.factors.wind.score;
    expect(swWind).toBeGreaterThan(nWind);
  });

  it('zones differ in swell score based on exposure', () => {
    const result = computeZoneScores(conditions);
    // SSW swell (200) hits southwest zone (face 225) harder than north (face 0)
    const swSwell = result.southwest.factors.swell.score;
    const nSwell = result.north.factors.swell.score;
    expect(nSwell).toBeGreaterThan(swSwell);
  });

  it('tide and rain are same across all zones', () => {
    const result = computeZoneScores(conditions);
    const tideScores = Object.values(result).map((z) => z.factors.tide.score);
    const rainScores = Object.values(result).map((z) => z.factors.rain.score);
    expect(new Set(tideScores).size).toBe(1);
    expect(new Set(rainScores).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getOverallLabel
// ---------------------------------------------------------------------------
describe('getOverallLabel', () => {
  it('returns correct labels for score ranges', () => {
    expect(getOverallLabel(90).label).toBe('Excellent');
    expect(getOverallLabel(80).label).toBe('Excellent');
    expect(getOverallLabel(70).label).toBe('Good');
    expect(getOverallLabel(60).label).toBe('Good');
    expect(getOverallLabel(50).label).toBe('Fair');
    expect(getOverallLabel(40).label).toBe('Fair');
    expect(getOverallLabel(30).label).toBe('Poor');
    expect(getOverallLabel(20).label).toBe('Poor');
    expect(getOverallLabel(10).label).toBe('Dangerous');
    expect(getOverallLabel(0).label).toBe('Dangerous');
  });

  it('returns hex color codes', () => {
    for (const score of [0, 20, 40, 60, 80, 100]) {
      expect(getOverallLabel(score).color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('returns emoji', () => {
    for (const score of [0, 20, 40, 60, 80, 100]) {
      expect(getOverallLabel(score).emoji).toBeDefined();
      expect(getOverallLabel(score).emoji.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------
describe('Edge Cases', () => {
  it('handles NaN wind speed (should not throw)', () => {
    expect(() => scoreWind(NaN, 0)).not.toThrow();
  });

  it('handles negative swell height', () => {
    const result = scoreSwell(-1, 10, 180);
    // Negative height hits the <= 1 branch, but direction penalty from 180 applies
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('handles zero swell height', () => {
    // Use direction 0 (north) to avoid south-swell exposure penalty
    const result = scoreSwell(0, 10, 0);
    expect(result.score).toBe(100);
  });

  it('handles wind angle wraparound (359 vs 1 degree)', () => {
    const s359 = scoreWind(10, 359).score;
    const s1 = scoreWind(10, 1).score;
    // Both are approximately north wind, should be similar
    expect(Math.abs(s359 - s1)).toBeLessThan(3);
  });

  it('handles wind angle exactly at 360', () => {
    const s0 = scoreWind(10, 0).score;
    const s360 = scoreWind(10, 360).score;
    expect(s0).toBe(s360);
  });

  it('handles very high tide rate', () => {
    const result = scoreTide(3.0, 2.0, null);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('computeDiveScore with all zeroes', () => {
    const result = computeDiveScore({
      windSpeedMph: 0,
      windDirectionDeg: 0,
      swellHeightFt: 0,
      swellPeriodSec: 0,
      swellDirectionDeg: 0,
      tideLevel: 0,
      tideRate: 0,
      nextSlack: null,
      rain24h: 0,
      rain48h: 0,
      currentlyRaining: false,
    });
    // Calm conditions should score very high
    expect(result.overall).toBeGreaterThanOrEqual(80);
  });
});
