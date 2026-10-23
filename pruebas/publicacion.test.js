// aep#10: la versión real y la versión a probar se publican sin archivos de prueba (CA-2),
// y el service worker no atiende lo que está bajo prueba/ (CA-3, modelo de datos §6.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url);
const NO_PUBLICAR = ['pruebas', 'package.json', 'package-lock.json', 'eslint.config.js', 'AGENTS.md', 'CLAUDE.md', '.claude', '.github', '.git'];

test('aep#10 CA-2 · «Publicar» saca los archivos de prueba de la raíz y de /prueba/', () => {
  const flujo = readFileSync(new URL('.github/workflows/publicar.yml', raiz), 'utf8');
  const paso = flujo.split('- name: Armar el sitio')[1].split('- name:')[0];
  const guion = paso.split('run: |')[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n')
    .replaceAll('${{ steps.real.outcome }}', 'success');
  const dir = mkdtempSync(join(tmpdir(), 'afp-publicar-'));
  try {
    for (const rama of ['real', 'prueba']) {
      mkdirSync(join(dir, rama, 'pruebas'), { recursive: true });
      mkdirSync(join(dir, rama, '.claude'), { recursive: true });
      mkdirSync(join(dir, rama, '.github'), { recursive: true });
      mkdirSync(join(dir, rama, '.git'), { recursive: true });
      for (const archivo of ['index.html', 'sw.js', 'package.json', 'package-lock.json', 'eslint.config.js', 'AGENTS.md', 'CLAUDE.md', 'pruebas/x.test.js']) {
        writeFileSync(join(dir, rama, archivo), 'x');
      }
    }
    execFileSync('bash', ['-e', '-c', guion], { cwd: dir });
    for (const lugar of ['sitio', 'sitio/prueba']) {
      assert.ok(existsSync(join(dir, lugar, 'index.html')), `${lugar}/index.html`);
      for (const archivo of NO_PUBLICAR) assert.equal(existsSync(join(dir, lugar, archivo)), false, `${lugar}/${archivo} no se publica`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Ejecuta sw.js con un «self» falso y devuelve su manejador de pedidos.
function manejadorDePedidos(alcance) {
  const manejadores = {};
  const self = { registration: { scope: alcance }, addEventListener: (tipo, f) => { manejadores[tipo] = f; }, clients: {}, skipWaiting() {} };
  vm.runInNewContext(readFileSync(new URL('sw.js', raiz), 'utf8'), { self, caches: { match: async () => null }, fetch: async () => null, Request: class {}, URL, console });
  return manejadores.fetch;
}
const atiende = (manejador, url, mode = 'no-cors') => {
  let atendido = false;
  manejador({ request: { method: 'GET', url, mode }, respondWith: () => { atendido = true; } });
  return atendido;
};

test('aep#10 CA-3 · el service worker de la versión real no atiende /prueba/', () => {
  const real = manejadorDePedidos('https://nicodiber.github.io/afp/');
  assert.equal(atiende(real, 'https://nicodiber.github.io/afp/prueba/', 'navigate'), false);
  assert.equal(atiende(real, 'https://nicodiber.github.io/afp/prueba/src/arranque.js'), false);
  assert.equal(atiende(real, 'https://nicodiber.github.io/afp/', 'navigate'), true);
  assert.equal(atiende(real, 'https://nicodiber.github.io/afp/css/app.css'), true);
  // El de la versión a probar sigue atendiendo lo suyo.
  const prueba = manejadorDePedidos('https://nicodiber.github.io/afp/prueba/');
  assert.equal(atiende(prueba, 'https://nicodiber.github.io/afp/prueba/', 'navigate'), true);
});
