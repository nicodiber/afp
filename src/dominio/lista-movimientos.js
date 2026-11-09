// Lista de movimientos (HU-04): período, filtros, orden, búsqueda y totales. Funciones puras: la fecha de «hoy» llega
// por parámetro (puerto Reloj) y los montos son enteros en centavos.
import { normalizarBusqueda } from './movimientos.js';
import { descendientes } from './categorias.js';
import { formatearFecha } from './fecha.js';

export const PERIODOS = Object.freeze([
  ['este-mes', 'Este mes'], ['mes-anterior', 'Mes anterior'], ['ultimos-3', 'Últimos 3 meses'],
  ['este-anio', 'Este año'], ['todo', 'Todo'], ['mes', 'Elegir un mes…'],
]);
export const TIPOS_DE_FILTRO = Object.freeze([['todos', 'Todos'], ['egreso', 'Egresos'], ['ingreso', 'Ingresos']]);

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

/**
 * El texto con las fechas del período, debajo del selector (HU-38, P-043): «01/09/2026 al 31/10/2026». Para «Todo» no hay
 * límite: «desde el primer movimiento (DD/MM/AAAA)», con la fecha del más viejo (`primerMovimiento`, AAAA-MM-DD o null).
 */
export function textoDelRango(periodo, rango, primerMovimiento = null) {
  if (periodo === 'todo' || !rango.desde) return primerMovimiento ? `desde el primer movimiento (${formatearFecha(primerMovimiento)})` : 'todavía no hay movimientos';
  return `${formatearFecha(rango.desde)} al ${formatearFecha(rango.hasta)}`;
}

/** Ids de una categoría y de todas las que cuelgan de ella (elegir una familia incluye sus subcategorías). */
export const idsDeCategoria = (categorias, id) => new Set([id, ...descendientes(categorias, id)]);

const nombresDeCategorias = (m, categoriasPorId) => (m.partes ?? []).map((p) => categoriasPorId.get(p.categoriaId)?.nombre ?? '');

/**
 * Los movimientos que cumplen los filtros, del más nuevo al más viejo por fecha y hora.
 * filtros: { texto, desde, hasta, tipo ('todos'|'egreso'|'ingreso'), categoriaIds (Set|null), cuentaId (null = todas) }.
 * La búsqueda mira la descripción y el nombre de la categoría, sin distinguir mayúsculas ni tildes.
 */
export function filtrarMovimientos(movimientos, filtros, categoriasPorId) {
  const { texto = '', desde = null, hasta = null, tipo = 'todos', categoriaIds = null, cuentaId = null } = filtros;
  const buscado = normalizarBusqueda(texto);
  const salida = movimientos.filter((m) => {
    if (desde && m.fecha < desde) return false;
    if (hasta && m.fecha > hasta) return false;
    if (tipo !== 'todos' && m.tipo !== tipo) return false;
    if (cuentaId && m.cuentaId !== cuentaId) return false;
    if (categoriaIds && !(m.partes ?? []).some((p) => categoriaIds.has(p.categoriaId))) return false;
    if (buscado && !normalizarBusqueda(`${m.descripcion ?? ''} ${nombresDeCategorias(m, categoriasPorId).join(' ')}`).includes(buscado)) return false;
    return true;
  });
  return ordenarPorFechaYHora(salida);
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

/**
 * Egresos por categoría hoja, de mayor a menor (a igualdad, por nombre): [{ categoriaId, nombre, emoji, monto }].
 * Suma el monto de las partes de los egresos de una sola moneda (`monedaId`).
 */
export function egresosPorCategoria(movimientos, categoriasPorId, monedaId = 'ARS') {
  const suma = new Map();
  for (const m of movimientos) {
    if (m.tipo !== 'egreso' || m.monedaId !== monedaId) continue;
    for (const p of m.partes ?? []) suma.set(p.categoriaId, (suma.get(p.categoriaId) ?? 0) + p.monto);
  }
  return [...suma.entries()]
    .map(([categoriaId, monto]) => ({ categoriaId, nombre: categoriasPorId.get(categoriaId)?.nombre ?? 'Sin categoría', emoji: categoriasPorId.get(categoriaId)?.emoji ?? '', monto }))
    .sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es'));
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
