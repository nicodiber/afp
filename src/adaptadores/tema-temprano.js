// Se carga sin «defer» en el <head>, antes de dibujar: pone el tema elegido en <html> para que la
// pantalla no aparezca un instante con el tema equivocado (aep#2 CA-4, CLS de CA-8), y marca el modo
// prueba para que el lugar de la franja quede reservado desde el primer dibujo (aep#6 CA-4).
// Script clásico (no módulo): repite en pocas líneas la clave de canal.js y el criterio de dominio/tema.js;
// las pruebas en navegador de CA-3 y CA-4 comprueban que coincidan.
(function () {
  var prefijo = /\/prueba\//.test(location.pathname) ? 'afp-dev-' : 'afp-';
  var tema = null;
  var modoPrueba = null;
  try { tema = localStorage.getItem(prefijo + 'tema'); modoPrueba = localStorage.getItem(prefijo + 'modo-prueba'); } catch { /* sin almacenamiento */ }
  if (tema === 'claro' || tema === 'oscuro') document.documentElement.setAttribute('data-tema', tema);
  if (modoPrueba === 'si') document.documentElement.setAttribute('data-modo-prueba', '');
})();
