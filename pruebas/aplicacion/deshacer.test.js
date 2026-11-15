// HU-41: deshacer y rehacer con los casos de uso reales y un almacén en memoria. Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCasosDeshacer } from '../../src/aplicacion/deshacer.js';
import { crearCasosMovimientos } from '../../src/aplicacion/movimientos.js';
import { crearCasosCuentas } from '../../src/aplicacion/cuentas.js';
import { crearCasosCategorias } from '../../src/aplicacion/categorias.js';
import { crearCasosDatosEjemplo } from '../../src/aplicacion/datos-ejemplo.js';

const HOY = '2026-10-31';
// El formato de montos usa un espacio que no se corta entre el símbolo y el número.
const t = (texto) => texto.replaceAll('$ ', '$\u00a0');
function almacenEnMemoria(inicial = {}) {
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
    reemplazar: async (nuevos) => { for (const [nombre, lista] of Object.entries(nuevos)) datos[nombre] = structuredClone(lista); },
  };
}
const CUENTA = { id: 'cue-mp', nombre: 'Mercado Pago', tipo: 'billetera', monedaId: 'ARS', saldoInicial: 80000000, fechaSaldoInicial: '2026-09-01', orden: 1, estado: 'activa', emoji: '📱' };
const OTRA = { id: 'cue-banco', nombre: 'Banco', tipo: 'banco', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-09-01', orden: 2, estado: 'activa', emoji: '🏦' };
const CLASIF = { fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false, naturaleza: null };
const CATEGORIAS = [
  { id: 'cat-vivienda', nombre: 'Vivienda', tipo: 'egreso', padreId: null, orden: 1, estado: 'activa', emoji: '🏠', ...CLASIF },
  { id: 'cat-alquiler', nombre: 'Alquiler', tipo: 'egreso', padreId: 'cat-vivienda', orden: 2, estado: 'activa', emoji: '🔑', ...CLASIF },
  { id: 'cat-expensas', nombre: 'Expensas', tipo: 'egreso', padreId: 'cat-vivienda', orden: 3, estado: 'activa', emoji: '🏢', ...CLASIF },
];
const MONEDAS = [{ id: 'ARS', activa: true }, { id: 'USD', activa: true }];

async function armar() {
  const base = almacenEnMemoria(structuredClone({ cuentas: [CUENTA, OTRA], categorias: CATEGORIAS, monedas: MONEDAS }));
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
  return { base, almacen, registro, cuentas, categorias, movimientos };
}
const egreso = (monto, cuentaId = 'cue-mp', fecha = HOY) => ({ fecha, monto, descripcion: '', categoriaId: 'cat-alquiler', cuentaId });
const formCuenta = (c) => ({ nombre: c.nombre, tipo: c.tipo, monedaId: c.monedaId, saldoInicial: '0', fechaSaldoInicial: c.fechaSaldoInicial, emoji: c.emoji });

test('HU-41 CA-1 · deshacer un egreso lo saca, el saldo vuelve y el aviso dice qué se deshizo', async () => {
  const { base, registro, cuentas, movimientos } = await armar();
  const guardado = await movimientos.registrarEgreso(egreso('12500'));
  assert.equal(guardado.saldo, 78750000);
  const resultado = await registro.deshacer();
  assert.deepEqual(resultado, { ok: true, texto: t('Deshiciste: egreso de $ 12.500,00 en Mercado Pago') });
  assert.equal(base.datos.movimientos.length, 0);
  assert.equal(movimientos.hay(), false);
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-mp')), 80000000, 'el saldo vuelve a como estaba');
});

test('HU-41 CA-1 · rehacer vuelve a guardar el mismo movimiento', async () => {
  const { base, registro, cuentas, movimientos } = await armar();
  await movimientos.registrarEgreso(egreso('12500'));
  const antes = structuredClone(base.datos.movimientos[0]);
  await registro.deshacer();
  assert.deepEqual(await registro.rehacer(), { ok: true, texto: t('Rehiciste: egreso de $ 12.500,00 en Mercado Pago') });
  assert.deepEqual(base.datos.movimientos, [antes]);
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-mp')), 78750000);
  assert.equal(movimientos.todos().length, 1);
});

test('HU-41 CA-1 · un ingreso se deshace y se rehace igual: el saldo baja y vuelve a subir', async () => {
  const { base, registro, cuentas, categorias, movimientos } = await armar();
  base.datos.categorias.push({ id: 'cat-sueldo', nombre: 'Sueldo', tipo: 'ingreso', padreId: null, orden: 9, estado: 'activa', emoji: '💼', naturaleza: 'ganado' });
  await categorias.recargar();
  await movimientos.registrarIngreso({ fecha: HOY, monto: '5000', descripcion: '', categoriaId: 'cat-sueldo', cuentaId: 'cue-banco' });
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 500000);
  assert.equal((await registro.deshacer()).texto, t('Deshiciste: ingreso de $ 5.000,00 en Banco'));
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 0);
  assert.equal(base.datos.movimientos.length, 0);
  await registro.rehacer();
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 500000);
});

test('HU-41 CA-1 · un movimiento con fecha anterior al saldo inicial: deshacerlo devuelve también la fecha de la cuenta (D-161)', async () => {
  const { base, registro, cuentas, movimientos } = await armar();
  const r = await movimientos.registrarEgreso(egreso('100', 'cue-mp', '2026-08-15'));
  assert.equal(r.cuentaAjustada.fechaSaldoInicial, '2026-08-15');
  assert.equal(cuentas.buscar('cue-mp').fechaSaldoInicial, '2026-08-15');
  assert.equal(registro.puedeDeshacer(), true);
  await registro.deshacer();
  assert.equal(cuentas.buscar('cue-mp').fechaSaldoInicial, '2026-09-01');
  assert.equal(base.datos.cuentas.find((c) => c.id === 'cue-mp').fechaSaldoInicial, '2026-09-01');
  assert.equal(registro.puedeDeshacer(), false, 'fue un solo cambio');
});

test('HU-41 CA-1 · cuentas: crear, editar, archivar, reactivar, eliminar y ordenar se deshacen y se rehacen', async () => {
  const { base, registro, cuentas } = await armar();
  const nombres = () => base.datos.cuentas.map((c) => `${c.nombre}:${c.estado}:${c.orden}`);
  const inicial = nombres();

  const nueva = await cuentas.crear({ nombre: 'ahorros', tipo: 'banco', monedaId: 'ARS', saldoInicial: '0', fechaSaldoInicial: '2026-09-01', emoji: '💰' });
  assert.equal(base.datos.cuentas.length, 3);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: creación de la cuenta Ahorros');
  assert.deepEqual(nombres(), inicial);
  assert.equal((await registro.rehacer()).texto, 'Rehiciste: creación de la cuenta Ahorros');
  assert.equal(base.datos.cuentas.find((c) => c.id === nueva.cuenta.id).nombre, 'Ahorros');
  await registro.deshacer();

  await cuentas.editar('cue-banco', { ...formCuenta(OTRA), nombre: 'Banco Nación' });
  assert.equal(cuentas.buscar('cue-banco').nombre, 'Banco Nación');
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: cambios en la cuenta Banco Nación');
  assert.equal(cuentas.buscar('cue-banco').nombre, 'Banco');

  await cuentas.archivar('cue-banco');
  assert.equal(cuentas.buscar('cue-banco').estado, 'archivada');
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: archivo de la cuenta Banco');
  assert.equal(cuentas.buscar('cue-banco').estado, 'activa');

  await cuentas.archivar('cue-banco');
  await cuentas.reactivar('cue-banco');
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: reactivación de la cuenta Banco');
  assert.equal(cuentas.buscar('cue-banco').estado, 'archivada');
  await registro.deshacer();
  assert.deepEqual(nombres(), inicial);

  await cuentas.mover('cue-banco', 0);
  assert.deepEqual(cuentas.activas().map((c) => c.id), ['cue-banco', 'cue-mp']);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: cambio de orden de la cuenta Banco');
  assert.deepEqual(cuentas.activas().map((c) => c.id), ['cue-mp', 'cue-banco']);

  await cuentas.eliminar('cue-banco');
  assert.equal(cuentas.buscar('cue-banco'), undefined);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: eliminación de la cuenta Banco');
  assert.deepEqual(nombres(), inicial);
  assert.deepEqual(base.datos.cuentas.find((c) => c.id === 'cue-banco'), OTRA, 'vuelve idéntica');
});

test('HU-41 CA-1 · categorías: crear, editar, archivar, ordenar y eliminar se deshacen', async () => {
  const { base, registro, categorias } = await armar();
  const estado = () => structuredClone(base.datos.categorias);
  const inicial = estado();
  const form = { nombre: 'Luz', emoji: '💡', fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false };

  const r = await categorias.crear(form, { padreId: 'cat-vivienda', tipo: 'egreso' });
  assert.equal(base.datos.categorias.length, 4);
  assert.equal(base.datos.ubicacionesCategoria.length, 1);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: creación de la categoría Luz');
  assert.deepEqual(estado(), inicial);
  assert.deepEqual(base.datos.ubicacionesCategoria, [], 'también se va su ubicación');
  await registro.rehacer();
  assert.equal(base.datos.categorias.find((c) => c.id === r.categoria.id).nombre, 'Luz');
  assert.equal(base.datos.ubicacionesCategoria.length, 1);
  await registro.deshacer();

  await categorias.editar('cat-alquiler', { ...form, nombre: 'Renta', emoji: '🔑' });
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: cambios en la categoría Renta');
  assert.deepEqual(estado(), inicial);

  await categorias.archivar('cat-vivienda');
  assert.deepEqual(base.datos.categorias.map((c) => c.estado), ['archivada', 'archivada', 'archivada']);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: archivo de la categoría Vivienda');
  assert.deepEqual(estado(), inicial);

  await categorias.ordenar('cat-expensas', 0);
  assert.deepEqual(categorias.hijas('cat-vivienda', 'egreso').map((c) => c.id), ['cat-expensas', 'cat-alquiler']);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: cambio de orden de la categoría Expensas');
  assert.deepEqual(estado(), inicial);

  await categorias.eliminar('cat-expensas');
  assert.equal(categorias.buscar('cat-expensas'), undefined);
  assert.equal((await registro.deshacer()).texto, 'Deshiciste: eliminación de la categoría Expensas');
  assert.deepEqual(estado(), inicial);
});

test('HU-41 CA-2 · tres cambios se deshacen en orden inverso y Ctrl + Y los rehace en orden; un cambio nuevo borra lo rehacible', async () => {
  const { registro, movimientos } = await armar();
  await movimientos.registrarEgreso(egreso('100'));
  await movimientos.registrarEgreso(egreso('200'));
  await movimientos.registrarEgreso(egreso('400'));
  assert.equal((await registro.deshacer()).texto, t('Deshiciste: egreso de $ 400,00 en Mercado Pago'));
  assert.equal((await registro.deshacer()).texto, t('Deshiciste: egreso de $ 200,00 en Mercado Pago'));
  assert.equal((await registro.deshacer()).texto, t('Deshiciste: egreso de $ 100,00 en Mercado Pago'));
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No hay nada para deshacer' });
  assert.equal((await registro.rehacer()).texto, t('Rehiciste: egreso de $ 100,00 en Mercado Pago'));
  assert.equal((await registro.rehacer()).texto, t('Rehiciste: egreso de $ 200,00 en Mercado Pago'));
  await movimientos.registrarEgreso(egreso('500'));
  assert.equal(registro.puedeRehacer(), false);
  assert.deepEqual(await registro.rehacer(), { ok: false, texto: 'No hay nada para rehacer' });
});

test('HU-41 CA-2 · solo se pueden deshacer los últimos 20 cambios de la sesión', async () => {
  const { base, registro, movimientos } = await armar();
  for (let i = 1; i <= 22; i++) await movimientos.registrarEgreso(egreso(String(i)));
  for (let i = 0; i < 20; i++) assert.equal((await registro.deshacer()).ok, true);
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No hay nada para deshacer' });
  assert.equal(base.datos.movimientos.length, 2, 'los dos primeros quedan');
});

test('HU-41 CA-2 · un cambio con errores no se anota', async () => {
  const { registro, movimientos } = await armar();
  const r = await movimientos.registrarEgreso(egreso('0'));
  assert.ok(r.errores);
  assert.equal(registro.puedeDeshacer(), false);
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No hay nada para deshacer' });
});

test('HU-41 · no se deshace la creación de una cuenta que ya tiene movimientos: queda como estaba y el aviso lo explica', async () => {
  const { base, registro, cuentas } = await armar();
  const { cuenta } = await cuentas.crear({ nombre: 'Ahorros', tipo: 'banco', monedaId: 'ARS', saldoInicial: '0', fechaSaldoInicial: '2026-09-01', emoji: '💰' });
  // Un movimiento que apareció por otro camino (por ejemplo, una importación): no pasó por la pila.
  base.datos.movimientos.push({ id: 'mov-x', cuentaId: cuenta.id, partes: [{ categoriaId: 'cat-alquiler' }] });
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No se puede deshacer: Ahorros ya tiene movimientos' });
  assert.equal(base.datos.cuentas.some((c) => c.id === cuenta.id), true);
  assert.equal(registro.puedeDeshacer(), true, 'el cambio sigue en la pila');
});

test('HU-41 · lo mismo con una categoría con movimientos, y al rehacer una eliminación que ya no vale', async () => {
  const { base, registro, categorias, cuentas } = await armar();
  const form = { nombre: 'Luz', emoji: '💡', fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false };
  const { categoria } = await categorias.crear(form, { padreId: 'cat-vivienda', tipo: 'egreso' });
  base.datos.movimientos.push({ id: 'mov-x', cuentaId: 'cue-mp', partes: [{ categoriaId: categoria.id }] });
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No se puede deshacer: Luz ya tiene movimientos' });
  base.datos.movimientos = [];
  await registro.deshacer();
  base.datos.movimientos.push({ id: 'mov-y', cuentaId: 'cue-mp', partes: [{ categoriaId: categoria.id }] });
  assert.equal(base.datos.categorias.some((c) => c.id === categoria.id), false);
  // Rehacer la creación vuelve a guardarla (nada la usa mal); y eliminar una cuenta se rehace solo si sigue sin movimientos.
  await registro.rehacer();
  await cuentas.eliminar('cue-banco');
  await registro.deshacer();
  base.datos.movimientos.push({ id: 'mov-z', cuentaId: 'cue-banco', partes: [{ categoriaId: 'cat-alquiler' }] });
  assert.equal((await registro.rehacer()).texto, 'No se puede rehacer: Banco ya tiene movimientos');
});

test('HU-41 · cargar o restablecer los datos de ejemplo vacía la pila', async () => {
  const { base, registro, cuentas, categorias, movimientos } = await armar();
  await movimientos.registrarEgreso(egreso('100'));
  await registro.deshacer();
  await movimientos.registrarEgreso(egreso('200'));
  assert.equal(registro.puedeDeshacer(), true);
  const ejemplo = crearCasosDatosEjemplo({ almacen: registro.almacenRegistrado, recargar: [cuentas.recargar, categorias.recargar, movimientos.recargar] });
  await ejemplo.cargar({ cuentas: [CUENTA], monedas: MONEDAS, categorias: CATEGORIAS });
  assert.deepEqual([registro.puedeDeshacer(), registro.puedeRehacer()], [false, false]);
  assert.equal(base.datos.movimientos.length, 0);
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No hay nada para deshacer' });
});

test('HU-41 · si algo falla al revertir, el aviso lo dice y la pila no pierde el cambio', async () => {
  const { base, registro, movimientos } = await armar();
  await movimientos.registrarEgreso(egreso('100'));
  const borrar = base.borrar;
  base.borrar = async () => { throw new Error('falla'); };
  assert.deepEqual(await registro.deshacer(), { ok: false, texto: 'No se pudo deshacer. Probá de nuevo.' });
  base.borrar = borrar;
  assert.equal((await registro.deshacer()).ok, true);
});
