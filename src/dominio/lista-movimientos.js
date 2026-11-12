// Lista de movimientos (HU-04): período, filtros, orden, búsqueda y totales. Funciones puras: la fecha de «hoy» llega
// por parámetro (puerto Reloj) y los montos son enteros en centavos.
import { normalizarBusqueda } from './movimientos.js';
import { descendientes } from './categorias.js';
import { formatearFecha } from './fecha.js';
import { rangoDePeriodo, ordenarPorFechaYHora, totales, totalesPorMoneda, filaDeMovimiento } from './tablero.js';

// Lo que usan también Inicio y otras pantallas livianas vive en tablero.js (sin imports) y se reexporta acá.
export { rangoDePeriodo, ordenarPorFechaYHora, totales, totalesPorMoneda, filaDeMovimiento };

export const PERIODOS = Object.freeze([
  ['este-mes', 'Este mes'], ['mes-anterior', 'Mes anterior'], ['ultimos-3', 'Últimos 3 meses'],
  ['este-anio', 'Este año'], ['todo', 'Todo'], ['mes', 'Elegir un mes…'],
]);
export const TIPOS_DE_FILTRO = Object.freeze([['todos', 'Todos'], ['egreso', 'Egresos'], ['ingreso', 'Ingresos']]);

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
