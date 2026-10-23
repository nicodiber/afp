// Puerto Almacen (arquitectura §3): los datos del dispositivo. Configuración (aep#9), cuentas y monedas (aep#12).

/**
 * @typedef {'cuentas'|'monedas'} NombreAlmacen
 * @typedef {Object} PuertoAlmacen
 * @property {() => boolean} disponible
 * @property {() => Promise<object|null>} leerConfiguracion  null si todavía no hay.
 * @property {(configuracion: object) => Promise<void>} guardarConfiguracion
 * @property {(almacen: NombreAlmacen) => Promise<object[]>} listar
 * @property {(almacen: NombreAlmacen, registros: object|object[]) => Promise<void>} guardar  Crea o reemplaza por id.
 * @property {(almacen: NombreAlmacen, id: string) => Promise<void>} borrar
 * @property {(datos: Partial<Record<NombreAlmacen, object[]>>) => Promise<void>} reemplazar  Todo junto o nada.
 * @property {() => Promise<('persistente'|'puede-borrarse'|'desconocido'|'sin-almacenamiento')>} persistencia
 */

export const METODOS_ALMACEN = Object.freeze(['disponible', 'leerConfiguracion', 'guardarConfiguracion', 'listar', 'guardar', 'borrar', 'reemplazar', 'persistencia']);
