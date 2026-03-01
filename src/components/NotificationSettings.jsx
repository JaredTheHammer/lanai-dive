/**
 * NotificationSettings -- Full-screen overlay for notification preferences
 * and notification history.
 *
 * Two tabs: Settings | History
 */

import React, { useState } from 'react';

export default function NotificationSettings({
  isOpen,
  onClose,
  prefs,
  updatePrefs,
  permission,
  requestPermission,
  history,
  clearHistory,
  markRead,
  supported,
}) {
  const [tab, setTab] = useState('settings');

  if (!isOpen) return null;

  const needsPermission = supported && permission !== 'granted' && permission !== 'denied';
  const isDenied = supported && permission === 'denied';

  return (
    <div className="fixed inset-0 z-50 bg-ocean-950/98 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="safe-top px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-base font-bold">Notifications</h2>
        <button
          onClick={() => { markRead(); onClose(); }}
          className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full touch-active"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white/40">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setTab('settings')}
          className={`flex-1 py-3 min-h-[44px] text-xs font-medium transition-colors ${
            tab === 'settings' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/40'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-3 min-h-[44px] text-xs font-medium transition-colors relative ${
            tab === 'history' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/40'
          }`}
        >
          History
          {history.filter(n => !n.read).length > 0 && (
            <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-cyan-400" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 safe-bottom">
        {tab === 'settings' && (
          <SettingsTab
            prefs={prefs}
            updatePrefs={updatePrefs}
            permission={permission}
            requestPermission={requestPermission}
            supported={supported}
            needsPermission={needsPermission}
            isDenied={isDenied}
          />
        )}
        {tab === 'history' && (
          <HistoryTab history={history} clearHistory={clearHistory} />
        )}
      </div>
    </div>
  );
}

function SettingsTab({ prefs, updatePrefs, permission, requestPermission, supported, needsPermission, isDenied }) {
  return (
    <div className="space-y-5">
      {/* Permission status */}
      {!supported && (
        <div className="glass-card p-4">
          <p className="text-xs text-amber-400/80">
            Notifications are not supported in this browser. Try adding the app to your home screen on iOS 16.4+.
          </p>
        </div>
      )}

      {isDenied && (
        <div className="glass-card p-4">
          <p className="text-xs text-amber-400/80">
            Notification permission was denied. To re-enable, go to your browser/device settings and allow notifications for this site.
          </p>
        </div>
      )}

      {needsPermission && (
        <button
          onClick={requestPermission}
          className="w-full glass-card p-4 flex items-center gap-3 touch-active"
        >
          <span className="text-2xl">🔔</span>
          <div className="text-left">
            <p className="text-sm font-medium">Enable Notifications</p>
            <p className="text-xs text-white/40">Get alerts when conditions change</p>
          </div>
        </button>
      )}

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Condition Alerts</p>
          <p className="text-xs text-white/40">Notify on threshold crossings during refresh</p>
        </div>
        <ToggleSwitch
          checked={prefs.enabled}
          onChange={(v) => updatePrefs({ enabled: v })}
          disabled={!supported || isDenied}
        />
      </div>

      <div className={prefs.enabled ? 'space-y-4' : 'space-y-4 opacity-40 pointer-events-none'}>
        {/* Score threshold */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-white/60">Score threshold</p>
            <span className="text-xs font-bold text-cyan-400 tabular-nums">{prefs.scoreThreshold}</span>
          </div>
          <input
            type="range"
            min={30}
            max={90}
            step={5}
            value={prefs.scoreThreshold}
            onChange={(e) => updatePrefs({ scoreThreshold: Number(e.target.value) })}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>30 (any)</span>
            <span>90 (strict)</span>
          </div>
        </div>

        {/* Wind limit */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-white/60">Wind limit</p>
            <span className="text-xs font-bold text-cyan-400 tabular-nums">{prefs.windLimitMph} mph</span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={prefs.windLimitMph}
            onChange={(e) => updatePrefs({ windLimitMph: Number(e.target.value) })}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>5 mph</span>
            <span>40 mph</span>
          </div>
        </div>

        {/* Swell limit */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-white/60">Swell limit</p>
            <span className="text-xs font-bold text-cyan-400 tabular-nums">{prefs.swellLimitFt} ft</span>
          </div>
          <input
            type="range"
            min={2}
            max={15}
            step={0.5}
            value={prefs.swellLimitFt}
            onChange={(e) => updatePrefs({ swellLimitFt: Number(e.target.value) })}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>2 ft</span>
            <span>15 ft</span>
          </div>
        </div>

        {/* Boolean toggles */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">Best zone changes</p>
              <p className="text-[10px] text-white/30">Alert when the top-rated zone shifts</p>
            </div>
            <ToggleSwitch
              checked={prefs.bestZoneChange}
              onChange={(v) => updatePrefs({ bestZoneChange: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">Season transitions</p>
              <p className="text-[10px] text-white/30">Lobster season open/close alerts</p>
            </div>
            <ToggleSwitch
              checked={prefs.seasonChange}
              onChange={(v) => updatePrefs({ seasonChange: v })}
            />
          </div>
        </div>
      </div>

      {/* Push note */}
      <div className="pt-2 border-t border-white/5">
        <p className="text-[10px] text-white/20 leading-relaxed">
          Alerts fire when the app is open and conditions change between refreshes. Background push notifications will be available after server deployment.
        </p>
      </div>
    </div>
  );
}

function HistoryTab({ history, clearHistory }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-3xl mb-3 opacity-30">🔕</div>
        <p className="text-sm text-white/30">No notifications yet</p>
        <p className="text-xs text-white/20 mt-1">Alerts will appear here when conditions change</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={clearHistory}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        {history.map(n => (
          <div key={n.id} className={`glass-card p-3 ${n.read ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium">{n.title}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{n.body}</p>
              </div>
              <span className="text-[10px] text-white/20 flex-shrink-0">
                {formatNotifTime(n.time)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        disabled ? 'opacity-30 cursor-not-allowed' :
        checked ? 'bg-cyan-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function formatNotifTime(isoStr) {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch {
    return '';
  }
}
