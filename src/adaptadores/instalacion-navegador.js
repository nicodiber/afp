// Adaptador del puerto de instalación con las funciones del navegador (aep#4):
// «beforeinstallprompt» (Chromium: Brave, Chrome, Edge), «appinstalled» y «display-mode: standalone».
export function crearInstalacionNavegador() {
  let pedido = null;
  const avisos = [];
  const alInstalar = [];
  const avisar = () => avisos.forEach((funcion) => funcion());
  const modoApp = matchMedia('(display-mode: standalone)');

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault(); // AFP decide cuándo mostrarlo (tarjeta o Ajustes).
    pedido = evento;
    avisar();
  });
  window.addEventListener('appinstalled', () => { pedido = null; alInstalar.forEach((funcion) => funcion()); avisar(); });
  modoApp.addEventListener?.('change', avisar);

  return {
    estaInstalada: () => modoApp.matches || navigator.standalone === true,
    puedeConUnToque: () => pedido != null,
    dispositivo: () => (/Android|iPhone|iPad/i.test(navigator.userAgent) ? 'celular' : 'pc'),
    async instalar() {
      if (!pedido) return false;
      const actual = pedido;
      pedido = null;
      await actual.prompt();
      const { outcome } = await actual.userChoice;
      avisar();
      return outcome === 'accepted';
    },
    alCambiar: (funcion) => avisos.push(funcion),
    alInstalarse: (funcion) => alInstalar.push(funcion),
  };
}
