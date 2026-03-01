import React from 'react';
import { format } from 'date-fns';

export default function Header({
  fetchedAt, errors, onRefresh, loading, currentView, onViewChange,
  isOffline, isStale, staleSummary, notifUnreadCount = 0, onNotifClick,
}) {
  return (
    <header className="safe-top px-4 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-cyan-400">Lanai</span> Dive
          </h1>
          <p className="text-xs text-white/40">
            Real-time dive conditions for L&#x101;na&#x2BB;i
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <button
            onClick={onNotifClick}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition-colors relative"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white/50">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {notifUnreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[10px] font-bold flex items-center justify-center">
                {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
              </span>
            )}
          </button>
          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="Refresh"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Offline / stale data banner */}
      {isOffline && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-400 flex-shrink-0">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs text-amber-400/80">
            Offline{staleSummary ? ` \u00b7 data from ${staleSummary}` : ''}
          </span>
        </div>
      )}
      {!isOffline && isStale && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-400/60 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-xs text-amber-400/60">
            Data is {staleSummary} and may be outdated
          </span>
          <button
            onClick={onRefresh}
            className="text-xs text-cyan-400/70 ml-auto hover:text-cyan-400"
          >
            Refresh
          </button>
        </div>
      )}

      {/* View switcher tabs -- 44px min touch targets */}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
            currentView === 'dashboard'
              ? 'bg-white/10 text-cyan-400'
              : 'text-white/40 hover:text-white/60 hover:bg-white/5 active:bg-white/10'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Dashboard
          </span>
        </button>
        <button
          onClick={() => onViewChange('compare')}
          className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
            currentView === 'compare'
              ? 'bg-white/10 text-cyan-400'
              : 'text-white/40 hover:text-white/60 hover:bg-white/5 active:bg-white/10'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="18" rx="1" />
            </svg>
            Compare
          </span>
        </button>
        <button
          onClick={() => onViewChange('map')}
          className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
            currentView === 'map'
              ? 'bg-white/10 text-cyan-400'
              : 'text-white/40 hover:text-white/60 hover:bg-white/5 active:bg-white/10'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Map
          </span>
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 mt-1">
        {fetchedAt && !isOffline && !isStale && (
          <span className="text-xs text-white/30">
            Updated {format(fetchedAt, 'h:mm a')}
          </span>
        )}
        {errors?.length > 0 && (
          <span className="text-xs text-amber-400/60" title={errors.map(e => `${e.source}: ${e.error}`).join(', ')}>
            {errors.length} source{errors.length > 1 ? 's' : ''} unavailable
          </span>
        )}
      </div>
    </header>
  );
}
