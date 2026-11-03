// Retire the legacy offline shell cache. CRM data and user preferences are untouched.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "CONVOSIS_CACHE_CLEARED" });
    }
  })());
});

// No fetch handler: every request uses the browser/network normally.
