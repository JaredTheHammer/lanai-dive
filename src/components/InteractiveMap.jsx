/**
 * InteractiveMap -- MapLibre GL rendering of Lanai dive zones,
 * dive sites, wind direction, and bathymetry layers.
 *
 * Uses react-map-gl v8 with maplibre-gl as the rendering engine.
 * Free vector tiles from OpenFreeMap (no API key required).
 */

import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { LANAI_CENTER, getZonesGeoJSON, getDiveSitesGeoJSON, getWindArrowGeoJSON } from '../data/zones.js';

// CartoCDN Dark Matter style (free, no API key required)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW = {
  latitude: LANAI_CENTER[0],
  longitude: LANAI_CENTER[1],
  zoom: 11,
  pitch: 0,
  bearing: 0
};

// Layer styles
const ZONE_FILL_LAYER = {
  id: 'zone-fill',
  type: 'fill',
  paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': 0.30,
  }
};

const ZONE_FILL_HOVER_LAYER = {
  id: 'zone-fill-hover',
  type: 'fill',
  paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': 0.55,
  },
  filter: ['==', ['get', 'id'], '']
};

const ZONE_OUTLINE_LAYER = {
  id: 'zone-outline',
  type: 'line',
  paint: {
    'line-color': 'rgba(255,255,255,0.25)',
    'line-width': 1.5,
  }
};

const ZONE_SELECTED_OUTLINE_LAYER = {
  id: 'zone-selected-outline',
  type: 'line',
  paint: {
    'line-color': '#22d3ee',   // cyan-400
    'line-width': 2.5,
  },
  filter: ['==', ['get', 'id'], '']
};

const ZONE_LABEL_LAYER = {
  id: 'zone-labels',
  type: 'symbol',
  layout: {
    'text-field': [
      'concat',
      ['get', 'name'],
      '\n',
      ['to-string', ['get', 'score']],
    ],
    'text-size': 12,
    'text-font': ['Open Sans Bold'],
    'text-anchor': 'center',
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,0.7)',
    'text-halo-width': 1.5,
  }
};

const SITE_CIRCLE_LAYER = {
  id: 'site-circles',
  type: 'circle',
  paint: {
    'circle-radius': 7,
    'circle-color': [
      'match', ['get', 'difficulty'],
      'beginner', '#22c55e',
      'intermediate', '#eab308',
      'advanced', '#ef4444',
      '#888888'
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  }
};

const SITE_LABEL_LAYER = {
  id: 'site-labels',
  type: 'symbol',
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 10,
    'text-font': ['Open Sans Regular'],
    'text-offset': [0, 1.5],
    'text-anchor': 'top',
  },
  paint: {
    'text-color': 'rgba(255,255,255,0.7)',
    'text-halo-color': 'rgba(0,0,0,0.8)',
    'text-halo-width': 1,
  }
};

const WIND_ARROW_LAYER = {
  id: 'wind-arrow',
  type: 'line',
  paint: {
    'line-color': '#67e8f9',  // cyan-300
    'line-width': 3,
    'line-opacity': 0.8,
  },
  layout: {
    'line-cap': 'round',
  }
};

const BATHYMETRY_LINE_LAYER = {
  id: 'bathymetry-lines',
  type: 'line',
  paint: {
    'line-color': [
      'interpolate', ['linear'], ['get', 'depth'],
      10, 'rgba(96,165,250,0.5)',   // blue-400
      20, 'rgba(59,130,246,0.5)',   // blue-500
      50, 'rgba(37,99,235,0.45)',   // blue-600
      100, 'rgba(29,78,216,0.4)',   // blue-700
      200, 'rgba(30,64,175,0.35)',  // blue-800
    ],
    'line-width': [
      'interpolate', ['linear'], ['get', 'depth'],
      10, 1,
      50, 1.5,
      200, 2,
    ]
  }
};

const BATHYMETRY_LABEL_LAYER = {
  id: 'bathymetry-labels',
  type: 'symbol',
  layout: {
    'symbol-placement': 'line',
    'text-field': ['concat', ['get', 'depth'], 'm'],
    'text-size': 9,
    'text-font': ['Open Sans Regular'],
  },
  paint: {
    'text-color': 'rgba(147,197,253,0.6)',
    'text-halo-color': 'rgba(0,0,0,0.5)',
    'text-halo-width': 1,
  }
};

const CURRENT_ARROW_LAYER = {
  id: 'current-arrow-lines',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 2.5,
    'line-opacity': 0.75,
  },
  layout: {
    'line-cap': 'round',
  }
};

const CURRENT_TIP_LAYER = {
  id: 'current-arrow-tips',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 2,
    'line-opacity': 0.75,
  },
  layout: {
    'line-cap': 'round',
  }
};


export default function InteractiveMap({
  zoneScores,
  conditions,
  bathymetryData,
  showBathymetry,
  currentArrowsData,
  showCurrents,
  selectedZoneId,
  onZoneSelect,
  onSiteSelect,
}) {
  const mapRef = useRef(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [sitePopup, setSitePopup] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Build GeoJSON sources from zone scores
  const zonesGeoJSON = useMemo(
    () => getZonesGeoJSON(zoneScores),
    [zoneScores]
  );

  const sitesGeoJSON = useMemo(
    () => getDiveSitesGeoJSON(zoneScores),
    [zoneScores]
  );

  const windGeoJSON = useMemo(
    () => conditions
      ? getWindArrowGeoJSON(conditions.windSpeedMph, conditions.windDirectionDeg)
      : null,
    [conditions?.windSpeedMph, conditions?.windDirectionDeg]
  );

  // Update hover filter when hoveredZoneId changes
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    try {
      map.setFilter('zone-fill-hover', ['==', ['get', 'id'], hoveredZoneId || '']);
    } catch (e) { /* layer may not exist yet */ }
  }, [hoveredZoneId, mapLoaded]);

  // Update selection filter when selectedZoneId changes
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    try {
      map.setFilter('zone-selected-outline', ['==', ['get', 'id'], selectedZoneId || '']);
    } catch (e) { /* layer may not exist yet */ }
  }, [selectedZoneId, mapLoaded]);

  const onMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  // Zone click handler
  const onMapClick = useCallback((e) => {
    // Check for site click first (higher priority)
    const siteFeatures = e.features?.filter(f => f.layer.id === 'site-circles') || [];
    if (siteFeatures.length > 0) {
      const props = siteFeatures[0].properties;
      onSiteSelect?.({
        ...props,
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
      });
      setSitePopup({
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
        name: props.name,
        difficulty: props.difficulty,
        maxDepth: props.maxDepth,
        description: props.description,
        zoneScore: props.zoneScore,
        zoneLabel: props.zoneLabel,
        zoneColor: props.zoneColor,
      });
      return;
    }

    // Check for zone click
    const zoneFeatures = e.features?.filter(f => f.layer.id === 'zone-fill') || [];
    if (zoneFeatures.length > 0) {
      const zoneId = zoneFeatures[0].properties.id;
      onZoneSelect?.(zoneId);
      setSitePopup(null);
    }
  }, [onZoneSelect, onSiteSelect]);

  // Hover handler for zones
  const onMapMouseMove = useCallback((e) => {
    const zoneFeatures = e.features?.filter(f => f.layer.id === 'zone-fill') || [];
    if (zoneFeatures.length > 0) {
      setHoveredZoneId(zoneFeatures[0].properties.id);
    } else {
      setHoveredZoneId(null);
    }
  }, []);

  const onMapMouseLeave = useCallback(() => {
    setHoveredZoneId(null);
  }, []);

  const interactiveLayerIds = useMemo(() => ['zone-fill', 'site-circles'], []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onMapClick}
        onMouseMove={onMapMouseMove}
        onMouseLeave={onMapMouseLeave}
        onLoad={onMapLoad}
        cursor={hoveredZoneId ? 'pointer' : 'grab'}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" maxWidth={100} unit="imperial" />

        {/* Zone polygons */}
        <Source id="zones" type="geojson" data={zonesGeoJSON}>
          <Layer {...ZONE_FILL_LAYER} />
          <Layer {...ZONE_FILL_HOVER_LAYER} />
          <Layer {...ZONE_OUTLINE_LAYER} />
          <Layer {...ZONE_SELECTED_OUTLINE_LAYER} />
          <Layer {...ZONE_LABEL_LAYER} />
        </Source>

        {/* Dive site markers */}
        <Source id="sites" type="geojson" data={sitesGeoJSON}>
          <Layer {...SITE_CIRCLE_LAYER} />
          <Layer {...SITE_LABEL_LAYER} />
        </Source>

        {/* Wind direction arrow */}
        {windGeoJSON && (
          <Source id="wind" type="geojson" data={windGeoJSON}>
            <Layer {...WIND_ARROW_LAYER} />
          </Source>
        )}

        {/* Bathymetry contours (toggleable) */}
        {showBathymetry && bathymetryData && (
          <Source id="bathymetry" type="geojson" data={bathymetryData}>
            <Layer {...BATHYMETRY_LINE_LAYER} />
            <Layer {...BATHYMETRY_LABEL_LAYER} />
          </Source>
        )}

        {/* Ocean current vectors (toggleable) */}
        {showCurrents && currentArrowsData && (
          <>
            <Source id="current-arrows" type="geojson" data={currentArrowsData.arrows}>
              <Layer {...CURRENT_ARROW_LAYER} />
            </Source>
            <Source id="current-tips" type="geojson" data={currentArrowsData.tips}>
              <Layer {...CURRENT_TIP_LAYER} />
            </Source>
          </>
        )}

        {/* Site popup */}
        {sitePopup && (
          <Popup
            latitude={sitePopup.latitude}
            longitude={sitePopup.longitude}
            closeOnClick={false}
            onClose={() => setSitePopup(null)}
            anchor="bottom"
            className="site-popup"
          >
            <div className="text-xs text-gray-900 max-w-[200px]">
              <p className="font-bold text-sm mb-1">{sitePopup.name}</p>
              <p className="text-gray-600 mb-1">{sitePopup.description}</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  sitePopup.difficulty === 'beginner' ? 'bg-green-500' :
                  sitePopup.difficulty === 'intermediate' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="capitalize">{sitePopup.difficulty}</span>
                <span className="text-gray-400">|</span>
                <span>{sitePopup.maxDepth} ft max</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium" style={{ color: sitePopup.zoneColor }}>
                  {sitePopup.zoneScore}
                </span>
                <span className="text-gray-500">{sitePopup.zoneLabel}</span>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
