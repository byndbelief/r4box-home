// r4box.com's service worker: alerts only, it does not touch page loads.
// - The family chat registers it when someone turns on alerts there; chat alerts
//   carry an absolute r4box.com URL.
// - It also stands in for the games' old service worker on phones that turned on
//   turn alerts while the games lived at r4box.com: their alerts carry a URL
//   relative to the game room, opened on games.r4box.com.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// How each kind of alert buzzes (d.kind, set by the edge functions). Android only: iPhones ignore
// vibration, and Android may still use its own default buzz for a site's notifications.
const BUZZ = {
  turn: [120, 80, 120],                        // your turn: a double tap
  round: [120, 80, 120, 80, 260],              // the next Chaos round: a double tap and a long one
  chat: [180],                                 // a message: one buzz
  claude: [60, 50, 60, 50, 60],                // Claude answered you: a flutter
  call: [600, 300, 600, 300, 600, 300, 600],   // a call rings
  tutor: [300, 150, 300, 150, 300],            // the tutor flagged something
  pickup: [250, 120, 250],                     // a pickup: on the way, nearly there, here
};
const TITLE = 'r4box';

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const kind = d.kind || (d.ring ? 'call' : ''), silent = !!d.silent;
  e.waitUntil(self.registration.showNotification(d.title || TITLE, {
    body: d.body || '',
    tag: d.tag,
    // A quiet alert (a burst of chat messages, a game over) replaces the last one without a sound or buzz.
    renotify: !!d.tag && !silent,
    silent,
    // A call rings, and a missed one waits: they stay up until answered or dismissed. Answer and Decline
    // sit on the alert itself where the phone or computer shows buttons (Android, Chrome and Edge; an iPhone
    // has none: a tap answers).
    requireInteraction: kind === 'call' || kind === 'missed',
    actions: kind === 'call' ? [{ action: 'answer', title: '📹 Answer' }, { action: 'decline', title: 'Decline' }]
      : kind === 'missed' ? [{ action: 'callback', title: '📹 Call back' }] : [],
    vibrate: silent ? undefined : BUZZ[kind],   // a buzz with silent set throws
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'decline') return;
  const to = new URL(e.notification.data?.url || './', 'https://games.r4box.com/').href;
  // a game opens inside r4box.com (open.html), so the installed app keeps no address bar
  const url = /^https:\/\/[a-z0-9-]+\.r4box\.com\//.test(to) ? new URL('/open.html?to=' + encodeURIComponent(to), self.location.origin).href : to;
  e.waitUntil((async () => {
    // The page is open already (the chat in another tab): bring it forward.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((w) => w.url.split('#')[0] === url.split('#')[0]);
    if (same) return same.focus();
    // Answering a call, or calling back, with r4box open already: that window goes there (one in a call stays put).
    if (/\/call\.html\?answer|#callback=/.test(url)) {
      const busy = wins.find((w) => new URL(w.url).pathname === '/call.html');
      if (busy) return busy.focus();
      const w = wins.find((x) => new URL(x.url).origin === self.location.origin);
      if (w) try { await w.focus(); return await w.navigate(url); } catch {}
    }
    return self.clients.openWindow(url);
  })());
});
