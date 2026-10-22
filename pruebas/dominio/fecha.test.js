// aep#6 CA-3 y CA-5: fechas válidas y formato DD/MM/AAAA. Casos escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esFechaValida, formatearFecha, FECHA_SIMULADA_POR_DEFECTO } from '../../src/dominio/fecha.js';

test('aep#6 · fecha simulada por defecto', () => {
  assert.equal(FECHA_SIMULADA_POR_DEFECTO, '2026-10-31');
});

test('aep#6 CA-3 · fechas válidas', () => {
  for (const f of ['2026-10-31', '2026-11-15', '2024-02-29', '2026-01-01']) assert.equal(esFechaValida(f), true, f);
  for (const f of ['2026-02-29', '2026-13-01', '2026-11-31', '31/10/2026', '', null, '2026-1-5']) assert.equal(esFechaValida(f), false, String(f));
});

test('aep#6 CA-3 · formato DD/MM/AAAA', () => {
  assert.equal(formatearFecha('2026-11-15'), '15/11/2026');
  assert.equal(formatearFecha('2026-01-05'), '05/01/2026');
});
