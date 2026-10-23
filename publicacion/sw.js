// Service worker de la raíz (aep#11 CA-4, D-118). Reemplaza al de la v0.1.0, que estaba en /afp/ y
// abarcaba también la versión a probar: cuando el navegador lo encuentra al buscar actualizaciones,
// se instala, se da de baja y lleva las ventanas abiertas a la versión real en app/. No guarda nada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.registration.unregister()
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((ventanas) => Promise.all(ventanas.map((v) => v.navigate(new URL('app/', self.registration.scope).href).catch(() => null)))));
});
