/**
 * SpeciesGuide -- Browsable species reference panel.
 *
 * Shows all harvestable marine species with:
 *   - Hawaiian name, common name, Latin binomial
 *   - Season status (open/closed badge)
 *   - Size limit, bag limit, gear restrictions
 *   - Ciguatera risk, edibility rating
 *   - Zone affinity, MLCD warnings
 *
 * Designed as a slide-up panel triggered from Dashboard or Map.
 */

import React, { useState, useMemo } from 'react';
import {
  SPECIES,
  SPECIES_CATEGORY,
  getSeasonStatus,
  getSpeciesByCategory,
  MANELE_HULOPOE_MLCD,
} from '../data/species.js';

const CATEGORY_LABELS = {
  [SPECIES_CATEGORY.FISH]: { label: 'Fish', emoji: '\u{1F41F}' },
  [SPECIES_CATEGORY.CRUSTACEAN]: { label: 'Crustaceans', emoji: '\u{1F99E}' },
  [SPECIES_CATEGORY.MOLLUSK]: { label: 'Mollusks', emoji: '\u{1F419}' },
  [SPECIES_CATEGORY.ECHINODERM]: { label: 'Echinoderms', emoji: '\u{1FAB8}' },
};

const CATEGORY_ORDER = [
  SPECIES_CATEGORY.CRUSTACEAN,
  SPECIES_CATEGORY.FISH,
  SPECIES_CATEGORY.MOLLUSK,
  SPECIES_CATEGORY.ECHINODERM,
];

export default function SpeciesGuide({ isOpen, onClose }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const now = new Date();

  const grouped = useMemo(() => getSpeciesByCategory(), []);

  const filteredSpecies = useMemo(() => {
    let pool = SPECIES;

    if (filter === 'in_season') {
      pool = pool.filter(s => getSeasonStatus(s, now).status !== 'closed');
    } else if (filter === 'closed') {
      pool = pool.filter(s => getSeasonStatus(s, now).status === 'closed');
    } else if (filter === 'invasive') {
      pool = pool.filter(s => s.invasive);
    } else if (filter === 'night') {
      pool = pool.filter(s => s.nightDive);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter(s =>
        s.commonName.toLowerCase().includes(q) ||
        s.hawaiianName.toLowerCase().includes(q) ||
        s.latinName.toLowerCase().includes(q) ||
        s.family.toLowerCase().includes(q)
      );
    }

    return pool;
  }, [filter, search, now]);

  // Group filtered results
  const filteredGrouped = useMemo(() => {
    const result = {};
    for (const cat of CATEGORY_ORDER) {
      const items = filteredSpecies.filter(s => s.category === cat);
      if (items.length > 0) result[cat] = items;
    }
    return result;
  }, [filteredSpecies]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ocean-950/98 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-base font-bold">Species Guide</h2>
          <p className="text-[10px] text-white/40">
            {filteredSpecies.length} of {SPECIES.length} species
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white/50">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, Hawaiian, Latin, or family..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
        />
      </div>

      {/* Filter pills */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All' },
          { key: 'in_season', label: 'In Season' },
          { key: 'closed', label: 'Closed' },
          { key: 'invasive', label: 'Invasive' },
          { key: 'night', label: 'Night Dive' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Species list */}
      <div className="flex-1 overflow-y-auto px-4 pb-safe">
        {Object.entries(filteredGrouped).map(([cat, species]) => (
          <div key={cat} className="mb-4">
            {/* Category header */}
            <div className="flex items-center gap-2 py-2 sticky top-0 bg-ocean-950/95 backdrop-blur z-10">
              <span className="text-sm">{CATEGORY_LABELS[cat]?.emoji}</span>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]?.label}
              </h3>
              <span className="text-[10px] text-white/30">({species.length})</span>
            </div>

            {/* Species cards */}
            <div className="space-y-1.5">
              {species.map(s => (
                <SpeciesCard
                  key={s.id}
                  species={s}
                  isExpanded={expandedId === s.id}
                  onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  now={now}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredSpecies.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/30 text-sm">No species match your filters</p>
          </div>
        )}

        {/* MLCD notice */}
        <div className="glass-card p-3 mt-4 mb-6 border-l-2 border-amber-500/50">
          <p className="text-xs font-semibold text-amber-400">
            Manele-Hulopoʻe MLCD
          </p>
          <p className="text-[10px] text-white/50 mt-1">
            No spearfishing or invertebrate harvest within the Marine Life Conservation District
            (Hulopoʻe Bay and Manele Bay). Pole-and-line from shoreline only for finfish and ʻaʻama crab.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-white/20 text-center pb-4">
          Regulations sourced from DLNR/DAR (2025). Always verify current rules before harvesting.
        </p>
      </div>
    </div>
  );
}

function SpeciesCard({ species, isExpanded, onToggle, now }) {
  const season = getSeasonStatus(species, now);
  const isClosed = season.status === 'closed';

  return (
    <div className={`glass-card overflow-hidden transition-all ${isClosed ? 'opacity-60' : ''}`}>
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Season indicator */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isClosed ? 'bg-red-500' : species.invasive ? 'bg-purple-500' : 'bg-green-500'
        }`} />

        {/* Names */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium truncate">
              {species.hawaiianName}
            </span>
            <span className="text-[10px] text-white/40 truncate">
              {species.commonName}
            </span>
          </div>
          <p className="text-[10px] text-white/25 italic truncate">
            {species.latinName}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {species.invasive && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
              invasive
            </span>
          )}
          {species.nightDive && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
              night
            </span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
            isClosed
              ? 'bg-red-500/20 text-red-400'
              : 'bg-green-500/20 text-green-400'
          }`}>
            {isClosed ? 'closed' : 'open'}
          </span>
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-3.5 h-3.5 text-white/20 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
          {/* Description */}
          <p className="text-xs text-white/50">{species.description}</p>

          {/* Regulations grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {species.sizeLimit && (
              <RegRow label="Min size" value={species.sizeLimit} />
            )}
            {species.bagLimit && (
              <RegRow label="Bag limit" value={`${species.bagLimit}/day`} />
            )}
            {species.bagLimitNote && !species.bagLimit && (
              <RegRow label="Bag limit" value={species.bagLimitNote} span />
            )}
            {species.closedSeasonLabel && (
              <RegRow
                label="Closed"
                value={species.closedSeasonLabel}
                className="text-red-400/80"
              />
            )}
            {species.genderRestriction && (
              <RegRow label="Gender" value={species.genderRestriction} span />
            )}
          </div>

          {/* Gear restrictions */}
          {species.gearRestrictions && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Gear</p>
              <p className="text-xs text-white/50">{species.gearRestrictions}</p>
            </div>
          )}

          {/* Risk / Edibility row */}
          <div className="flex gap-3">
            {species.ciguateraRisk && species.ciguateraRisk !== 'none' && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30">Ciguatera:</span>
                <span className={`text-[10px] font-medium ${
                  species.ciguateraRisk === 'high' ? 'text-red-400' :
                  species.ciguateraRisk === 'moderate' ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {species.ciguateraRisk}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/30">Eating:</span>
              <span className={`text-[10px] font-medium ${
                species.edibility === 'excellent' ? 'text-green-400' :
                species.edibility === 'good' ? 'text-cyan-400' :
                species.edibility === 'moderate' ? 'text-amber-400' :
                species.edibility === 'risky' ? 'text-red-400' :
                'text-white/40'
              }`}>
                {species.edibility}
              </span>
            </div>
          </div>

          {/* Lanai-specific notes */}
          {species.lanaiNotes && (
            <div className="bg-cyan-500/5 rounded-lg p-2 border border-cyan-500/10">
              <p className="text-[10px] text-cyan-400/60 font-medium mb-0.5">Lanai Notes</p>
              <p className="text-[10px] text-white/40">{species.lanaiNotes}</p>
            </div>
          )}

          {/* Family */}
          <p className="text-[10px] text-white/20">
            Family: {species.family}
          </p>
        </div>
      )}
    </div>
  );
}

function RegRow({ label, value, span = false, className = '' }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <span className="text-[10px] text-white/30">{label}: </span>
      <span className={`text-[10px] text-white/60 ${className}`}>{value}</span>
    </div>
  );
}
