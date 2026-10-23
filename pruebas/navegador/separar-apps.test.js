// aep#11: la raíz quita el service worker viejo y lleva a la versión real en /app/ (CA-4), y la versión
// real usa las mismas claves de siempre (CA-5).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, CELULAR, colorDeFondo } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

// Lo que publicó la v0.1.0 en la raíz: la app, que registra su service worker con alcance «/». Este
// guarda la página y después la sirve desde su caché, sin pedirla a la red.
const SW_VIEJO = `const CACHE = 'afp-real-v0.1.0';
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.add('/'))));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate' && new URL(e.request.url).pathname === '/') e.respondWith(caches.match('/').then((r) => r || fetch(e.request)));
});`;
const APP_VIEJA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AFP vieja</title></head>
<body><main><h1>AFP vieja</h1></main><script>navigator.serviceWorker.register('/sw.js', { scope: '/' });</script></body></html>`;

async function instalarVersionVieja(pagina) {
  entorno.servidor.sustituir('/sw.js', () => SW_VIEJO);
  entorno.servidor.sustituir('/', () => APP_VIEJA);
  await pagina.goto(entorno.servidor.urlRaiz);
  await pagina.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Ya publicada la v0.1.1: en la raíz están la página que lleva a app/ y el service worker que se da de baja.
  entorno.servidor.restaurar();
}
const alcances = (pagina) => pagina.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname));

test('aep#11 CA-4 · con el service worker viejo en la raíz, abrir la raíz lo quita y lleva a /app/', async () => {
  const contexto = await entorno.navegador.newContext({ viewport: CELULAR });
  try {
    const pagina = await contexto.newPage();
    await instalarVersionVieja(pagina);
    assert.deepEqual(await alcances(pagina), ['/'], 'service worker viejo registrado');
    await pagina.goto(entorno.servidor.urlRaiz);
    await pagina.waitForURL(entorno.servidor.urlReal, { timeout: 15000 });
    await pagina.waitForSelector('main h1');
    assert.equal((await alcances(pagina)).includes('/'), false, 'sin el service worker de la raíz');
    assert.equal(await pagina.evaluate(() => document.title.includes('vieja')), false);
  } finally {
    entorno.servidor.restaurar();
    await contexto.close();
  }
});

test('aep#11 CA-4 · una ventana abierta con la versión vieja pasa sola a /app/ al buscar actualizaciones', async () => {
  const contexto = await entorno.navegador.newContext({ viewport: CELULAR });
  try {
    const pagina = await contexto.newPage();
    await instalarVersionVieja(pagina);
    await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).update());
    await pagina.waitForURL(entorno.servidor.urlReal, { timeout: 15000 });
    await pagina.waitForSelector('main h1');
    assert.equal((await alcances(pagina)).includes('/'), false, 'sin el service worker de la raíz');
  } finally {
    entorno.servidor.restaurar();
    await contexto.close();
  }
});

test('aep#11 CA-4 · la raíz lleva a /app/ aunque no haya service worker', async () => {
  const contexto = await entorno.navegador.newContext({ viewport: CELULAR, serviceWorkers: 'block' });
  try {
    const pagina = await contexto.newPage();
    await pagina.goto(entorno.servidor.urlRaiz);
    await pagina.waitForURL(entorno.servidor.urlReal);
    await pagina.waitForSelector('main h1');
  } finally {
    await contexto.close();
  }
});

test('aep#11 CA-5 · la versión real en /app/ usa el tema guardado antes con la clave afp-tema', async () => {
  const contexto = await entorno.navegador.newContext({ viewport: CELULAR, colorScheme: 'light' });
  try {
    const pagina = await contexto.newPage();
    // Lo que guardó la v0.1.0 en la raíz: mismo origen, misma clave.
    await pagina.goto(entorno.servidor.urlRaiz + 'desregistrar.js');
    await pagina.evaluate(() => localStorage.setItem('afp-tema', 'oscuro'));
    await pagina.goto(entorno.servidor.urlReal);
    await pagina.waitForSelector('main h1');
    assert.equal(await colorDeFondo(pagina), 'rgb(14, 26, 20)', 'fondo oscuro del manual (#0E1A14)');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('afp-dev-tema')), null);
  } finally {
    await contexto.close();
  }
});
