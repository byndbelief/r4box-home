// r4box.com's service worker: alerts only, it does not touch page loads.
// - The family chat registers it when someone turns on alerts there; chat alerts
//   carry an absolute r4box.com URL.
// - It also stands in for the games' old service worker on phones that turned on
//   turn alerts while the games lived at r4box.com: their alerts carry a URL
//   relative to the game room, opened on games.r4box.com.
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
  const url = new URL(e.notification.data?.url || './', 'https://games.r4box.com/').href;
  e.waitUntil((async () => {
    // The page is open already (the chat in another tab): bring it forward.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((w) => w.url.split('#')[0] === url.split('#')[0]);
    if (same) return same.focus();
    return self.clients.openWindow(url);
  })());
});
