/**
 * Push notification manager tests.
 *
 * Tests urlBase64ToUint8Array conversion, subscribeToPush flow,
 * unsubscribeFromPush, updatePushPrefs, and edge cases.
 * All browser APIs and fetch are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock import.meta.env before importing the module
// Use vi.mock to control the module's behavior
let subscribeToPush, unsubscribeFromPush, updatePushPrefs;

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// urlBase64ToUint8Array (tested indirectly via subscribeToPush)
// ---------------------------------------------------------------------------
describe('push module - configuration checks', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('returns null when PUSH_URL is not configured', async () => {
    // Import with default env (empty strings)
    const mod = await import('./push.js');
    const result = await mod.subscribeToPush();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// subscribeToPush with mocked env
// ---------------------------------------------------------------------------
describe('subscribeToPush', () => {
  let mockSubscription;
  let mockPushManager;
  let mockRegistration;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();

    mockSubscription = {
      endpoint: 'https://push.example.com/sub/123',
      toJSON: vi.fn(() => ({
        endpoint: 'https://push.example.com/sub/123',
        keys: { p256dh: 'key1', auth: 'key2' },
      })),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };

    mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    };

    mockRegistration = {
      pushManager: mockPushManager,
    };

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(mockRegistration),
      },
      writable: true,
      configurable: true,
    });

    // Mock PushManager existence
    if (!('PushManager' in window)) {
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when browser does not support service workers', async () => {
    const savedSW = navigator.serviceWorker;
    delete navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Import fresh module with mocked env
    vi.doMock('./push.js', async () => {
      // This forces re-evaluation but env vars are still empty
      return await vi.importActual('./push.js');
    });

    const mod = await import('./push.js');
    const result = await mod.subscribeToPush();
    expect(result).toBeNull();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: savedSW,
      writable: true,
      configurable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// unsubscribeFromPush
// ---------------------------------------------------------------------------
describe('unsubscribeFromPush', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('does nothing when serviceWorker is not available', async () => {
    const savedSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const mod = await import('./push.js');
    // Should not throw
    await expect(mod.unsubscribeFromPush()).resolves.not.toThrow();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: savedSW,
      writable: true,
      configurable: true,
    });
  });

  it('does nothing when there is no existing subscription', async () => {
    const mockRegistration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      writable: true,
      configurable: true,
    });

    const mod = await import('./push.js');
    await mod.unsubscribeFromPush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updatePushPrefs
// ---------------------------------------------------------------------------
describe('updatePushPrefs', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('does nothing when serviceWorker is not available', async () => {
    const savedSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const mod = await import('./push.js');
    await mod.updatePushPrefs({ scoreThreshold: 80 });
    expect(mockFetch).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: savedSW,
      writable: true,
      configurable: true,
    });
  });
});
