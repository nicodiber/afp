// HU-03: reglas de la carga de un ingreso simple (RF-MOV-01, modelo de datos §3.7.4). Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarIngreso, validarEgreso, crearIngreso, hojasDeTipo, categoriasAgrupadas, nivelDeCategorias,
} from '../../src/dominio/movimientos.js';
import { saldo, verificarPartidaDoble } from '../../src/dominio/partida-doble.js';

const HOY = '2026-10-31';
const c = (id, nombre, tipo, padreId, orden, extra = {}) => ({ id, nombre, tipo, padreId, orden, emoji: '', estado: 'activa', ...extra });
const CATEGORIAS = [
  c('trabajo', 'Trabajo', 'ingreso', null, 1, { emoji: '💼', naturaleza: 'ganado' }),
  c('ventas', 'Ventas', 'ingreso', null, 2, { naturaleza: 'ganado' }),
  c('aporte', 'Aportes', 'ingreso', null, 3),
  c('familiar', 'Aporte familiar', 'ingreso', 'aporte', 4, { naturaleza: 'aporte_terceros' }),
  c('viejo', 'Premio', 'ingreso', 'aporte', 5, { naturaleza: 'otro', estado: 'archivada' }),
  c('alquiler', 'Alquiler', 'egreso', null, 6, { fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false }),
];
const CUENTAS = [
  { id: 'banco', nombre: 'Banco', monedaId: 'ARS', saldoInicial: 80000000, fechaSaldoInicial: '2026-09-01', estado: 'activa', orden: 1 },
  { id: 'vieja', nombre: 'Vieja', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-09-01', estado: 'archivada', orden: 2 },
];
const form = (cambios = {}) => ({ fecha: HOY, monto: '150.000', descripcion: '', categoriaId: 'trabajo', cuentaId: 'banco', ...cambios });
const validar = (cambios) => validarIngreso(form(cambios), { cuentas: CUENTAS, categorias: CATEGORIAS, hoy: HOY });

test('HU-03 CA-1 · las categorías para cargar un ingreso son las hojas activas de ingresos, por niveles', () => {
  assert.deepEqual(hojasDeTipo(CATEGORIAS, 'ingreso').map((x) => x.id), ['trabajo', 'ventas', 'familiar']);
  assert.deepEqual(categoriasAgrupadas(CATEGORIAS, 'ingreso').map((g) => [g.familia?.nombre ?? null, g.categorias.map((x) => x.nombre)]), [
    ['Aportes', ['Aporte familiar']],
    [null, ['Trabajo', 'Ventas']],
  ]);
  assert.deepEqual(nivelDeCategorias(CATEGORIAS, null, 'ingreso').map((x) => [x.nombre, x.emoji, x.esFamilia]), [
    ['Trabajo', '💼', false], ['Ventas', '', false], ['Aportes', '', true],
  ]);
  assert.deepEqual(nivelDeCategorias(CATEGORIAS, 'aporte', 'ingreso').map((x) => x.nombre), ['Aporte familiar'], 'sin la archivada');
});

test('HU-03 CA-3 · una categoría de egreso no vale para un ingreso (ni al revés)', () => {
  assert.equal(validar({ categoriaId: 'alquiler' }).errores.categoria, 'Elegí una categoría.');
  assert.equal(validarEgreso(form({ categoriaId: 'trabajo' }), { cuentas: CUENTAS, categorias: CATEGORIAS, hoy: HOY }).errores.categoria, 'Elegí una categoría.');
  assert.equal(validar({ categoriaId: 'aporte' }).errores.categoria, 'Elegí una categoría.', 'una familia no se elige');
});

test('HU-03 CA-3 · mismas validaciones que el egreso', () => {
  assert.deepEqual(validar().errores, {});
  assert.equal(validar({ monto: '0' }).errores.monto, 'Escribí un monto mayor que 0.');
  assert.equal(validar({ fecha: '2026-11-01' }).errores.fecha, 'La fecha no puede ser posterior a hoy.');
  assert.equal(validar({ cuentaId: 'vieja' }).errores.cuenta, 'Elegí una cuenta.');
  assert.equal(validar({ hora: '25:00' }).errores.hora, 'Escribí una hora válida (por ejemplo 18:30) o dejala vacía.');
  assert.equal(validar({ fecha: '2026-08-15' }).datos.adelantaInicio, true, 'fecha anterior al saldo inicial: adelanta el inicio');
});

test('HU-03 CA-3 · un ingreso queda como movimiento tipo ingreso con una parte y su naturaleza; el saldo sube', () => {
  const datos = validar({ descripcion: ' sueldo de octubre', hora: '09:15' }).datos;
  assert.equal(datos.montoTotal, 15000000);
  const m = crearIngreso(datos, { id: 'mov-1', cuenta: CUENTAS[0], categoria: CATEGORIAS[0] });
  assert.deepEqual(
    [m.tipo, m.estado, m.origen, m.fecha, m.hora, m.descripcion, m.montoTotal, m.monedaId, m.asientos],
    ['ingreso', 'confirmado', 'manual', HOY, '09:15', 'Sueldo de octubre', 15000000, 'ARS', [{ cuentaId: 'banco', monto: 15000000 }]],
  );
  assert.deepEqual(m.partes, [{ categoriaId: 'trabajo', monto: 15000000, naturaleza: 'ganado' }]);
  assert.deepEqual(verificarPartidaDoble(m, { monedaDeCuenta: () => 'ARS' }), []);
  assert.equal(saldo(CUENTAS[0], HOY, [m]), 80000000 + 15000000, 'el saldo sube: 800.000,00 + 150.000,00 = 950.000,00');
  const aporte = crearIngreso(validar({ categoriaId: 'familiar' }).datos, { id: 'mov-2', cuenta: CUENTAS[0], categoria: CATEGORIAS[3] });
  assert.equal(aporte.partes[0].naturaleza, 'aporte_terceros');
});
