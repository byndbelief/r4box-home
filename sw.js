// The push bridge. Phones that turned on turn alerts while the games lived at r4box.com have a
// service worker and a push subscription on this origin, and the notify function still sends to
// them. The browser picks up this file in place of the games' old one: it keeps showing those
// alerts and opens them on games.r4box.com. It does not touch page loads. Retire it once everyone
// has turned alerts back on at games.r4box.com.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'r4box', {
    body: d.body || '',
    tag: d.tag,
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(new URL(e.notification.data?.url || './', 'https://games.r4box.com/').href));
});
