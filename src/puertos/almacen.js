// Puerto Almacen (arquitectura §3): los datos del dispositivo. En v0.1.0, solo la configuración (aep#9).

/**
 * @typedef {Object} PuertoAlmacen
 * @property {() => Promise<object|null>} leerConfiguracion  null si todavía no hay.
 * @property {(configuracion: object) => Promise<void>} guardarConfiguracion
 * @property {() => Promise<('persistente'|'puede-borrarse'|'desconocido'|'sin-almacenamiento')>} persistencia
 */

export const METODOS_ALMACEN = Object.freeze(['leerConfiguracion', 'guardarConfiguracion', 'persistencia']);
