// aep#12 CA-17: monedas (RF-CUE-03, D-122). Casos escritos a mano a partir de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONEDAS_POR_DEFECTO, puedeDesactivar } from '../../src/dominio/monedas.js';

test('aep#12 CA-18 · ARS y USD activas desde el inicio', () => {
  assert.deepEqual(MONEDAS_POR_DEFECTO.map((m) => [m.id, m.simbolo, m.activa]), [['ARS', '$', true], ['USD', 'US$', true]]);
});

test('aep#12 CA-17 · ARS nunca se desactiva; USD no, si la usa una cuenta activa o archivada', () => {
  const dolares = { id: 'cue-5', nombre: 'Dólares billete', monedaId: 'USD', estado: 'activa' };
  assert.deepEqual(puedeDesactivar('ARS', []), { ok: false, motivo: 'ARS es la moneda base: no se puede desactivar.' });
  assert.deepEqual(puedeDesactivar('USD', [dolares]), { ok: false, motivo: 'No podés desactivar USD: la usa la cuenta Dólares billete.' });
  assert.equal(puedeDesactivar('USD', [{ ...dolares, estado: 'archivada' }]).ok, false);
  assert.deepEqual(puedeDesactivar('USD', [{ ...dolares, monedaId: 'ARS' }]), { ok: true });
});
