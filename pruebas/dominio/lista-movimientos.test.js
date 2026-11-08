// HU-04: período, filtros, orden, búsqueda, totales y barras por categoría de la lista de movimientos. Valores
// esperados escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rangoDePeriodo, idsDeCategoria, filtrarMovimientos, totales, totalesPorMoneda, egresosPorCategoria, filaDeMovimiento, ordenarPorFechaYHora,
} from '../../src/dominio/lista-movimientos.js';

const HOY = '2026-10-31';
const c = (id, nombre, tipo, padreId, emoji = '') => ({ id, nombre, tipo, padreId, emoji, estado: 'activa', orden: 1 });
const CATEGORIAS = [
  c('vivienda', 'Vivienda', 'egreso', null, '🏠'), c('alquiler', 'Alquiler', 'egreso', 'vivienda', '🔑'), c('luz', 'Electricidad', 'egreso', 'vivienda', '💡'),
  c('alimentacion', 'Alimentación', 'egreso', null, '🍽️'), c('super', 'Supermercado', 'egreso', 'alimentacion', '🛒'),
  c('trabajo', 'Trabajo', 'ingreso', null, '💼'),
];
const POR_ID = new Map(CATEGORIAS.map((x) => [x.id, x]));
const CUENTAS_POR_ID = new Map([['banco', { id: 'banco', nombre: 'Banco' }], ['caja', { id: 'caja', nombre: 'Caja' }], ['usd', { id: 'usd', nombre: 'Dólares' }]]);
const mov = (id, tipo, fecha, hora, monto, categoriaId, cuentaId = 'banco', descripcion = '', monedaId = 'ARS') => ({
  id, tipo, fecha, hora, descripcion, estado: 'confirmado', cuentaId, monedaId, montoTotal: monto, partes: [{ categoriaId, monto }],
});
const MOVS = [
  mov('m1', 'egreso', '2026-10-31', '09:00', 1250000, 'alquiler', 'banco', 'Alquiler de octubre'),
  mov('m2', 'egreso', '2026-10-31', '18:30', 350000, 'super', 'caja', 'Compra del mes'),
  mov('m3', 'ingreso', '2026-10-05', '08:00', 15000000, 'trabajo', 'banco', 'Sueldo'),
  mov('m4', 'egreso', '2026-09-30', null, 80000, 'luz', 'banco'),
  mov('m5', 'egreso', '2026-09-10', '12:00', 420000, 'super', 'caja', 'Verdulería'),
  mov('m6', 'egreso', '2026-07-31', '23:59', 100000, 'super', 'caja'),
  mov('m7', 'egreso', '2026-08-01', '00:00', 90000, 'luz', 'banco'),
  mov('m8', 'egreso', '2025-12-31', '10:00', 50000, 'alquiler', 'banco'),
  mov('m9', 'egreso', '2026-10-12', '10:00', 2500, 'super', 'usd', 'Café', 'USD'),
];
const filtrar = (f) => filtrarMovimientos(MOVS, f, POR_ID).map((m) => m.id);

test('HU-04 CA-2 · períodos: este mes, mes anterior, últimos 3 meses, este año, todo y un mes elegido', () => {
  assert.deepEqual(rangoDePeriodo('este-mes', HOY), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoDePeriodo('mes-anterior', HOY), { desde: '2026-09-01', hasta: '2026-09-30' });
  assert.deepEqual(rangoDePeriodo('ultimos-3', HOY), { desde: '2026-08-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoDePeriodo('este-anio', HOY), { desde: '2026-01-01', hasta: '2026-12-31' });
  assert.deepEqual(rangoDePeriodo('todo', HOY), { desde: null, hasta: null });
  assert.deepEqual(rangoDePeriodo('mes', HOY, '2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rangoDePeriodo('mes', HOY, '2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' }, 'año bisiesto');
  assert.deepEqual(rangoDePeriodo('mes', HOY, ''), { desde: '2026-10-01', hasta: '2026-10-31' }, 'sin mes elegido, este mes');
});

test('HU-04 CA-2 · los períodos cruzan el cambio de año', () => {
  assert.deepEqual(rangoDePeriodo('mes-anterior', '2027-01-15'), { desde: '2026-12-01', hasta: '2026-12-31' });
  assert.deepEqual(rangoDePeriodo('ultimos-3', '2027-02-10'), { desde: '2026-12-01', hasta: '2027-02-28' });
});

test('HU-04 CA-1 · del más nuevo al más viejo por fecha y hora (sin hora, antes que las de ese día)', () => {
  const orden = ordenarPorFechaYHora(MOVS).map((m) => m.id);
  assert.deepEqual(orden, ['m2', 'm1', 'm9', 'm3', 'm4', 'm5', 'm7', 'm6', 'm8']);
  const mismoDia = [mov('a', 'egreso', '2026-10-01', '10:00', 1, 'super'), mov('b', 'egreso', '2026-10-01', '10:05', 1, 'super'), mov('c', 'egreso', '2026-10-01', null, 1, 'super')];
  assert.deepEqual(ordenarPorFechaYHora(mismoDia).map((m) => m.id), ['b', 'a', 'c']);
});

test('HU-04 CA-2 · filtro por período', () => {
  assert.deepEqual(filtrar({ ...rangoDePeriodo('este-mes', HOY) }), ['m2', 'm1', 'm9', 'm3']);
  assert.deepEqual(filtrar({ ...rangoDePeriodo('mes-anterior', HOY) }), ['m4', 'm5']);
  assert.deepEqual(filtrar({ ...rangoDePeriodo('ultimos-3', HOY) }), ['m2', 'm1', 'm9', 'm3', 'm4', 'm5', 'm7']);
  assert.deepEqual(filtrar({ ...rangoDePeriodo('este-anio', HOY) }), ['m2', 'm1', 'm9', 'm3', 'm4', 'm5', 'm7', 'm6']);
  assert.equal(filtrar({ ...rangoDePeriodo('todo', HOY) }).length, 9);
});

test('HU-04 CA-2 · filtro por tipo y por cuenta', () => {
  assert.deepEqual(filtrar({ tipo: 'ingreso' }), ['m3']);
  assert.deepEqual(filtrar({ tipo: 'egreso', cuentaId: 'caja' }), ['m2', 'm5', 'm6']);
  assert.deepEqual(filtrar({ cuentaId: 'usd' }), ['m9']);
  assert.equal(filtrar({ tipo: 'todos' }).length, 9);
});

test('HU-04 CA-2 · elegir una familia incluye sus subcategorías', () => {
  assert.deepEqual([...idsDeCategoria(CATEGORIAS, 'vivienda')].sort(), ['alquiler', 'luz', 'vivienda']);
  assert.deepEqual([...idsDeCategoria(CATEGORIAS, 'luz')], ['luz']);
  assert.deepEqual(filtrar({ categoriaIds: idsDeCategoria(CATEGORIAS, 'vivienda') }), ['m1', 'm4', 'm7', 'm8']);
  assert.deepEqual(filtrar({ categoriaIds: idsDeCategoria(CATEGORIAS, 'alquiler') }), ['m1', 'm8']);
});

test('HU-04 CA-2 · la búsqueda mira la descripción y la categoría, sin distinguir mayúsculas ni acentos', () => {
  assert.deepEqual(filtrar({ texto: 'VERDULERIA' }), ['m5']);
  assert.deepEqual(filtrar({ texto: 'cafe' }), ['m9'], 'Café, sin tilde');
  assert.deepEqual(filtrar({ texto: 'electricidad' }), ['m4', 'm7'], 'por el nombre de la categoría');
  assert.deepEqual(filtrar({ texto: '  ALIMENTACION ' }), [], 'el nombre de la familia no se busca: solo el de la categoría del movimiento');
  assert.deepEqual(filtrar({ texto: 'super' }), ['m2', 'm9', 'm5', 'm6'], 'Supermercado, por categoría');
  assert.deepEqual(filtrar({ texto: 'zzz' }), []);
});

test('HU-04 CA-2 · los filtros se combinan', () => {
  assert.deepEqual(filtrar({ ...rangoDePeriodo('este-mes', HOY), tipo: 'egreso', cuentaId: 'banco' }), ['m1']);
  assert.deepEqual(filtrar({ ...rangoDePeriodo('ultimos-3', HOY), categoriaIds: idsDeCategoria(CATEGORIAS, 'vivienda'), texto: 'electri' }), ['m4', 'm7']);
});

test('HU-04 CA-2 · totales en centavos: ingresos, egresos y diferencia', () => {
  const del = (ids) => MOVS.filter((m) => ids.includes(m.id));
  assert.deepEqual(totales(del(['m1', 'm2', 'm3'])), { ingresos: 15000000, egresos: 1600000, diferencia: 13400000 });
  assert.deepEqual(totales(del(['m1'])), { ingresos: 0, egresos: 1250000, diferencia: -1250000 });
  assert.deepEqual(totales([]), { ingresos: 0, egresos: 0, diferencia: 0 });
});

test('HU-04 CA-2 · los totales no mezclan monedas: uno por moneda, ARS primero', () => {
  assert.deepEqual(totalesPorMoneda(MOVS.filter((m) => ['m9', 'm3', 'm1'].includes(m.id))), [
    { monedaId: 'ARS', ingresos: 15000000, egresos: 1250000, diferencia: 13750000 },
    { monedaId: 'USD', ingresos: 0, egresos: 2500, diferencia: -2500 },
  ]);
  assert.deepEqual(totalesPorMoneda([]), []);
});

test('HU-04 CA-2 · egresos por categoría hoja, de mayor a menor', () => {
  const barras = egresosPorCategoria(MOVS, POR_ID).map((b) => [b.categoriaId, b.monto, b.emoji]);
  assert.deepEqual(barras, [['alquiler', 1300000, '🔑'], ['super', 870000, '🛒'], ['luz', 170000, '💡']], 'sin ingresos ni dólares');
  assert.deepEqual(egresosPorCategoria(MOVS, POR_ID, 'USD').map((b) => [b.categoriaId, b.monto]), [['super', 2500]]);
  assert.deepEqual(egresosPorCategoria([MOVS[2]], POR_ID), []);
  // A igualdad de monto, por nombre.
  const iguales = [mov('x', 'egreso', HOY, null, 500, 'super'), mov('y', 'egreso', HOY, null, 500, 'alquiler')];
  assert.deepEqual(egresosPorCategoria(iguales, POR_ID).map((b) => b.categoriaId), ['alquiler', 'super']);
});

test('HU-04 CA-1 · la fila: ícono, descripción (o la categoría), «fecha · hora · categoría · cuenta» y monto con signo', () => {
  const contexto = { categoriasPorId: POR_ID, cuentasPorId: CUENTAS_POR_ID };
  assert.deepEqual(filaDeMovimiento(MOVS[0], contexto), {
    id: 'm1', emoji: '🔑', titulo: 'Alquiler de octubre', detalle: '31/10/2026 · 09:00 · Alquiler · Banco', monto: -1250000, tipo: 'egreso', monedaId: 'ARS',
  });
  const sinDescripcion = filaDeMovimiento(MOVS[2], contexto);
  assert.deepEqual([sinDescripcion.titulo, sinDescripcion.monto, sinDescripcion.tipo], ['Sueldo', 15000000, 'ingreso']);
  const sinTexto = filaDeMovimiento(MOVS[3], contexto);
  assert.equal(sinTexto.titulo, 'Electricidad', 'sin descripción, el nombre de la categoría');
  assert.equal(sinTexto.detalle, '30/09/2026 · Electricidad · Banco', 'sin hora, se omite');
});

test('HU-04 CA-3 · con 500 movimientos, filtrar y calcular los totales tarda menos de 200 ms', () => {
  const muchos = Array.from({ length: 500 }, (_, i) => mov(`p${i}`, i % 5 === 0 ? 'ingreso' : 'egreso', `2026-${String(1 + (i % 10)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
    `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, 1000 + i, ['alquiler', 'super', 'luz', 'trabajo'][i % 4], i % 2 ? 'banco' : 'caja', `Movimiento número ${i} de prueba`));
  const filtros = { texto: 'MOVIMIENTO número', desde: '2026-01-01', hasta: '2026-12-31', tipo: 'todos', categoriaIds: idsDeCategoria(CATEGORIAS, 'vivienda'), cuentaId: null };
  const t0 = performance.now();
  const lista = filtrarMovimientos(muchos, filtros, POR_ID);
  const t = totalesPorMoneda(lista);
  const barras = egresosPorCategoria(lista, POR_ID);
  const ms = performance.now() - t0;
  assert.ok(lista.length > 0 && t.length === 1 && barras.length > 0);
  assert.ok(ms < 200, `tardó ${ms.toFixed(1)} ms`);
});
