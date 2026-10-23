// Raíz del sitio (aep#11, D-118): quita el service worker de la v0.1.0, que estaba en /afp/ y abarcaba
// también la versión a probar, y lleva a la versión real en app/.
(function () {
  var ir = function () { location.replace('app/'); };
  if (!('serviceWorker' in navigator)) { ir(); return; }
  var raiz = new URL('./', location.href).href;
  navigator.serviceWorker.getRegistrations().then(function (registros) {
    return Promise.all(registros.filter(function (r) { return r.scope === raiz; }).map(function (r) { return r.unregister(); }));
  }).then(ir, ir);
})();
