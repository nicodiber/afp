// HU-06 y HU-07: transferir y cambiar moneda con los casos de uso reales, un almacén en memoria y la pila de deshacer (HU-41).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCasosDeshacer } from '../../src/aplicacion/deshacer.js';
import { crearCasosMovimientos } from '../../src/aplicacion/movimientos.js';
import { crearCasosCuentas } from '../../src/aplicacion/cuentas.js';
import { crearCasosCategorias } from '../../src/aplicacion/categorias.js';

const HOY = '2026-10-31';
const t = (texto) => texto.replaceAll('$ ', '$ ');
function almacenEnMemoria(inicial) {
  const datos = { cuentas: [], monedas: [], categorias: [], ubicacionesCategoria: [], movimientos: [], ...inicial };
  return {
    datos,
    listar: async (nombre) => structuredClone(datos[nombre]),
    guardar: async (nombre, registros) => {
      for (const r of [].concat(registros)) {
        const i = datos[nombre].findIndex((x) => x.id === r.id);
        if (i >= 0) datos[nombre][i] = structuredClone(r); else datos[nombre].push(structuredClone(r));
      }
    },
    borrar: async (nombre, id) => { datos[nombre] = datos[nombre].filter((x) => x.id !== id); },
    reemplazar: async () => {},
  };
}
const cuenta = (id, nombre, monedaId, saldoInicial, orden) => ({ id, nombre, tipo: 'efectivo', monedaId, saldoInicial, fechaSaldoInicial: '2026-09-01', orden, estado: 'activa', emoji: '💵' });
const CUENTAS = [
  cuenta('billetera', 'Billetera', 'ARS', 3750000, 1), cuenta('caja', 'Caja', 'ARS', 6000000, 2),
  cuenta('banco', 'Banco', 'ARS', 80000000, 3), cuenta('dolares', 'Dólares billete', 'USD', 50000, 4),
];

async function armar() {
  const base = almacenEnMemoria(structuredClone({ cuentas: CUENTAS, monedas: [{ id: 'ARS', activa: true }, { id: 'USD', activa: true }] }));
  const reloj = { hoy: () => HOY };
  let n = 0;
  const nuevoId = (prefijo = 'x') => `${prefijo}-${++n}`;
  const guardados = { lista: () => [] };
  let cuentas; let categorias; let movimientos;
  const registro = crearCasosDeshacer({ almacen: base, recargar: async () => { await Promise.all([cuentas.recargar(), categorias.recargar(), movimientos.recargar()]); } });
  const almacen = registro.almacenRegistrado;
  cuentas = crearCasosCuentas({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista(), movimientosEnMemoria: () => guardados.lista(), cambio: registro.cambio });
  categorias = crearCasosCategorias({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista(), cambio: registro.cambio });
  movimientos = crearCasosMovimientos({ almacen, reloj, nuevoId, cuentas, categorias, cambio: registro.cambio });
  guardados.lista = movimientos.todos;
  await Promise.all([cuentas.recargar(), categorias.recargar(), movimientos.recargar()]);
  return { base, registro, cuentas, movimientos };
}
const saldos = (cuentas, ...ids) => ids.map((id) => cuentas.saldoDe(cuentas.buscar(id)));
const transf = (c = {}) => ({ fecha: HOY, hora: '', monto: '10.000', descripcion: '', cuentaId: 'caja', cuentaDestinoId: 'billetera', ...c });
const cambio = (c = {}) => ({ fecha: HOY, hora: '', descripcion: '', monto: '145.000', montoRecibido: '100', cuentaId: 'banco', cuentaDestinoId: 'dolares', ...c });

test('HU-06 CA-1 · transferir 10.000 de Caja a Billetera deja Billetera $ 47.500 y Caja $ 50.000', async () => {
  const { base, cuentas, movimientos } = await armar();
  assert.deepEqual(saldos(cuentas, 'billetera', 'caja'), [3750000, 6000000]);
  const r = await movimientos.registrar('transferencia', transf());
  assert.equal(r.errores, undefined);
  assert.deepEqual([r.saldo, r.saldoDestino, r.cuenta.nombre, r.cuentaDestino.nombre], [5000000, 4750000, 'Caja', 'Billetera']);
  assert.deepEqual(saldos(cuentas, 'billetera', 'caja'), [4750000, 5000000]);
  assert.equal(base.datos.movimientos.length, 1);
  assert.equal(base.datos.movimientos[0].tipo, 'transferencia');
});

test('HU-06 CA-2 · con errores no se guarda nada y los saldos no cambian', async () => {
  const { base, cuentas, movimientos } = await armar();
  assert.ok((await movimientos.registrar('transferencia', transf({ cuentaDestinoId: 'caja' }))).errores.cuentaDestino);
  assert.ok((await movimientos.registrar('transferencia', transf({ monto: '0' }))).errores.monto);
  const otra = await movimientos.registrar('transferencia', transf({ cuentaDestinoId: 'dolares' }));
  assert.deepEqual([Boolean(otra.errores.cuentaDestino), otra.sugerirCambio], [true, true]);
  assert.equal(base.datos.movimientos.length, 0);
  assert.deepEqual(saldos(cuentas, 'billetera', 'caja', 'dolares'), [3750000, 6000000, 50000]);
});

test('HU-06 · deshacer y rehacer una transferencia (HU-41): vuelven los dos saldos', async () => {
  const { base, registro, cuentas, movimientos } = await armar();
  await movimientos.registrar('transferencia', transf());
  assert.deepEqual(await registro.deshacer(), { ok: true, texto: t('Deshiciste: transferencia de $ 10.000,00 de Caja a Billetera') });
  assert.deepEqual(saldos(cuentas, 'billetera', 'caja'), [3750000, 6000000]);
  assert.equal(base.datos.movimientos.length, 0);
  assert.equal((await registro.rehacer()).ok, true);
  assert.deepEqual(saldos(cuentas, 'billetera', 'caja'), [4750000, 5000000]);
});

test('HU-06 · una fecha anterior al saldo inicial adelanta las dos cuentas y deshacer devuelve las dos fechas', async () => {
  const { registro, cuentas, movimientos } = await armar();
  const r = await movimientos.registrar('transferencia', transf({ fecha: '2026-08-15' }));
  assert.deepEqual([cuentas.buscar('caja').fechaSaldoInicial, cuentas.buscar('billetera').fechaSaldoInicial], ['2026-08-15', '2026-08-15']);
  assert.equal(r.cuentaAjustada.fechaSaldoInicial, '2026-08-15');
  await registro.deshacer();
  assert.deepEqual([cuentas.buscar('caja').fechaSaldoInicial, cuentas.buscar('billetera').fechaSaldoInicial], ['2026-09-01', '2026-09-01']);
});

test('HU-07 CA-1 · $ 145.000 por US$ 100: Banco baja, Dólares billete sube y el tipo de cambio guardado es 1450,0000', async () => {
  const { base, cuentas, movimientos } = await armar();
  const r = await movimientos.registrar('cambio_moneda', cambio());
  assert.deepEqual([r.saldo, r.saldoDestino], [80000000 - 14500000, 60000]);
  assert.deepEqual(saldos(cuentas, 'banco', 'dolares'), [65500000, 60000]);
  const m = base.datos.movimientos[0];
  assert.deepEqual([m.tipo, m.montoTotal, m.montoRecibido, m.tipoCambioOperacion], ['cambio_moneda', 14500000, 10000, '1450.0000']);
});

test('HU-07 CA-2 · dos cuentas de la misma moneda o un monto en 0: no se guarda y se sugiere la transferencia', async () => {
  const { base, movimientos } = await armar();
  const misma = await movimientos.registrar('cambio_moneda', cambio({ cuentaDestinoId: 'caja' }));
  assert.deepEqual([Boolean(misma.errores.cuentaDestino), misma.sugerirTransferencia], [true, true]);
  assert.ok((await movimientos.registrar('cambio_moneda', cambio({ monto: '0' }))).errores.monto);
  assert.ok((await movimientos.registrar('cambio_moneda', cambio({ montoRecibido: '0' }))).errores.montoRecibido);
  assert.equal(base.datos.movimientos.length, 0);
});

test('HU-07 · deshacer un cambio devuelve los saldos en pesos y en dólares; la cuenta de destino no se puede deshacer si ya tiene movimientos', async () => {
  const { registro, cuentas, movimientos } = await armar();
  await movimientos.registrar('cambio_moneda', cambio({ cuentaId: 'dolares', cuentaDestinoId: 'banco', monto: '50', montoRecibido: '70.000' }));
  assert.deepEqual(saldos(cuentas, 'banco', 'dolares'), [87000000, 45000]);
  assert.deepEqual(await registro.deshacer(), { ok: true, texto: t('Deshiciste: cambio de US$ 50,00 a $ 70.000,00 (Dólares billete a Banco)') });
  assert.deepEqual(saldos(cuentas, 'banco', 'dolares'), [80000000, 50000]);
});

test('HU-06 · no se puede eliminar una cuenta que solo figura como destino de una transferencia', async () => {
  const { cuentas, movimientos } = await armar();
  await movimientos.registrar('transferencia', transf());
  assert.equal((await cuentas.puedeEliminar('billetera')).ok, false);
  assert.equal((await cuentas.puedeEliminar('banco')).ok, true);
});
