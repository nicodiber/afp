// aep#12 CA-22 (RNF-FLE-01): ningún nombre de cuenta de los datos de ejemplo está escrito en src/; las
// cuentas salen solo de la base del dispositivo o de datos-demo/. «Banco» es también el nombre de un tipo
// de cuenta (RF-CUE-01), así que se busca solo donde no es un tipo, y como texto entre comillas (no como
// parte de otro texto: «Billetera virtual» es un tipo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOMBRES_DE_TIPO } from '../../src/dominio/cuentas.js';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const datos = JSON.parse(await readFile(new URL('../../datos-demo/datos-ejemplo.json', import.meta.url), 'utf8'));

test('aep#12 CA-22 · ningún nombre de cuenta de ejemplo está en src/', async () => {
  const tipos = new Set(Object.values(NOMBRES_DE_TIPO));
  const nombres = datos.cuentas.map((c) => c.nombre).filter((n) => !tipos.has(n));
  assert.ok(nombres.length >= 4, 'se revisan los nombres propios de las cuentas');
  const archivos = (await readdir(SRC, { recursive: true })).filter((a) => a.endsWith('.js'));
  for (const archivo of archivos) {
    const texto = await readFile(join(SRC, archivo), 'utf8');
    for (const nombre of nombres) assert.ok(![`'${nombre}'`, `"${nombre}"`, `\`${nombre}\``].some((x) => texto.includes(x)), `${archivo} nombra «${nombre}»`);
  }
});
