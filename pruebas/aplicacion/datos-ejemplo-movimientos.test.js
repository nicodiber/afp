// HU-38: los datos de ejemplo traen categorías de ingresos y movimientos de agosto a octubre de 2026. Los valores esperados
// están escritos a mano (los saldos, con una cuenta hecha aparte a partir del plan de los datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearCasosMovimientos } from '../../src/aplicacion/movimientos.js';
import { crearCasosCuentas } from '../../src/aplicacion/cuentas.js';
import { crearCasosCategorias } from '../../src/aplicacion/categorias.js';
import { crearCasosDatosEjemplo } from '../../src/aplicacion/datos-ejemplo.js';
import { armarMovimientosDeEjemplo, hojasDeEgreso } from '../../src/dominio/movimientos.js';
import { verificarPartidaDoble } from '../../src/dominio/partida-doble.js';
import { esFamilia } from '../../src/dominio/categorias.js';

const datos = JSON.parse(await readFile(new URL('../../datos-demo/datos-ejemplo.json', import.meta.url), 'utf8'));
const compactos = datos.movimientosDeEjemplo;
const HOY = '2026-10-31';

function almacenEnMemoria() {
  const base = { cuentas: [], monedas: [], categorias: [], ubicacionesCategoria: [], movimientos: [] };
  return {
    datos: base,
    listar: async (nombre) => structuredClone(base[nombre]),
    guardar: async (nombre, registros) => {
      for (const r of [].concat(registros)) {
        const i = base[nombre].findIndex((x) => x.id === r.id);
        if (i >= 0) base[nombre][i] = structuredClone(r); else base[nombre].push(structuredClone(r));
      }
    },
    borrar: async (nombre, id) => { base[nombre] = base[nombre].filter((x) => x.id !== id); },
    reemplazar: async (nuevos) => { for (const [nombre, lista] of Object.entries(nuevos)) base[nombre] = structuredClone(lista); },
  };
}
async function armar() {
  const almacen = almacenEnMemoria();
  const reloj = { hoy: () => HOY };
  let n = 0;
  const nuevoId = (prefijo = 'x') => `${prefijo}-${++n}`;
  const guardados = { lista: () => [] };
  const cuentas = crearCasosCuentas({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista(), movimientosEnMemoria: () => guardados.lista() });
  const categorias = crearCasosCategorias({ almacen, reloj, nuevoId, movimientos: async () => guardados.lista() });
  const movimientos = crearCasosMovimientos({ almacen, reloj, nuevoId, cuentas, categorias });
  guardados.lista = movimientos.todos;
  const ejemplo = crearCasosDatosEjemplo({ almacen, recargar: [cuentas.recargar, categorias.recargar, movimientos.recargar] });
  return { almacen, cuentas, categorias, movimientos, ejemplo };
}

test('HU-38 CA-1 · categorías de ingresos nuevas, con íconos únicos y su naturaleza', () => {
  const por = (nombre) => datos.categorias.find((c) => c.nombre === nombre);
  const esperadas = [['Sueldo', 'ganado'], ['Encargos', 'ganado'], ['Clases', 'ganado'], ['Ayuda familiar', 'aporte_terceros'], ['Regalos y Reintegros', 'otro']];
  for (const [nombre, naturaleza] of esperadas) {
    assert.equal(por(nombre).tipo, 'ingreso', nombre);
    assert.equal(por(nombre).naturaleza, naturaleza, nombre);
  }
  const familia = por('Trabajos independientes');
  assert.deepEqual([familia.tipo, familia.padreId, familia.naturaleza], ['ingreso', null, null]);
  assert.deepEqual(datos.categorias.filter((c) => c.padreId === familia.id).map((c) => c.nombre).sort(), ['Clases', 'Encargos']);
  const claves = datos.categorias.map((c) => c.emoji.replaceAll('️', ''));
  assert.equal(new Set(claves).size, datos.categorias.length, 'ningún ícono se repite');
});

test('HU-38 CA-1 · unos 60 movimientos ficticios de agosto al 31/10/2026, con hora y sin datos personales', () => {
  assert.equal(compactos.length, 61);
  assert.equal(new Set(compactos.map((m) => m.id)).size, 61, 'ids únicos');
  for (const m of compactos) {
    assert.ok(m.fecha >= '2026-08-01' && m.fecha <= HOY, `${m.id} dentro del período: ${m.fecha}`);
    assert.match(m.hora, /^([01]\d|2[0-3]):[0-5]\d$/, `${m.id} tiene hora`);
    assert.ok(m.descripcion && m.descripcion.length <= 120, m.id);
    assert.equal(m.origen, 'datos_ejemplo');
  }
  const montos = new Set(compactos.map((m) => m.monto));
  assert.ok(montos.size >= 40, `montos variados (${montos.size})`);
  const descripciones = new Set(compactos.map((m) => m.descripcion));
  for (const genericas of ['Compra semanal', 'Abono mensual']) assert.ok(descripciones.has(genericas), genericas);
});

test('HU-38 CA-1 · sueldo mensual, trabajos independientes, un regalo y egresos en varias hojas (varias de Alimentación)', () => {
  const nombreDe = (id) => datos.categorias.find((c) => c.id === id).nombre;
  const ingresos = compactos.filter((m) => m.tipo === 'ingreso');
  const de = (nombre) => ingresos.filter((m) => nombreDe(m.categoriaId) === nombre);
  assert.deepEqual(de('Sueldo').map((m) => m.fecha.slice(0, 7)), ['2026-08', '2026-09', '2026-10']);
  assert.ok(de('Encargos').length + de('Clases').length >= 3, 'algunos trabajos independientes');
  assert.equal(de('Regalos y Reintegros').length, 1);
  assert.equal(ingresos.length, 9);
  const hojasEgreso = new Set(compactos.filter((m) => m.tipo === 'egreso').map((m) => nombreDe(m.categoriaId)));
  assert.ok(hojasEgreso.size >= 8, `hojas de egreso usadas: ${[...hojasEgreso]}`);
  for (const alimentacion of ['Supermercado', 'Verdulería', 'Kiosco']) assert.ok(hojasEgreso.has(alimentacion), alimentacion);
  const cuentasUsadas = new Set(compactos.map((m) => m.cuentaId));
  assert.ok(cuentasUsadas.size >= 5, 'repartidos entre las cuentas');
  for (const id of cuentasUsadas) assert.equal(datos.cuentas.find((c) => c.id === id).monedaId, 'ARS', `${id} está en pesos`);
});

test('HU-38 CA-3 · todos pasan la partida doble, usan hojas activas y cuentas que existen', () => {
  const armados = armarMovimientosDeEjemplo(compactos, { cuentas: datos.cuentas, categorias: datos.categorias });
  assert.equal(armados.length, 61);
  const moneda = (id) => datos.cuentas.find((c) => c.id === id).monedaId;
  for (const m of armados) {
    assert.deepEqual(verificarPartidaDoble(m, { monedaDeCuenta: moneda }), [], m.id);
    assert.equal(m.estado, 'confirmado');
    assert.ok(datos.cuentas.some((c) => c.id === m.cuentaId && c.estado === 'activa'), `${m.id}: cuenta`);
    const categoria = datos.categorias.find((c) => c.id === m.partes[0].categoriaId);
    assert.ok(categoria.estado === 'activa' && !esFamilia(datos.categorias, categoria.id), `${m.id}: hoja activa`);
    assert.equal(categoria.tipo, m.tipo);
    assert.ok(m.fecha >= datos.cuentas.find((c) => c.id === m.cuentaId).fechaSaldoInicial, `${m.id}: no es anterior al saldo inicial de su cuenta`);
  }
  assert.ok(hojasDeEgreso(datos.categorias).length > 0);
  // Una cuenta o una categoría que no existen, o una familia, se rechazan.
  const malo = (cambio) => () => armarMovimientosDeEjemplo([{ ...compactos[0], ...cambio }], { cuentas: datos.cuentas, categorias: datos.categorias });
  assert.throws(malo({ cuentaId: 'cue-nada' }), /cuenta/);
  assert.throws(malo({ categoriaId: 'cat-nada' }), /categoría/);
  assert.throws(malo({ categoriaId: 'cat-trabajos-independientes' }), /categoría/);
  assert.throws(malo({ monto: 0 }), /monto/);
});

test('HU-38 CA-3 · hay ingresos y egresos en agosto, septiembre y octubre', () => {
  for (const mes of ['2026-08', '2026-09', '2026-10']) {
    for (const tipo of ['ingreso', 'egreso']) {
      assert.ok(compactos.some((m) => m.tipo === tipo && m.fecha.startsWith(mes)), `${tipo} en ${mes}`);
    }
  }
});

test('HU-38 CA-2 · los saldos salen del saldo inicial más los movimientos y ninguna cuenta queda negativa', async () => {
  const { cuentas, movimientos, ejemplo } = await armar();
  await ejemplo.cargar(datos);
  assert.equal(movimientos.todos().length, 61);
  const saldoDe = (id) => cuentas.saldoDe(cuentas.buscar(id));
  // Saldos al 31/10/2026 calculados aparte (saldo inicial + ingresos − egresos), en centavos.
  assert.deepEqual(Object.fromEntries(datos.cuentas.map((c) => [c.id, saldoDe(c.id)])), {
    'cue-billetera': 1_290_000, 'cue-caja': 15_890_000, 'cue-banco': 241_120_000,
    'cue-billetera-virtual': 11_340_000, 'cue-dolares': 50_000, 'cue-tarjeta-transporte': 100_000,
  });
  // En ningún momento de agosto a octubre una cuenta queda en negativo.
  const corriente = Object.fromEntries(datos.cuentas.map((c) => [c.id, c.saldoInicial]));
  for (const m of movimientos.todos()) {
    for (const a of m.asientos) {
      corriente[a.cuentaId] += a.monto;
      assert.ok(corriente[a.cuentaId] >= 0, `${m.id}: ${a.cuentaId} quedó en ${corriente[a.cuentaId]}`);
    }
  }
});

test('HU-38 CA-2 · restablecer deja el mismo estado y borrar los datos de prueba borra también los movimientos', async () => {
  const { almacen, cuentas, categorias, movimientos, ejemplo } = await armar();
  await ejemplo.cargar(datos);
  const antes = structuredClone(almacen.datos);
  await movimientos.registrarEgreso({ fecha: HOY, monto: '1000', descripcion: 'otro', categoriaId: 'cat-kiosco', cuentaId: 'cue-billetera' });
  assert.equal(almacen.datos.movimientos.length, 62);
  await ejemplo.cargar(datos);
  assert.deepEqual(almacen.datos, antes, 'restablecer vuelve al mismo estado');
  assert.equal(movimientos.todos().length, 61);
  assert.equal(cuentas.saldoDe(cuentas.buscar('cue-billetera')), 1_290_000);
  assert.ok(categorias.buscar('cat-sueldo'));
  await ejemplo.borrar();
  assert.deepEqual([almacen.datos.movimientos.length, movimientos.hay(), cuentas.hayCuentas(), categorias.hayCategorias()], [0, false, false, false]);
});

test('HU-38 · si un movimiento de ejemplo no cumple las reglas, no se guarda nada', async () => {
  const { almacen, ejemplo } = await armar();
  const roto = { ...datos, movimientosDeEjemplo: [...compactos, { ...compactos[0], id: 'mov-ej-roto', cuentaId: 'cue-nada' }] };
  await assert.rejects(() => ejemplo.cargar(roto), /cuenta/);
  assert.deepEqual([almacen.datos.cuentas.length, almacen.datos.movimientos.length], [0, 0]);
});

test('HU-38 · la versión de los datos de ejemplo es 4', () => {
  assert.equal(datos.version, 4);
});
