// Puerto de las preferencias del dispositivo (PreferenciasDispositivo, modelo de datos §3.2).
// No se sincronizan: viven solo en el dispositivo.

/**
 * @typedef {Object} PuertoPreferencias
 * @property {() => (string|null)} leerTema  El tema guardado, o null si nunca se eligió.
 * @property {(tema: 'claro'|'oscuro'|'sistema') => void} guardarTema
 */

/** Métodos que tiene que ofrecer todo adaptador de este puerto. */
export const METODOS_PREFERENCIAS = Object.freeze(['leerTema', 'guardarTema']);
