// Casos de uso del tema (aep#2 CA-3, CA-4): ver el elegido y elegir otro.
import { TEMAS, normalizarTema, resolverTema } from '../dominio/tema.js';

export function crearCasosPreferencias(preferencias) {
  return {
    opcionesDeTema: () => TEMAS,
    temaElegido: () => normalizarTema(preferencias.leerTema()),
    elegirTema(tema) {
      if (!TEMAS.includes(tema)) throw new Error(`Tema desconocido: ${tema}`);
      preferencias.guardarTema(tema);
      return tema;
    },
    temaQueSeVe: (sistemaOscuro) => resolverTema(preferencias.leerTema(), sistemaOscuro),
  };
}
