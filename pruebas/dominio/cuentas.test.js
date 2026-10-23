// aep#12: reglas de las cuentas (RF-CUE-01, D-120 a D-127). Casos y mensajes escritos a mano a partir de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCuenta, TIPOS_ELEGIBLES, puedeCambiarMoneda, puedeEliminar, necesitaConfirmarArchivo,
  puedeReactivar, ordenParaNueva, moverCuenta, activasEnOrden, archivadas,
} from '../../src/dominio/cuentas.js';

const HOY = '2026-10-31';
const cuenta = (id, nombre, orden, extra = {}) => ({ id, nombre, tipo: 'efectivo', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-09-01', tieneRendimiento: false, proposito: 'ninguno', emoji: '', notas: '', orden, estado: 'activa', ...extra });
const EJEMPLO = [
  cuenta('cue-1', 'Billetera', 1), cuenta('cue-2', 'Caja', 2), cuenta('cue-3', 'Banco', 3),
  cuenta('cue-4', 'Billetera virtual', 4), cuenta('cue-5', 'Dólares billete', 5, { monedaId: 'USD' }), cuenta('cue-6', 'Tarjeta transporte', 6),
  cuenta('cue-7', 'Banco USD', 7, { monedaId: 'USD', saldoInicial: 15000 }),
];
const contexto = { cuentas: EJEMPLO, hoy: HOY, monedasActivas: ['ARS', 'USD'] };
const formulario = (cambios = {}) => ({ nombre: 'Nueva', tipo: 'banco', monedaId: 'ARS', saldoInicial: '0', fechaSaldoInicial: HOY, tieneRendimiento: false, emoji: '', notas: '', proposito: 'ninguno', ...cambios });

test('aep#12 CA-5 · una cuenta válida se normaliza: nombre sin espacios alrededor y saldo en centavos', () => {
  const r = validarCuenta(formulario({ nombre: 'Banco USD 2', monedaId: 'USD', saldoInicial: '150', fechaSaldoInicial: '2026-10-01' }), contexto);
  assert.deepEqual(r.errores, {});
  assert.equal(r.datos.nombre, 'Banco USD 2');
  assert.equal(r.datos.saldoInicial, 15000);
  assert.equal(r.datos.fechaSaldoInicial, '2026-10-01');
});

test('aep#12 CA-6 · nombre repetido entre activas, sin distinguir mayúsculas ni espacios alrededor', () => {
  for (const nombre of ['banco usd', ' Banco USD ', 'BANCO USD']) {
    assert.equal(validarCuenta(formulario({ nombre }), contexto).errores.nombre, 'Ya existe una cuenta con ese nombre', nombre);
  }
  // Renombrar «Caja» como «BILLETERA».
  assert.equal(validarCuenta(formulario({ nombre: 'BILLETERA' }), { ...contexto, id: 'cue-2' }).errores.nombre, 'Ya existe una cuenta con ese nombre');
  // Editar una cuenta sin cambiarle el nombre no choca consigo misma.
  assert.equal(validarCuenta(formulario({ nombre: 'Caja' }), { ...contexto, id: 'cue-2' }).errores.nombre, undefined);
});

test('aep#12 CA-7 · el nombre tiene entre 1 y 40 caracteres', () => {
  const msg = 'El nombre tiene que tener entre 1 y 40 caracteres.';
  assert.equal(validarCuenta(formulario({ nombre: '' }), contexto).errores.nombre, msg);
  assert.equal(validarCuenta(formulario({ nombre: '   ' }), contexto).errores.nombre, msg);
  assert.equal(validarCuenta(formulario({ nombre: 'x'.repeat(41) }), contexto).errores.nombre, msg);
  assert.equal(validarCuenta(formulario({ nombre: 'x'.repeat(40) }), contexto).errores.nombre, undefined);
});

test('aep#12 CA-8 · saldo inicial con hasta 2 decimales, también negativo (D-123)', () => {
  const saldo = (texto) => validarCuenta(formulario({ saldoInicial: texto }), contexto);
  assert.equal(saldo('1.234,5').datos.saldoInicial, 123450);
  assert.equal(saldo('0').datos.saldoInicial, 0);
  assert.equal(saldo('-5000').datos.saldoInicial, -500000);
  for (const malo of ['12,345', 'abc', '']) assert.equal(saldo(malo).errores.saldoInicial, 'Escribí un monto con hasta 2 decimales.', malo);
});

test('aep#12 CA-9 · tipos que se eligen a mano: sin préstamos ni deudas; moneda activa', () => {
  assert.deepEqual(TIPOS_ELEGIBLES, ['efectivo', 'billetera_virtual', 'banco', 'broker', 'transporte', 'cripto']);
  assert.ok(validarCuenta(formulario({ tipo: 'deuda' }), contexto).errores.tipo);
  assert.ok(validarCuenta(formulario({ monedaId: 'USD' }), { ...contexto, monedasActivas: ['ARS'] }).errores.monedaId);
});

test('aep#12 CA-11 · la moneda se cambia solo si la cuenta no tiene movimientos (INV-06, D-121)', () => {
  const bancoUsd = EJEMPLO[6];
  assert.deepEqual(puedeCambiarMoneda(bancoUsd, []), { ok: true });
  const movimiento = { id: 'M-ficticio', cuentaId: 'cue-7', tipo: 'egreso', montoTotal: 100 };
  assert.deepEqual(puedeCambiarMoneda(bancoUsd, [movimiento]), { ok: false, motivo: 'No podés cambiar la moneda: la cuenta tiene movimientos.' });
  // También cuenta como movimiento si la cuenta es el destino.
  assert.equal(puedeCambiarMoneda(bancoUsd, [{ id: 'T', cuentaId: 'cue-1', cuentaDestinoId: 'cue-7' }]).ok, false);
});

test('aep#12 CA-12 · mover una cuenta reordena las activas', () => {
  const orden = moverCuenta(EJEMPLO.slice(0, 6), 'cue-5', 2).map((c) => c.nombre);
  assert.deepEqual(orden, ['Billetera', 'Caja', 'Dólares billete', 'Banco', 'Billetera virtual', 'Tarjeta transporte']);
  assert.deepEqual(moverCuenta(EJEMPLO.slice(0, 6), 'cue-5', 2).map((c) => c.orden), [1, 2, 3, 4, 5, 6]);
});

test('aep#12 CA-13 y CA-14 · archivar pide confirmación solo si el saldo no es 0', () => {
  assert.equal(necesitaConfirmarArchivo(15000), true);
  assert.equal(necesitaConfirmarArchivo(-100), true);
  assert.equal(necesitaConfirmarArchivo(0), false);
});

test('aep#12 CA-15 · el nombre es único solo entre activas', () => {
  const conArchivada = EJEMPLO.map((c) => (c.id === 'cue-7' ? { ...c, estado: 'archivada' } : c));
  assert.deepEqual(validarCuenta(formulario({ nombre: 'Banco USD' }), { ...contexto, cuentas: conArchivada }).errores, {});
  assert.deepEqual(archivadas(conArchivada).map((c) => c.id), ['cue-7']);
  assert.equal(activasEnOrden(conArchivada).length, 6);
});

test('aep#12 CA-16 · con movimientos no se elimina: se ofrece archivar (D-120)', () => {
  assert.deepEqual(puedeEliminar(EJEMPLO[6], []), { ok: true });
  assert.deepEqual(puedeEliminar(EJEMPLO[6], [{ id: 'M', cuentaId: 'cue-7' }]), { ok: false, motivo: 'No podés eliminarla porque tiene movimientos. Podés archivarla.' });
});

test('aep#12 CA-24 · la fecha del saldo inicial no puede ser posterior a hoy (D-124)', () => {
  assert.equal(validarCuenta(formulario({ fechaSaldoInicial: '2026-11-01' }), contexto).errores.fechaSaldoInicial, 'La fecha no puede ser posterior a hoy.');
  assert.equal(validarCuenta(formulario({ fechaSaldoInicial: HOY }), contexto).errores.fechaSaldoInicial, undefined);
  assert.ok(validarCuenta(formulario({ fechaSaldoInicial: '2026-02-30' }), contexto).errores.fechaSaldoInicial);
});

test('aep#12 CA-25 · emoji, notas y propósito (D-127); sin propósito, «ninguno»', () => {
  const r = validarCuenta(formulario({ nombre: 'Fondo', emoji: '🛟', notas: 'Para imprevistos', proposito: 'emergencia' }), contexto);
  assert.equal(r.datos.emoji, '🛟');
  assert.equal(r.datos.notas, 'Para imprevistos');
  assert.equal(r.datos.proposito, 'emergencia');
  assert.equal(validarCuenta(formulario({ nombre: 'Fondo', proposito: '' }), contexto).datos.proposito, 'ninguno');
  assert.ok(validarCuenta(formulario({ notas: 'x'.repeat(501) }), contexto).errores.notas);
});

test('aep#12 CA-26 · reactivar va al final, salvo que una activa tenga el mismo nombre (D-125)', () => {
  const archivada = { ...EJEMPLO[6], estado: 'archivada' };
  const sinChoque = [...EJEMPLO.slice(0, 6), archivada];
  assert.deepEqual(puedeReactivar(archivada, sinChoque), { ok: true });
  assert.equal(ordenParaNueva(sinChoque), 8);
  const conChoque = [...sinChoque, cuenta('cue-8', 'Banco USD', 8)];
  assert.deepEqual(puedeReactivar(archivada, conChoque), { ok: false, motivo: 'Ya existe una cuenta con ese nombre' });
});
