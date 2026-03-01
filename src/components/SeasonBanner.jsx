/**
 * SeasonBanner -- Compact banner showing current harvest season status.
 * Displays lobster season, closed species, and in-season count.
 * Sits below the score gauge on the Dashboard.
 */

import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

export default function SeasonBanner({ seasonInfo }) {
  const [expanded, setExpanded] = useState(false);

  if (!seasonInfo) return null;

  const { lobster, spearfishing, all } = seasonInfo;
  const closedSpecies = all.closedSpecies || [];

  return (
    <div className="glass-card overflow-hidden">
      {/* Collapsed: single-line summary */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
      >
        {/* Lobster icon */}
        <span className="text-lg flex-shrink-0">
          {lobster.inSeason ? '\u{1F99E}' : '\u{1F6AB}'}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              lobster.inSeason
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {lobster.inSeason ? 'Lobster Open' : 'Lobster Closed'}
            </span>

            {closedSpecies.length > 0 && (
              <span className="text-[10px] text-amber-400/70">
                {closedSpecies.length} species closed
              </span>
            )}
          </div>

          <p className="text-[10px] text-white/30 mt-0.5 truncate">
            {all.openCount}/{all.totalCount} harvestable species in season
            {!lobster.inSeason && lobster.closedUntil && (
              <> &middot; Lobster opens {format(lobster.closedUntil, 'MMM d')}</>
            )}
          </p>
        </div>

        {/* Expand chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded: show closed species list */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-white/5">
          {closedSpecies.length > 0 ? (
            <>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-2 mb-1.5">
                Currently Closed
              </p>
              <div className="flex flex-wrap gap-1.5">
                {closedSpecies.map(name => (
                  <span
                    key={name}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400/80"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-green-400/70 mt-2">
              All species open for harvest
            </p>
          )}

          {/* Spearfishing-specific note */}
          {spearfishing.closedSpecies.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Spearfishing Closures
              </p>
              <div className="flex flex-wrap gap-1.5">
                {spearfishing.closedSpecies.map(name => (
                  <span
                    key={name}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/20 mt-2">
            DLNR/DAR regulations. Verify current rules before harvesting.
          </p>
        </div>
      )}
    </div>
  );
}
