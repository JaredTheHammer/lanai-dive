/**
 * useNotifications Hook Tests
 *
 * Tests notification preferences persistence, permission handling,
 * threshold-based notification logic (checkAndNotify), history
 * management, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the push.js module before importing the hook
vi.mock('../push.js', () => ({
  subscribeToPush: vi.fn().mockResolvedValue(null),
  unsubscribeFromPush: vi.fn().mockResolvedValue(undefined),
  updatePushPrefs: vi.fn().mockResolvedValue(undefined),
}));

import useNotifications from './useNotifications.js';

beforeEach(() => {
  localStorage.clear();
  // Mock Notification API
  globalThis.Notification = vi.fn();
  globalThis.Notification.permission = 'default';
  globalThis.Notification.requestPermission = vi.fn().mockResolvedValue('granted');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state & preferences
// ---------------------------------------------------------------------------
describe('initial state', () => {
  it('returns default preferences when none stored', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.prefs.enabled).toBe(false);
    expect(result.current.prefs.scoreThreshold).toBe(70);
    expect(result.current.prefs.windLimitMph).toBe(20);
    expect(result.current.prefs.swellLimitFt).toBe(6);
    expect(result.current.prefs.bestZoneChange).toBe(true);
    expect(result.current.prefs.seasonChange).toBe(true);
  });

  it('loads persisted preferences from localStorage', () => {
    localStorage.setItem(
      'lanaidive:notifPrefs',
      JSON.stringify({
        enabled: true,
        scoreThreshold: 50,
      }),
    );
    const { result } = renderHook(() => useNotifications());
    expect(result.current.prefs.enabled).toBe(true);
    expect(result.current.prefs.scoreThreshold).toBe(50);
    // Defaults for unset fields
    expect(result.current.prefs.windLimitMph).toBe(20);
  });

  it('falls back to defaults for corrupted localStorage', () => {
    localStorage.setItem('lanaidive:notifPrefs', 'not-json');
    const { result } = renderHook(() => useNotifications());
    expect(result.current.prefs.enabled).toBe(false);
  });

  it('returns empty history initially', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.history).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('reports supported=true when Notification API exists', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.supported).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updatePrefs
// ---------------------------------------------------------------------------
describe('updatePrefs', () => {
  it('merges partial updates into existing preferences', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ scoreThreshold: 80, windLimitMph: 15 });
    });
    expect(result.current.prefs.scoreThreshold).toBe(80);
    expect(result.current.prefs.windLimitMph).toBe(15);
    // Other prefs unchanged
    expect(result.current.prefs.swellLimitFt).toBe(6);
  });

  it('persists updated preferences to localStorage', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ scoreThreshold: 90 });
    });
    const stored = JSON.parse(localStorage.getItem('lanaidive:notifPrefs'));
    expect(stored.scoreThreshold).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// requestPermission
// ---------------------------------------------------------------------------
describe('requestPermission', () => {
  it('requests permission and updates state on grant', async () => {
    const { result } = renderHook(() => useNotifications());
    let permResult;
    await act(async () => {
      permResult = await result.current.requestPermission();
    });
    expect(permResult).toBe('granted');
    expect(result.current.permission).toBe('granted');
    expect(result.current.prefs.enabled).toBe(true);
  });

  it('returns denied when Notification API is unavailable', async () => {
    delete globalThis.Notification;
    const { result } = renderHook(() => useNotifications());
    let permResult;
    await act(async () => {
      permResult = await result.current.requestPermission();
    });
    expect(permResult).toBe('denied');
  });
});

// ---------------------------------------------------------------------------
// checkAndNotify – score threshold
// ---------------------------------------------------------------------------
describe('checkAndNotify – score thresholds', () => {
  const makeData = (zoneScores, conditions = {}) => ({
    zoneScores,
    conditions,
    seasonInfo: { lobster: { inSeason: true } },
  });

  const zoneA = (score) => ({
    overall: score,
    zone: { name: 'South Shore' },
  });

  it('fires notification when zone crosses above threshold', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, scoreThreshold: 70 });
    });

    const prev = makeData({ south: zoneA(65) });
    const next = makeData({ south: zoneA(75) });

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    expect(result.current.history.length).toBe(1);
    expect(result.current.history[0].title).toContain('diveable');
    expect(result.current.unreadCount).toBe(1);
  });

  it('fires notification when zone drops below threshold', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, scoreThreshold: 70 });
    });

    const prev = makeData({ south: zoneA(75) });
    const next = makeData({ south: zoneA(60) });

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    expect(result.current.history.length).toBe(1);
    expect(result.current.history[0].title).toContain('dropped');
  });

  it('does not fire when score stays above threshold', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, scoreThreshold: 70 });
    });

    const prev = makeData({ south: zoneA(80) });
    const next = makeData({ south: zoneA(85) });

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('does nothing when notifications are disabled', () => {
    const { result } = renderHook(() => useNotifications());
    // prefs.enabled is false by default

    const prev = makeData({ south: zoneA(65) });
    const next = makeData({ south: zoneA(75) });

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    expect(result.current.history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkAndNotify – best zone change
// ---------------------------------------------------------------------------
describe('checkAndNotify – best zone change', () => {
  it('fires notification when best zone changes', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, bestZoneChange: true, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {
        south: { overall: 80, zone: { name: 'South' } },
        west: { overall: 70, zone: { name: 'West' } },
      },
      conditions: {},
      seasonInfo: { lobster: { inSeason: true } },
    };
    const next = {
      zoneScores: {
        south: { overall: 65, zone: { name: 'South' } },
        west: { overall: 85, zone: { name: 'West' } },
      },
      conditions: {},
      seasonInfo: { lobster: { inSeason: true } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    const bestChangeNotif = result.current.history.find((n) => n.tag === 'best-zone-change');
    expect(bestChangeNotif).toBeDefined();
    expect(bestChangeNotif.body).toContain('West');
  });
});

// ---------------------------------------------------------------------------
// checkAndNotify – wind/swell limits
// ---------------------------------------------------------------------------
describe('checkAndNotify – wind limit', () => {
  it('fires when wind exceeds limit', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, windLimitMph: 20, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {},
      conditions: { windSpeedMph: 15, swellHeightFt: 3 },
      seasonInfo: { lobster: { inSeason: true } },
    };
    const next = {
      zoneScores: {},
      conditions: { windSpeedMph: 25, swellHeightFt: 3 },
      seasonInfo: { lobster: { inSeason: true } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    const windNotif = result.current.history.find((n) => n.tag === 'wind-over');
    expect(windNotif).toBeDefined();
    expect(windNotif.title).toContain('advisory');
  });

  it('fires when wind drops below limit', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, windLimitMph: 20, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {},
      conditions: { windSpeedMph: 25, swellHeightFt: 3 },
      seasonInfo: { lobster: { inSeason: true } },
    };
    const next = {
      zoneScores: {},
      conditions: { windSpeedMph: 15, swellHeightFt: 3 },
      seasonInfo: { lobster: { inSeason: true } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    const windNotif = result.current.history.find((n) => n.tag === 'wind-under');
    expect(windNotif).toBeDefined();
    expect(windNotif.title).toContain('easing');
  });
});

describe('checkAndNotify – swell limit', () => {
  it('fires when swell exceeds limit', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, swellLimitFt: 6, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {},
      conditions: { windSpeedMph: 10, swellHeightFt: 4 },
      seasonInfo: { lobster: { inSeason: true } },
    };
    const next = {
      zoneScores: {},
      conditions: { windSpeedMph: 10, swellHeightFt: 8 },
      seasonInfo: { lobster: { inSeason: true } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    expect(result.current.history.find((n) => n.tag === 'swell-over')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// checkAndNotify – lobster season transition
// ---------------------------------------------------------------------------
describe('checkAndNotify – season transition', () => {
  it('fires when lobster season opens', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, seasonChange: true, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {},
      conditions: {},
      seasonInfo: { lobster: { inSeason: false } },
    };
    const next = {
      zoneScores: {},
      conditions: {},
      seasonInfo: { lobster: { inSeason: true } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    const seasonNotif = result.current.history.find((n) => n.tag === 'lobster-season');
    expect(seasonNotif).toBeDefined();
    expect(seasonNotif.title).toContain('opened');
  });

  it('fires when lobster season closes', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, seasonChange: true, scoreThreshold: 0 });
    });

    const prev = {
      zoneScores: {},
      conditions: {},
      seasonInfo: { lobster: { inSeason: true } },
    };
    const next = {
      zoneScores: {},
      conditions: {},
      seasonInfo: { lobster: { inSeason: false } },
    };

    act(() => {
      result.current.checkAndNotify(prev, next);
    });

    const seasonNotif = result.current.history.find((n) => n.tag === 'lobster-season');
    expect(seasonNotif).toBeDefined();
    expect(seasonNotif.title).toContain('closed');
  });
});

// ---------------------------------------------------------------------------
// checkAndNotify – null/missing data guards
// ---------------------------------------------------------------------------
describe('checkAndNotify – guards', () => {
  it('does nothing when prevData is null', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true });
    });

    act(() => {
      result.current.checkAndNotify(null, { zoneScores: {} });
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('does nothing when newData is null', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true });
    });

    act(() => {
      result.current.checkAndNotify({ zoneScores: {} }, null);
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('does nothing when zoneScores are missing', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true });
    });

    act(() => {
      result.current.checkAndNotify({ conditions: {} }, { conditions: {} });
    });

    expect(result.current.history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// History management
// ---------------------------------------------------------------------------
describe('history management', () => {
  it('clearHistory empties history and resets unread count', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, scoreThreshold: 70 });
    });

    // Trigger a notification
    act(() => {
      result.current.checkAndNotify(
        { zoneScores: { s: { overall: 65, zone: { name: 'S' } } }, conditions: {}, seasonInfo: {} },
        { zoneScores: { s: { overall: 75, zone: { name: 'S' } } }, conditions: {}, seasonInfo: {} },
      );
    });

    expect(result.current.history.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markRead sets unreadCount to 0 and marks all entries as read', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({ enabled: true, scoreThreshold: 70 });
    });

    act(() => {
      result.current.checkAndNotify(
        { zoneScores: { s: { overall: 65, zone: { name: 'S' } } }, conditions: {}, seasonInfo: {} },
        { zoneScores: { s: { overall: 75, zone: { name: 'S' } } }, conditions: {}, seasonInfo: {} },
      );
    });

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.history.every((n) => n.read)).toBe(true);
  });
});
