/* Сброс service worker Godot: снять COEP и кэш, затем удалиться. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    var windows = await self.clients.matchAll({ type: 'window' });
    await self.registration.unregister();
    await Promise.all(windows.map(function (client) { return client.navigate(client.url); }));
  })());
});
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
