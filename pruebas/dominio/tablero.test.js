// HU-37: el tablero de Inicio (mes en curso, saldos de hoy y últimos movimientos). Valores esperados calculados a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesEnCurso, resumenDelMes, saldosDeHoy, ultimosMovimientos } from '../../src/dominio/tablero.js';

const mov = (id, tipo, fecha, hora, monto, monedaId = 'ARS') => ({ id, tipo, fecha, hora, monedaId, montoTotal: monto, partes: [] });

test('HU-37 CA-1 · el título del mes lleva su nombre y sus fechas (también febrero bisiesto y diciembre)', () => {
  assert.equal(mesEnCurso('2026-10-31').titulo, 'Octubre 2026 · 01/10/2026 al 31/10/2026');
  assert.equal(mesEnCurso('2028-02-10').titulo, 'Febrero 2028 · 01/02/2028 al 29/02/2028');
  assert.equal(mesEnCurso('2026-12-01').titulo, 'Diciembre 2026 · 01/12/2026 al 31/12/2026');
  assert.deepEqual([mesEnCurso('2026-10-31').desde, mesEnCurso('2026-10-31').hasta], ['2026-10-01', '2026-10-31']);
});

test('HU-37 CA-1 · el resumen del mes suma solo ingresos y egresos en pesos del mes (no transferencias, otras monedas ni otros meses)', () => {
  const movimientos = [
    mov('a', 'ingreso', '2026-10-01', '09:00', 100000),
    mov('b', 'ingreso', '2026-10-31', null, 25050),
    mov('c', 'egreso', '2026-10-15', '10:00', 40000),
    mov('d', 'egreso', '2026-10-31', '23:59', 1050),
    mov('e', 'transferencia', '2026-10-20', '10:00', 999999),
    mov('f', 'ingreso', '2026-10-20', '10:00', 7777, 'USD'),
    mov('g', 'egreso', '2026-09-30', '10:00', 5555),
    mov('h', 'ingreso', '2026-11-01', '10:00', 8888),
  ];
  const r = resumenDelMes(movimientos, '2026-10-31');
  assert.deepEqual([r.ingresos, r.egresos, r.diferencia], [125050, 41050, 84000]);
  assert.deepEqual(resumenDelMes([], '2026-10-31').diferencia, 0);
});

test('HU-37 CA-1 · saldos de hoy: pesos siempre; dólares solo si hay cuentas en dólares; las archivadas no cuentan', () => {
  const saldos = { a: 1000, b: 2500, c: -300, d: 50000, e: 99 };
  const cuentas = [
    { id: 'a', estado: 'activa', monedaId: 'ARS' }, { id: 'b', estado: 'activa', monedaId: 'ARS' }, { id: 'c', estado: 'activa', monedaId: 'ARS' },
    { id: 'd', estado: 'activa', monedaId: 'USD' }, { id: 'e', estado: 'archivada', monedaId: 'ARS' },
  ];
  assert.deepEqual(saldosDeHoy(cuentas, (c) => saldos[c.id]), [
    { monedaId: 'ARS', rotulo: 'Total en pesos', total: 3200 }, { monedaId: 'USD', rotulo: 'Total en dólares', total: 50000 },
  ]);
  assert.deepEqual(saldosDeHoy(cuentas.slice(0, 3), (c) => saldos[c.id]), [{ monedaId: 'ARS', rotulo: 'Total en pesos', total: 3200 }], 'sin cuentas en dólares, no hay total en dólares');
});

test('HU-37 CA-2 · los últimos movimientos: los 5 más nuevos por fecha y hora', () => {
  const lista = [
    mov('m1', 'egreso', '2026-10-30', '10:00', 1), mov('m2', 'egreso', '2026-10-31', '09:00', 1), mov('m3', 'ingreso', '2026-10-31', '18:00', 1),
    mov('m4', 'egreso', '2026-10-29', '23:00', 1), mov('m5', 'egreso', '2026-10-30', '11:00', 1), mov('m6', 'egreso', '2026-10-01', '08:00', 1), mov('m7', 'egreso', '2026-10-28', '08:00', 1),
  ];
  assert.deepEqual(ultimosMovimientos(lista).map((m) => m.id), ['m3', 'm2', 'm5', 'm1', 'm4']);
  assert.deepEqual(ultimosMovimientos(lista, 2).map((m) => m.id), ['m3', 'm2']);
  assert.deepEqual(ultimosMovimientos([]), []);
});
