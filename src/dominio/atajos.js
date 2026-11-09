// Atajos de teclado de la PC (HU-34, D-165) y a dónde vuelve Esc (HU-35). Funciones puras: la interfaz le cuenta qué pasó y ellas
// deciden. Viven juntas para que la pantalla inicial no pida un archivo más (LCP).

/**
 * ¿Esta tecla abre Cargar? Sí con «c» o «C» en Inicio, en la PC, sin Ctrl, Alt ni Meta, con el foco fuera de un campo
 * de texto y sin ninguna ventana abierta.
 * @param {{tecla: string, ctrl: boolean, alt: boolean, meta: boolean, enCampo: boolean, hayVentana: boolean, esPC: boolean, ruta: string}} o
 */
export function abreCarga({ tecla, ctrl, alt, meta, enCampo, hayVentana, esPC, ruta }) {
  if (ctrl || alt || meta || enCampo || hayVentana || !esPC) return false;
  return ruta === 'inicio' && typeof tecla === 'string' && tecla.toLowerCase() === 'c';
}

/**
 * Qué hace la tecla Esc en la PC (HU-35): 'ignorar' (no es para AFP: otra ventana, un tooltip, el celular, Inicio,
 * una tecla repetida o con modificadores), 'soltar-foco' (hay un campo con el foco: primero se lo suelta) o 'volver'.
 * En Cargar, 'volver' equivale a «Cancelar».
 * @param {{tecla: string, ctrl: boolean, alt: boolean, meta: boolean, shift: boolean, repetida: boolean, enCampo: boolean, hayVentana: boolean, hayAyuda: boolean, esPC: boolean, ruta: string}} o
 * @returns {'ignorar' | 'soltar-foco' | 'volver'}
 */
export function accionDeEscape({ tecla, ctrl, alt, meta, shift, repetida, enCampo, hayVentana, hayAyuda, esPC, ruta }) {
  if (tecla !== 'Escape' || ctrl || alt || meta || shift || repetida || hayVentana || hayAyuda || !esPC) return 'ignorar';
  if (ruta === 'inicio') return 'ignorar';
  return enCampo ? 'soltar-foco' : 'volver';
}

// --- A dónde vuelve Esc (HU-35) ---

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
