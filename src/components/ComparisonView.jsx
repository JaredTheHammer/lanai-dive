/**
 * ComparisonView -- Side-by-side zone comparison for all 6 Lanai dive zones.
 *
 * Layout: Horizontally scrollable cards (one per zone), sorted by overall
 * score descending. Each card shows the zone score gauge, factor breakdown
 * bar chart, best dive site, and harvestable species count.
 *
 * On wider screens (≥640px) the cards wrap into a 2-column grid.
 */

import React, { useState, useMemo } from 'react';
import { LANAI_ZONES } from '../data/zones.js';
import { getOverallLabel, WEIGHTS } from '../scoring/index.js';

const FACTOR_ORDER = ['wind', 'swell', 'tide', 'rain', 'visibility'];
const FACTOR_ICONS = {
  wind: '\u{1F32C}\uFE0F',
  swell: '\u{1F30A}',
  tide: '\u{1F311}',
  rain: '\u{1F327}\uFE0F',
  visibility: '\u{1F441}\uFE0F',
};
const FACTOR_LABELS = {
  wind: 'Wind',
  swell: 'Swell',
  tide: 'Tide',
  rain: 'Rain',
  visibility: 'Vis',
};

// Compact mini-gauge (arc SVG)
function MiniGauge({ score, size = 72 }) {
  const { color } = getOverallLabel(score);
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half-circle
  const offset = circumference * (1 - score / 100);

  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Score arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
        {score}
      </text>
    </svg>
  );
}

// Factor breakdown bar
function FactorBar({ name, factor, weight }) {
  const pct = factor.score;
  const barColor =
    pct >= 70 ? 'bg-emerald-400' :
    pct >= 50 ? 'bg-lime-400' :
    pct >= 30 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right text-white/40 text-[10px]">{FACTOR_LABELS[name]}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%`, transition: 'width 0.4s ease-out' }}
        />
      </div>
      <span className="w-6 text-right text-white/50 text-[10px] tabular-nums">{pct}</span>
    </div>
  );
}

// Mini SVG sparkline for zone forecast
function Sparkline({ data, width = 120, height = 24 }) {
  if (!data?.length) return null;
  const max = 100;
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => `${i * step},${height - (d.score / max) * height}`).join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(34,211,238,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Single zone comparison card
function ZoneCard({ zoneId, zoneScore, zoneDef, zoneSpecies, isTopZone, onSelectZone, forecastData }) {
  const { overall, overallLabel, overallColor, factors } = zoneScore;
  const speciesCount = zoneSpecies?.count || 0;
  const bestSite = zoneDef.sites?.[0];

  return (
    <div
      className={`glass-card p-4 flex flex-col gap-3 relative overflow-hidden ${
        isTopZone ? 'ring-1 ring-cyan-400/30' : ''
      }`}
      role="article"
      aria-label={`${zoneDef.name} dive conditions`}
    >
      {/* Top zone badge */}
      {isTopZone && (
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded-bl-lg">
          BEST
        </div>
      )}

      {/* Header: zone name + mini gauge */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{zoneDef.name}</h3>
          <p className="text-[10px] text-white/30">{zoneDef.faceOrientation}° face</p>
        </div>
        <MiniGauge score={overall} />
      </div>

      {/* Overall label */}
      <div className="flex items-center gap-2 -mt-1">
        <span
          className="text-xs font-medium"
          style={{ color: overallColor }}
        >
          {overallLabel}
        </span>
        {speciesCount > 0 && (
          <span className="text-[10px] text-white/30">
            {speciesCount} species in season
          </span>
        )}
      </div>

      {/* Factor breakdown */}
      <div className="space-y-1.5">
        {FACTOR_ORDER.map(name => (
          <FactorBar
            key={name}
            name={name}
            factor={factors[name]}
            weight={WEIGHTS[name]}
          />
        ))}
      </div>

      {/* Factor details (wind/swell text) */}
      <div className="text-[10px] text-white/30 space-y-0.5">
        <p>{factors.wind.detail}</p>
        <p>{factors.swell.detail}</p>
        <p>{factors.visibility.label} visibility</p>
      </div>

      {/* 48h forecast sparkline */}
      {forecastData?.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] text-white/30 mb-1">48h forecast</p>
          <Sparkline data={forecastData} />
        </div>
      )}

      {/* Best dive site */}
      {bestSite && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] text-white/40 mb-0.5">Top site</p>
          <p className="text-xs text-white/70 font-medium">{bestSite.name}</p>
          <p className="text-[10px] text-white/30">
            {bestSite.difficulty} / {bestSite.maxDepth} ft max
          </p>
        </div>
      )}

      {/* View on map */}
      {onSelectZone && (
        <button
          onClick={() => onSelectZone(zoneId)}
          className="mt-auto pt-2 text-[11px] text-cyan-400/60 hover:text-cyan-400 transition-colors min-h-[44px] flex items-center justify-center"
        >
          View on map
        </button>
      )}
    </div>
  );
}

// Sort selector
const SORT_OPTIONS = [
  { value: 'score', label: 'Overall Score' },
  { value: 'wind', label: 'Wind' },
  { value: 'swell', label: 'Swell' },
  { value: 'visibility', label: 'Visibility' },
  { value: 'species', label: 'Species Count' },
];

export default function ComparisonView({ data, onSelectZone, zoneForecastScores }) {
  const [sortBy, setSortBy] = useState('score');

  const sortedZones = useMemo(() => {
    if (!data?.zoneScores) return [];

    const entries = Object.entries(data.zoneScores).map(([zoneId, zoneScore]) => ({
      zoneId,
      zoneScore,
      zoneDef: LANAI_ZONES[zoneId],
      zoneSpecies: data.zoneSpecies?.[zoneId],
    }));

    entries.sort((a, b) => {
      switch (sortBy) {
        case 'wind':
          return b.zoneScore.factors.wind.score - a.zoneScore.factors.wind.score;
        case 'swell':
          return b.zoneScore.factors.swell.score - a.zoneScore.factors.swell.score;
        case 'visibility':
          return b.zoneScore.factors.visibility.score - a.zoneScore.factors.visibility.score;
        case 'species':
          return (b.zoneSpecies?.count || 0) - (a.zoneSpecies?.count || 0);
        default:
          return b.zoneScore.overall - a.zoneScore.overall;
      }
    });

    return entries;
  }, [data, sortBy]);

  const topZoneId = sortedZones[0]?.zoneId;

  if (!data?.zoneScores) {
    return (
      <main className="px-4 pt-8 max-w-lg mx-auto">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 h-48 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  // Summary stats
  const scores = sortedZones.map(z => z.zoneScore.overall);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const spread = Math.max(...scores) - Math.min(...scores);

  return (
    <main className="px-4 space-y-4 max-w-2xl mx-auto">
      {/* Summary header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Zone Comparison</h2>
            <p className="text-[10px] text-white/30">All 6 zones, sorted by condition quality</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white tabular-nums">{avgScore}</p>
            <p className="text-[10px] text-white/30">avg score</p>
          </div>
        </div>

        {/* Score range indicator */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/5 rounded-full relative overflow-hidden">
            {sortedZones.map((z, i) => {
              const { color } = getOverallLabel(z.zoneScore.overall);
              return (
                <div
                  key={z.zoneId}
                  className="absolute top-0 h-full w-1.5 rounded-full"
                  style={{
                    left: `${z.zoneScore.overall}%`,
                    backgroundColor: color,
                    opacity: z.zoneId === topZoneId ? 1 : 0.5,
                  }}
                  title={`${z.zoneDef.name}: ${z.zoneScore.overall}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-white/30 tabular-nums whitespace-nowrap">
            {spread} pt spread
          </span>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <span className="text-[10px] text-white/30 whitespace-nowrap">Sort by</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
              sortBy === opt.value
                ? 'bg-white/10 text-cyan-400'
                : 'text-white/40 hover:bg-white/5 active:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Zone cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sortedZones.map(({ zoneId, zoneScore, zoneDef, zoneSpecies }) => (
          <ZoneCard
            key={zoneId}
            zoneId={zoneId}
            zoneScore={zoneScore}
            zoneDef={zoneDef}
            zoneSpecies={zoneSpecies}
            isTopZone={zoneId === topZoneId}
            onSelectZone={onSelectZone}
            forecastData={zoneForecastScores?.[zoneId]}
          />
        ))}
      </div>

      {/* Conditions context */}
      {data.conditions && (
        <div className="glass-card p-3">
          <p className="text-[10px] text-white/30 mb-2">Current island-wide conditions</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-sm font-semibold text-white tabular-nums">
                {Math.round(data.conditions.windSpeedMph)} mph
              </p>
              <p className="text-[10px] text-white/30">Wind</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white tabular-nums">
                {data.conditions.swellHeightFt?.toFixed(1)} ft
              </p>
              <p className="text-[10px] text-white/30">Swell</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white tabular-nums">
                {data.conditions.tideHeightFt?.toFixed(1) || data.conditions.tideLevel?.toFixed(1)} ft
              </p>
              <p className="text-[10px] text-white/30">Tide</p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="text-center text-[10px] text-white/20 pb-2 pt-2">
        <p>Scores differ by zone due to shore orientation relative to current wind and swell direction.</p>
        <p className="mt-1">Zones facing away from the swell score higher. Offshore wind is a bonus.</p>
      </div>
    </main>
  );
}
