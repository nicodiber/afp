// Service worker de AFP (aep#2 CA-5; arquitectura §7; FC-01).
// Guarda la app para abrir sin conexión. Cada versión usa su propia caché y los archivos se piden
// sin la caché HTTP; la versión nueva espera a que el usuario toque «Actualizar».
const VERSION = 'v0.1.0-4';
const CANAL = new URL(self.registration.scope).pathname.includes('/prueba/') ? 'dev' : 'real';
const CACHE = `afp-${CANAL}-${VERSION}`;
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/app.css', 'fuentes/figtree.woff2',
  'iconos/icono.svg', 'iconos/icono-32.png', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png',
  'src/arranque.js', 'src/version.js',
  'src/dominio/tema.js', 'src/dominio/instalacion.js', 'src/dominio/fecha.js', 'src/puertos/reloj.js', 'src/adaptadores/reloj.js',
  'src/aplicacion/modo-prueba.js', 'src/ui/franja-prueba.js', 'src/puertos/preferencias.js', 'src/puertos/instalacion.js',
  'src/aplicacion/preferencias.js', 'src/aplicacion/instalacion.js', 'src/adaptadores/instalacion-navegador.js', 'src/ui/instalacion.js',
  'src/adaptadores/canal.js', 'src/adaptadores/preferencias-local.js', 'src/adaptadores/tema-temprano.js', 'src/adaptadores/actualizaciones.js',
  'src/ui/app.js', 'src/ui/dom.js', 'src/ui/pantallas/inicio.js', 'src/ui/pantallas/ajustes.js', 'src/ui/pantallas/proximamente.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS.map((archivo) => new Request(archivo, { cache: 'no-cache' })))));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((c) => c.startsWith(`afp-${CANAL}-`) && c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  const alcance = new URL(self.registration.scope);
  if (url.origin !== alcance.origin || !url.pathname.startsWith(alcance.pathname)) return;
  const esLaApp = pedido.mode === 'navigate' && (url.pathname === alcance.pathname || url.pathname === `${alcance.pathname}index.html`);
  const buscar = esLaApp ? caches.match(new URL('./', alcance).href) : caches.match(pedido, { ignoreSearch: true });
  evento.respondWith(buscar.then((guardado) => guardado || fetch(pedido)));
});
