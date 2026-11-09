// Períodos de la lista de Movimientos (P-043, HU-38 ajuste B): de qué fecha a qué fecha va cada uno y cómo se muestra
// debajo del selector. Funciones puras; «hoy» llega del puerto Reloj.
import { formatearFecha } from './fecha.js';

export const PERIODOS = Object.freeze(['mes', 'ultimos-3-meses', 'todo']);

const dosCifras = (n) => String(n).padStart(2, '0');
const bisiesto = (anio) => (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
const diasDelMes = (anio, mes) => [31, bisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];

/**
 * El rango de un período: `{ desde, hasta }` (AAAA-MM-DD). «mes» es el mes en curso completo; «ultimos-3-meses», el mes
 * en curso y los dos anteriores completos; «todo» va desde `primerMovimiento` (o `desde: null` si no hay) hasta el fin
 * del mes en curso.
 */
export function rangoDePeriodo(periodo, hoy, primerMovimiento = null) {
  if (!PERIODOS.includes(periodo)) throw new Error(`Período desconocido: ${periodo}`);
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const hasta = `${anio}-${dosCifras(mes)}-${dosCifras(diasDelMes(anio, mes))}`;
  if (periodo === 'todo') return { desde: primerMovimiento, hasta };
  const atras = periodo === 'mes' ? 0 : 2;
  const indice = anio * 12 + (mes - 1) - atras;
  return { desde: `${Math.floor(indice / 12)}-${dosCifras((indice % 12) + 1)}-01`, hasta };
}

/** El texto de debajo del selector: «01/09/2026 al 31/10/2026»; para «Todo», «desde el primer movimiento (DD/MM/AAAA)». */
export function textoDeRango(periodo, rango) {
  if (periodo === 'todo') return rango.desde ? `desde el primer movimiento (${formatearFecha(rango.desde)})` : 'todavía no hay movimientos';
  return `${formatearFecha(rango.desde)} al ${formatearFecha(rango.hasta)}`;
}
