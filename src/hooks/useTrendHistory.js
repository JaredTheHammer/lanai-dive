/**
 * useTrendHistory -- Accumulates condition snapshots across refreshes
 * into a localStorage-backed ring buffer for historical trend charts.
 *
 * Each snapshot is a compact object (~200 bytes) stored at the refresh
 * interval (15 min). At 672 entries max, this uses ~135 KB of localStorage.
 *
 * Schema per snapshot:
 *   { t, s, bz, bs, w, wd, sh, sp, tl, r, wt, zs }
 *   t   = timestamp (ms)
 *   s   = overall score
 *   bz  = best zone id
 *   bs  = best zone score
 *   w   = wind speed mph
 *   wd  = wind direction deg
 *   sh  = swell height ft
 *   sp  = swell period sec
 *   tl  = tide level ft
 *   r   = rain24h inches
 *   wt  = water temp F (nullable)
 *   zs  = { zoneId: score } map (all zones)
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lanaidive:trendHistory';
const MAX_ENTRIES = 672;              // 7 days at 15-min intervals
const MIN_INTERVAL_MS = 10 * 60_000; // Don't store more than once per 10 min

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* full */ }
}

/**
 * Extract a compact snapshot from the full conditions data object.
 */
function extractSnapshot(data) {
  if (!data?.score || !data?.conditions) return null;

  const zoneScoreMap = {};
  if (data.zoneScores) {
    for (const [id, z] of Object.entries(data.zoneScores)) {
      zoneScoreMap[id] = z.overall;
    }
  }

  // Find best zone
  let bestZoneId = null;
  let bestZoneScore = 0;
  for (const [id, score] of Object.entries(zoneScoreMap)) {
    if (score > bestZoneScore) {
      bestZoneId = id;
      bestZoneScore = score;
    }
  }

  return {
    t: Date.now(),
    s: data.score.overall,
    bz: bestZoneId,
    bs: bestZoneScore,
    w: data.conditions.windSpeedMph,
    wd: data.conditions.windDirectionDeg,
    sh: data.conditions.swellHeightFt,
    sp: data.conditions.swellPeriodSec,
    tl: data.conditions.tideLevel,
    r: data.conditions.rain24h,
    wt: data.waterTemp ?? null,
    zs: zoneScoreMap,
  };
}

export default function useTrendHistory() {
  const [history, setHistory] = useState(loadHistory);

  // Persist whenever history changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  /**
   * Record a new snapshot from the latest fetch result.
   * Deduplicates based on MIN_INTERVAL_MS.
   */
  const recordSnapshot = useCallback((data) => {
    const snapshot = extractSnapshot(data);
    if (!snapshot) return;

    setHistory(prev => {
      // Check minimum interval
      if (prev.length > 0) {
        const lastT = prev[prev.length - 1].t;
        if (snapshot.t - lastT < MIN_INTERVAL_MS) return prev;
      }
      // Append and trim
      const updated = [...prev, snapshot];
      if (updated.length > MAX_ENTRIES) {
        return updated.slice(updated.length - MAX_ENTRIES);
      }
      return updated;
    });
  }, []);

  /**
   * Get history filtered to a time range.
   * @param {'6h'|'24h'|'48h'|'7d'} range
   */
  const getRange = useCallback((range) => {
    const now = Date.now();
    const msMap = { '6h': 6 * 3600_000, '24h': 24 * 3600_000, '48h': 48 * 3600_000, '7d': 7 * 86400_000 };
    const cutoff = now - (msMap[range] || msMap['24h']);
    return history.filter(s => s.t >= cutoff);
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, recordSnapshot, getRange, clearHistory };
}

export { extractSnapshot, STORAGE_KEY, MAX_ENTRIES };
