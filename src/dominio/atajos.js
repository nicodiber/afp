// Atajos de teclado de la PC (HU-34, D-165). Función pura: la interfaz le cuenta qué pasó y ella decide.

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
