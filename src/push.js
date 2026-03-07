/**
 * Client-side push subscription manager.
 *
 * Handles:
 *   1. Subscribing the service worker to Push API with VAPID key
 *   2. Sending the PushSubscription to the backend Lambda
 *   3. Unsubscribing and notifying the backend
 *
 * Environment variables (injected by Vite at build time):
 *   VITE_PUSH_SUBSCRIBE_URL  - Lambda Function URL for subscription management
 *   VITE_VAPID_PUBLIC_KEY    - VAPID public key (base64url)
 */

const PUSH_URL = import.meta.env.VITE_PUSH_SUBSCRIBE_URL || '';
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert a base64url VAPID key to a Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

/**
 * Subscribe the current service worker to web push and register with backend.
 * @param {object} prefs - Notification preferences to store server-side
 * @returns {PushSubscription|null}
 */
export async function subscribeToPush(prefs = {}) {
  if (!PUSH_URL || !VAPID_KEY) {
    console.warn('Push not configured: missing VITE_PUSH_SUBSCRIBE_URL or VITE_VAPID_PUBLIC_KEY');
    return null;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
    }

    // Register with backend
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        prefs: {
          enabled: true,
          scoreThreshold: prefs.scoreThreshold ?? 70,
          windLimitMph: prefs.windLimitMph ?? 20,
          swellLimitFt: prefs.swellLimitFt ?? 6,
          ...prefs,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }

    console.log('Push subscription registered');
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications and notify backend.
 */
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend
      if (PUSH_URL) {
        const res = await fetch(PUSH_URL, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        if (!res.ok) {
          console.error(`Backend unsubscribe returned ${res.status}`);
        }
      }

      console.log('Push subscription removed');
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

/**
 * Update notification preferences on the backend without re-subscribing.
 * @param {object} prefs - Updated preferences
 */
export async function updatePushPrefs(prefs) {
  if (!PUSH_URL || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const res = await fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          prefs,
        }),
      });
      if (!res.ok) {
        console.error(`Push prefs update returned ${res.status}`);
      }
    }
  } catch (err) {
    console.error('Push prefs update failed:', err);
  }
}
