import React from 'react';
import { getOverallLabel } from '../scoring/index.js';

const ICONS = {
  wind: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  swell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0s4 3 6 0" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0s4 3 6 0" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
    </svg>
  ),
  tide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M2 6l3 3 3-3 3 3 3-3 3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 18h20M2 14l3-2 3 2 3-2 3 2 3-2 3 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  ),
  rain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 16v2m4-3v2m4-1v2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  visibility: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

export default function ConditionCard({ name, factor, weight }) {
  const { color } = getOverallLabel(factor.score);
  const pct = Math.round(weight * 100);

  return (
    <div className="glass-card p-4 fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{ICONS[name]}</span>
          <span className="text-sm font-medium capitalize">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{pct}%</span>
          <span className="text-lg font-bold tabular-nums" style={{ color }}>
            {factor.score}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-white/10 mb-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${factor.score}%`,
            backgroundColor: color
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{factor.label}</span>
        <span className="text-xs text-white/40">{factor.detail}</span>
      </div>
    </div>
  );
}
