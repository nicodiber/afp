// HU-06 (transferir) y HU-07 (cambiar moneda): reglas del dominio. Valores esperados escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarTransferencia, validarCambio, crearTransferencia, crearCambio, tipoCambioDeOperacion, leerTipoCambio, montoRecibidoDesdeTipoCambio } from '../../src/dominio/traspasos.js';
import { saldo } from '../../src/dominio/saldos.js';
import { filaDeMovimiento, totalesPorMoneda } from '../../src/dominio/tablero.js';
import { filtrarMovimientos } from '../../src/dominio/lista-movimientos.js';

const HOY = '2026-10-31';
const cuenta = (id, nombre, monedaId, saldoInicial, extra = {}) => ({ id, nombre, monedaId, saldoInicial, fechaSaldoInicial: '2026-08-01', estado: 'activa', ...extra });
const CUENTAS = [
  cuenta('billetera', 'Billetera', 'ARS', 3750000), cuenta('caja', 'Caja', 'ARS', 6000000), cuenta('banco', 'Banco', 'ARS', 80000000),
  cuenta('dolares', 'Dólares billete', 'USD', 50000), cuenta('vieja', 'Vieja', 'ARS', 0, { estado: 'archivada' }),
];
const porId = (id) => CUENTAS.find((c) => c.id === id);
const contexto = { cuentas: CUENTAS, hoy: HOY };
const form = (c = {}) => ({ fecha: HOY, hora: '', monto: '10.000', descripcion: '', cuentaId: 'caja', cuentaDestinoId: 'billetera', ...c });

test('HU-06 CA-1 · transferir 10.000 de Caja a Billetera: quedan $ 47.500 y $ 50.000 y no cuenta como ingreso ni egreso', () => {
  const { errores, datos } = validarTransferencia(form(), contexto);
  assert.deepEqual(errores, {});
  const m = crearTransferencia(datos, { id: 'mov-1', origen: porId('caja'), destino: porId('billetera') });
  assert.deepEqual(m.asientos, [{ cuentaId: 'caja', monto: -1000000 }, { cuentaId: 'billetera', monto: 1000000 }]);
  assert.deepEqual([m.tipo, m.partes, m.montoTotal, m.monedaId], ['transferencia', [], 1000000, 'ARS']);
  assert.equal(saldo(porId('billetera'), HOY, [m]), 4750000);
  assert.equal(saldo(porId('caja'), HOY, [m]), 5000000);
  assert.deepEqual(totalesPorMoneda([m]), [], 'ni ingresos ni egresos');
});

test('HU-06 CA-2 · mismo origen y destino, monto 0 o negativo, cuentas sin elegir: no se guarda y se señala el campo', () => {
  assert.equal(validarTransferencia(form({ cuentaDestinoId: 'caja' }), contexto).errores.cuentaDestino, 'El origen y el destino tienen que ser cuentas distintas.');
  assert.equal(validarTransferencia(form({ monto: '0' }), contexto).errores.monto, 'Escribí un monto mayor que 0.');
  assert.equal(validarTransferencia(form({ monto: '-5' }), contexto).errores.monto, 'Escribí un monto mayor que 0.');
  assert.equal(validarTransferencia(form({ monto: '' }), contexto).errores.monto, 'Escribí un monto mayor que 0.');
  assert.equal(validarTransferencia(form({ cuentaId: null }), contexto).errores.cuenta, 'Elegí la cuenta de origen.');
  assert.equal(validarTransferencia(form({ cuentaDestinoId: 'vieja' }), contexto).errores.cuentaDestino, 'Elegí la cuenta de destino.', 'una cuenta archivada no sirve');
});

test('HU-06 CA-2 · cuentas de distinta moneda: no se guarda y se sugiere el cambio', () => {
  const r = validarTransferencia(form({ cuentaDestinoId: 'dolares' }), contexto);
  assert.equal(r.errores.cuentaDestino, 'Las cuentas son de distinta moneda: eso es un cambio. Andá a la pestaña «Cambio».');
  assert.equal(r.sugerirCambio, true);
  assert.equal(validarTransferencia(form(), contexto).sugerirCambio, false);
});

test('HU-06 · fecha futura inválida, hora mal escrita y una fecha anterior al saldo inicial (se adelanta la cuenta)', () => {
  assert.equal(validarTransferencia(form({ fecha: '2026-11-01' }), contexto).errores.fecha, 'La fecha no puede ser posterior a hoy.');
  assert.equal(validarTransferencia(form({ hora: '25:00' }), contexto).errores.hora, 'Escribí una hora válida (por ejemplo 18:30) o dejala vacía.');
  const r = validarTransferencia(form({ fecha: '2026-07-15' }), contexto);
  assert.deepEqual(r.errores, {});
  assert.deepEqual(r.datos.adelantan, ['caja', 'billetera']);
  assert.deepEqual(validarTransferencia(form(), contexto).datos.adelantan, []);
});

test('HU-06 CA-3 · la transferencia es una fila «⇄ Caja → Billetera» sin categoría, y se ve en las dos cuentas', () => {
  const m = crearTransferencia(validarTransferencia(form({ descripcion: 'retiro' }), contexto).datos, { id: 'mov-1', origen: porId('caja'), destino: porId('billetera') });
  const fila = filaDeMovimiento(m, { categoriasPorId: new Map(), cuentasPorId: new Map(CUENTAS.map((c) => [c.id, c])) });
  assert.deepEqual([fila.emoji, fila.titulo, fila.monto, fila.tipo], ['⇄', 'Caja → Billetera', 1000000, 'transferencia']);
  assert.equal(fila.detalle, '31/10/2026 · Retiro · Transferencia');
  const buscar = (filtros) => filtrarMovimientos([m], filtros, new Map()).length;
  assert.equal(buscar({ cuentaId: 'caja' }), 1);
  assert.equal(buscar({ cuentaId: 'billetera' }), 1);
  assert.equal(buscar({ cuentaId: 'banco' }), 0);
  assert.equal(buscar({ tipo: 'transferencia' }), 1);
  assert.equal(buscar({ tipo: 'egreso' }), 0);
  assert.equal(buscar({ tipo: 'cambio_moneda' }), 0);
});

const cambioDe = (c) => {
  const { errores, datos } = validarCambio({ fecha: HOY, hora: '', descripcion: '', cuentaId: 'banco', cuentaDestinoId: 'dolares', monto: '145.000', montoRecibido: '100', ...c }, contexto);
  assert.deepEqual(errores, {});
  return crearCambio(datos, { id: 'mov-2', origen: porId(datos.cuentaId), destino: porId(datos.cuentaDestinoId) });
};

test('HU-07 CA-1 · $ 145.000 por US$ 100: Banco baja, Dólares sube y el tipo de cambio es 1.450', () => {
  const m = cambioDe({});
  assert.deepEqual(m.asientos, [{ cuentaId: 'banco', monto: -14500000 }, { cuentaId: 'dolares', monto: 10000 }]);
  assert.deepEqual([m.tipo, m.montoTotal, m.montoRecibido, m.tipoCambioOperacion, m.monedaId], ['cambio_moneda', 14500000, 10000, '1450.0000', 'ARS']);
  assert.equal(saldo(porId('banco'), HOY, [m]), 80000000 - 14500000);
  assert.equal(saldo(porId('dolares'), HOY, [m]), 60000);
});

test('HU-07 CA-1 · vender US$ 50 por $ 70.000: el tipo de cambio es 1.400 (pesos por dólar)', () => {
  const m = cambioDe({ cuentaId: 'dolares', cuentaDestinoId: 'banco', monto: '50', montoRecibido: '70.000' });
  assert.deepEqual([m.montoTotal, m.montoRecibido, m.tipoCambioOperacion, m.monedaId], [5000, 7000000, '1400.0000', 'USD']);
  assert.deepEqual(m.asientos, [{ cuentaId: 'dolares', monto: -5000 }, { cuentaId: 'banco', monto: 7000000 }]);
});

test('HU-07 CA-1 · el tipo de cambio guarda 4 decimales con redondeo comercial', () => {
  assert.equal(tipoCambioDeOperacion(10000000, 8333, 'ARS', 'USD'), '1200.0480'); // 100000 / 83,33
  assert.equal(tipoCambioDeOperacion(100000, 300, 'ARS', 'USD'), '333.3333');
  assert.equal(tipoCambioDeOperacion(200000, 300, 'ARS', 'USD'), '666.6667');
  assert.equal(tipoCambioDeOperacion(1000, 100, 'USD', 'EUR'), '10.0000', 'sin pesos: entregado ÷ recibido');
  assert.equal(tipoCambioDeOperacion(0, 100, 'ARS', 'USD'), null);
});

test('HU-07 CA-2 · monto ≤ 0, cuenta sin elegir o dos cuentas de la misma moneda: no se guarda y se señala el campo', () => {
  const base = { fecha: HOY, hora: '', descripcion: '', cuentaId: 'banco', cuentaDestinoId: 'dolares', monto: '145.000', montoRecibido: '100' };
  assert.equal(validarCambio({ ...base, monto: '0' }, contexto).errores.monto, 'Escribí un monto mayor que 0.');
  assert.equal(validarCambio({ ...base, montoRecibido: '' }, contexto).errores.montoRecibido, 'Escribí el monto que recibís, mayor que 0.');
  assert.equal(validarCambio({ ...base, montoRecibido: '-1' }, contexto).errores.montoRecibido, 'Escribí el monto que recibís, mayor que 0.');
  assert.equal(validarCambio({ ...base, cuentaId: null }, contexto).errores.cuenta, 'Elegí la cuenta de origen.');
  assert.equal(validarCambio({ ...base, cuentaDestinoId: null }, contexto).errores.cuentaDestino, 'Elegí la cuenta de destino.');
  const misma = validarCambio({ ...base, cuentaDestinoId: 'caja' }, contexto);
  assert.equal(misma.errores.cuentaDestino, 'Las cuentas son de la misma moneda: eso es una transferencia. Andá a la pestaña «Transferencia».');
  assert.equal(misma.sugerirTransferencia, true);
});

test('HU-07 CA-3 · el monto que recibís sale del tipo de cambio escrito (y al revés), a centavos', () => {
  assert.equal(leerTipoCambio('1.450,55'), 145055);
  assert.equal(leerTipoCambio('0'), null);
  assert.equal(leerTipoCambio('abc'), null);
  assert.equal(montoRecibidoDesdeTipoCambio(14500000, 145000, 'ARS', 'USD'), 10000, '$ 145.000 a 1.450 = US$ 100');
  assert.equal(montoRecibidoDesdeTipoCambio(14500000, 145055, 'ARS', 'USD'), 9996, '145000 / 1450,55 = 99,962… → US$ 99,96');
  assert.equal(montoRecibidoDesdeTipoCambio(5000, 140000, 'USD', 'ARS'), 7000000, 'US$ 50 a 1.400 = $ 70.000');
  assert.equal(montoRecibidoDesdeTipoCambio(5001, 140050, 'USD', 'ARS'), 7003901, '50,01 × 1.400,50 = 70.039,005 → 70.039,01 (mitad hacia arriba)');
  assert.equal(montoRecibidoDesdeTipoCambio(0, 140000, 'USD', 'ARS'), null);
  assert.equal(montoRecibidoDesdeTipoCambio(5000, null, 'USD', 'ARS'), null);
});

test('HU-07 CA-4 · el cambio es una fila «💱 Banco → Dólares billete» con los dos montos y el tipo de cambio, y no es ingreso ni egreso', () => {
  const m = cambioDe({});
  const fila = filaDeMovimiento(m, { categoriasPorId: new Map(), cuentasPorId: new Map(CUENTAS.map((c) => [c.id, c])) });
  assert.deepEqual([fila.emoji, fila.titulo, fila.monto, fila.montoDestino, fila.monedaDestinoId, fila.tipoCambio], ['💱', 'Banco → Dólares billete', 14500000, 10000, 'USD', '1450.0000']);
  assert.equal(fila.detalle, '31/10/2026');
  assert.deepEqual(totalesPorMoneda([m]), []);
  assert.equal(filtrarMovimientos([m], { tipo: 'cambio_moneda' }, new Map()).length, 1);
  assert.equal(filtrarMovimientos([m], { tipo: 'transferencia' }, new Map()).length, 0);
  assert.equal(filtrarMovimientos([m], { cuentaId: 'dolares' }, new Map()).length, 1);
});

test('HU-07 · no se arma una transferencia entre monedas distintas ni un cambio con un monto en 0', () => {
  const { datos } = validarTransferencia(form(), contexto);
  assert.throws(() => crearTransferencia(datos, { id: 'x', origen: porId('caja'), destino: porId('dolares') }), /misma moneda/);
  assert.throws(() => crearCambio({ ...datos, montoRecibido: 0 }, { id: 'x', origen: porId('banco'), destino: porId('dolares') }), /mayores que 0/);
});

test('HU-06 · deshacer la creación de una cuenta que es el destino de una transferencia no se puede (queda un movimiento huérfano)', async () => {
  const { problemaAlAplicar } = await import('../../src/dominio/deshacer.js');
  const transferencia = { id: 'mov-1', tipo: 'transferencia', cuentaId: 'caja', cuentaDestinoId: 'nueva', partes: [] };
  const estado = { cuentas: [{ id: 'caja', nombre: 'Caja' }, { id: 'nueva', nombre: 'Nueva' }], categorias: [], movimientos: [transferencia] };
  assert.deepEqual(problemaAlAplicar([{ tipo: 'borrar', almacen: 'cuentas', id: 'nueva' }], estado), { motivo: 'Nueva ya tiene movimientos' });
  // Y rehacer una transferencia cuya cuenta de destino ya no existe tampoco.
  const sinDestino = { ...estado, cuentas: [{ id: 'caja', nombre: 'Caja' }], movimientos: [] };
  assert.ok(problemaAlAplicar([{ tipo: 'guardar', almacen: 'movimientos', registro: transferencia }], sinDestino));
});
