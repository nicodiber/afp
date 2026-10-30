// HU-02: registrar un egreso con los casos de uso reales y un almacén en memoria. Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCasosMovimientos } from '../../src/aplicacion/movimientos.js';
import { crearCasosCuentas } from '../../src/aplicacion/cuentas.js';
import { crearCasosCategorias } from '../../src/aplicacion/categorias.js';
import { crearCasosDatosEjemplo } from '../../src/aplicacion/datos-ejemplo.js';

const HOY = '2026-10-31';
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
const CUENTA = { id: 'cue-banco', nombre: 'Banco', tipo: 'banco', monedaId: 'ARS', saldoInicial: 80000000, fechaSaldoInicial: '2026-09-01', orden: 1, estado: 'activa' };
const CATEGORIAS = [
  { id: 'cat-vivienda', nombre: 'Vivienda', tipo: 'egreso', padreId: null, orden: 1, estado: 'activa' },
  { id: 'cat-alquiler', nombre: 'Alquiler', tipo: 'egreso', padreId: 'cat-vivienda', orden: 2, estado: 'activa', fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false },
];

async function armar() {
  const almacen = almacenEnMemoria({ cuentas: [CUENTA], categorias: CATEGORIAS });
  const reloj = { hoy: () => HOY };
  let n = 0;
  const nuevoId = (prefijo = 'x') => `${prefijo}-${++n}`;
  const guardados = { lista: () => [] };
  const cuentas = crearCasosCuentas({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista(), movimientosEnMemoria: () => guardados.lista() });
  const categorias = crearCasosCategorias({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista() });
  const movimientos = crearCasosMovimientos({ almacen, reloj, nuevoId, cuentas, categorias });
  guardados.lista = movimientos.todos;
  await Promise.all([cuentas.recargar(), categorias.recargar(), movimientos.recargar()]);
  return { almacen, cuentas, categorias, movimientos };
}
const formulario = (cambios = {}) => ({ fecha: HOY, monto: '12.500,50', descripcion: 'alquiler', categoriaId: 'cat-alquiler', cuentaId: 'cue-banco', ...cambios });

test('HU-02 CA-2 · registrar un egreso lo guarda y devuelve el saldo nuevo de la cuenta', async () => {
  const { almacen, cuentas, movimientos } = await armar();
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 80000000);
  const resultado = await movimientos.registrarEgreso(formulario());
  assert.equal(resultado.errores, undefined);
  assert.equal(resultado.saldo, 78749950);
  assert.equal(resultado.cuenta.nombre, 'Banco');
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 78749950, 'el saldo que muestran Inicio y Cuentas es el calculado');
  assert.equal(almacen.datos.movimientos.length, 1);
  const guardado = almacen.datos.movimientos[0];
  assert.deepEqual([guardado.id, guardado.tipo, guardado.montoTotal, guardado.descripcion, guardado.fecha], ['mov-1', 'egreso', 1250050, 'Alquiler', HOY]);
  assert.deepEqual(guardado.asientos, [{ cuentaId: 'cue-banco', monto: -1250050 }]);
  assert.equal(movimientos.hay(), true);
});

test('HU-02 CA-2 · con errores no se guarda nada', async () => {
  const { almacen, movimientos } = await armar();
  const resultado = await movimientos.registrarEgreso(formulario({ monto: '0', categoriaId: null, cuentaId: null }));
  assert.deepEqual(resultado.errores, { monto: 'Escribí un monto mayor que 0.', categoria: 'Elegí una categoría.', cuenta: 'Elegí una cuenta.' });
  assert.equal(almacen.datos.movimientos.length, 0);
  assert.equal(movimientos.hay(), false);
});

test('HU-02 CA-2 · dos egresos seguidos suman: 800.000,00 − 12.500,50 − 100,00 = 787.399,50', async () => {
  const { cuentas, movimientos } = await armar();
  await movimientos.registrarEgreso(formulario());
  const segundo = await movimientos.registrarEgreso(formulario({ monto: '100' }));
  assert.equal(segundo.saldo, 78739950);
  assert.equal(movimientos.todos().length, 2);
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 78739950);
});

test('HU-02 CA-2 · una cuenta o una categoría con movimientos no se elimina (se ofrece archivar)', async () => {
  const { cuentas, categorias, movimientos } = await armar();
  await movimientos.registrarEgreso(formulario());
  assert.deepEqual(await cuentas.puedeEliminar('cue-banco'), { ok: false, motivo: 'No podés eliminarla porque tiene movimientos. Podés archivarla.' });
  assert.deepEqual(await categorias.puedeEliminar('cat-alquiler'), { ok: false, motivo: 'No podés eliminarla porque tiene movimientos. Podés archivarla.' });
});

test('HU-02 CA-4 · «Borrar datos de prueba» y «Restablecer datos de ejemplo» dejan los movimientos vacíos', async () => {
  const { almacen, cuentas, categorias, movimientos } = await armar();
  await movimientos.registrarEgreso(formulario());
  const ejemplo = crearCasosDatosEjemplo({ almacen, recargar: [cuentas.recargar, categorias.recargar, movimientos.recargar] });
  await ejemplo.cargar({ cuentas: [CUENTA], monedas: [{ id: 'ARS', activa: true }], categorias: CATEGORIAS });
  assert.deepEqual([almacen.datos.movimientos.length, movimientos.hay()], [0, false], 'restablecer');
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-banco')), 80000000, 'el saldo vuelve al inicial');
  await movimientos.registrarEgreso(formulario());
  await ejemplo.borrar();
  assert.deepEqual([almacen.datos.movimientos.length, movimientos.hay(), cuentas.hayCuentas()], [0, false, false], 'borrar');
});

test('HU-02b CA-4 · un egreso anterior al saldo inicial se guarda y la cuenta pasa a empezar en esa fecha, con el mismo monto', async () => {
  const { almacen, cuentas, movimientos } = await armar();
  const resultado = await movimientos.registrarEgreso(formulario({ fecha: '2026-08-15', hora: '09:05' }));
  assert.equal(resultado.errores, undefined);
  assert.equal(resultado.cuentaAjustada.fechaSaldoInicial, '2026-08-15');
  assert.equal(cuentas.buscar('cue-banco').fechaSaldoInicial, '2026-08-15');
  assert.equal(almacen.datos.cuentas[0].fechaSaldoInicial, '2026-08-15', 'quedó guardado');
  assert.equal(cuentas.buscar('cue-banco').saldoInicial, 80000000, 'el monto no cambia');
  assert.equal(resultado.saldo, 78749950);
  assert.deepEqual([almacen.datos.movimientos[0].fecha, almacen.datos.movimientos[0].hora], ['2026-08-15', '09:05']);
  const normal = await movimientos.registrarEgreso(formulario({ fecha: '2026-09-02' }));
  assert.equal(normal.cuentaAjustada, undefined, 'una fecha posterior al inicio no lo toca');
  assert.equal(cuentas.buscar('cue-banco').fechaSaldoInicial, '2026-08-15');
});

test('HU-02b CA-4 · con errores, la cuenta no se toca', async () => {
  const { almacen, movimientos } = await armar();
  const r = await movimientos.registrarEgreso(formulario({ fecha: '2026-08-15', monto: '0' }));
  assert.ok(r.errores.monto);
  assert.equal(almacen.datos.cuentas[0].fechaSaldoInicial, '2026-09-01');
});
