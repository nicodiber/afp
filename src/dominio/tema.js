// Tema de la interfaz (RNF-USA-02, aep#2). Función pura: no sabe nada del navegador.

/** Opciones de Ajustes → Tema, en el orden en que se muestran. */
export const TEMAS = Object.freeze(['claro', 'oscuro', 'sistema']);

/** Un valor guardado que no es una opción válida (o que no existe) cuenta como «Como el sistema». */
export function normalizarTema(valor) {
  return TEMAS.includes(valor) ? valor : 'sistema';
}

/** Tema que se ve: la elección del usuario o, con «Como el sistema», el del dispositivo. */
export function resolverTema(eleccion, sistemaOscuro) {
  const tema = normalizarTema(eleccion);
  if (tema === 'sistema') return sistemaOscuro ? 'oscuro' : 'claro';
  return tema;
}
