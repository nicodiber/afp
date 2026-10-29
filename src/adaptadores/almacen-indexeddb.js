// Adaptador del puerto Almacen con IndexedDB (RF-DAT-01, aep#9, aep#12). Una base por canal y modo
// (modelo de datos §6.1): afp, afp-prueba, afp-dev o afp-dev-prueba.
// Esquema 1: configuracion. Esquema 2 (aep#12): + cuentas y monedas. Esquema 3 (aep#15): + categorias y
// ubicacionesCategoria. Esquema 4 (HU-02): + movimientos, con índices por fecha, estado y claveImportacion (único,
// modelo de datos §6.1). Cada migración conserva lo anterior.
const VERSION_ESQUEMA = 4;
const ALMACENES = ['configuracion', 'cuentas', 'monedas', 'categorias', 'ubicacionesCategoria', 'movimientos'];

function abrir(nombre) {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(nombre, VERSION_ESQUEMA);
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      for (const almacen of ALMACENES) {
        if (base.objectStoreNames.contains(almacen)) continue;
        const nuevo = base.createObjectStore(almacen, { keyPath: 'id' });
        if (almacen === 'movimientos') {
          nuevo.createIndex('fecha', 'fecha');
          nuevo.createIndex('estado', 'estado');
          nuevo.createIndex('claveImportacion', 'claveImportacion', { unique: true });
        }
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
  let pedido;
  try {
    pedido = accion(tx);
  } catch (error) {
    // Un registro inválido deshace la transacción entera: nada queda a medias.
    try { tx.abort(); } catch { /* ya terminó */ }
    rechazar(error);
    return;
  }
  tx.oncomplete = () => resolver(pedido?.result);
  tx.onerror = () => rechazar(tx.error);
  tx.onabort = () => rechazar(tx.error);
});

export function crearAlmacenIndexedDB(nombreDeBase) {
  let conexion = null;
  const disponible = () => typeof indexedDB !== 'undefined' && indexedDB != null;
  // Una sola conexión aunque varias lecturas la pidan a la vez; si falla, la próxima vez se reintenta.
  const conectar = () => {
    conexion ??= abrir(nombreDeBase).catch((error) => { conexion = null; throw error; });
    return conexion;
  };
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
