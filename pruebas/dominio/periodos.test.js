// P-043-a: fechas de cada período de Movimientos. Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoDePeriodo, textoDeRango } from '../../src/dominio/periodos.js';

test('P-043 · «Este mes» es el mes en curso completo', () => {
  const r = rangoDePeriodo('mes', '2026-10-31');
  assert.deepEqual(r, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.equal(textoDeRango('mes', r), '01/10/2026 al 31/10/2026');
  assert.deepEqual(rangoDePeriodo('mes', '2026-02-10'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rangoDePeriodo('mes', '2028-02-10'), { desde: '2028-02-01', hasta: '2028-02-29' });
});

test('P-043 · «Últimos 3 meses» son el mes en curso y los dos anteriores completos', () => {
  const r = rangoDePeriodo('ultimos-3-meses', '2026-10-31');
  assert.deepEqual(r, { desde: '2026-08-01', hasta: '2026-10-31' });
  assert.equal(textoDeRango('ultimos-3-meses', r), '01/08/2026 al 31/10/2026');
  assert.deepEqual(rangoDePeriodo('ultimos-3-meses', '2026-11-09'), { desde: '2026-09-01', hasta: '2026-11-30' }, 'con hoy a mitad de mes también');
  assert.deepEqual(rangoDePeriodo('ultimos-3-meses', '2027-01-15'), { desde: '2026-11-01', hasta: '2027-01-31' }, 'cruza el año');
});

test('P-043 · «Todo» va desde el primer movimiento', () => {
  const r = rangoDePeriodo('todo', '2026-10-31', '2026-08-03');
  assert.deepEqual(r, { desde: '2026-08-03', hasta: '2026-10-31' });
  assert.equal(textoDeRango('todo', r), 'desde el primer movimiento (03/08/2026)');
  assert.equal(textoDeRango('todo', rangoDePeriodo('todo', '2026-10-31')), 'todavía no hay movimientos');
  assert.throws(() => rangoDePeriodo('siempre', '2026-10-31'));
});
