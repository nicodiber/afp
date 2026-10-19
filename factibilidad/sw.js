// Service worker de la página de pruebas: guarda la página para abrirla sin conexión.
const CACHE = 'afp-factibilidad-v4';
const ARCHIVOS = ['./', 'index.html', 'app.js', 'manifest.webmanifest', '../css/tokens.css',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k.startsWith('afp-factibilidad') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Solo responde los archivos propios; los pedidos a las fuentes de cotizaciones van siempre a la red.
self.addEventListener('fetch', (e) => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
