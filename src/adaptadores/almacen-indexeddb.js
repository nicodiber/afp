// Adaptador del puerto Almacen con IndexedDB (RF-DAT-01, aep#9). Una base por canal y modo
// (modelo de datos §6.1): afp, afp-prueba, afp-dev o afp-dev-prueba.
const VERSION_ESQUEMA = 1;

function abrir(nombre) {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(nombre, VERSION_ESQUEMA);
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      if (!base.objectStoreNames.contains('configuracion')) base.createObjectStore('configuracion', { keyPath: 'id' });
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
    pedido.onblocked = () => rechazar(new Error('La base está abierta en otra pestaña con una versión anterior.'));
  });
}

const operacion = (base, modo, accion) => new Promise((resolver, rechazar) => {
  const tx = base.transaction('configuracion', modo);
  const pedido = accion(tx.objectStore('configuracion'));
  tx.oncomplete = () => resolver(pedido?.result);
  tx.onerror = () => rechazar(tx.error);
  tx.onabort = () => rechazar(tx.error);
});

export function crearAlmacenIndexedDB(nombreDeBase) {
  let base = null;
  const disponible = () => typeof indexedDB !== 'undefined' && indexedDB != null;
  const conectar = async () => { base ??= await abrir(nombreDeBase); return base; };
  return {
    disponible,
    async leerConfiguracion() {
      const resultado = await operacion(await conectar(), 'readonly', (almacen) => almacen.get('config'));
      return resultado ?? null;
    },
    async guardarConfiguracion(configuracion) {
      await operacion(await conectar(), 'readwrite', (almacen) => almacen.put(configuracion));
    },
    async persistencia() {
      if (!disponible()) return 'sin-almacenamiento';
      try {
        if (!navigator.storage?.persisted) return 'desconocido';
        if (await navigator.storage.persisted()) return 'persistente';
        const concedido = await navigator.storage.persist?.();
        return concedido ? 'persistente' : 'puede-borrarse';
      } catch { return 'desconocido'; }
    },
  };
}
