// HU-31 CA-2 y CA-3: íconos de las categorías. Valores esperados escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMOJIS_DE_CATEGORIA, EMOJIS_DE_PALABRAS, claveIcono, iconoVisible, iconosUsados, proponerIcono, asignarIconosFaltantes,
} from '../../src/dominio/iconos.js';
import { validarCategoria, MENSAJES, etiquetasDe, explicacionesDe, EXPLICACIONES } from '../../src/dominio/categorias.js';

const c = (id, nombre, emoji, extra = {}) => ({ id, nombre, tipo: 'egreso', padreId: null, emoji, orden: 0, estado: 'activa', ...extra });
const form = (cambios = {}) => ({ nombre: 'Carnicería', emoji: '🥩', fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false, ...cambios });

test('HU-31 CA-2 · la lista de emojis no repite ninguno y tiene de sobra', () => {
  const claves = EMOJIS_DE_CATEGORIA.map(claveIcono);
  assert.equal(new Set(claves).size, claves.length);
  assert.ok(claves.length >= 200);
  for (const e of EMOJIS_DE_PALABRAS) assert.ok(claves.includes(e), `${e} de la tabla de palabras no está en la lista`);
});

test('HU-31 CA-2 · los emojis que se dibujarían como texto llevan el selector de variación', () => {
  assert.equal(iconoVisible('✂'), '✂️');
  assert.equal(iconoVisible('✂️'), '✂️');
  assert.equal(iconoVisible('🛒'), '🛒');
  assert.equal(claveIcono('🍽️'), '🍽');
});

test('HU-31 CA-2 · propone el ícono según palabras clave del nombre, sin tildes ni mayúsculas', () => {
  const nadie = new Set();
  assert.equal(proponerIcono('Supermercado', nadie), '🛒');
  assert.equal(proponerIcono('ALQUILER del depto', nadie), '🏠');
  assert.equal(proponerIcono('Sueldo', nadie), '💼');
  assert.equal(proponerIcono('Farmacia', nadie), '💊');
  assert.equal(proponerIcono('Peluquería', nadie), '✂️');
  // La palabra tiene que estar entera: «gasolero» no es «gas».
  assert.notEqual(proponerIcono('Gasolero', nadie), '🔥');
});

test('HU-31 CA-2 · si el ícono de la palabra está usado, propone otro libre', () => {
  const propuesto = proponerIcono('Supermercado', new Set(['🛒']));
  assert.notEqual(propuesto, '🛒');
  assert.ok(propuesto);
  // Sin palabra clave: el primero libre de la lista.
  assert.equal(proponerIcono('Cosas varias', new Set()), claveIcono(EMOJIS_DE_CATEGORIA[0]));
  assert.equal(proponerIcono('', new Set([claveIcono(EMOJIS_DE_CATEGORIA[0])])), claveIcono(EMOJIS_DE_CATEGORIA[1]));
  assert.equal(proponerIcono('x', new Set(EMOJIS_DE_CATEGORIA.map(claveIcono))), '');
});

test('HU-31 CA-2 · los íconos usados cuentan activas y archivadas, de ingresos y egresos, salvo la propia', () => {
  const todas = [c('a', 'A', '🛒'), c('b', 'B', '💼', { tipo: 'ingreso' }), c('d', 'D', '🏠', { estado: 'archivada' }), c('e', 'E', '')];
  assert.deepEqual([...iconosUsados(todas)].sort(), ['🏠', '💼', '🛒'].sort());
  assert.deepEqual([...iconosUsados(todas, 'a')].sort(), ['🏠', '💼'].sort());
});

test('HU-31 CA-2 · guardar sin ícono o con uno repetido da el error; el propio se puede conservar', () => {
  const categorias = [c('a', 'Super', '🛒'), c('b', 'Sueldo', '💼', { tipo: 'ingreso', naturaleza: 'ganado' }), c('d', 'Viejo', '🏠', { estado: 'archivada' })];
  const ctx = { categorias, padreId: null, tipo: 'egreso' };
  assert.equal(MENSAJES.icono, 'Elegí un ícono que no use otra categoría.');
  assert.equal(validarCategoria(form({ emoji: '' }), ctx).errores.emoji, MENSAJES.icono);
  assert.equal(validarCategoria(form({ emoji: '   ' }), ctx).errores.emoji, MENSAJES.icono);
  assert.equal(validarCategoria(form({ emoji: '🛒' }), ctx).errores.emoji, MENSAJES.icono, 'activa');
  assert.equal(validarCategoria(form({ emoji: '💼' }), ctx).errores.emoji, MENSAJES.icono, 'de otro tipo');
  assert.equal(validarCategoria(form({ emoji: '🏠' }), ctx).errores.emoji, MENSAJES.icono, 'archivada');
  assert.equal(validarCategoria(form({ emoji: '🥩' }), ctx).errores.emoji, undefined);
  assert.equal(validarCategoria(form({ nombre: 'Super', emoji: '🛒' }), { ...ctx, id: 'a' }).errores.emoji, undefined, 'editar sin cambiar el ícono');
  // Con y sin selector de variación es el mismo ícono.
  const conVariacion = [c('p', 'Pelu', '✂️')];
  assert.equal(validarCategoria(form({ emoji: '✂' }), { ...ctx, categorias: conVariacion }).errores.emoji, MENSAJES.icono);
});

test('HU-31 CA-3 · a las categorías sin ícono o con ícono repetido se les asigna uno libre; las demás no cambian', () => {
  const base = [
    { ...c('a', 'Supermercado', '🛒'), orden: 1 },
    { ...c('b', 'Compras del súper', '🛒'), orden: 2 }, // repetida: la primera por orden se queda con el ícono
    { ...c('d', 'Alquiler', ''), orden: 3 },
    { ...c('e', 'Sueldo', undefined, { tipo: 'ingreso' }), orden: 4 },
    { ...c('f', 'Cosas varias', '🏠'), orden: 5 },
  ];
  const cambios = asignarIconosFaltantes(base);
  assert.deepEqual(cambios.map((x) => x.id), ['b', 'd', 'e']);
  const porId = Object.fromEntries(cambios.map((x) => [x.id, x.emoji]));
  assert.equal(porId.e, '💼', 'por palabra clave');
  assert.notEqual(porId.d, '🏠', 'el 🏠 ya está usado por otra: no se repite');
  const finales = base.map((x) => ({ ...x, emoji: porId[x.id] ?? x.emoji }));
  const claves = finales.map((x) => claveIcono(x.emoji));
  assert.ok(claves.every(Boolean));
  assert.equal(new Set(claves).size, claves.length);
  assert.deepEqual(asignarIconosFaltantes(finales), [], 'una segunda pasada ya no cambia nada');
});

test('HU-31 CA-1 · las etiquetas de la clasificación y sus explicaciones', () => {
  const kiosco = c('k', 'Kiosco', '🍬', { fijoVariable: 'variable', necesidadDeseo: 'deseo', hormiga: true });
  assert.deepEqual(etiquetasDe(kiosco).map((t) => t.nombre), ['Variable', 'Deseo', 'Hormiga']);
  assert.deepEqual(explicacionesDe(kiosco).map((t) => t.nombre), ['Variable', 'Deseo', 'Hormiga']);
  const alquiler = c('q', 'Alquiler', '🔑', { fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false });
  assert.deepEqual(etiquetasDe(alquiler).map((t) => t.nombre), ['Fijo', 'Necesidad']);
  assert.deepEqual(etiquetasDe(c('t', 'Trabajo', '💼', { tipo: 'ingreso', naturaleza: 'aporte_terceros' })).map((t) => t.nombre), ['Aporte de terceros']);
  assert.deepEqual(explicacionesDe(c('t', 'Trabajo', '💼', { tipo: 'ingreso', naturaleza: 'ganado' })), []);
  assert.equal(EXPLICACIONES.find((e) => e.clave === 'hormiga').texto, 'Gastos chicos y frecuentes que, sumados, pesan (el kiosco, el café de paso).');
  assert.equal(EXPLICACIONES.length, 5);
});
