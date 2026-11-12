// Tablero de Inicio (HU-37, D-178): saldos de hoy, resumen del mes en curso y últimos movimientos. Funciones puras y livianas
// (solo importan fecha.js): Inicio las usa al dibujarse, así que no pueden arrastrar módulos grandes (LCP). Lo que comparten
// con la lista de Movimientos (rangos de período, totales, orden y filas) vive acá y lista-movimientos.js lo reexporta.
import { formatearFecha } from './fecha.js';

const dosDigitos = (n) => String(n).padStart(2, '0');
const diasDelMes = (a, m) => [31, (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const primerDia = (a, m) => `${a}-${dosDigitos(m)}-01`;
const ultimoDia = (a, m) => `${a}-${dosDigitos(m)}-${dosDigitos(diasDelMes(a, m))}`;
/** Mes `a`-`m` desplazado `n` meses (n puede ser negativo): { a, m }. */
const mesDesplazado = (a, m, n) => { const total = a * 12 + (m - 1) + n; return { a: Math.floor(total / 12), m: (total % 12) + 1 }; };

/**
 * Rango de fechas (inclusive) de un período: { desde, hasta }, con null cuando no hay límite («todo»).
 * `hoy` es AAAA-MM-DD; `mesElegido` es AAAA-MM (solo para 'mes'). «Últimos 3 meses» son el mes en curso y los dos anteriores.
 */
export function rangoDePeriodo(periodo, hoy, mesElegido = null) {
  const [a, m] = hoy.split('-').map(Number);
  switch (periodo) {
    case 'este-mes': return { desde: primerDia(a, m), hasta: ultimoDia(a, m) };
    case 'mes-anterior': { const p = mesDesplazado(a, m, -1); return { desde: primerDia(p.a, p.m), hasta: ultimoDia(p.a, p.m) }; }
    case 'ultimos-3': { const p = mesDesplazado(a, m, -2); return { desde: primerDia(p.a, p.m), hasta: ultimoDia(a, m) }; }
    case 'este-anio': return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
    case 'mes': {
      const [ea, em] = String(mesElegido ?? '').split('-').map(Number);
      if (!ea || !em || em < 1 || em > 12) return rangoDePeriodo('este-mes', hoy);
      return { desde: primerDia(ea, em), hasta: ultimoDia(ea, em) };
    }
    default: return { desde: null, hasta: null };
  }
}

/** Del más nuevo al más viejo por fecha y hora (sin hora, antes que las que tienen hora de ese día); a igualdad, por id. */
export function ordenarPorFechaYHora(movimientos) {
  return [...movimientos].sort((a, b) => (
    b.fecha.localeCompare(a.fecha) || (b.hora ?? '').localeCompare(a.hora ?? '') || String(b.id).localeCompare(String(a.id))
  ));
}

/** Totales en centavos de los ingresos y egresos de la lista (una sola moneda): { ingresos, egresos, diferencia }. */
export function totales(movimientos) {
  let ingresos = 0;
  let egresos = 0;
  for (const m of movimientos) {
    if (m.tipo === 'ingreso') ingresos += m.montoTotal;
    else if (m.tipo === 'egreso') egresos += m.montoTotal;
  }
  return { ingresos, egresos, diferencia: ingresos - egresos };
}

/** Los totales por moneda (no se suman monedas distintas): [{ monedaId, ingresos, egresos, diferencia }], ARS primero. */
export function totalesPorMoneda(movimientos) {
  const porMoneda = new Map();
  for (const m of movimientos) {
    if (!porMoneda.has(m.monedaId)) porMoneda.set(m.monedaId, []);
    porMoneda.get(m.monedaId).push(m);
  }
  return [...porMoneda.entries()]
    .map(([monedaId, lista]) => ({ monedaId, ...totales(lista) }))
    .sort((a, b) => (a.monedaId === 'ARS' ? -1 : b.monedaId === 'ARS' ? 1 : a.monedaId.localeCompare(b.monedaId)));
}

/** Datos de una fila de la lista: título, línea de detalle y monto con signo. */
export function filaDeMovimiento(m, { categoriasPorId, cuentasPorId }) {
  const categorias = (m.partes ?? []).map((p) => categoriasPorId.get(p.categoriaId)).filter(Boolean);
  const nombreCategoria = categorias.map((c) => c.nombre).join(', ') || 'Sin categoría';
  const [a, mes, d] = m.fecha.split('-');
  return {
    id: m.id,
    emoji: categorias[0]?.emoji || '•',
    titulo: m.descripcion || nombreCategoria,
    detalle: [`${d}/${mes}/${a}`, m.hora, nombreCategoria, cuentasPorId.get(m.cuentaId)?.nombre ?? 'Cuenta'].filter(Boolean).join(' · '),
    monto: m.tipo === 'egreso' ? -m.montoTotal : m.montoTotal,
    tipo: m.tipo,
    monedaId: m.monedaId,
  };
}

export const NOMBRES_DE_MES = Object.freeze(['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']);
const NOMBRES_DE_MONEDA = { ARS: 'pesos', USD: 'dólares' };

/** El mes de `hoy` (AAAA-MM-DD): { clave, desde, hasta, titulo } con el título «Octubre 2026 · 01/10/2026 al 31/10/2026». */
export function mesEnCurso(hoy) {
  const rango = rangoDePeriodo('este-mes', hoy);
  const [a, m] = hoy.split('-').map(Number);
  return { clave: hoy.slice(0, 7), ...rango, titulo: `${NOMBRES_DE_MES[m - 1]} ${a} · ${formatearFecha(rango.desde)} al ${formatearFecha(rango.hasta)}` };
}

/**
 * El resumen del mes en curso en pesos (las demás monedas no se suman): { clave, desde, hasta, titulo, ingresos, egresos, diferencia }.
 * Son los mismos totales que muestra Movimientos con «Este mes»; las transferencias y los cambios de moneda no cuentan.
 */
export function resumenDelMes(movimientos, hoy) {
  const mes = mesEnCurso(hoy);
  const delMes = movimientos.filter((m) => m.monedaId === 'ARS' && m.fecha >= mes.desde && m.fecha <= mes.hasta);
  return { ...mes, ...totales(delMes) };
}

/**
 * Los saldos de hoy por moneda: [{ monedaId, rotulo, total }], pesos primero (siempre) y las otras monedas solo si hay
 * cuentas en ellas. `saldoDe(cuenta)` da el saldo en centavos; las cuentas archivadas no se cuentan.
 */
export function saldosDeHoy(cuentas, saldoDe) {
  const total = new Map([['ARS', 0]]);
  for (const c of cuentas) if (c.estado === 'activa') total.set(c.monedaId, (total.get(c.monedaId) ?? 0) + saldoDe(c));
  return [...total.entries()]
    .sort(([a], [b]) => (a === 'ARS' ? -1 : b === 'ARS' ? 1 : a.localeCompare(b)))
    .map(([monedaId, suma]) => ({ monedaId, rotulo: `Total en ${NOMBRES_DE_MONEDA[monedaId] ?? monedaId}`, total: suma }));
}

/** Los `cuantos` movimientos más nuevos por fecha y hora (todos los tipos y monedas). */
export const ultimosMovimientos = (movimientos, cuantos = 5) => ordenarPorFechaYHora(movimientos).slice(0, cuantos);
