// aep#8: núcleo de partida doble (RF-MOV-02, RN-01, INV-01) y saldos (RN-02).
// Valores esperados: tabla 3.7.4 del modelo de datos (escritos a mano) y roadmap §5.6 (script independiente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_MOVIMIENTO, crearMovimiento, verificarPartidaDoble, saldo } from '../../src/dominio/partida-doble.js';
import { datos, traducir, monedaDe } from '../apoyo/datos-ejemplo.mjs';

// Cuentas de préstamo y deuda: una por persona y moneda (modelo §3.4).
const cuentaDePersona = (personaId, tipo, moneda) => `${tipo}:${personaId}:${moneda}`;
const MONEDA = { banco: 'ARS', caja: 'ARS', dolares: 'USD', 'billetera-virtual': 'ARS', billetera: 'ARS' };
const contexto = { cuentaDePersona, monedaDeCuenta: (id) => MONEDA[id] ?? id.split(':')[2] };
const p = (monto, categoriaId = 'cat') => ({ categoriaId, monto });

test('aep#8 CA-1 · los 11 tipos generan los asientos de la tabla 3.7.4', () => {
  assert.equal(TIPOS_MOVIMIENTO.length, 11);
  const casos = [
    [{ tipo: 'ingreso', cuentaId: 'banco', montoTotal: 90000, partes: [p(90000)] }, [['banco', 90000]]],
    [{ tipo: 'egreso', cuentaId: 'banco', montoTotal: 1000, partes: [p(400), p(600)] }, [['banco', -1000]]],
    [{ tipo: 'transferencia', cuentaId: 'caja', cuentaDestinoId: 'billetera', montoTotal: 5000 }, [['caja', -5000], ['billetera', 5000]]],
    [{ tipo: 'cambio_moneda', cuentaId: 'banco', cuentaDestinoId: 'dolares', montoTotal: 14500000, montoRecibido: 10000 }, [['banco', -14500000], ['dolares', 10000]]],
    [{ tipo: 'pagado_por_terceros', monedaId: 'ARS', montoTotal: 3000, partes: [p(3000)] }, []],
    [{ tipo: 'gasto_compartido', cuentaId: 'billetera-virtual', montoTotal: 4000000, partes: [p(1000000)],
      deudores: [{ personaId: 'Ana', monto: 1000000 }, { personaId: 'Beto', monto: 1000000 }, { personaId: 'Caro', monto: 1000000 }] },
    [['billetera-virtual', -4000000], ['prestamo_a_cobrar:Ana:ARS', 1000000], ['prestamo_a_cobrar:Beto:ARS', 1000000], ['prestamo_a_cobrar:Caro:ARS', 1000000]]],
    [{ tipo: 'prestamo_otorgado', cuentaId: 'caja', personaId: 'Juan', montoTotal: 2000000 }, [['caja', -2000000], ['prestamo_a_cobrar:Juan:ARS', 2000000]]],
    [{ tipo: 'cobro_prestamo', cuentaId: 'billetera', personaId: 'Juan', montoTotal: 1200, partes: [p(200, 'Intereses')] }, [['billetera', 1200], ['prestamo_a_cobrar:Juan:ARS', -1000]]],
    [{ tipo: 'prestamo_recibido', cuentaId: 'banco', personaId: 'Luz', montoTotal: 5000 }, [['banco', 5000], ['deuda:Luz:ARS', -5000]]],
    [{ tipo: 'pago_deuda', cuentaId: 'banco', personaId: 'Luz', montoTotal: 5300, partes: [p(300, 'Intereses')] }, [['banco', -5300], ['deuda:Luz:ARS', 5000]]],
    [{ tipo: 'devolucion', cuentaId: 'banco', montoTotal: 700, partes: [p(700)] }, [['banco', 700]]],
  ];
  assert.deepEqual(casos.map(([m]) => m.tipo).sort(), [...TIPOS_MOVIMIENTO].sort(), 'un caso por tipo');
  for (const [datosMovimiento, esperado] of casos) {
    const m = crearMovimiento({ fecha: '2026-10-31', estado: 'confirmado', ...datosMovimiento }, contexto);
    assert.deepEqual(m.asientos.map((a) => [a.cuentaId, a.monto]), esperado, datosMovimiento.tipo);
  }
});

// Generador de números al azar con semilla fija (mulberry32): la prueba da siempre lo mismo.
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('aep#8 CA-2 · 1.000 movimientos al azar de los 11 tipos cumplen RN-01', () => {
  const r = azar(20261022);
  const entero = (min, max) => min + Math.floor(r() * (max - min + 1));
  const partes = (total) => {
    const n = entero(1, 4); const res = []; let resto = total;
    for (let i = 1; i < n && resto > 1; i += 1) { const v = entero(1, resto - 1); res.push(p(v)); resto -= v; }
    res.push(p(resto)); return res;
  };
  const cuentas = ['banco', 'caja', 'billetera'];
  const vistos = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const tipo = TIPOS_MOVIMIENTO[i % TIPOS_MOVIMIENTO.length];
    const m = entero(2, 100000000);
    const cuentaId = cuentas[entero(0, 2)];
    const persona = ['Ana', 'Beto', 'Juan'][entero(0, 2)];
    const datosMovimiento = {
      ingreso: { cuentaId, montoTotal: m, partes: partes(m) },
      egreso: { cuentaId, montoTotal: m, partes: partes(m) },
      devolucion: { cuentaId, montoTotal: m, partes: partes(m) },
      transferencia: { cuentaId: 'banco', cuentaDestinoId: 'caja', montoTotal: m },
      cambio_moneda: { cuentaId: 'banco', cuentaDestinoId: 'dolares', montoTotal: m, montoRecibido: entero(1, 1000000) },
      pagado_por_terceros: { monedaId: 'ARS', montoTotal: m, partes: partes(m) },
      gasto_compartido: (() => { const mia = entero(1, m - 1); return { cuentaId, montoTotal: m, partes: partes(mia), deudores: [{ personaId: persona, monto: m - mia }] }; })(),
      prestamo_otorgado: { cuentaId, personaId: persona, montoTotal: m },
      prestamo_recibido: { cuentaId, personaId: persona, montoTotal: m },
      cobro_prestamo: (() => { const ex = entero(0, m - 1); return { cuentaId, personaId: persona, montoTotal: m, partes: ex ? [p(ex)] : [] }; })(),
      pago_deuda: (() => { const ex = entero(0, m - 1); return { cuentaId, personaId: persona, montoTotal: m, partes: ex ? [p(ex)] : [] }; })(),
    }[tipo];
    const mov = crearMovimiento({ fecha: '2026-10-31', estado: 'confirmado', tipo, ...datosMovimiento }, contexto);
    assert.deepEqual(verificarPartidaDoble(mov, contexto), [], `${i} ${tipo}`);
    vistos.add(tipo);
  }
  assert.equal(vistos.size, 11);
});

test('aep#8 CA-3 · un movimiento que no cuadra se rechaza con el detalle', () => {
  assert.throws(
    () => crearMovimiento({ id: 'X1', fecha: '2026-10-31', estado: 'confirmado', tipo: 'egreso', cuentaId: 'banco', montoTotal: 100000, partes: [p(90000)] }, contexto),
    (e) => e.name === 'ErrorPartidaDoble' && /X1/.test(e.message) && /10000/.test(e.message),
  );
  // Y asientos alterados después de crearlo también se detectan.
  const m = crearMovimiento({ id: 'X2', fecha: '2026-10-31', estado: 'confirmado', tipo: 'transferencia', cuentaId: 'caja', cuentaDestinoId: 'billetera', montoTotal: 5000 }, contexto);
  m.asientos[1].monto = 4999;
  assert.equal(verificarPartidaDoble(m, contexto).length, 1);
});

const movimientos = datos.movimientos.map((m) => crearMovimiento(traducir(m), { cuentaDePersona, monedaDeCuenta: (id) => monedaDe[id] ?? id.split(':')[2] }));
const cuentas = datos.cuentas.map((c) => ({ id: c.id, saldoInicial: c.saldoInicial }));
const saldos = (fecha) => Object.fromEntries(cuentas.map((c) => [c.id, saldo(c, fecha, movimientos)]));

test('aep#8 CA-4 · saldos de los datos de ejemplo (roadmap §5.6)', () => {
  assert.deepEqual(saldos('2026-09-30'), { 'cue-billetera': 1200000, 'cue-caja': 20000000, 'cue-banco': 130500000, 'cue-billetera-virtual': 39000000, 'cue-dolares': 50000, 'cue-tarjeta-transporte': 1500000 });
  assert.deepEqual(saldos('2026-10-31'), { 'cue-billetera': 4850000, 'cue-caja': 17000000, 'cue-banco': 169300000, 'cue-billetera-virtual': 43500000, 'cue-dolares': 60000, 'cue-tarjeta-transporte': 300000 });
});

test('aep#8 CA-5 · quién me debe al 31/10/2026 (roadmap §5.6)', () => {
  const debe = {};
  for (const persona of ['Ana', 'Beto', 'Caro', 'Juan']) debe[persona] = saldo({ id: cuentaDePersona(persona, 'prestamo_a_cobrar', 'ARS'), saldoInicial: 0 }, '2026-10-31', movimientos);
  assert.deepEqual(debe, { Ana: 1000000, Beto: 1000000, Caro: 1000000, Juan: 1500000 });
  assert.equal(Object.values(debe).reduce((s, v) => s + v, 0), 4500000);
});

test('aep#8 CA-6 · pendientes de revisión y en papelera no suman', () => {
  const noConfirmados = movimientos.filter((m) => m.estado !== 'confirmado');
  assert.equal(noConfirmados.length, 2, 'M34 y M35 de los datos de ejemplo');
  const cuenta = noConfirmados[0].asientos[0].cuentaId;
  const sin = saldo({ id: cuenta, saldoInicial: 0 }, '2026-10-31', movimientos.filter((m) => m.estado === 'confirmado'));
  assert.equal(saldo({ id: cuenta, saldoInicial: 0 }, '2026-10-31', movimientos), sin);
});
