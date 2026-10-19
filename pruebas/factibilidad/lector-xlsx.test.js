// F-04: el lector propio lee el .xlsx ficticio de v3 igual que openpyxl (valores esperados generados aparte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leerXlsx } from '../../factibilidad/xlsx/lector-xlsx.js';

const raiz = new URL('../../datos-demo/', import.meta.url);

test('lee la hoja «movimientos» del archivo ficticio de v3 celda por celda', async () => {
  const archivo = await readFile(new URL('v3-prueba.xlsx', raiz));
  const esperado = JSON.parse(await readFile(new URL('v3-prueba.esperado.json', raiz), 'utf8'));
  const { hojas } = await leerXlsx(archivo);
  const hoja = hojas.find((h) => h.nombre === esperado.hoja);
  assert.ok(hoja, 'falta la hoja');
  const recortar = (f) => { const c = [...f]; while (c.length && c.at(-1) === null) c.pop(); return c; };
  assert.equal(hoja.filas.length, esperado.filas.length);
  esperado.filas.forEach((fila, i) => assert.deepEqual(recortar(hoja.filas[i]), fila, `fila ${i + 1}`));
});

test('rechaza un archivo que no es .xlsx', async () => {
  await assert.rejects(leerXlsx(new TextEncoder().encode('hola').buffer), /no es un \.xlsx válido/);
});
