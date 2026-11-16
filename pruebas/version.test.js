// aep#2 CA-7 y FC-01: la versión que muestra «Acerca de» es la misma que nombra la caché del service worker,
// y el service worker guarda todos los archivos que necesita la app para abrir sin conexión (CA-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const sw = await readFile(join(RAIZ, 'sw.js'), 'utf8');

test('HU-06 y HU-07 · versión de esta entrega: v0.3.0-14', () => {
  assert.equal(VERSION, 'v0.3.0-14');
});

test('FC-01 · el service worker usa la misma versión en el nombre de su caché', () => {
  assert.equal(sw.match(/const VERSION = '([^']+)'/)?.[1], VERSION);
});

test('aep#2 CA-5 · el service worker guarda cada archivo de la app', async () => {
  const listar = async (dir) => (await readdir(join(RAIZ, dir), { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile()).map((e) => relative(RAIZ, join(e.parentPath, e.name)).replaceAll('\\', '/'));
  const necesarios = [
    'index.html', 'manifest.webmanifest',
    ...await listar('src'), ...await listar('css'),
    'fuentes/figtree.woff2', 'iconos/icono.svg', 'iconos/icono-32.png', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png',
    'manifest-prueba.webmanifest', ...await listar('iconos/prueba'),
    'datos-demo/datos-ejemplo.json',
  ];
  const lista = sw.match(/const ARCHIVOS = \[([\s\S]*?)\];/)[1];
  for (const archivo of necesarios) assert.ok(lista.includes(`'${archivo}'`), `falta ${archivo} en sw.js`);
});

test('aep#12 · index.html precarga todos los módulos que usa la app (y solo esos)', async () => {
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');
  const precargados = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort();
  const alcanzables = new Set();
  const visitar = async (ruta) => {
    if (alcanzables.has(ruta)) return;
    alcanzables.add(ruta);
    const texto = await readFile(join(RAIZ, ruta), 'utf8');
    for (const [, rel] of texto.matchAll(/from\s+'(\.[^']+)'/g)) await visitar(join(ruta, '..', rel).replaceAll('\\', '/'));
  };
  await visitar('src/arranque.js');
  alcanzables.delete('src/arranque.js');
  assert.deepEqual(precargados, [...alcanzables].sort());
});

test('HU-41 · index.html precarga los módulos del más grande al más chico (LCP, FC-19)', async () => {
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');
  const precargados = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  const tamanios = [];
  for (const ruta of precargados) tamanios.push((await readFile(join(RAIZ, ruta))).length);
  const ordenados = [...tamanios].sort((a, b) => b - a);
  assert.deepEqual(tamanios, ordenados, 'la precarga tiene que ir de mayor a menor tamaño');
});
