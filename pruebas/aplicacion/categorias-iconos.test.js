// HU-31 CA-2 y CA-3: casos de uso de categorías con íconos, con un almacén en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCasosCategorias } from '../../src/aplicacion/categorias.js';

function almacenEnMemoria(categorias) {
  const datos = { categorias, ubicacionesCategoria: [] };
  return {
    datos,
    listar: async (nombre) => structuredClone(datos[nombre]),
    guardar: async (nombre, registros) => {
      for (const r of [].concat(registros)) {
        const i = datos[nombre].findIndex((x) => x.id === r.id);
        if (i >= 0) datos[nombre][i] = structuredClone(r); else datos[nombre].push(structuredClone(r));
      }
    },
    borrar: async () => {},
  };
}
const cat = (id, nombre, emoji, orden, extra = {}) => ({ id, nombre, emoji, tipo: 'egreso', padreId: null, orden, estado: 'activa', fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false, ...extra });
const armar = async (categorias) => {
  const almacen = almacenEnMemoria(categorias);
  let n = 0;
  const casos = crearCasosCategorias({ almacen, reloj: { hoy: () => '2026-10-31' }, nuevoId: (p = 'x') => `${p}-${++n}` });
  await casos.preparar();
  return { almacen, casos };
};

test('HU-31 CA-3 · al abrir la base, las categorías sin ícono o repetidas reciben uno libre y queda guardado', async () => {
  const { almacen, casos } = await armar([cat('a', 'Supermercado', '🛒', 1), cat('b', 'Super 2', '🛒', 2), cat('c', 'Farmacia', '', 3), cat('d', 'Archivada', undefined, 4, { estado: 'archivada' })]);
  const emojis = casos.todas().map((c) => c.emoji);
  assert.equal(emojis[0], '🛒');
  assert.equal(emojis[2], '💊');
  assert.ok(emojis.every(Boolean));
  assert.equal(new Set(emojis).size, 4, 'ninguno se repite, tampoco con la archivada');
  assert.deepEqual(almacen.datos.categorias.map((c) => c.emoji), emojis, 'se guardó en la base');
  const antes = JSON.stringify(almacen.datos.categorias);
  await casos.recargar();
  assert.equal(JSON.stringify(almacen.datos.categorias), antes, 'abrir otra vez no cambia nada');
});

test('HU-31 CA-2 · crear con el ícono propuesto anda; repetido o vacío no guarda', async () => {
  const { casos } = await armar([cat('a', 'Supermercado', '🛒', 1)]);
  const propuesto = casos.iconoPropuesto('Peluquería');
  assert.equal(propuesto, '✂️');
  const hecho = await casos.crear({ nombre: 'Peluquería', emoji: propuesto, fijoVariable: 'variable', necesidadDeseo: 'deseo' }, { padreId: null, tipo: 'egreso' });
  assert.equal(hecho.categoria.emoji, propuesto);
  const repetido = await casos.crear({ nombre: 'Otra', emoji: '🛒', fijoVariable: 'variable', necesidadDeseo: 'deseo' }, { padreId: null, tipo: 'egreso' });
  assert.equal(repetido.errores.emoji, 'Elegí un ícono que no use otra categoría.');
  const vacio = await casos.crear({ nombre: 'Otra', emoji: '', fijoVariable: 'variable', necesidadDeseo: 'deseo' }, { padreId: null, tipo: 'egreso' });
  assert.equal(vacio.errores.emoji, 'Elegí un ícono que no use otra categoría.');
  assert.equal(casos.iconoEnUso('🛒'), true);
  assert.equal(casos.iconoEnUso('🛒', 'a'), false, 'el propio no cuenta');
  assert.notEqual(casos.iconoPropuesto('Supermercado'), '🛒', 'ya usado: propone otro');
});
