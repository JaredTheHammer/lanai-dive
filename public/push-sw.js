/**
 * Push notification event handlers for the service worker.
 *
 * This file is loaded by the Workbox-generated sw.js via importScripts.
 * It handles incoming push events and notification click actions.
 */

/* eslint-env serviceworker */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Lanai Dive',
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: 'lanai-dive-conditions',
    renotify: true,
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'View Conditions' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Lanai Dive', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Validate URL is same-origin to prevent open redirect attacks
  const rawUrl = event.notification.data?.url || '/';
  let urlToOpen = '/';
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    urlToOpen = parsed.origin === self.location.origin ? parsed.href : '/';
  } catch {
    urlToOpen = '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(urlToOpen);
    }),
  );
});
