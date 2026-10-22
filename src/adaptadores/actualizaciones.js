// Service worker y aviso de versión nueva (arquitectura §7, FC-01). La app no cambia sola de versión:
// cuando hay una nueva, avisa, y cambia cuando el usuario toca «Actualizar».
export function registrarServiceWorker({ alHaberVersionNueva }) {
  if (!('serviceWorker' in navigator)) return;
  let pidioActualizar = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pidioActualizar) location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((registro) => {
    const avisar = () => alHaberVersionNueva(() => {
      pidioActualizar = true;
      registro.waiting?.postMessage('actualizar');
    });
    if (registro.waiting && navigator.serviceWorker.controller) avisar();
    registro.addEventListener('updatefound', () => {
      const nuevo = registro.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {});
    });
  }).catch(() => { /* sin service worker: AFP anda igual, pero no sin conexión */ });
}
