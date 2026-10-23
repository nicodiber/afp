// aep#13 CA-5 (D-134): mayúscula inicial en los nombres. Casos escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitalizarInicial } from '../../src/dominio/texto.js';

test('aep#13 CA-5 · solo la primera letra pasa a mayúscula; el resto queda como se escribió', () => {
  assert.equal(capitalizarInicial('banco nación'), 'Banco nación');
  assert.equal(capitalizarInicial('fondo de emergencia'), 'Fondo de emergencia');
  assert.equal(capitalizarInicial('BBVA'), 'BBVA');
  assert.equal(capitalizarInicial('ñandú'), 'Ñandú');
  assert.equal(capitalizarInicial('ébano'), 'Ébano');
  assert.equal(capitalizarInicial('  caja'), '  Caja', 'la primera letra, aunque haya espacios antes');
  assert.equal(capitalizarInicial('🛟 fondo'), '🛟 fondo', 'si no empieza con una letra, no cambia');
  assert.equal(capitalizarInicial('1 caja'), '1 caja');
  assert.equal(capitalizarInicial(''), '');
});
