import React from 'react';

export default function WaterTemp({ tempF, buoyTime }) {
  if (tempF === null || tempF === undefined) return null;

  return (
    <div className="glass-card p-3 flex items-center justify-between fade-in">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-cyan-400">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm text-white/60">Water Temp</span>
      </div>
      <span className="text-sm font-medium">
        {Math.round(tempF)}&deg;F
        <span className="text-white/40 ml-1">({Math.round((tempF - 32) * 5 / 9)}&deg;C)</span>
      </span>
    </div>
  );
}
