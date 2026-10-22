// Se carga sin «defer» en el <head>, antes de dibujar: pone el tema elegido en <html> para que la
// pantalla no aparezca un instante con el tema equivocado (aep#2 CA-4, CLS de CA-8).
// Script clásico (no módulo): repite en pocas líneas la clave de canal.js y el criterio de dominio/tema.js;
// las pruebas en navegador de CA-3 y CA-4 comprueban que coincidan.
(function () {
  var clave = /\/prueba\//.test(location.pathname) ? 'afp-dev-tema' : 'afp-tema';
  var tema = null;
  try { tema = localStorage.getItem(clave); } catch { /* sin almacenamiento */ }
  if (tema === 'claro' || tema === 'oscuro') document.documentElement.setAttribute('data-tema', tema);
})();
