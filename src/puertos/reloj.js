// Puerto Reloj (arquitectura §3): la única forma de saber «hoy». En modo prueba devuelve la fecha simulada.

/**
 * @typedef {Object} PuertoReloj
 * @property {() => string} hoy  Fecha AAAA-MM-DD en America/Argentina/Buenos_Aires.
 * @property {() => string} ahora  Hora HH:MM de 24 h en America/Argentina/Buenos_Aires (en modo prueba, la hora real).
 */

export const METODOS_RELOJ = Object.freeze(['hoy', 'ahora']);
