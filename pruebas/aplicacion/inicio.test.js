// HU-01: casos de uso del primer uso (RF-CAT-03) con un almacén en memoria. Valores esperados de la spec 16, escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearCasosInicio } from '../../src/aplicacion/inicio.js';
import { crearCasosDatosEjemplo } from '../../src/aplicacion/datos-ejemplo.js';
import { CONFIGURACION_POR_DEFECTO } from '../../src/dominio/configuracion.js';
import { MONEDAS_POR_DEFECTO } from '../../src/dominio/monedas.js';

const plantilla = JSON.parse(await readFile(new URL('../../plantilla/plantilla-inicial.json', import.meta.url), 'utf8'));

/** Almacén en memoria con la misma promesa del real: guardarTodo/reemplazar son todo o nada. */
function almacenEnMemoria({ inicioCompletado = false, cuentas = [], categorias = [], monedas = [], fallarEnLaCategoria = 0 } = {}) {
  const datos = {
    configuracion: { ...CONFIGURACION_POR_DEFECTO, inicioCompletado }, cuentas, categorias, monedas, ubicacionesCategoria: [],
  };
  const copiar = (x) => structuredClone(x);
  return {
    datos,
    guardados: 0,
    leerConfiguracion: async () => copiar(datos.configuracion),
    guardarConfiguracion: async (c) => { datos.configuracion = copiar(c); },
    listar: async (nombre) => copiar(datos[nombre]),
    async guardarTodo(nuevos) {
      this.guardados += 1;
      const trabajo = copiar(datos);
      for (const [nombre, registros] of Object.entries(nuevos)) {
        let puestos = 0;
        for (const r of [].concat(registros)) {
          puestos += 1;
          if (nombre === 'categorias' && puestos === fallarEnLaCategoria) throw new Error('falla al guardar');
          if (nombre === 'configuracion') trabajo.configuracion = copiar(r);
          else trabajo[nombre] = [...trabajo[nombre].filter((x) => x.id !== r.id), copiar(r)];
        }
      }
      Object.assign(datos, trabajo);
    },
    async reemplazar(nuevos) {
      for (const [nombre, registros] of Object.entries(nuevos)) datos[nombre] = nombre === 'configuracion' ? copiar(registros[0]) : copiar(registros);
    },
  };
}
const crearInicio = (almacen, extra = {}) => {
  let n = 0;
  return crearCasosInicio({
    almacen, reloj: { hoy: () => '2026-10-31' }, nuevoId: (p) => `${p}-${++n}`, leerPlantilla: async () => plantilla, ...extra,
  });
};

test('HU-01 CA-1 · una base vacía sin la marca ofrece las opciones; una con datos no, y queda con la marca', async () => {
  const vacia = almacenEnMemoria();
  const inicio = crearInicio(vacia);
  assert.equal(inicio.estado(), 'comprobando');
  assert.equal(await inicio.preparar(), 'ofrecer');
  assert.equal(vacia.datos.configuracion.inicioCompletado, false, 'no se guarda nada hasta que se elige');

  for (const parcial of [{ cuentas: [{ id: 'c1', estado: 'activa' }] }, { categorias: [{ id: 'k1', estado: 'archivada' }] }]) {
    const conDatos = almacenEnMemoria(parcial);
    assert.equal(await crearInicio(conDatos).preparar(), 'resuelto');
    assert.equal(conDatos.datos.configuracion.inicioCompletado, true);
  }
  const marcada = almacenEnMemoria({ inicioCompletado: true });
  assert.equal(await crearInicio(marcada).preparar(), 'resuelto');
});

test('HU-01 CA-1 · si se cierra sin elegir, la próxima vez se ofrece de nuevo', async () => {
  const almacen = almacenEnMemoria();
  await crearInicio(almacen).preparar();
  const reabierta = crearInicio(almacen);
  assert.equal(await reabierta.preparar(), 'ofrecer');
  assert.equal(almacen.datos.cuentas.length + almacen.datos.categorias.length, 0);
});

test('HU-01 CA-2 · empezar con la plantilla crea 4 cuentas y 37 categorías y marca el inicio', async () => {
  const almacen = almacenEnMemoria({ monedas: MONEDAS_POR_DEFECTO.map((m) => ({ ...m })) });
  let recargas = 0;
  const inicio = crearInicio(almacen, { recargar: [async () => { recargas += 1; }] });
  await inicio.preparar();
  assert.deepEqual(await inicio.usarPlantilla(), { ok: true, cuentas: 4, categorias: 37 });
  assert.equal(almacen.datos.cuentas.length, 4);
  assert.equal(almacen.datos.categorias.length, 37);
  assert.equal(almacen.datos.ubicacionesCategoria.length, 37);
  assert.equal(almacen.datos.configuracion.inicioCompletado, true);
  assert.deepEqual(almacen.datos.cuentas.map((c) => [c.nombre, c.saldoInicial, c.fechaSaldoInicial]), [
    ['Efectivo', 0, '2026-10-31'], ['Banco', 0, '2026-10-31'], ['Billetera virtual', 0, '2026-10-31'], ['Dólares', 0, '2026-10-31'],
  ]);
  assert.equal(inicio.estado(), 'resuelto');
  assert.equal(recargas, 1);
  assert.equal(almacen.guardados, 1, 'todo en una sola escritura');
  // Ya resuelto, no se aplica otra vez.
  assert.deepEqual(await inicio.usarPlantilla(), { ok: false });
  assert.equal(almacen.datos.cuentas.length, 4);
});

test('HU-01 CA-2 · si falla al guardar la décima categoría no queda nada y el inicio sigue sin completar', async () => {
  const almacen = almacenEnMemoria({ fallarEnLaCategoria: 10 });
  const inicio = crearInicio(almacen);
  await inicio.preparar();
  assert.deepEqual(await inicio.usarPlantilla(), { ok: false });
  assert.equal(almacen.datos.cuentas.length, 0);
  assert.equal(almacen.datos.categorias.length, 0);
  assert.equal(almacen.datos.ubicacionesCategoria.length, 0);
  assert.equal(almacen.datos.configuracion.inicioCompletado, false);
  assert.equal(inicio.estado(), 'ofrecer');
  // Se puede probar de nuevo.
  const reintento = crearInicio(almacenEnMemoria());
  await reintento.preparar();
  assert.equal((await reintento.usarPlantilla()).ok, true);
});

test('HU-01 CA-2 · si no se puede leer la plantilla tampoco queda nada', async () => {
  const almacen = almacenEnMemoria();
  const inicio = crearInicio(almacen, { leerPlantilla: async () => { throw new Error('sin conexión'); } });
  await inicio.preparar();
  assert.deepEqual(await inicio.usarPlantilla(), { ok: false });
  assert.equal(almacen.datos.cuentas.length, 0);
  assert.equal(almacen.datos.configuracion.inicioCompletado, false);
});

test('HU-01 CA-2 · un doble toque en «Empezar con la plantilla» crea 4 cuentas, no 8', async () => {
  const almacen = almacenEnMemoria();
  const inicio = crearInicio(almacen);
  await inicio.preparar();
  const [a, b] = await Promise.all([inicio.usarPlantilla(), inicio.usarPlantilla()]);
  assert.deepEqual(a, { ok: true, cuentas: 4, categorias: 37 });
  assert.deepEqual(b, a);
  assert.equal(almacen.datos.cuentas.length, 4);
  assert.equal(almacen.datos.categorias.length, 37);
  assert.equal(almacen.guardados, 1);
});

test('HU-01 CA-2 · una moneda desactivada que usa la plantilla queda activa', async () => {
  const monedas = MONEDAS_POR_DEFECTO.map((m) => ({ ...m, activa: m.id === 'ARS' }));
  const almacen = almacenEnMemoria({ monedas });
  const inicio = crearInicio(almacen);
  await inicio.preparar();
  assert.equal((await inicio.usarPlantilla()).ok, true);
  assert.deepEqual(almacen.datos.monedas.map((m) => [m.id, m.activa]), [['ARS', true], ['USD', true]]);
});

test('HU-01 CA-3 · empezar vacío marca el inicio sin crear nada y no se vuelve a ofrecer', async () => {
  const almacen = almacenEnMemoria();
  const inicio = crearInicio(almacen);
  await inicio.preparar();
  assert.deepEqual(await inicio.empezarVacio(), { ok: true });
  assert.equal(almacen.datos.configuracion.inicioCompletado, true);
  assert.equal(almacen.datos.cuentas.length + almacen.datos.categorias.length, 0);
  assert.equal(await crearInicio(almacen).preparar(), 'resuelto');
  // Tampoco con la plantilla elegida y todo borrado después.
  const otra = almacenEnMemoria();
  const conPlantilla = crearInicio(otra);
  await conPlantilla.preparar();
  await conPlantilla.usarPlantilla();
  otra.datos.cuentas = []; otra.datos.categorias = [];
  assert.equal(await crearInicio(otra).preparar(), 'resuelto');
});

test('HU-01 CA-4 · cargar y restablecer los datos de ejemplo dejan el inicio completado; borrar los datos de prueba lo vuelve a ofrecer', async () => {
  const almacen = almacenEnMemoria();
  const ejemplo = crearCasosDatosEjemplo({ almacen, recargar: [] });
  const demo = JSON.parse(await readFile(new URL('../../datos-demo/datos-ejemplo.json', import.meta.url), 'utf8'));
  await ejemplo.cargar(demo);
  assert.equal(almacen.datos.configuracion.inicioCompletado, true);
  assert.equal(almacen.datos.cuentas.length, 6);
  assert.equal(await crearInicio(almacen).preparar(), 'resuelto');
  await ejemplo.cargar(demo); // restablecer
  assert.equal(almacen.datos.configuracion.inicioCompletado, true);
  await ejemplo.borrar();
  assert.equal(almacen.datos.configuracion.inicioCompletado, false);
  assert.equal(almacen.datos.cuentas.length + almacen.datos.categorias.length + almacen.datos.ubicacionesCategoria.length, 0);
  assert.equal(await crearInicio(almacen).preparar(), 'ofrecer');
});
