// Núcleo de partida doble (RF-MOV-02, RN-01, INV-01) y saldos (RN-02). aep#8.
// Asientos de cada tipo según la tabla 3.7.4 del modelo de datos. Solo enteros (centavos).

export const TIPOS_MOVIMIENTO = Object.freeze([
  'ingreso', 'egreso', 'transferencia', 'cambio_moneda', 'pagado_por_terceros', 'gasto_compartido',
  'prestamo_otorgado', 'cobro_prestamo', 'prestamo_recibido', 'pago_deuda', 'devolucion',
]);

/** Error de un movimiento que no cumple RN-01: no se guarda (RF-MOV-02, excepciones). */
export class ErrorPartidaDoble extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'ErrorPartidaDoble'; }
}

// Efecto de las partes en RN-01: las de ingreso valen −monto; las de egreso, +monto; las de devolución, −monto.
const SIGNO_PARTES = {
  ingreso: -1, egreso: 1, devolucion: -1, pagado_por_terceros: 1, gasto_compartido: 1, cobro_prestamo: -1, pago_deuda: 1,
};
const suma = (lista) => (lista ?? []).reduce((s, x) => s + x.monto, 0);

function asientosDe(m, { cuentaDePersona, monedaDeCuenta }) {
  const c = m.cuentaId;
  const total = m.montoTotal;
  const excedente = suma(m.partes);
  const prestamo = (tipo) => cuentaDePersona(m.personaId, tipo, monedaDeCuenta(c));
  switch (m.tipo) {
    case 'ingreso': case 'devolucion': return [{ cuentaId: c, monto: total }];
    case 'egreso': return [{ cuentaId: c, monto: -total }];
    case 'transferencia': return [{ cuentaId: c, monto: -total }, { cuentaId: m.cuentaDestinoId, monto: total }];
    case 'cambio_moneda': return [{ cuentaId: c, monto: -total }, { cuentaId: m.cuentaDestinoId, monto: m.montoRecibido }];
    case 'pagado_por_terceros': return [];
    case 'gasto_compartido':
      return [{ cuentaId: c, monto: -total }, ...m.deudores.map((d) => ({ cuentaId: cuentaDePersona(d.personaId, 'prestamo_a_cobrar', monedaDeCuenta(c)), monto: d.monto }))];
    case 'prestamo_otorgado': return [{ cuentaId: c, monto: -total }, { cuentaId: prestamo('prestamo_a_cobrar'), monto: total }];
    case 'cobro_prestamo': return [{ cuentaId: c, monto: total }, { cuentaId: prestamo('prestamo_a_cobrar'), monto: -(total - excedente) }];
    case 'prestamo_recibido': return [{ cuentaId: c, monto: total }, { cuentaId: prestamo('deuda'), monto: -total }];
    case 'pago_deuda': return [{ cuentaId: c, monto: -total }, { cuentaId: prestamo('deuda'), monto: total - excedente }];
    default: throw new ErrorPartidaDoble(`Tipo de movimiento desconocido: ${m.tipo}`);
  }
}

/**
 * Lista de problemas de partida doble de un movimiento (vacía si cumple RN-01).
 * contexto.monedaDeCuenta(cuentaId) da la moneda de cada cuenta.
 */
export function verificarPartidaDoble(m, { monedaDeCuenta }) {
  const problemas = [];
  const nombre = m.id ?? m.tipo;
  if (m.asientos.some((a) => !Number.isInteger(a.monto) || a.monto === 0)) problemas.push(`${nombre}: hay un asiento en 0 o con decimales`);
  if (m.tipo === 'cambio_moneda') {
    // Excepción de RN-01: un asiento por moneda.
    const monedas = new Set(m.asientos.map((a) => monedaDeCuenta(a.cuentaId)));
    if (m.asientos.length !== 2 || monedas.size !== 2) problemas.push(`${nombre}: un cambio de moneda lleva un asiento en cada moneda`);
    return problemas;
  }
  const porMoneda = {};
  for (const a of m.asientos) {
    const moneda = monedaDeCuenta(a.cuentaId);
    porMoneda[moneda] = (porMoneda[moneda] ?? 0) + a.monto;
  }
  if (m.partes?.length) {
    const moneda = m.monedaId ?? monedaDeCuenta(m.cuentaId);
    porMoneda[moneda] = (porMoneda[moneda] ?? 0) + SIGNO_PARTES[m.tipo] * suma(m.partes);
    // Gasto pagado por terceros: contrapartida implícita de aporte de terceros.
    if (m.tipo === 'pagado_por_terceros') porMoneda[moneda] -= suma(m.partes);
  }
  for (const [moneda, diferencia] of Object.entries(porMoneda)) {
    if (diferencia !== 0) problemas.push(`${nombre}: no cuadra en ${moneda} por ${diferencia}`);
  }
  return problemas;
}

/** Arma un movimiento con sus asientos y lo rechaza si no cumple RN-01 o sus montos no son válidos. */
export function crearMovimiento(datos, contexto) {
  const nombre = datos.id ?? datos.tipo;
  if (!TIPOS_MOVIMIENTO.includes(datos.tipo)) throw new ErrorPartidaDoble(`${nombre}: tipo de movimiento desconocido «${datos.tipo}»`);
  if (!Number.isInteger(datos.montoTotal) || datos.montoTotal <= 0) throw new ErrorPartidaDoble(`${nombre}: el monto tiene que ser un entero mayor que 0`);
  if ((datos.partes ?? []).some((p) => !Number.isInteger(p.monto) || p.monto <= 0)) throw new ErrorPartidaDoble(`${nombre}: cada parte tiene que ser mayor que 0`);
  const movimiento = { ...datos, partes: datos.partes ?? [] };
  movimiento.asientos = asientosDe(movimiento, contexto);
  // Las partes tienen que sumar el total en los tipos que lo piden (3.7.4).
  const partes = suma(movimiento.partes);
  const esperadas = { ingreso: datos.montoTotal, egreso: datos.montoTotal, devolucion: datos.montoTotal, pagado_por_terceros: datos.montoTotal,
    gasto_compartido: datos.montoTotal - suma(datos.deudores) }[datos.tipo];
  const problemas = esperadas != null && partes !== esperadas
    ? [`${nombre}: no cuadra: las partes suman ${partes} y deberían sumar ${esperadas} (diferencia ${esperadas - partes})`]
    : verificarPartidaDoble(movimiento, contexto);
  if (problemas.length) throw new ErrorPartidaDoble(problemas.join('; '));
  return movimiento;
}

/** Saldo de una cuenta a una fecha (RN-02): saldo inicial + asientos de los movimientos confirmados hasta esa fecha. */
export function saldo(cuenta, fecha, movimientos) {
  let total = cuenta.saldoInicial;
  for (const m of movimientos) {
    if (m.estado !== 'confirmado' || m.fecha > fecha) continue;
    for (const a of m.asientos) if (a.cuentaId === cuenta.id) total += a.monto;
  }
  return total;
}
