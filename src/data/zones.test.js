/**
 * Zone Data Unit Tests
 * Tests zone definitions, GeoJSON converters, and geometry integrity.
 */

import { describe, it, expect } from 'vitest';
import {
  LANAI_ZONES,
  LANAI_CENTER,
  getZonesGeoJSON,
  getDiveSitesGeoJSON,
  getWindArrowGeoJSON,
} from './zones.js';

describe('LANAI_ZONES', () => {
  it('defines exactly 6 zones', () => {
    expect(Object.keys(LANAI_ZONES)).toHaveLength(6);
  });

  it('each zone has required properties', () => {
    for (const [id, zone] of Object.entries(LANAI_ZONES)) {
      expect(zone.id).toBe(id);
      expect(zone.name).toBeDefined();
      expect(zone.faceOrientation).toBeGreaterThanOrEqual(0);
      expect(zone.faceOrientation).toBeLessThan(360);
      expect(zone.offshoreDirection).toBe((zone.faceOrientation + 180) % 360);
      expect(zone.polygon).toBeInstanceOf(Array);
      expect(zone.polygon.length).toBeGreaterThanOrEqual(4); // minimum polygon
      expect(zone.sites).toBeInstanceOf(Array);
    }
  });

  it('all polygons are closed (first vertex = last vertex)', () => {
    for (const zone of Object.values(LANAI_ZONES)) {
      const first = zone.polygon[0];
      const last = zone.polygon[zone.polygon.length - 1];
      expect(first[0]).toBeCloseTo(last[0], 4);
      expect(first[1]).toBeCloseTo(last[1], 4);
    }
  });

  it('polygon coordinates are in Lanai bounding box', () => {
    // Lanai approx bounds: lat 20.7-20.95, lon -157.0 to -156.8
    for (const zone of Object.values(LANAI_ZONES)) {
      for (const [lon, lat] of zone.polygon) {
        expect(lat).toBeGreaterThan(20.5);
        expect(lat).toBeLessThan(21.1);
        expect(lon).toBeGreaterThan(-157.2);
        expect(lon).toBeLessThan(-156.6);
      }
    }
  });

  it('dive sites have valid coordinates within zone bounds', () => {
    for (const zone of Object.values(LANAI_ZONES)) {
      for (const site of zone.sites) {
        expect(site.lat).toBeGreaterThan(20.5);
        expect(site.lat).toBeLessThan(21.1);
        expect(site.lon).toBeGreaterThan(-157.2);
        expect(site.lon).toBeLessThan(-156.6);
        expect(site.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
        expect(site.maxDepth).toBeGreaterThan(0);
      }
    }
  });
});

describe('LANAI_CENTER', () => {
  it('is within Lanai bounds', () => {
    const [lat, lon] = LANAI_CENTER;
    expect(lat).toBeGreaterThan(20.7);
    expect(lat).toBeLessThan(20.95);
    expect(lon).toBeGreaterThan(-157.0);
    expect(lon).toBeLessThan(-156.8);
  });
});

describe('getZonesGeoJSON', () => {
  const mockZoneScores = {
    south_shore: { overall: 75, overallLabel: 'Good', overallColor: '#84cc16' },
    southwest: { overall: 60, overallLabel: 'Good', overallColor: '#84cc16' },
    west: { overall: 50, overallLabel: 'Fair', overallColor: '#eab308' },
    northwest: { overall: 30, overallLabel: 'Poor', overallColor: '#f97316' },
    north: { overall: 20, overallLabel: 'Poor', overallColor: '#f97316' },
    east: { overall: 40, overallLabel: 'Fair', overallColor: '#eab308' },
  };

  it('returns valid GeoJSON FeatureCollection', () => {
    const geojson = getZonesGeoJSON(mockZoneScores);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toBeInstanceOf(Array);
    expect(geojson.features).toHaveLength(6);
  });

  it('features have Polygon geometry', () => {
    const geojson = getZonesGeoJSON(mockZoneScores);
    for (const feature of geojson.features) {
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.geometry.coordinates).toBeInstanceOf(Array);
    }
  });

  it('features carry score properties', () => {
    const geojson = getZonesGeoJSON(mockZoneScores);
    const south = geojson.features.find((f) => f.properties.id === 'south_shore');
    expect(south.properties.score).toBe(75);
    expect(south.properties.color).toBe('#84cc16');
  });
});

describe('getDiveSitesGeoJSON', () => {
  const mockZoneScores = {
    south_shore: { overall: 75, overallLabel: 'Good', overallColor: '#84cc16' },
    southwest: { overall: 60, overallLabel: 'Good', overallColor: '#84cc16' },
    west: { overall: 50, overallLabel: 'Fair', overallColor: '#eab308' },
    northwest: { overall: 30, overallLabel: 'Poor', overallColor: '#f97316' },
    north: { overall: 20, overallLabel: 'Poor', overallColor: '#f97316' },
    east: { overall: 40, overallLabel: 'Fair', overallColor: '#eab308' },
  };

  it('returns GeoJSON FeatureCollection of Points', () => {
    const geojson = getDiveSitesGeoJSON(mockZoneScores);
    expect(geojson.type).toBe('FeatureCollection');
    for (const feature of geojson.features) {
      expect(feature.geometry.type).toBe('Point');
    }
  });

  it('total sites matches sum of all zone sites', () => {
    const geojson = getDiveSitesGeoJSON(mockZoneScores);
    const totalSites = Object.values(LANAI_ZONES).reduce((sum, z) => sum + z.sites.length, 0);
    expect(geojson.features).toHaveLength(totalSites);
  });

  it('site features include zone score', () => {
    const geojson = getDiveSitesGeoJSON(mockZoneScores);
    const hulupoe = geojson.features.find((f) => f.properties.name === "Hulopo'e Bay");
    expect(hulupoe).toBeDefined();
    expect(hulupoe.properties.zoneScore).toBe(75);
  });
});

describe('getWindArrowGeoJSON', () => {
  it('returns GeoJSON with LineString', () => {
    const geojson = getWindArrowGeoJSON(15, 45);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features[0].geometry.type).toBe('LineString');
  });

  it('arrow properties include speed and direction', () => {
    const geojson = getWindArrowGeoJSON(20, 90);
    const props = geojson.features[0].properties;
    expect(props.speed).toBe(20);
    expect(props.direction).toBe(90);
  });

  it('arrow length scales with wind speed', () => {
    const light = getWindArrowGeoJSON(5, 0);
    const strong = getWindArrowGeoJSON(25, 0);
    const lightCoords = light.features[0].geometry.coordinates;
    const strongCoords = strong.features[0].geometry.coordinates;
    // Strong wind arrow should be longer
    const lightLen = Math.hypot(
      lightCoords[1][0] - lightCoords[0][0],
      lightCoords[1][1] - lightCoords[0][1]
    );
    const strongLen = Math.hypot(
      strongCoords[1][0] - strongCoords[0][0],
      strongCoords[1][1] - strongCoords[0][1]
    );
    expect(strongLen).toBeGreaterThan(lightLen);
  });
});
