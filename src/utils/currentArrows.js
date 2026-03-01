/**
 * Convert ocean current vector data to GeoJSON for MapLibre rendering.
 *
 * Each current observation becomes a LineString arrow:
 *   - Origin at the observation lat/lon
 *   - Length proportional to current speed (capped)
 *   - Color encodes speed: blue (calm) -> cyan -> yellow -> red (strong)
 *   - Arrowhead via a second shorter LineString at the tip
 */

/**
 * Speed thresholds (m/s) for color mapping.
 */
const SPEED_COLORS = [
  { max: 0.05, color: '#3b82f6' },  // blue-500: near-still
  { max: 0.10, color: '#06b6d4' },  // cyan-500: gentle
  { max: 0.20, color: '#22d3ee' },  // cyan-400: moderate
  { max: 0.35, color: '#eab308' },  // yellow-500: notable
  { max: 0.50, color: '#f97316' },  // orange-500: strong
  { max: Infinity, color: '#ef4444' }, // red-500: very strong
];

function speedToColor(speed) {
  for (const { max, color } of SPEED_COLORS) {
    if (speed <= max) return color;
  }
  return '#ef4444';
}

/**
 * Arrow length in degrees, scaled by speed.
 * At ~20.8 deg latitude, 0.01 deg ~ 1.1 km.
 * Max arrow length ~ 0.04 deg (~4.4 km) for 0.5+ m/s currents.
 */
const BASE_LENGTH = 0.008;   // minimum visible arrow
const SCALE_FACTOR = 0.06;   // deg per m/s
const MAX_LENGTH = 0.04;     // cap

function arrowLength(speed) {
  return Math.min(BASE_LENGTH + speed * SCALE_FACTOR, MAX_LENGTH);
}

/**
 * Build GeoJSON FeatureCollection of current arrows.
 *
 * @param {Array} currents - Array of { lat, lon, u, v, speed, direction }
 * @returns {{ arrows: object, tips: object }} - Two FeatureCollections: shafts and arrowheads
 */
export function buildCurrentArrowsGeoJSON(currents) {
  if (!currents || currents.length === 0) {
    const empty = { type: 'FeatureCollection', features: [] };
    return { arrows: empty, tips: empty };
  }

  const arrowFeatures = [];
  const tipFeatures = [];

  for (const pt of currents) {
    // Skip near-zero currents
    if (pt.speed < 0.01) continue;

    const len = arrowLength(pt.speed);
    const color = speedToColor(pt.speed);

    // Direction is where current flows TO, in degrees from north
    const dirRad = pt.direction * Math.PI / 180;

    // End point of arrow (where current goes)
    const dLat = len * Math.cos(dirRad);
    const dLon = len * Math.sin(dirRad) / Math.cos(pt.lat * Math.PI / 180);

    const endLon = pt.lon + dLon;
    const endLat = pt.lat + dLat;

    // Arrow shaft
    arrowFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [pt.lon, pt.lat],
          [endLon, endLat],
        ]
      },
      properties: {
        speed: pt.speed,
        direction: pt.direction,
        color,
      }
    });

    // Arrowhead: two short lines from the tip at +/- 25 degrees from shaft
    const headLen = len * 0.3;
    const headAngle = 25 * Math.PI / 180;

    for (const sign of [-1, 1]) {
      const hRad = dirRad + Math.PI + sign * headAngle; // reverse + splay
      const hDLat = headLen * Math.cos(hRad);
      const hDLon = headLen * Math.sin(hRad) / Math.cos(endLat * Math.PI / 180);

      tipFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [endLon, endLat],
            [endLon + hDLon, endLat + hDLat],
          ]
        },
        properties: { color }
      });
    }
  }

  return {
    arrows: { type: 'FeatureCollection', features: arrowFeatures },
    tips: { type: 'FeatureCollection', features: tipFeatures },
  };
}
