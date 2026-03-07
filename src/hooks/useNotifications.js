/**
 * useNotifications -- Manages notification permissions, preferences,
 * threshold comparison between fetches, and firing Notification API alerts.
 *
 * Foreground-only for now (no Push API server). When the AWS backend is
 * deployed, the pushSubscription getter enables server-side push.
 *
 * Notification triggers:
 *  1. Score crosses a threshold (e.g., zone goes from Poor to Good)
 *  2. Best zone changes
 *  3. Wind exceeds or drops below a user-set limit
 *  4. Swell exceeds or drops below a user-set limit
 *  5. Lobster season opens/closes
 */

import { useState, useEffect, useCallback } from 'react';
import { subscribeToPush, unsubscribeFromPush, updatePushPrefs } from '../push.js';

// --- Persistence keys ---
const PREFS_KEY = 'lanaidive:notifPrefs';
const HISTORY_KEY = 'lanaidive:notifHistory';

// --- Default preferences ---
const DEFAULT_PREFS = {
  enabled: false,
  scoreThreshold: 70, // Notify when any zone crosses this score
  windLimitMph: 20, // Notify when wind exceeds this
  swellLimitFt: 6, // Notify when swell exceeds this
  bestZoneChange: true, // Notify when the best zone changes
  seasonChange: true, // Notify on lobster/species season transitions
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* silent */
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    // Keep last 50 notifications
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    /* silent */
  }
}

/**
 * @returns {{
 *   prefs: object,
 *   updatePrefs: (partial: object) => void,
 *   permission: string,
 *   requestPermission: () => Promise<string>,
 *   history: Array,
 *   clearHistory: () => void,
 *   unreadCount: number,
 *   markRead: () => void,
 *   checkAndNotify: (prevData: object, newData: object) => void,
 *   supported: boolean
 * }}
 */
export default function useNotifications() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [history, setHistory] = useState(loadHistory);
  const [unreadCount, setUnreadCount] = useState(0);
  const supported = typeof Notification !== 'undefined';

  // Sync prefs to localStorage and server push backend
  useEffect(() => {
    savePrefs(prefs);
    // Non-blocking sync to server
    if (prefs.enabled && permission === 'granted') {
      updatePushPrefs(prefs).catch((err) => console.error('Failed to sync push prefs:', err));
    }
    if (!prefs.enabled) {
      unsubscribeFromPush().catch((err) => console.error('Failed to unsubscribe push:', err));
    }
  }, [prefs, permission]);
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const updatePrefs = useCallback((partial) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      updatePrefs({ enabled: true });
      // Also subscribe to server-side push (non-blocking)
      subscribeToPush(prefs).catch((err) => console.error('Failed to subscribe push:', err));
    }
    return result;
  }, [supported, updatePrefs, prefs]);

  const addNotification = useCallback(
    (title, body, tag) => {
      const entry = {
        id: Date.now(),
        title,
        body,
        tag,
        time: new Date().toISOString(),
        read: false,
      };
      setHistory((prev) => [entry, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Fire browser notification if permitted
      if (supported && permission === 'granted') {
        try {
          new Notification(title, {
            body,
            tag, // Replaces notifications with the same tag
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            silent: false,
          });
        } catch {
          // iOS may throw in certain states; sw registration needed
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title,
              options: { body, tag, icon: '/icon-192.png' },
            });
          }
        }
      }
    },
    [supported, permission],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    setUnreadCount(0);
  }, []);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    setHistory((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /**
   * Compare previous and current condition data, fire notifications
   * for any threshold crossings.
   */
  const checkAndNotify = useCallback(
    (prevData, newData) => {
      if (!prefs.enabled || !prevData || !newData) return;
      if (!prevData.zoneScores || !newData.zoneScores) return;

      // 1. Score threshold crossings
      if (prefs.scoreThreshold > 0) {
        const threshold = prefs.scoreThreshold;
        for (const [zoneId, newScore] of Object.entries(newData.zoneScores)) {
          const prevScore = prevData.zoneScores[zoneId];
          if (!prevScore) continue;
          const wasAbove = prevScore.overall >= threshold;
          const isAbove = newScore.overall >= threshold;
          if (!wasAbove && isAbove) {
            addNotification(
              `${newScore.zone.name} is now diveable`,
              `Score rose to ${newScore.overall} (threshold: ${threshold})`,
              `score-up-${zoneId}`,
            );
          } else if (wasAbove && !isAbove) {
            addNotification(
              `${newScore.zone.name} conditions dropped`,
              `Score fell to ${newScore.overall} (was ${prevScore.overall})`,
              `score-down-${zoneId}`,
            );
          }
        }
      }

      // 2. Best zone change
      if (prefs.bestZoneChange) {
        const prevBest = Object.entries(prevData.zoneScores).sort(
          ([, a], [, b]) => b.overall - a.overall,
        )[0];
        const newBest = Object.entries(newData.zoneScores).sort(
          ([, a], [, b]) => b.overall - a.overall,
        )[0];
        if (prevBest && newBest && prevBest[0] !== newBest[0]) {
          addNotification(
            'Best zone changed',
            `${newBest[1].zone.name} (${newBest[1].overall}) replaced ${prevBest[1].zone.name} (${prevBest[1].overall})`,
            'best-zone-change',
          );
        }
      }

      // 3. Wind limit
      if (prefs.windLimitMph > 0 && newData.conditions && prevData.conditions) {
        const wasOver = prevData.conditions.windSpeedMph > prefs.windLimitMph;
        const isOver = newData.conditions.windSpeedMph > prefs.windLimitMph;
        if (!wasOver && isOver) {
          addNotification(
            'Wind advisory',
            `Wind increased to ${Math.round(newData.conditions.windSpeedMph)} mph (limit: ${prefs.windLimitMph})`,
            'wind-over',
          );
        } else if (wasOver && !isOver) {
          addNotification(
            'Wind easing',
            `Wind dropped to ${Math.round(newData.conditions.windSpeedMph)} mph`,
            'wind-under',
          );
        }
      }

      // 4. Swell limit
      if (prefs.swellLimitFt > 0 && newData.conditions && prevData.conditions) {
        const wasOver = prevData.conditions.swellHeightFt > prefs.swellLimitFt;
        const isOver = newData.conditions.swellHeightFt > prefs.swellLimitFt;
        if (!wasOver && isOver) {
          addNotification(
            'Swell advisory',
            `Swell increased to ${newData.conditions.swellHeightFt.toFixed(1)} ft (limit: ${prefs.swellLimitFt})`,
            'swell-over',
          );
        } else if (wasOver && !isOver) {
          addNotification(
            'Swell dropping',
            `Swell eased to ${newData.conditions.swellHeightFt.toFixed(1)} ft`,
            'swell-under',
          );
        }
      }

      // 5. Lobster season transition
      if (prefs.seasonChange && prevData.seasonInfo && newData.seasonInfo) {
        const wasOpen = prevData.seasonInfo.lobster?.inSeason;
        const isOpen = newData.seasonInfo.lobster?.inSeason;
        if (wasOpen !== undefined && isOpen !== undefined && wasOpen !== isOpen) {
          addNotification(
            isOpen ? 'Lobster season opened!' : 'Lobster season closed',
            isOpen
              ? 'Spiny lobster harvest is now permitted (Sep 1 - Apr 30)'
              : 'Lobster season closed May 1 through August 31',
            'lobster-season',
          );
        }
      }
    },
    [prefs, addNotification],
  );

  return {
    prefs,
    updatePrefs,
    permission,
    requestPermission,
    history,
    clearHistory,
    unreadCount,
    markRead,
    checkAndNotify,
    supported,
  };
}
