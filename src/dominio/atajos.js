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
