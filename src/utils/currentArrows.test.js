/**
 * Current Arrows GeoJSON builder tests.
 *
 * Tests buildCurrentArrowsGeoJSON: empty/null inputs, single/multi point,
 * near-zero speed filtering, color mapping, arrowhead generation,
 * length capping, and longitude correction at Lanai's latitude.
 */

import { describe, it, expect } from 'vitest';
import { buildCurrentArrowsGeoJSON } from './currentArrows.js';

// ---------------------------------------------------------------------------
// Empty / null inputs
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - empty inputs', () => {
  it('returns empty FeatureCollections for null input', () => {
    const { arrows, tips } = buildCurrentArrowsGeoJSON(null);
    expect(arrows.type).toBe('FeatureCollection');
    expect(arrows.features).toHaveLength(0);
    expect(tips.type).toBe('FeatureCollection');
    expect(tips.features).toHaveLength(0);
  });

  it('returns empty FeatureCollections for undefined input', () => {
    const { arrows, tips } = buildCurrentArrowsGeoJSON(undefined);
    expect(arrows.features).toHaveLength(0);
    expect(tips.features).toHaveLength(0);
  });

  it('returns empty FeatureCollections for empty array', () => {
    const { arrows, tips } = buildCurrentArrowsGeoJSON([]);
    expect(arrows.features).toHaveLength(0);
    expect(tips.features).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Near-zero speed filtering
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - speed filtering', () => {
  it('skips currents with speed < 0.01 m/s', () => {
    const currents = [{ lat: 20.83, lon: -156.92, u: 0, v: 0, speed: 0.005, direction: 90 }];
    const { arrows, tips } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features).toHaveLength(0);
    expect(tips.features).toHaveLength(0);
  });

  it('includes currents with speed >= 0.01 m/s', () => {
    const currents = [{ lat: 20.83, lon: -156.92, u: 0.01, v: 0, speed: 0.01, direction: 90 }];
    const { arrows, tips } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features).toHaveLength(1);
    expect(tips.features).toHaveLength(2); // two arrowhead lines per arrow
  });
});

// ---------------------------------------------------------------------------
// Single point
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - single point', () => {
  const currents = [{ lat: 20.83, lon: -156.92, u: 0.1, v: 0.1, speed: 0.15, direction: 45 }];

  it('generates one arrow shaft (LineString)', () => {
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features).toHaveLength(1);
    expect(arrows.features[0].geometry.type).toBe('LineString');
    expect(arrows.features[0].geometry.coordinates).toHaveLength(2);
  });

  it('arrow starts at the observation lat/lon', () => {
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const [startLon, startLat] = arrows.features[0].geometry.coordinates[0];
    expect(startLon).toBe(-156.92);
    expect(startLat).toBe(20.83);
  });

  it('generates two arrowhead tip segments', () => {
    const { tips } = buildCurrentArrowsGeoJSON(currents);
    expect(tips.features).toHaveLength(2);
    tips.features.forEach((f) => {
      expect(f.geometry.type).toBe('LineString');
      expect(f.geometry.coordinates).toHaveLength(2);
    });
  });

  it('arrow properties include speed, direction, and color', () => {
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const props = arrows.features[0].properties;
    expect(props.speed).toBe(0.15);
    expect(props.direction).toBe(45);
    expect(props.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('tip properties include color', () => {
    const { tips } = buildCurrentArrowsGeoJSON(currents);
    tips.features.forEach((f) => {
      expect(f.properties.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

// ---------------------------------------------------------------------------
// Multiple points
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - multiple points', () => {
  it('generates one arrow and two tips per valid current point', () => {
    const currents = [
      { lat: 20.83, lon: -156.92, speed: 0.1, direction: 0 },
      { lat: 20.84, lon: -156.93, speed: 0.2, direction: 90 },
      { lat: 20.85, lon: -156.91, speed: 0.3, direction: 180 },
    ];
    const { arrows, tips } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features).toHaveLength(3);
    expect(tips.features).toHaveLength(6);
  });

  it('mixes valid and filtered points correctly', () => {
    const currents = [
      { lat: 20.83, lon: -156.92, speed: 0.005, direction: 0 }, // filtered
      { lat: 20.84, lon: -156.93, speed: 0.2, direction: 90 }, // kept
      { lat: 20.85, lon: -156.91, speed: 0.001, direction: 180 }, // filtered
    ];
    const { arrows, tips } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features).toHaveLength(1);
    expect(tips.features).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - color mapping', () => {
  it('maps near-still currents to blue', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.03, direction: 0 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features[0].properties.color).toBe('#3b82f6');
  });

  it('maps strong currents to orange/red', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.45, direction: 0 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features[0].properties.color).toBe('#f97316');
  });

  it('maps very strong currents (>0.5) to red', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.6, direction: 0 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    expect(arrows.features[0].properties.color).toBe('#ef4444');
  });
});

// ---------------------------------------------------------------------------
// Arrow length capping
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - arrow length', () => {
  it('arrow length is capped at MAX_LENGTH (0.04 deg)', () => {
    // Very fast current should not produce an arrow longer than 0.04 deg
    const currents = [
      { lat: 20.83, lon: -156.92, speed: 1.0, direction: 0 }, // northward
    ];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const [[, startLat], [, endLat]] = arrows.features[0].geometry.coordinates;
    const dLat = Math.abs(endLat - startLat);
    expect(dLat).toBeLessThanOrEqual(0.041); // small tolerance for rounding
  });

  it('slow current produces shorter arrow than fast current', () => {
    const slow = [{ lat: 20.83, lon: -156.92, speed: 0.05, direction: 0 }];
    const fast = [{ lat: 20.83, lon: -156.92, speed: 0.4, direction: 0 }];
    const slowArrow = buildCurrentArrowsGeoJSON(slow).arrows.features[0];
    const fastArrow = buildCurrentArrowsGeoJSON(fast).arrows.features[0];

    const slowLen = Math.abs(
      slowArrow.geometry.coordinates[1][1] - slowArrow.geometry.coordinates[0][1],
    );
    const fastLen = Math.abs(
      fastArrow.geometry.coordinates[1][1] - fastArrow.geometry.coordinates[0][1],
    );
    expect(fastLen).toBeGreaterThan(slowLen);
  });
});

// ---------------------------------------------------------------------------
// Direction correctness
// ---------------------------------------------------------------------------
describe('buildCurrentArrowsGeoJSON - direction', () => {
  it('northward current (0 deg) moves arrow north (increasing lat)', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.2, direction: 0 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const [[, startLat], [, endLat]] = arrows.features[0].geometry.coordinates;
    expect(endLat).toBeGreaterThan(startLat);
  });

  it('southward current (180 deg) moves arrow south (decreasing lat)', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.2, direction: 180 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const [[, startLat], [, endLat]] = arrows.features[0].geometry.coordinates;
    expect(endLat).toBeLessThan(startLat);
  });

  it('eastward current (90 deg) moves arrow east (increasing lon)', () => {
    const currents = [{ lat: 20.83, lon: -156.92, speed: 0.2, direction: 90 }];
    const { arrows } = buildCurrentArrowsGeoJSON(currents);
    const [[startLon], [endLon]] = arrows.features[0].geometry.coordinates;
    expect(endLon).toBeGreaterThan(startLon);
  });

  it('applies cosine correction for longitude at Lanai latitude', () => {
    // At lat ~20.83, cos correction means 1 deg lon ≈ cos(20.83) * 1 deg lat
    // So for same speed going N vs E, lon displacement should be larger than lat displacement
    const northCurrent = [{ lat: 20.83, lon: -156.92, speed: 0.2, direction: 0 }];
    const eastCurrent = [{ lat: 20.83, lon: -156.92, speed: 0.2, direction: 90 }];

    const nArrow = buildCurrentArrowsGeoJSON(northCurrent).arrows.features[0];
    const eArrow = buildCurrentArrowsGeoJSON(eastCurrent).arrows.features[0];

    const dLat = Math.abs(nArrow.geometry.coordinates[1][1] - nArrow.geometry.coordinates[0][1]);
    const dLon = Math.abs(eArrow.geometry.coordinates[1][0] - eArrow.geometry.coordinates[0][0]);

    // dLon should be larger than dLat due to cos correction
    expect(dLon).toBeGreaterThan(dLat);
  });
});
