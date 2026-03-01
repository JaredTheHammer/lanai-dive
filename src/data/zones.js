/**
 * Lanai Dive Zones
 *
 * Divides the island's coastline into six exposure zones, each defined by
 * its shore-normal orientation. Wind and swell scores are recomputed
 * per-zone so the map can show which side of the island is diveable.
 *
 * Coordinate system:
 *   faceOrientation  -- degrees the shore faces (normal pointing seaward)
 *   offshoreDirection -- wind FROM this direction is offshore for this zone
 *                        (always faceOrientation + 180 mod 360)
 *
 * Zone polygons are coastal wedges rather than rectangles, defined as
 * arrays of [lon, lat] coordinates tracing the nearshore area.
 */

export const LANAI_CENTER = [20.8305, -156.9195]; // [lat, lon]

export const LANAI_ZONES = {
  south_shore: {
    id: 'south_shore',
    name: 'South Shore',
    faceOrientation: 180,
    offshoreDirection: 0,
    // Manele Harbor east to Cathedrals/Pu'u Pehe area
    // Shore traces Manele breakwall, Pu'u Pehe point, Hulopo'e crescent, Cathedral cliffs
    polygon: [
      [-156.868530, 20.741200],  // Manele Harbor mouth east side
      [-156.870100, 20.739800],  // harbor entrance south
      [-156.869200, 20.736500],  // Pu'u Pehe (Sweetheart Rock) point
      [-156.870800, 20.733200],  // Pu'u Pehe south face
      [-156.874500, 20.731500],  // reef shelf south of Hulopo'e
      [-156.879200, 20.730800],  // Hulopo'e bay mouth
      [-156.884500, 20.730200],  // reef shelf between Hulopo'e and Cathedrals
      [-156.889000, 20.729500],  // First Cathedral offshore
      [-156.893800, 20.728800],  // Second Cathedral offshore
      [-156.898500, 20.728200],  // Fisherman's Trail bluffs offshore
      [-156.903200, 20.728500],  // approaching SW zone boundary offshore
      [-156.906500, 20.729800],  // SW boundary offshore
      [-156.906500, 20.735200],  // SW boundary shore side
      [-156.903200, 20.734800],  // Fisherman's Trail cliffs
      [-156.898500, 20.735500],  // bluff line west of Cathedrals
      [-156.893800, 20.735800],  // Second Cathedral entry area
      [-156.889000, 20.736200],  // First Cathedral cliff base
      [-156.884500, 20.736800],  // Hulopo'e west headland
      [-156.879200, 20.737500],  // Hulopo'e Bay west side
      [-156.875800, 20.738800],  // Hulopo'e sandy beach center
      [-156.872500, 20.739500],  // Hulopo'e east headland
      [-156.870200, 20.740800],  // cliffs east of Hulopo'e
      [-156.868530, 20.741200],  // close at Manele Harbor
    ],
    sites: [
      { id: 'hulupoe', name: "Hulopo'e Bay", lat: 20.7365, lon: -156.8878, difficulty: 'beginner', maxDepth: 30, description: 'Marine preserve, sandy entry, reef snorkeling' },
      { id: 'first_cathedral', name: 'First Cathedral', lat: 20.7330, lon: -156.8920, difficulty: 'advanced', maxDepth: 60, description: 'Cavern dive with cathedral light shafts' },
      { id: 'second_cathedral', name: 'Second Cathedral', lat: 20.7325, lon: -156.8935, difficulty: 'advanced', maxDepth: 60, description: 'Larger cavern system, multiple chambers' },
      { id: 'shark_fin', name: 'Shark Fin Rock', lat: 20.7340, lon: -156.8850, difficulty: 'intermediate', maxDepth: 60, description: 'Wall dive, strong currents possible' },
      { id: 'manele', name: 'Manele Bay', lat: 20.7385, lon: -156.8830, difficulty: 'intermediate', maxDepth: 40, description: 'Harbor access, reef and sand' },
    ]
  },

  southwest: {
    id: 'southwest',
    name: 'Southwest',
    faceOrientation: 225,
    offshoreDirection: 45,
    // Cathedrals west edge to Kaunolu gulch
    // High sea cliffs, exposed, Kahea Heiau ruins above Kaunolu
    polygon: [
      [-156.906500, 20.735200],  // shared boundary with south shore (shore)
      [-156.906500, 20.729800],  // shared boundary (offshore)
      [-156.910200, 20.728500],  // cliffs south of Fisherman's Trail offshore
      [-156.914800, 20.726800],  // sea cliff offshore
      [-156.919500, 20.724500],  // Kaunolu approach offshore
      [-156.923200, 20.722200],  // Kaunolu Bay south point offshore
      [-156.927800, 20.720500],  // Kaunolu west bluff offshore
      [-156.932500, 20.719800],  // SW corner of zone offshore
      [-156.935800, 20.722500],  // rounding toward west coast offshore
      [-156.935800, 20.738500],  // west boundary shore side
      [-156.932500, 20.737200],  // Kaunolu gulch west rim
      [-156.928500, 20.735000],  // sea cliffs above Kaunolu
      [-156.924200, 20.733800],  // Kaunolu Bay north headland
      [-156.920800, 20.732500],  // eroded cliff line
      [-156.916500, 20.733200],  // high cliffs trending east
      [-156.912800, 20.734000],  // cliff base
      [-156.909500, 20.734800],  // approaching south shore boundary
      [-156.906500, 20.735200],  // close
    ],
    sites: [
      { id: 'kaunolu', name: 'Kaunolu Bay', lat: 20.7280, lon: -156.9200, difficulty: 'intermediate', maxDepth: 40, description: 'Historic fishing village, rocky entry, reef ledges' },
    ]
  },

  west: {
    id: 'west',
    name: 'West',
    faceOrientation: 270,
    offshoreDirection: 90,
    // Kaunolu west edge north to Nanahoa islets area
    // Includes Kaumalapau Harbor breakwall, steep pali cliffs
    polygon: [
      [-156.935800, 20.738500],  // shared SW boundary (shore)
      [-156.935800, 20.722500],  // shared SW boundary (offshore)
      [-156.940200, 20.725800],  // offshore south of Kaumalapau
      [-156.945500, 20.740200],  // offshore mid-south
      [-156.949800, 20.755500],  // offshore approaching Kaumalapau
      [-156.952200, 20.770800],  // offshore abeam Kaumalapau Harbor
      [-156.953500, 20.786200],  // offshore mid-west coast
      [-156.954200, 20.801500],  // offshore pali cliffs
      [-156.954500, 20.816800],  // offshore approaching Nanahoa
      [-156.953800, 20.832200],  // offshore north end of west zone
      [-156.951200, 20.842500],  // NW boundary offshore
      [-156.943800, 20.842500],  // NW boundary shore side
      [-156.941500, 20.832200],  // sea cliff shore
      [-156.940200, 20.816800],  // pali cliffs mid
      [-156.939500, 20.801500],  // steep cliffs
      [-156.939200, 20.786200],  // Kaumalapau north approach
      [-156.938800, 20.778500],  // Kaumalapau Harbor breakwall north
      [-156.937500, 20.773200],  // harbor interior
      [-156.938200, 20.768500],  // Kaumalapau breakwall south
      [-156.937800, 20.755500],  // cliff line south of harbor
      [-156.936500, 20.745800],  // approaching SW boundary
      [-156.935800, 20.738500],  // close
    ],
    sites: [
      { id: 'kaumalapau', name: 'Kaumalapau Harbor', lat: 20.7870, lon: -156.9380, difficulty: 'intermediate', maxDepth: 45, description: 'Former pineapple shipping port, deep reef access' },
    ]
  },

  northwest: {
    id: 'northwest',
    name: 'Northwest',
    faceOrientation: 315,
    offshoreDirection: 135,
    // Nanahoa islets area to Polihua Beach west end
    // Tall sea cliffs, Ka'ena Point, remote and exposed
    polygon: [
      [-156.943800, 20.842500],  // shared west boundary (shore)
      [-156.951200, 20.842500],  // shared west boundary (offshore)
      [-156.954800, 20.852800],  // offshore sea cliffs
      [-156.958200, 20.863500],  // offshore approaching Ka'ena Point
      [-156.961500, 20.874200],  // Ka'ena Point offshore
      [-156.963800, 20.885500],  // NW cliffs offshore
      [-156.965200, 20.896800],  // offshore approaching Polihua
      [-156.965500, 20.905200],  // Polihua offshore west
      [-156.964200, 20.912500],  // Polihua west end offshore
      [-156.960800, 20.917800],  // rounding Polihua point offshore
      [-156.956500, 20.920200],  // north boundary offshore
      [-156.950200, 20.914500],  // Polihua Beach west end (shore)
      [-156.946800, 20.912200],  // Polihua dune line
      [-156.944500, 20.908800],  // cliff base west of Polihua
      [-156.943200, 20.901500],  // sea cliffs
      [-156.942500, 20.892200],  // tall NW pali
      [-156.942200, 20.882800],  // cliff line
      [-156.942500, 20.873500],  // Ka'ena Point vicinity
      [-156.943000, 20.864200],  // cliff base
      [-156.943500, 20.855800],  // cliffs south of Ka'ena
      [-156.943800, 20.842500],  // close
    ],
    sites: [
      { id: 'polihua', name: 'Polihua Beach', lat: 20.9100, lon: -156.9500, difficulty: 'advanced', maxDepth: 50, description: 'Remote north shore, strong currents, monk seal habitat' },
    ]
  },

  north: {
    id: 'north',
    name: 'North',
    faceOrientation: 0,
    offshoreDirection: 180,
    // Polihua east end to Shipwreck Beach / Awalua area
    // Shallow reef shelf, trade wind exposed, WWII wreck
    polygon: [
      [-156.950200, 20.914500],  // shared NW boundary (shore)
      [-156.956500, 20.920200],  // shared NW boundary (offshore)
      [-156.950800, 20.923500],  // Polihua mid offshore
      [-156.944200, 20.926200],  // Polihua east end offshore
      [-156.937500, 20.928500],  // reef flat offshore
      [-156.930800, 20.929800],  // north shore mid offshore
      [-156.924200, 20.930200],  // shallow reef offshore
      [-156.917500, 20.929800],  // mid-north offshore
      [-156.910800, 20.928500],  // approaching Awalua offshore
      [-156.904200, 20.926500],  // Awalua offshore
      [-156.897500, 20.923800],  // Shipwreck Beach offshore
      [-156.891800, 20.920500],  // reef edge NE offshore
      [-156.886500, 20.916800],  // east boundary offshore
      [-156.882200, 20.912500],  // rounding to east coast offshore
      [-156.878500, 20.905800],  // NE corner offshore
      [-156.878500, 20.900200],  // east boundary shore side
      [-156.882200, 20.903800],  // Shipwreck reef edge (shore)
      [-156.887500, 20.907200],  // Shipwreck Beach east end
      [-156.893200, 20.909800],  // Shipwreck Beach center
      [-156.899800, 20.911500],  // Awalua area
      [-156.906500, 20.912800],  // north shore mid
      [-156.913200, 20.913500],  // reef flat shore
      [-156.920800, 20.913800],  // mid coast
      [-156.928500, 20.914000],  // approaching Polihua
      [-156.935200, 20.914200],  // Polihua east dunes
      [-156.942500, 20.914300],  // dune line
      [-156.950200, 20.914500],  // close
    ],
    sites: [
      { id: 'shipwreck', name: 'Shipwreck Beach', lat: 20.9000, lon: -156.8800, difficulty: 'advanced', maxDepth: 55, description: 'WWII-era wreck, shallow reef, strong trade-wind exposure' },
    ]
  },

  east: {
    id: 'east',
    name: 'East',
    faceOrientation: 90,
    offshoreDirection: 270,
    // Shipwreck south end to Manele Harbor (completes the island)
    // Lopa Beach, Naha area, Kaiolohia, windward exposed coast
    polygon: [
      [-156.878500, 20.900200],  // shared north boundary (shore)
      [-156.878500, 20.905800],  // shared north boundary (offshore)
      [-156.875200, 20.898500],  // NE coast offshore
      [-156.871800, 20.890200],  // offshore Kaiolohia
      [-156.868500, 20.878800],  // offshore mid-east
      [-156.865800, 20.867500],  // Lopa Beach offshore
      [-156.863500, 20.856200],  // offshore south of Lopa
      [-156.861800, 20.844800],  // offshore Naha area
      [-156.860500, 20.833500],  // mid-east coast offshore
      [-156.859800, 20.822200],  // offshore
      [-156.859500, 20.810800],  // offshore
      [-156.860200, 20.799500],  // offshore approaching SE
      [-156.861500, 20.788200],  // SE coast offshore
      [-156.863200, 20.776800],  // offshore
      [-156.865200, 20.765500],  // offshore approaching Manele
      [-156.867000, 20.754200],  // Manele approach offshore
      [-156.868200, 20.746800],  // close to Manele Harbor offshore
      [-156.868530, 20.741200],  // Manele Harbor (shared with south shore)
      [-156.870200, 20.740800],  // Manele cliffs (shore, from south shore)
      [-156.869800, 20.746800],  // east of Manele Harbor shore
      [-156.869200, 20.754200],  // coastal bluffs
      [-156.868500, 20.765500],  // windward cliffs
      [-156.867800, 20.776800],  // rocky coast
      [-156.867200, 20.788200],  // low cliffs
      [-156.867000, 20.799500],  // shore mid
      [-156.867200, 20.810800],  // Naha area shore
      [-156.867800, 20.822200],  // shore
      [-156.868500, 20.833500],  // shore
      [-156.869500, 20.844800],  // Lopa approach
      [-156.870800, 20.856200],  // Lopa Beach south
      [-156.872200, 20.867500],  // Lopa Beach center
      [-156.873800, 20.878800],  // Lopa Beach north
      [-156.875500, 20.890200],  // Kaiolohia shore
      [-156.877200, 20.898500],  // approaching Shipwreck
      [-156.878500, 20.900200],  // close
    ],
    sites: [
      { id: 'lopa', name: 'Lopa Beach', lat: 20.8350, lon: -156.8550, difficulty: 'intermediate', maxDepth: 40, description: 'East side beach, exposed to trade winds, good when Kona winds blow' },
    ]
  }
};

// -------------------------------------------------------------------------
// GeoJSON converters for MapLibre
// -------------------------------------------------------------------------

/**
 * Convert zones to GeoJSON polygons for rendering as colored fill layers.
 * Each feature includes properties needed for data-driven styling.
 */
export function getZonesGeoJSON(zoneScores) {
  return {
    type: 'FeatureCollection',
    features: Object.values(LANAI_ZONES).map(zone => ({
      type: 'Feature',
      id: zone.id,
      properties: {
        id: zone.id,
        name: zone.name,
        faceOrientation: zone.faceOrientation,
        offshoreDirection: zone.offshoreDirection,
        score: zoneScores?.[zone.id]?.overall ?? 0,
        label: zoneScores?.[zone.id]?.overallLabel ?? 'Unknown',
        color: zoneScores?.[zone.id]?.overallColor ?? '#666666',
        siteCount: zone.sites.length,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [zone.polygon]
      }
    }))
  };
}

/**
 * Convert all dive sites across all zones to a GeoJSON FeatureCollection.
 */
export function getDiveSitesGeoJSON(zoneScores) {
  const features = [];
  Object.values(LANAI_ZONES).forEach(zone => {
    zone.sites.forEach(site => {
      features.push({
        type: 'Feature',
        id: site.id,
        properties: {
          name: site.name,
          difficulty: site.difficulty,
          maxDepth: site.maxDepth,
          description: site.description,
          zoneId: zone.id,
          zoneName: zone.name,
          zoneScore: zoneScores?.[zone.id]?.overall ?? 0,
          zoneLabel: zoneScores?.[zone.id]?.overallLabel ?? 'Unknown',
          zoneColor: zoneScores?.[zone.id]?.overallColor ?? '#666666',
        },
        geometry: {
          type: 'Point',
          coordinates: [site.lon, site.lat]
        }
      });
    });
  });
  return { type: 'FeatureCollection', features };
}

/**
 * Generate a wind arrow GeoJSON feature for map overlay.
 * Places an arrow at the island center showing wind direction and speed.
 */
export function getWindArrowGeoJSON(windSpeedMph, windDirectionDeg) {
  // Wind FROM direction -> arrow points in the direction the wind is going TO
  const toRad = Math.PI / 180;
  const bearingTo = (windDirectionDeg + 180) % 360;
  const len = Math.min(windSpeedMph * 0.001, 0.025); // scale arrow length to speed

  const [lat, lon] = LANAI_CENTER;
  const endLat = lat + len * Math.cos(bearingTo * toRad);
  const endLon = lon + len * Math.sin(bearingTo * toRad) / Math.cos(lat * toRad);

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        speed: windSpeedMph,
        direction: windDirectionDeg,
        bearing: bearingTo,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, lat],
          [endLon, endLat]
        ]
      }
    }]
  };
}
