// Textos que escribe el usuario (D-134). Funciones puras.

/** La primera letra pasa a mayúscula; el resto queda como se escribió. Si el texto no empieza con una letra, no cambia. */
export function capitalizarInicial(texto) {
  return String(texto).replace(/^(\s*)(\p{L})/u, (_, espacios, letra) => espacios + letra.toLocaleUpperCase('es'));
}
