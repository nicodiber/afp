// HU-02: reglas de la carga de un egreso simple (RF-MOV-01, modelo de datos §3.7, INV-03, INV-16). Valores
// esperados escritos a mano a partir de la historia y del modelo de datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarEgreso, crearEgreso, hojasDeEgreso, categoriasDeEgresoAgrupadas, filtrarOpciones, normalizarBusqueda,
} from '../../src/dominio/movimientos.js';
import { saldo, verificarPartidaDoble } from '../../src/dominio/partida-doble.js';

const HOY = '2026-10-31';
const c = (id, nombre, tipo, padreId, orden, extra = {}) => ({ id, nombre, tipo, padreId, orden, emoji: '', estado: 'activa', ...extra });
const EG = { fijoVariable: 'variable', necesidadDeseo: 'necesidad', hormiga: false };
const CATEGORIAS = [
  c('trabajo', 'Trabajo', 'ingreso', null, 1),
  c('vivienda', 'Vivienda', 'egreso', null, 2),
  c('alquiler', 'Alquiler', 'egreso', 'vivienda', 3, { emoji: '🏠', ...EG, fijoVariable: 'fijo' }),
  c('luz', 'Electricidad', 'egreso', 'vivienda', 4, { ...EG, fijoVariable: 'fijo' }),
  c('viejo', 'Gas', 'egreso', 'vivienda', 5, { ...EG, estado: 'archivada' }),
  c('alimentacion', 'Alimentación', 'egreso', null, 6),
  c('super', 'Supermercado', 'egreso', 'alimentacion', 7, { emoji: '🛒', ...EG }),
  c('kiosco', 'Kiosco', 'egreso', 'alimentacion', 8, { ...EG, necesidadDeseo: 'deseo', hormiga: true }),
  c('salud', 'Salud', 'egreso', null, 9, EG),
  c('regalos', 'Regalos', 'egreso', null, 10, EG),
];
const CUENTAS = [
  { id: 'banco', nombre: 'Banco', monedaId: 'ARS', saldoInicial: 80000000, fechaSaldoInicial: '2026-09-01', estado: 'activa', orden: 1 },
  { id: 'vieja', nombre: 'Vieja', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-09-01', estado: 'archivada', orden: 2 },
  { id: 'dolares', nombre: 'Dólares', monedaId: 'USD', saldoInicial: 50000, fechaSaldoInicial: '2026-10-15', estado: 'activa', orden: 3 },
];
const form = (cambios = {}) => ({ fecha: HOY, monto: '12.500,50', descripcion: '', categoriaId: 'super', cuentaId: 'banco', ...cambios });
const validar = (cambios) => validarEgreso(form(cambios), { cuentas: CUENTAS, categorias: CATEGORIAS, hoy: HOY });

test('HU-02 CA-1 · las categorías para cargar son las hojas activas de egresos, por familia y en el orden del árbol', () => {
  assert.deepEqual(hojasDeEgreso(CATEGORIAS).map((x) => x.id), ['alquiler', 'luz', 'super', 'kiosco', 'salud', 'regalos']);
  const grupos = categoriasDeEgresoAgrupadas(CATEGORIAS);
  assert.deepEqual(grupos.map((g) => [g.familia?.nombre ?? null, g.categorias.map((x) => x.nombre)]), [
    ['Vivienda', ['Alquiler', 'Electricidad']],
    ['Alimentación', ['Supermercado', 'Kiosco']],
    [null, ['Salud', 'Regalos']], // las hojas que están en la raíz van juntas al final
  ]);
});

test('HU-02 CA-1 · el buscador no distingue mayúsculas ni tildes y también busca por familia', () => {
  assert.equal(normalizarBusqueda('  Alimentación '), 'alimentacion');
  const opciones = [{ nombre: 'Supermercado', familia: 'Alimentación' }, { nombre: 'Alquiler', familia: 'Vivienda' }, { nombre: 'Salud', familia: null }];
  assert.deepEqual(filtrarOpciones(opciones, 'ALIMENTACION').map((o) => o.nombre), ['Supermercado']);
  assert.deepEqual(filtrarOpciones(opciones, 'al').map((o) => o.nombre), ['Supermercado', 'Alquiler', 'Salud'], '«al» está en Alimentación, Alquiler y Salud');
  assert.deepEqual(filtrarOpciones(opciones, 'alq').map((o) => o.nombre), ['Alquiler']);
  assert.deepEqual(filtrarOpciones(opciones, 'superm').map((o) => o.nombre), ['Supermercado']);
  assert.deepEqual(filtrarOpciones(opciones, '   ').map((o) => o.nombre), ['Supermercado', 'Alquiler', 'Salud'], 'sin texto, todas');
  assert.deepEqual(filtrarOpciones(opciones, 'zzz'), []);
});

test('HU-02 CA-2 · un egreso válido: monto en centavos, descripción con mayúscula inicial', () => {
  const { errores, datos } = validar({ descripcion: '  compra del mes ' });
  assert.deepEqual(errores, {});
  assert.deepEqual(datos, { fecha: HOY, montoTotal: 1250050, descripcion: 'Compra del mes', categoriaId: 'super', cuentaId: 'banco' });
});

test('HU-02 CA-2 · sin monto, con 0, negativo o ilegible: «Escribí un monto mayor que 0.»', () => {
  for (const monto of ['', '   ', '0', '0,00', '-500', 'abc', '12,345', '1.2.3']) {
    assert.deepEqual(validar({ monto }).errores, { monto: 'Escribí un monto mayor que 0.' }, `«${monto}»`);
  }
  assert.deepEqual(validar({ monto: '99999999999999999' }).errores, { monto: 'Escribí un monto mayor que 0.' }, 'más de lo que cabe en un entero exacto');
  assert.deepEqual(validar({ monto: '0,01' }).errores, {}, 'un centavo vale');
});

test('HU-02 CA-2 · sin categoría o sin cuenta: cada campo con su mensaje', () => {
  assert.deepEqual(validar({ categoriaId: null, cuentaId: null, monto: '' }).errores, {
    monto: 'Escribí un monto mayor que 0.', categoria: 'Elegí una categoría.', cuenta: 'Elegí una cuenta.',
  });
});

test('HU-02 CA-2 · la categoría tiene que ser una hoja activa de egresos y la cuenta, activa (INV-03)', () => {
  for (const categoriaId of ['vivienda', 'trabajo', 'viejo', 'no-existe']) assert.equal(validar({ categoriaId }).errores.categoria, 'Elegí una categoría.', categoriaId);
  for (const cuentaId of ['vieja', 'no-existe']) assert.equal(validar({ cuentaId }).errores.cuenta, 'Elegí una cuenta.', cuentaId);
});

test('HU-02 CA-1 · la fecha no puede ser posterior a hoy ni inválida', () => {
  assert.equal(validar({ fecha: '2026-11-01' }).errores.fecha, 'La fecha no puede ser posterior a hoy.');
  assert.equal(validar({ fecha: '2026-02-30' }).errores.fecha, 'Elegí una fecha válida.');
  assert.equal(validar({ fecha: '' }).errores.fecha, 'Elegí una fecha válida.');
  assert.deepEqual(validar({ fecha: '2026-10-30' }).errores, {});
});

test('HU-02 CA-2 · la fecha no puede ser anterior al saldo inicial de la cuenta (INV-16)', () => {
  assert.equal(validar({ cuentaId: 'dolares', fecha: '2026-10-14' }).errores.fecha, 'La cuenta Dólares empieza el 15/10/2026: elegí esa fecha o una posterior.');
  assert.deepEqual(validar({ cuentaId: 'dolares', fecha: '2026-10-15' }).errores, {}, 'el mismo día ya cuenta');
});

test('HU-02 CA-2 · el egreso es un Movimiento con una parte, asiento −monto y partida doble', () => {
  const { datos } = validar({ descripcion: 'compra' });
  const contexto = { monedaDeCuenta: () => 'ARS' };
  const m = crearEgreso(datos, { id: 'mov-1', cuenta: CUENTAS[0], categoria: CATEGORIAS.find((x) => x.id === 'kiosco') });
  assert.equal(m.tipo, 'egreso');
  assert.equal(m.estado, 'confirmado');
  assert.equal(m.origen, 'manual');
  assert.equal(m.monedaId, 'ARS');
  assert.equal(m.montoTotal, 1250050);
  assert.equal(m.descripcion, 'Compra');
  assert.equal(m.revisarCategoria, false);
  assert.deepEqual(m.asientos, [{ cuentaId: 'banco', monto: -1250050 }]);
  // La parte copia la clasificación de la categoría (RN-17).
  assert.deepEqual(m.partes, [{ categoriaId: 'kiosco', monto: 1250050, fijoVariable: 'variable', necesidadDeseo: 'deseo', hormiga: true }]);
  assert.deepEqual(verificarPartidaDoble(m, contexto), []);
});

test('HU-02 CA-2 · el saldo baja con el egreso: 800.000,00 − 12.500,50 = 787.499,50', () => {
  const m = crearEgreso(validar().datos, { id: 'mov-1', cuenta: CUENTAS[0], categoria: CATEGORIAS.find((x) => x.id === 'super') });
  assert.equal(saldo(CUENTAS[0], HOY, []), 80000000);
  assert.equal(saldo(CUENTAS[0], HOY, [m]), 78749950);
  assert.equal(saldo(CUENTAS[2], HOY, [m]), 50000, 'las otras cuentas no cambian');
});
