// No fetch cache: private logs and auth responses must never be cached here.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = { title: 'Time to log your lifting', body: 'What did you actually do? Tap to record your sets and reps.', url: '/?log=strength' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'fitness-strength-check-in', data: { url: payload.url },
    renotify: false
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/?log=strength', self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const window = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (window) { await window.focus(); window.postMessage({ type: 'open-strength-log' }); }
    else await self.clients.openWindow(target.href);
  })());
});
