// Sugerir la instalación (aep#4, D-105 a D-107). Funciones puras: no saben nada del navegador.

/** La tarjeta de Inicio aparece desde el navegador hasta instalar AFP o tocar «Ahora no» (D-106). */
export function debeSugerirInstalacion({ instalada, sugerencia }) {
  return !instalada && sugerencia !== 'descartada';
}

/**
 * Qué ofrecer: nada (ya es la app instalada), el pedido del navegador con un toque,
 * o los pasos a mano según el dispositivo (D-107).
 */
export function formaDeInstalar({ instalada, conUnToque, dispositivo }) {
  if (instalada) return 'instalada';
  if (conUnToque) return 'un-toque';
  return dispositivo === 'celular' ? 'pasos-celular' : 'pasos-pc';
}
