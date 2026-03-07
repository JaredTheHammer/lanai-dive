/**
 * MapView -- Container component for the interactive map tab.
 *
 * Manages:
 *  - Selected zone / site state
 *  - Zone score sidebar (scrollable list)
 *  - Zone detail panel (bottom sheet with drag gestures)
 *  - Moon phase display
 *  - Layer toggles (bathymetry)
 *  - Touch targets >= 44px for iOS compliance
 *  - Safe area insets for notch/home indicator
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import InteractiveMap from './InteractiveMap.jsx';
import ConditionCard from './ConditionCard.jsx';
import SpeciesGuide from './SpeciesGuide.jsx';
import { LANAI_ZONES } from '../data/zones.js';
import { WEIGHTS } from '../scoring/index.js';
import { getLobsterSeasonStatus } from '../data/species.js';
import useBottomSheetGesture from '../hooks/useBottomSheetGesture.js';
import { fetchCurrents } from '../api/currents.js';
import { buildCurrentArrowsGeoJSON } from '../utils/currentArrows.js';
import WindParticles from './WindParticles.jsx';

const FACTOR_ORDER = ['wind', 'swell', 'tide', 'rain', 'visibility'];

export default function MapView({ data, initialZoneId = null }) {
  const [selectedZoneId, setSelectedZoneId] = useState(initialZoneId);
  const [selectedSite, setSelectedSite] = useState(null);
  const [showBathymetry, setShowBathymetry] = useState(false);
  const [showCurrents, setShowCurrents] = useState(false);
  const [showWindAnimation, setShowWindAnimation] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showSpeciesGuide, setShowSpeciesGuide] = useState(false);
  const [bathymetryData, setBathymetryData] = useState(null);
  const [currentArrowsData, setCurrentArrowsData] = useState(null);

  const { zoneScores, moonPhase, conditions, zoneSpecies } = data;
  const lobsterStatus = useMemo(() => getLobsterSeasonStatus(), []);

  // Bottom sheet gesture hook
  const handleDismiss = useCallback(() => {
    setShowPanel(false);
    setSelectedZoneId(null);
  }, []);

  const { sheetRef, handleRef, snapTo, dismiss, initSheet } = useBottomSheetGesture({
    onDismiss: handleDismiss,
  });

  // Auto-open panel when navigated from comparison view with a zone selected
  useEffect(() => {
    if (initialZoneId && zoneScores?.[initialZoneId]) {
      setShowPanel(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load bathymetry GeoJSON on demand
  useEffect(() => {
    if (showBathymetry && !bathymetryData) {
      fetch('/data/lanai-bathymetry.geojson')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setBathymetryData(d))
        .catch(() => setBathymetryData(null));
    }
  }, [showBathymetry, bathymetryData]);

  // Load ocean currents on demand
  useEffect(() => {
    if (showCurrents && !currentArrowsData) {
      fetchCurrents()
        .then((data) => setCurrentArrowsData(buildCurrentArrowsGeoJSON(data)))
        .catch(() => setCurrentArrowsData(null));
    }
  }, [showCurrents, currentArrowsData]);

  // Sort zones by score (best first) for the list
  const sortedZones = useMemo(() => {
    if (!zoneScores) return [];
    return Object.entries(zoneScores)
      .sort(([, a], [, b]) => b.overall - a.overall)
      .map(([id, score]) => ({ id, ...score }));
  }, [zoneScores]);

  // Best zone for quick recommendation
  const bestZone = sortedZones[0] || null;

  // Selected zone data
  const selectedZoneData =
    selectedZoneId && zoneScores?.[selectedZoneId]
      ? {
          id: selectedZoneId,
          ...zoneScores[selectedZoneId],
          sites: LANAI_ZONES[selectedZoneId]?.sites || [],
        }
      : null;

  // Initialize bottom sheet when panel opens
  useEffect(() => {
    if (showPanel && selectedZoneData) {
      // Small delay to let DOM render
      requestAnimationFrame(() => {
        initSheet();
      });
    }
  }, [showPanel, selectedZoneData, initSheet]);

  const handleZoneSelect = (zoneId) => {
    setSelectedZoneId(zoneId);
    setSelectedSite(null);
    setShowPanel(true);
  };

  const handleSiteSelect = (site) => {
    setSelectedSite(site);
    setShowPanel(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] relative">
      {/* Map fills available space */}
      <div className={`flex-1 relative ${showPanel ? 'overflow-hidden' : ''}`}>
        <InteractiveMap
          zoneScores={zoneScores}
          conditions={conditions}
          bathymetryData={bathymetryData}
          showBathymetry={showBathymetry}
          currentArrowsData={currentArrowsData}
          showCurrents={showCurrents}
          selectedZoneId={selectedZoneId}
          onZoneSelect={handleZoneSelect}
          onSiteSelect={handleSiteSelect}
        />

        {/* Animated wind particle overlay */}
        {showWindAnimation && conditions && (
          <WindParticles
            windSpeedMph={conditions.windSpeedMph}
            windFromDeg={conditions.windDirectionDeg}
            zoom={11}
            active={showWindAnimation}
          />
        )}

        {/* Floating controls: top-left with safe area */}
        <div
          className="absolute top-3 left-3 flex flex-col gap-2 z-10"
          style={{ paddingLeft: 'env(safe-area-inset-left, 0px)' }}
        >
          {/* Moon phase badge -- 44px min height */}
          {moonPhase && (
            <div className="glass-card px-3 py-2 flex items-center gap-2 min-h-[44px]">
              <span className="text-lg">{moonPhase.emoji}</span>
              <div className="text-xs">
                <p className="text-white/80 font-medium">{moonPhase.name}</p>
                <p className="text-white/40 hidden md:block">
                  {moonPhase.illumination}% illuminated
                </p>
                {moonPhase.tidalNote && (
                  <p className="text-cyan-400/70 text-[10px] hidden md:block">
                    {moonPhase.tidalNote}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Layer toggles -- 44px touch target */}
          <div className="glass-card px-3 min-h-[44px] flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={showBathymetry}
                onChange={(e) => setShowBathymetry(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
              <span className="text-xs text-white/60">Depth contours</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={showCurrents}
                onChange={(e) => setShowCurrents(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
              <span className="text-xs text-white/60">Ocean currents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={showWindAnimation}
                onChange={(e) => setShowWindAnimation(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
              <span className="text-xs text-white/60">Wind flow</span>
            </label>
          </div>

          {/* Wind summary -- 44px min height */}
          {conditions && (
            <div className="glass-card px-3 py-2 min-h-[44px] flex items-center">
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4 text-cyan-300"
                >
                  <path
                    d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs text-white/70">
                  {Math.round(conditions.windSpeedMph)} mph{' '}
                  <span className="text-white/40">from</span>{' '}
                  {degreesToCompass(conditions.windDirectionDeg)}
                </span>
              </div>
            </div>
          )}

          {/* Lobster season badge -- 44px min height */}
          <div
            className={`glass-card px-3 py-2 min-h-[44px] flex items-center ${lobsterStatus.inSeason ? '' : 'opacity-70'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{lobsterStatus.inSeason ? '\u{1F99E}' : '\u{1F6AB}'}</span>
              <span
                className={`text-[10px] font-medium ${lobsterStatus.inSeason ? 'text-green-400' : 'text-red-400'}`}
              >
                {lobsterStatus.inSeason ? 'Lobster Open' : 'Lobster Closed'}
              </span>
            </div>
          </div>

          {/* Species guide trigger -- 44px min height */}
          <button
            onClick={() => setShowSpeciesGuide(true)}
            className="glass-card px-3 py-2 min-h-[44px] flex items-center touch-active"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{'\u{1F4D6}'}</span>
              <span className="text-[10px] text-white/60">Species</span>
            </div>
          </button>
        </div>

        {/* Best zone recommendation badge: top-center */}
        {bestZone && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={() => handleZoneSelect(bestZone.id)}
              className="glass-card px-4 py-2 min-h-[44px] flex items-center gap-2 touch-active"
            >
              <span className="text-xs text-white/50">Best:</span>
              <span className="text-sm font-bold" style={{ color: bestZone.overallColor }}>
                {bestZone.zone.name}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: bestZone.overallColor }}
              >
                {bestZone.overall}
              </span>
            </button>
          </div>
        )}

        {/* Zone list: floating right side with safe area */}
        <div
          className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto"
          style={{ paddingRight: 'env(safe-area-inset-right, 0px)' }}
        >
          {sortedZones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => handleZoneSelect(zone.id)}
              className={`glass-card px-3 py-2.5 flex items-center gap-2 min-w-[120px] min-h-[44px] transition-all touch-active ${
                selectedZoneId === zone.id ? 'ring-1 ring-cyan-400 bg-white/10' : ''
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: zone.overallColor }}
              />
              <span className="text-xs text-white/70 flex-1 text-left truncate">
                {zone.zone.name}
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: zone.overallColor }}>
                {zone.overall}
              </span>
            </button>
          ))}
        </div>

        {/* Difficulty legend: bottom-right */}
        <div
          className="absolute bottom-8 right-3 z-10 glass-card px-3 py-2"
          style={{ marginRight: 'env(safe-area-inset-right, 0px)' }}
        >
          <p className="text-[10px] text-white/40 mb-1">Site Difficulty</p>
          <div className="flex flex-col gap-1">
            {[
              ['beginner', '#22c55e'],
              ['intermediate', '#eab308'],
              ['advanced', '#ef4444'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-white/50 capitalize">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current speed legend: bottom-left, visible only when currents toggled on */}
        {showCurrents && (
          <div
            className="absolute bottom-8 left-3 z-10 glass-card px-3 py-2"
            style={{ marginLeft: 'env(safe-area-inset-left, 0px)' }}
          >
            <p className="text-[10px] text-white/40 mb-1">Current Speed (m/s)</p>
            <div className="flex flex-col gap-1">
              {[
                ['#3b82f6', 'Calm', '< 0.05'],
                ['#06b6d4', 'Gentle', '0.05-0.10'],
                ['#22d3ee', 'Moderate', '0.10-0.20'],
                ['#eab308', 'Notable', '0.20-0.35'],
                ['#f97316', 'Strong', '0.35-0.50'],
                ['#ef4444', 'V. Strong', '> 0.50'],
              ].map(([color, label, range]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-white/50">{label}</span>
                  <span className="text-[10px] text-white/30 ml-auto">{range}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom sheet: zone/site details with drag gestures */}
      {showPanel && selectedZoneData && (
        <div
          ref={sheetRef}
          className="absolute bottom-0 left-0 right-0 z-20 bg-ocean-950/95 backdrop-blur-lg border-t border-white/10 rounded-t-2xl safe-bottom slide-up"
          style={{ maxHeight: 'calc(90vh - 64px)' }}
        >
          {/* Drag handle -- 44px touch zone */}
          <div
            ref={handleRef}
            className="drag-handle flex justify-center items-center h-[44px] cursor-grab active:cursor-grabbing"
          >
            <div className="w-12 h-1.5 rounded-full bg-white/25" />
          </div>

          {/* Close button -- 44px touch target */}
          <button
            onClick={() => {
              dismiss();
            }}
            className="absolute top-2 right-3 p-3 rounded-full touch-active min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5 text-white/40"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Scrollable content area */}
          <div
            data-sheet-content
            className="overflow-y-hidden overscroll-contain px-4 pb-6"
            style={{ maxHeight: 'calc(90vh - 64px - 44px)' }}
          >
            {/* Zone header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{
                  backgroundColor: selectedZoneData.overallColor + '20',
                  color: selectedZoneData.overallColor,
                }}
              >
                {selectedZoneData.overall}
              </div>
              <div>
                <h3 className="text-base font-bold">{selectedZoneData.zone.name}</h3>
                <p className="text-xs text-white/50">
                  {selectedZoneData.overallLabel}
                  {' \u00b7 Faces '}
                  {degreesToCompass(selectedZoneData.zone.faceOrientation)}
                  {' \u00b7 Offshore from '}
                  {degreesToCompass((selectedZoneData.zone.faceOrientation + 180) % 360)}
                </p>
              </div>
            </div>

            {/* Factor cards (reused from dashboard) */}
            <div className="space-y-2 mb-3">
              {FACTOR_ORDER.map((name) => (
                <ConditionCard
                  key={name}
                  name={name}
                  factor={selectedZoneData.factors[name]}
                  weight={WEIGHTS[name]}
                />
              ))}
            </div>

            {/* In-season species for this zone */}
            {zoneSpecies?.[selectedZoneId] && (
              <div className="mb-3">
                <h4 className="text-xs text-white/40 uppercase tracking-wider mb-1.5">
                  In-Season Species ({zoneSpecies[selectedZoneId].count})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {zoneSpecies[selectedZoneId].species.slice(0, 12).map((s) => (
                    <span
                      key={s.id}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50"
                    >
                      {s.hawaiianName || s.commonName}
                    </span>
                  ))}
                  {zoneSpecies[selectedZoneId].count > 12 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                      +{zoneSpecies[selectedZoneId].count - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Dive sites in this zone */}
            {selectedZoneData.sites.length > 0 && (
              <div>
                <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Dive Sites</h4>
                <div className="space-y-2">
                  {selectedZoneData.sites.map((site) => (
                    <div key={site.id} className="glass-card p-3 flex items-start gap-3">
                      <span
                        className={`w-2.5 h-2.5 mt-1 rounded-full flex-shrink-0 ${
                          site.difficulty === 'beginner'
                            ? 'bg-green-500'
                            : site.difficulty === 'intermediate'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{site.name}</p>
                        <p className="text-xs text-white/40">{site.description}</p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {site.difficulty} | {site.maxDepth} ft max
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Species Guide overlay */}
      <SpeciesGuide isOpen={showSpeciesGuide} onClose={() => setShowSpeciesGuide(false)} />
    </div>
  );
}

// Inline helper (same as scoring module)
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
