// Canal de la versión que corre: la versión a probar se publica en /prueba/ (D-67) y sus nombres de
// almacenamiento llevan «dev» para no tocar nunca los de la versión real (modelo de datos §6.1).
export function canal(ruta = location.pathname) {
  return /\/prueba\//.test(ruta) ? 'dev' : 'real';
}

/** Nombre de una clave o base del navegador para este canal: «afp-tema» o «afp-dev-tema». */
export function nombreConCanal(nombre, ruta) {
  return canal(ruta) === 'dev' ? `afp-dev-${nombre}` : `afp-${nombre}`;
}
