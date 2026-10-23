// aep#15: reglas de las categorías (RF-CAT-01, RF-CAT-02, D-33, D-137, D-138). Casos escritos a mano a partir de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCategoria, clasificacionPorDefecto, esFamilia, hijasEnOrden, destinosPara, ubicacionesAlMover,
  idsParaArchivar, puedeEliminar, idsParaReactivar, propuestaAlAgregarHija, moverEntreHermanas, ubicacionEn,
} from '../../src/dominio/categorias.js';

const HOY = '2026-10-31';
const c = (id, nombre, tipo, padreId = null, extra = {}) => ({ id, nombre, tipo, padreId, emoji: '', orden: 0, estado: 'activa', ...extra });
const EG = (fv, nd, hormiga = false) => ({ fijoVariable: fv, necesidadDeseo: nd, hormiga });
let n = 0;
const ARBOL = [
  c('trabajo', 'Trabajo', 'ingreso', null, { naturaleza: 'ganado' }),
  c('aporte', 'Aporte familiar', 'ingreso', null, { naturaleza: 'aporte_terceros' }),
  c('alimentacion', 'Alimentación', 'egreso'),
  c('super', 'Supermercado', 'egreso', 'alimentacion', EG('variable', 'necesidad')),
  c('verduleria', 'Verdulería', 'egreso', 'alimentacion', EG('variable', 'necesidad')),
  c('kiosco', 'Kiosco', 'egreso', 'alimentacion', EG('variable', 'deseo', true)),
  c('vivienda', 'Vivienda', 'egreso', null, EG('fijo', 'necesidad')),
  c('alquiler', 'Alquiler', 'egreso', 'vivienda', EG('fijo', 'necesidad')),
  c('ocio', 'Ocio', 'egreso'),
  c('juntada', 'Juntada', 'egreso', 'ocio', EG('variable', 'deseo')),
  c('vacaciones', 'Vacaciones', 'egreso', 'ocio', EG('variable', 'deseo')),
  c('salud', 'Salud', 'egreso', null, EG('variable', 'necesidad')),
].map((x) => ({ ...x, orden: ++n }));
const contexto = (cambios = {}) => ({ categorias: ARBOL, ...cambios });
const form = (cambios = {}) => ({ nombre: 'Carnicería', emoji: '', fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false, naturaleza: 'ganado', ...cambios });

test('aep#15 CA-4 y D-137 · la clasificación de una hoja nueva: la de su familia o la más común', () => {
  assert.deepEqual(clasificacionPorDefecto(ARBOL, { padreId: 'vivienda', tipo: 'egreso' }), { fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false });
  assert.deepEqual(clasificacionPorDefecto(ARBOL, { padreId: 'alimentacion', tipo: 'egreso' }), { fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false }, 'familia sin clasificación');
  assert.deepEqual(clasificacionPorDefecto(ARBOL, { padreId: null, tipo: 'egreso' }), { fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false });
  assert.deepEqual(clasificacionPorDefecto(ARBOL, { padreId: null, tipo: 'ingreso' }), { naturaleza: 'ganado' });
});

test('aep#15 CA-5 · nombre único entre hermanas, sin distinguir mayúsculas', () => {
  const msg = 'Ya existe una categoría con ese nombre en este nivel';
  assert.equal(validarCategoria(form({ nombre: 'supermercado' }), contexto({ padreId: 'alimentacion', tipo: 'egreso' })).errores.nombre, msg);
  assert.equal(validarCategoria(form({ nombre: 'Supermercado' }), contexto({ padreId: 'ocio', tipo: 'egreso' })).errores.nombre, undefined, 'en otro nivel, sí');
  assert.equal(validarCategoria(form({ nombre: 'Kiosco' }), contexto({ padreId: 'alimentacion', tipo: 'egreso', id: 'kiosco' })).errores.nombre, undefined, 'editar sin cambiar el nombre');
  // Una hermana archivada no ocupa el nombre.
  const conArchivada = ARBOL.map((x) => (x.id === 'kiosco' ? { ...x, estado: 'archivada' } : x));
  assert.equal(validarCategoria(form({ nombre: 'Kiosco' }), { categorias: conArchivada, padreId: 'alimentacion', tipo: 'egreso' }).errores.nombre, undefined);
});

test('aep#15 CA-6 · nombre de 1 a 40 caracteres, con mayúscula inicial (D-134)', () => {
  const msg = 'El nombre tiene que tener entre 1 y 40 caracteres.';
  const ctx = contexto({ padreId: 'alimentacion', tipo: 'egreso' });
  for (const malo of ['', '   ', 'x'.repeat(41)]) assert.equal(validarCategoria(form({ nombre: malo }), ctx).errores.nombre, msg);
  assert.equal(validarCategoria(form({ nombre: 'carnicería' }), ctx).datos.nombre, 'Carnicería');
});

test('aep#15 CA-8 · la clasificación según el tipo: egreso o ingreso', () => {
  const egreso = validarCategoria(form({ fijoVariable: 'fijo', necesidadDeseo: 'deseo', hormiga: true }), contexto({ padreId: null, tipo: 'egreso' })).datos;
  assert.deepEqual([egreso.fijoVariable, egreso.necesidadDeseo, egreso.hormiga, egreso.naturaleza], ['fijo', 'deseo', true, null]);
  const ingreso = validarCategoria(form({ naturaleza: 'aporte_terceros' }), contexto({ padreId: null, tipo: 'ingreso' })).datos;
  assert.deepEqual([ingreso.naturaleza, ingreso.fijoVariable, ingreso.necesidadDeseo, ingreso.hormiga], ['aporte_terceros', null, null, null]);
  assert.ok(validarCategoria(form({ fijoVariable: 'otro' }), contexto({ padreId: null, tipo: 'egreso' })).errores.fijoVariable);
});

test('aep#15 CA-9 y CA-10 · ubicaciones al mover: todo el historial o desde una fecha (D-33)', () => {
  const previas = [{ id: 'u1', categoriaId: 'juntada', padreId: 'ocio', desde: null }];
  assert.deepEqual(ubicacionesAlMover(previas, { categoriaId: 'juntada', padreId: 'alimentacion', alcance: 'todo', hoy: HOY, nuevoId: () => 'u2' }).map((u) => [u.padreId, u.desde]), [['alimentacion', null]]);
  assert.deepEqual(ubicacionesAlMover(previas, { categoriaId: 'juntada', padreId: 'alimentacion', alcance: 'fecha', fecha: '2026-10-15', hoy: HOY, nuevoId: () => 'u2' }).map((u) => [u.padreId, u.desde]), [['ocio', null], ['alimentacion', '2026-10-15']]);
  const ubis = ubicacionesAlMover(previas, { categoriaId: 'juntada', padreId: 'alimentacion', alcance: 'fecha', fecha: '2026-10-15', hoy: HOY, nuevoId: () => 'u2' });
  assert.equal(ubicacionEn(ubis, 'juntada', '2026-10-14'), 'ocio');
  assert.equal(ubicacionEn(ubis, 'juntada', '2026-10-15'), 'alimentacion');
});

test('aep#15 CA-11 · mover desde una fecha posterior a hoy no se permite', () => {
  assert.throws(() => ubicacionesAlMover([], { categoriaId: 'juntada', padreId: 'alimentacion', alcance: 'fecha', fecha: '2026-11-01', hoy: HOY, nuevoId: () => 'u' }), /no puede ser posterior a hoy/);
});

test('aep#15 CA-12 · destinos: del mismo tipo, sin ella ni sus hijas (INV-09)', () => {
  const ids = destinosPara(ARBOL, 'alimentacion').map((d) => d.id);
  assert.ok(ids.includes(null) && ids.includes('vivienda') && ids.includes('ocio'));
  for (const prohibido of ['alimentacion', 'super', 'verduleria', 'kiosco', 'trabajo', 'aporte']) assert.equal(ids.includes(prohibido), false, prohibido);
  assert.deepEqual(destinosPara(ARBOL, 'trabajo').map((d) => d.id), [null, 'aporte']);
});

test('aep#15 CA-13 · ordenar entre hermanas', () => {
  const orden = moverEntreHermanas(ARBOL, 'kiosco', 0).map((x) => x.nombre);
  assert.deepEqual(orden, ['Kiosco', 'Supermercado', 'Verdulería']);
  assert.deepEqual(hijasEnOrden(ARBOL, 'alimentacion', 'egreso').map((x) => x.id), ['super', 'verduleria', 'kiosco'], 'no cambia el árbol original');
});

test('aep#15 CA-14 y CA-16 · archivar una familia arrastra a sus hijas (D-138); reactivar vuelve a activar sus padres', () => {
  assert.deepEqual(idsParaArchivar(ARBOL, 'ocio').sort(), ['juntada', 'ocio', 'vacaciones']);
  assert.deepEqual(idsParaArchivar(ARBOL, 'salud'), ['salud']);
  const archivadas = ARBOL.map((x) => (['ocio', 'juntada', 'vacaciones'].includes(x.id) ? { ...x, estado: 'archivada' } : x));
  assert.deepEqual(idsParaReactivar(archivadas, 'juntada').ok, true);
  assert.deepEqual(idsParaReactivar(archivadas, 'juntada').ids.sort(), ['juntada', 'ocio'], 'la familia archivada vuelve con ella');
  assert.deepEqual(idsParaReactivar(archivadas, 'ocio').ids.sort(), ['juntada', 'ocio', 'vacaciones'], 'la familia vuelve con sus hijas');
  const choque = [...archivadas, c('otra-juntada', 'Juntada', 'egreso', 'ocio')];
  assert.deepEqual(idsParaReactivar(choque, 'juntada'), { ok: false, motivo: 'Ya existe una categoría con ese nombre en este nivel' });
});

test('aep#15 CA-15 y CA-16 · eliminar: con movimientos o con hijas, no', () => {
  assert.deepEqual(puedeEliminar(ARBOL, 'juntada', []), { ok: true });
  assert.deepEqual(puedeEliminar(ARBOL, 'juntada', [{ id: 'M', partes: [{ categoriaId: 'juntada', monto: 100 }] }]), { ok: false, motivo: 'No podés eliminarla porque tiene movimientos. Podés archivarla.' });
  assert.deepEqual(puedeEliminar(ARBOL, 'ocio', []), { ok: false, motivo: 'Primero mové o eliminá sus categorías.' });
  assert.equal(esFamilia(ARBOL, 'ocio'), true);
  assert.equal(esFamilia(ARBOL, 'salud'), false);
});

test('aep#15 CA-17 · agregar una hija a una hoja con movimientos propone «Otros (hoja)»', () => {
  const movimientos = [{ id: 'M1', partes: [{ categoriaId: 'salud', monto: 100 }] }, { id: 'M2', partes: [{ categoriaId: 'super', monto: 50 }] }];
  assert.deepEqual(propuestaAlAgregarHija(ARBOL, 'salud', movimientos), { nombre: 'Otros (Salud)', movimientos: ['M1'] });
  assert.equal(propuestaAlAgregarHija(ARBOL, 'juntada', movimientos), null, 'sin movimientos, no hace falta');
  assert.equal(propuestaAlAgregarHija(ARBOL, 'ocio', movimientos), null, 'una familia ya tiene hijas');
});
