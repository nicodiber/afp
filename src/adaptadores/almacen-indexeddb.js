// Adaptador del puerto Almacen con IndexedDB (RF-DAT-01, aep#9, aep#12). Una base por canal y modo
// (modelo de datos §6.1): afp, afp-prueba, afp-dev o afp-dev-prueba.
// Esquema 1: configuracion. Esquema 2 (aep#12): + cuentas y monedas; la migración conserva lo anterior.
const VERSION_ESQUEMA = 2;
const ALMACENES = ['configuracion', 'cuentas', 'monedas'];

function abrir(nombre) {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(nombre, VERSION_ESQUEMA);
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      for (const almacen of ALMACENES) {
        if (!base.objectStoreNames.contains(almacen)) base.createObjectStore(almacen, { keyPath: 'id' });
      }
    };
    pedido.onsuccess = () => {
      const base = pedido.result;
      // Si otra pestaña abre una versión nueva del esquema, esta cierra la suya para no bloquearla.
      base.onversionchange = () => base.close();
      resolver(base);
    };
    pedido.onerror = () => rechazar(pedido.error);
    pedido.onblocked = () => rechazar(new Error('La base está abierta en otra pestaña con una versión anterior.'));
  });
}

const operacion = (base, almacenes, modo, accion) => new Promise((resolver, rechazar) => {
  const tx = base.transaction(almacenes, modo);
  const pedido = accion(tx);
  tx.oncomplete = () => resolver(pedido?.result);
  tx.onerror = () => rechazar(tx.error);
  tx.onabort = () => rechazar(tx.error);
});

export function crearAlmacenIndexedDB(nombreDeBase) {
  let base = null;
  const disponible = () => typeof indexedDB !== 'undefined' && indexedDB != null;
  const conectar = async () => { base ??= await abrir(nombreDeBase); return base; };
  const validar = (almacen) => { if (!ALMACENES.includes(almacen) || almacen === 'configuracion') throw new Error(`Almacén desconocido: ${almacen}`); };
  return {
    disponible,
    async leerConfiguracion() {
      const resultado = await operacion(await conectar(), 'configuracion', 'readonly', (tx) => tx.objectStore('configuracion').get('config'));
      return resultado ?? null;
    },
    async guardarConfiguracion(configuracion) {
      await operacion(await conectar(), 'configuracion', 'readwrite', (tx) => tx.objectStore('configuracion').put(configuracion));
    },
    async listar(almacen) {
      validar(almacen);
      return operacion(await conectar(), almacen, 'readonly', (tx) => tx.objectStore(almacen).getAll());
    },
    async guardar(almacen, registros) {
      validar(almacen);
      await operacion(await conectar(), almacen, 'readwrite', (tx) => { for (const r of [].concat(registros)) tx.objectStore(almacen).put(r); });
    },
    async borrar(almacen, id) {
      validar(almacen);
      await operacion(await conectar(), almacen, 'readwrite', (tx) => tx.objectStore(almacen).delete(id));
    },
    /** Reemplaza el contenido de varios almacenes en una sola transacción (datos de ejemplo, aep#12). */
    async reemplazar(datos) {
      const nombres = Object.keys(datos);
      nombres.forEach(validar);
      await operacion(await conectar(), nombres, 'readwrite', (tx) => {
        for (const nombre of nombres) {
          const almacen = tx.objectStore(nombre);
          almacen.clear();
          for (const r of datos[nombre]) almacen.put(r);
        }
      });
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
