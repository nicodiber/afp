// A dónde vuelve AFP con Esc (HU-35). Funciones puras: la interfaz cuenta dónde está y ellas deciden.

/** Pantallas de primer nivel (las que se abren desde la barra) y sus subpantallas. */
const PANTALLAS = Object.freeze(['inicio', 'movimientos', 'cargar', 'analisis', 'ajustes']);

/**
 * La pantalla «padre» de una ruta: una subpantalla (`ajustes/cuentas`) vuelve a su pantalla (`ajustes`) y cualquier
 * otra pantalla vuelve a Inicio. Inicio no tiene padre (null). Una ruta desconocida cuenta como Inicio.
 */
export function padreDe(ruta) {
  if (typeof ruta === 'string' && ruta.includes('/')) {
    const principal = ruta.split('/')[0];
    return PANTALLAS.includes(principal) ? principal : 'inicio';
  }
  return PANTALLAS.includes(ruta) && ruta !== 'inicio' ? 'inicio' : null;
}

/**
 * Qué hace «volver» desde `ruta`: en Inicio, nada (null); si hay historial previo dentro de AFP, ir atrás en el
 * historial; si no (por ejemplo, se abrió `#categorias` directo), ir a la pantalla padre.
 * @returns {null | {accion: 'atras'} | {accion: 'ir', ruta: string}}
 */
export function destinoAlVolver({ ruta, hayHistorial }) {
  const padre = padreDe(ruta);
  if (padre === null) return null;
  return hayHistorial ? { accion: 'atras' } : { accion: 'ir', ruta: padre };
}
