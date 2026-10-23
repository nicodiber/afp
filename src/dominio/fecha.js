// Fechas del dominio (AAAA-MM-DD, sin zona horaria; modelo de datos §1). Funciones puras.

/** Fecha simulada del modo prueba por defecto (RF-DAT-07). */
export const FECHA_SIMULADA_POR_DEFECTO = '2026-10-31';

/** true si es una fecha AAAA-MM-DD que existe en el calendario. */
export function esFechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dias;
}

/** «2026-11-15» → «15/11/2026» (RNF-USA-05). */
export function formatearFecha(valor) {
  const [a, m, d] = valor.split('-');
  return `${d}/${m}/${a}`;
}

/** En contexto: «hoy, 31/10» si es hoy; si no, DD/MM/AAAA (manual §8.2). «hoy» lo da el puerto Reloj. */
export function formatearFechaEnContexto(valor, hoy) {
  if (valor === hoy) {
    const [, m, d] = valor.split('-');
    return `hoy, ${d}/${m}`;
  }
  return formatearFecha(valor);
}
