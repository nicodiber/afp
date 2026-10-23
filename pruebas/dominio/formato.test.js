// aep#7: formatos (RNF-USA-05, manual §8.2). Casos escritos a mano a partir de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearMonto, formatearDecimal, formatearPorcentaje, formatearHora } from '../../src/dominio/formato.js';
import { formatearFecha, formatearFechaEnContexto } from '../../src/dominio/fecha.js';

const E = ' '; // espacio que no se corta
const MENOS = '−'; // signo menos tipográfico

test('aep#7 CA-1 · montos', () => {
  assert.equal(formatearMonto(123456789, 'ARS'), `$${E}1.234.567,89`);
  assert.equal(formatearMonto(60000, 'USD'), `US$${E}600,00`);
  assert.equal(formatearMonto(-900000, 'ARS'), `${MENOS}$${E}9.000,00`);
  assert.equal(formatearMonto(114000000, 'ARS', { conSigno: true }), `+$${E}1.140.000,00`);
  assert.equal(formatearMonto(0, 'ARS'), `$${E}0,00`);
  assert.equal(formatearMonto(5, 'ARS'), `$${E}0,05`);
});

test('aep#7 CA-2 · decimales en texto, con redondeo comercial (D-113)', () => {
  assert.equal(formatearDecimal('1234567.891'), '1.234.567,89');
  assert.equal(formatearDecimal('1234.565'), '1.234,57');
  assert.equal(formatearDecimal('1450'), '1.450,00');
  assert.equal(formatearDecimal('-0.005'), `${MENOS}0,01`);
  assert.equal(formatearDecimal('0.004'), '0,00');
  assert.equal(formatearDecimal('999.995'), '1.000,00');
});

test('aep#7 CA-3 · porcentajes', () => {
  assert.equal(formatearPorcentaje('7.07'), `7,07${E}%`);
  assert.equal(formatearPorcentaje('-0.07'), `${MENOS}0,07${E}%`);
});

test('aep#7 CA-4 · fechas', () => {
  assert.equal(formatearFecha('2026-10-31'), '31/10/2026');
  assert.equal(formatearFechaEnContexto('2026-10-31', '2026-10-31'), 'hoy, 31/10');
  assert.equal(formatearFechaEnContexto('2026-10-30', '2026-10-31'), '30/10/2026');
});

test('aep#7 CA-5 · horas de 24 h en UTC−3', () => {
  assert.equal(formatearHora('2026-10-31T21:42:00.000Z'), '18:42');
  assert.equal(formatearHora('2026-11-01T02:05:00.000Z'), '23:05');
  assert.equal(formatearHora('2026-10-31T03:00:00.000Z'), '00:00');
});

test('aep#12 CA-8 · leer un monto escrito: hasta 2 decimales, con signo menos (D-123)', async () => {
  const { leerMonto } = await import('../../src/dominio/formato.js');
  assert.equal(leerMonto('1.234,5'), 123450);
  assert.equal(leerMonto('1234,56'), 123456);
  assert.equal(leerMonto('0'), 0);
  assert.equal(leerMonto('150'), 15000);
  assert.equal(leerMonto('-5000'), -500000);
  assert.equal(leerMonto(' 250.000 '), 25000000);
  for (const malo of ['12,345', 'abc', '', '1,2,3', '1.23', '-', '12.34.5']) assert.equal(leerMonto(malo), null, malo);
});

test('aep#12 CA-10 · un monto guardado vuelve al campo para editarlo y se lee igual', async () => {
  const { montoParaEditar, leerMonto } = await import('../../src/dominio/formato.js');
  assert.equal(montoParaEditar(15000), '150,00');
  assert.equal(montoParaEditar(25000000), '250.000,00');
  assert.equal(montoParaEditar(-500000), '-5.000,00');
  assert.equal(montoParaEditar(5), '0,05');
  for (const c of [0, 5, 15000, -500000, 123456789]) assert.equal(leerMonto(montoParaEditar(c)), c);
});
