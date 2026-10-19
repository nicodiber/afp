// Los datos de ejemplo de datos-demo/ coinciden con PLAN_DE_VERSIONES.md §5 (repo aep).
// Los saldos esperados están copiados de §5.6 («Calculados con un script independiente»),
// y esta suma es a propósito simple: solo comprueba que la transcripción de §5.3 no tenga errores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const datos = JSON.parse(await readFile(new URL('../datos-demo/datos-ejemplo.json', import.meta.url), 'utf8'));
const c = (pesos) => Math.round(pesos * 100);

function saldos(hasta) {
  const s = Object.fromEntries(datos.cuentas.map((x) => [x.id, x.saldoInicial]));
  for (const m of datos.movimientos) {
    if (m.fecha > hasta || m.estado !== 'confirmado') continue;
    const partes = (m.partes || []).reduce((a, p) => a + p.monto, 0);
    if (m.tipo === 'ingreso') s[m.cuenta] += partes;
    else if (m.tipo === 'egreso') s[m.cuenta] -= partes;
    else if (m.tipo === 'gasto_compartido') s[m.cuenta] -= m.total;
    else if (m.tipo === 'transferencia') { s[m.cuentaOrigen] -= m.monto; s[m.cuentaDestino] += m.monto; }
    else if (m.tipo === 'cambio_de_moneda') { s[m.cuentaOrigen] -= m.montoOrigen; s[m.cuentaDestino] += m.montoDestino; }
    else if (m.tipo === 'prestamo_otorgado') s[m.cuenta] -= m.monto;
    else if (m.tipo === 'cobro_de_prestamo') s[m.cuenta] += m.monto;
  }
  return s;
}

test('35 movimientos M01–M35, con ids únicos', () => {
  const ids = datos.movimientos.map((m) => m.id);
  assert.equal(new Set(ids).size, 35);
  assert.deepEqual(ids, Array.from({ length: 35 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`));
});

test('saldos al 30/09/2026 (PLAN §5.6)', () => {
  assert.deepEqual(saldos('2026-09-30'), {
    billetera: c(12_000), caja: c(200_000), banco: c(1_305_000),
    'billetera-virtual': c(390_000), dolares: c(500), 'tarjeta-transporte': c(15_000),
  });
});

test('saldos al 31/10/2026 (PLAN §5.6)', () => {
  assert.deepEqual(saldos('2026-10-31'), {
    billetera: c(48_500), caja: c(170_000), banco: c(1_693_000),
    'billetera-virtual': c(435_000), dolares: c(600), 'tarjeta-transporte': c(3_000),
  });
});

test('toda categoría usada existe y toda cuenta usada existe', () => {
  const hojas = new Set(datos.categorias.map((x) => x.hoja));
  const cuentas = new Set(datos.cuentas.map((x) => x.id));
  for (const m of datos.movimientos) {
    for (const p of m.partes || []) assert.ok(hojas.has(p.categoria), `${m.id}: ${p.categoria}`);
    for (const k of ['cuenta', 'cuentaOrigen', 'cuentaDestino']) if (m[k]) assert.ok(cuentas.has(m[k]), `${m.id}: ${m[k]}`);
  }
});
