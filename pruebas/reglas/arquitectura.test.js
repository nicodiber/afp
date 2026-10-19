// Reglas de ARQUITECTURA.md §2 y de CLAUDE.md, comprobadas leyendo el código de src/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
async function archivos(dir) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...await archivos(ruta));
    else if (e.name.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}
const existeSrc = await stat(SRC).then(() => true, () => false);
const codigo = existeSrc ? await Promise.all((await archivos(SRC)).map(async (r) => ({ ruta: relative(SRC, r), texto: await readFile(r, 'utf8') }))) : [];
const capa = (ruta) => ruta.split(/[\\/]/)[0];
const importa = (texto) => [...texto.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] || m[2]);
const opciones = { skip: existeSrc ? false : 'todavía no hay código en src/' };

test('el dominio no importa nada de fuera de src/dominio/', opciones, () => {
  for (const { ruta, texto } of codigo.filter((a) => capa(a.ruta) === 'dominio')) {
    for (const i of importa(texto)) assert.ok(i.startsWith('./') || i.startsWith('../') && !i.startsWith('../../'), `${ruta} importa ${i}`);
  }
});

test('solo los adaptadores usan el navegador (indexedDB, fetch, localStorage, google)', opciones, () => {
  for (const { ruta, texto } of codigo.filter((a) => !['adaptadores', 'arranque.js'].includes(capa(a.ruta)))) {
    assert.doesNotMatch(texto, /\b(indexedDB|fetch\(|localStorage|google\.accounts)/, ruta);
  }
});

test('solo el adaptador de reloj lee la fecha y hora del sistema', opciones, () => {
  for (const { ruta, texto } of codigo.filter((a) => !/reloj/i.test(a.ruta))) {
    assert.doesNotMatch(texto, /Date\.now\(\)|new Date\(\s*\)/, ruta);
  }
});

test('ningún texto entra al DOM como HTML', opciones, () => {
  for (const { ruta, texto } of codigo) assert.doesNotMatch(texto, /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML/, ruta);
});
