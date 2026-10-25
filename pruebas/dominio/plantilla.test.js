// HU-01 (RF-CAT-03): el archivo de la plantilla cumple las reglas del dominio. Los valores esperados son los de la
// spec 16 (tablas de cuentas y categorías), escritos a mano: no salen del archivo que se prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { armarPlantilla, debeOfrecerse } from '../../src/dominio/plantilla.js';
import { validarCuenta } from '../../src/dominio/cuentas.js';
import { validarCategoria, hijasEnOrden } from '../../src/dominio/categorias.js';

const archivo = JSON.parse(await readFile(new URL('../../plantilla/plantilla-inicial.json', import.meta.url), 'utf8'));
let contador = 0;
const armar = (datos = archivo) => armarPlantilla(datos, { hoy: '2026-10-31', monedasActivas: ['ARS', 'USD'], nuevoId: (p) => `${p}-${++contador}` });
const plantilla = armar();
const nombresDe = (padreId, tipo) => hijasEnOrden(plantilla.categorias, padreId, tipo).map((c) => c.nombre);
const porNombre = (nombre) => plantilla.categorias.find((c) => c.nombre === nombre);

test('HU-01 CA-4 · el archivo de la plantilla cumple las reglas del dominio y trae 4 cuentas y 37 categorías', () => {
  assert.deepEqual(plantilla.errores, []);
  assert.equal(plantilla.cuentas.length, 4);
  assert.equal(plantilla.categorias.length, 37);
  assert.equal(plantilla.ubicaciones.length, 37);
});

test('HU-01 CA-4 · cuentas: nombre, tipo y moneda de la tabla, en orden, con saldo 0 de hoy, sin rendimiento y propósito Ninguno', () => {
  assert.deepEqual(plantilla.cuentas.map((c) => [c.nombre, c.tipo, c.monedaId, c.orden]), [
    ['Efectivo', 'efectivo', 'ARS', 1], ['Banco', 'banco', 'ARS', 2], ['Billetera virtual', 'billetera_virtual', 'ARS', 3], ['Dólares', 'efectivo', 'USD', 4],
  ]);
  for (const c of plantilla.cuentas) {
    assert.equal(c.saldoInicial, 0);
    assert.equal(c.fechaSaldoInicial, '2026-10-31');
    assert.equal(c.tieneRendimiento, false);
    assert.equal(c.proposito, 'ninguno');
    assert.equal(c.estado, 'activa');
    assert.match(c.id, /^cue-/);
  }
});

test('HU-01 CA-4 · categorías de ingresos y de egresos: nombres y orden de la tabla', () => {
  assert.deepEqual(nombresDe(null, 'ingreso'), ['Sueldo', 'Trabajos independientes', 'Ventas', 'Ayuda familiar', 'Otros ingresos']);
  const hojas = (familia) => nombresDe(porNombre(familia).id, 'egreso');
  assert.deepEqual(hojas('Vivienda'), ['Alquiler', 'Expensas', 'Servicios', 'Internet y teléfono', 'Mantenimiento']);
  assert.deepEqual(hojas('Alimentación'), ['Supermercado', 'Almacén y verdulería', 'Comida afuera', 'Kiosco']);
  assert.deepEqual(hojas('Transporte'), ['Transporte público', 'Combustible', 'Taxi y aplicaciones']);
  assert.deepEqual(hojas('Salud'), ['Prepaga u obra social', 'Farmacia', 'Consultas']);
  assert.deepEqual(hojas('Vestimenta'), ['Ropa', 'Calzado']);
  assert.deepEqual(hojas('Educación'), ['Cuotas y cursos', 'Libros y materiales']);
  assert.deepEqual(hojas('Ocio'), ['Salidas', 'Vacaciones', 'Suscripciones']);
});

test('HU-01 CA-4 · la raíz de egresos tiene las 7 familias en orden y después sus 3 hojas', () => {
  assert.deepEqual(nombresDe(null, 'egreso'), [
    'Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Vestimenta', 'Educación', 'Ocio', 'Impuestos y comisiones', 'Regalos', 'Otros gastos',
  ]);
});

test('HU-01 CA-4 · clasificación: Kiosco es hormiga; Alquiler y Suscripciones son fijos; ayuda familiar es de terceros', () => {
  const detalle = (n) => { const c = porNombre(n); return [c.fijoVariable, c.necesidadDeseo, c.hormiga, c.naturaleza]; };
  assert.deepEqual(detalle('Kiosco'), ['variable', 'deseo', true, null]);
  assert.deepEqual(detalle('Alquiler'), ['fijo', 'necesidad', false, null]);
  assert.deepEqual(detalle('Suscripciones'), ['fijo', 'deseo', false, null]);
  assert.deepEqual(detalle('Comida afuera'), ['variable', 'deseo', false, null]);
  assert.deepEqual(detalle('Mantenimiento'), ['variable', 'necesidad', false, null]);
  assert.deepEqual(detalle('Ocio'), ['variable', 'deseo', false, null]);
  assert.deepEqual(detalle('Educación'), ['fijo', 'necesidad', false, null]);
  assert.deepEqual(detalle('Ayuda familiar'), [null, null, null, 'aporte_terceros']);
  assert.deepEqual(detalle('Otros ingresos'), [null, null, null, 'otro']);
  assert.deepEqual(detalle('Sueldo'), [null, null, null, 'ganado']);
  assert.equal(porNombre('Vivienda').emoji, '🏠');
});

test('HU-01 CA-4 · cada categoría tiene una sola ubicación «desde siempre» bajo su padre, sin ciclos ni huérfanas', () => {
  const ids = new Set(plantilla.categorias.map((c) => c.id));
  for (const c of plantilla.categorias) {
    const propias = plantilla.ubicaciones.filter((u) => u.categoriaId === c.id);
    assert.deepEqual(propias.map((u) => [u.padreId, u.desde]), [[c.padreId, null]]);
    assert.ok(c.padreId === null || ids.has(c.padreId), 'el padre existe');
    assert.equal(c.estado, 'activa');
    assert.equal(c.esSistema, false);
    // Subiendo por los padres se llega a la raíz sin repetir (INV-09).
    const visto = new Set([c.id]);
    for (let p = c.padreId; p; p = plantilla.categorias.find((x) => x.id === p).padreId) { assert.ok(!visto.has(p), 'ciclo'); visto.add(p); }
  }
  assert.equal(new Set(plantilla.categorias.map((c) => c.id)).size, 37, 'ids distintos');
});

test('HU-01 CA-4 · cada fila del archivo pasa por validarCuenta y validarCategoria sin errores', () => {
  const cuentas = [];
  for (const fila of archivo.cuentas) {
    const { errores } = validarCuenta({ ...fila, saldoInicial: '', fechaSaldoInicial: '2026-10-31' }, { cuentas, hoy: '2026-10-31', monedasActivas: ['ARS', 'USD'] });
    assert.deepEqual(errores, {}, fila.nombre);
    cuentas.push({ ...fila, estado: 'activa' });
  }
  for (const c of plantilla.categorias) {
    const sinEsta = plantilla.categorias.filter((x) => x.id !== c.id);
    assert.deepEqual(validarCategoria(c, { categorias: sinEsta, padreId: c.padreId, tipo: c.tipo, id: c.id }).errores, {}, c.nombre);
  }
});

test('HU-01 CA-4 · un archivo con un nombre repetido entre hermanas, un padre inexistente o un tipo cruzado se rechaza', () => {
  const copia = () => structuredClone(archivo);
  const repetido = copia();
  repetido.categorias[1].nombre = repetido.categorias[0].nombre;
  assert.equal(armar(repetido).errores.length, 1);
  const sinPadre = copia();
  sinPadre.categorias.find((c) => c.padre).padre = 'no-existe';
  assert.match(armar(sinPadre).errores.join(), /padre/);
  const cruzado = copia();
  const hoja = cruzado.categorias.find((c) => c.padre);
  hoja.tipo = 'ingreso'; hoja.naturaleza = 'ganado';
  assert.match(armar(cruzado).errores.join(), /mismo tipo/);
  const sinClasificar = copia();
  delete sinClasificar.categorias.find((c) => c.tipo === 'egreso' && c.padre).fijoVariable;
  assert.equal(armar(sinClasificar).errores.length, 1);
  const largo = copia();
  largo.cuentas[0].nombre = 'x'.repeat(41);
  assert.equal(armar(largo).errores.length, 1);
  assert.equal(armar({ formato: 'otro' }).errores.length, 1);
});

test('HU-01 CA-1 · se ofrece solo con la base vacía (ni activas ni archivadas) y sin la marca', () => {
  const sin = { inicioCompletado: false };
  assert.equal(debeOfrecerse({ configuracion: sin, cuentas: [], categorias: [] }), true);
  assert.equal(debeOfrecerse({ configuracion: sin, cuentas: [{ estado: 'archivada' }], categorias: [] }), false);
  assert.equal(debeOfrecerse({ configuracion: sin, cuentas: [], categorias: [{ estado: 'archivada' }] }), false);
  assert.equal(debeOfrecerse({ configuracion: { inicioCompletado: true }, cuentas: [], categorias: [] }), false);
});
