// Inicio sin datos (aep#2 CA-1): una frase y un botón (manual §8.1, D-65, D-97).
import { crear } from '../dom.js';

export function pantallaInicio() {
  return [
    crear('h1', { class: 'titulo titulo-inicio', tabindex: '-1', texto: 'Inicio' }),
    crear('div', { class: 'vacio' }, [
      crear('p', { texto: 'Todavía no cargaste movimientos.' }),
      // Mientras la carga no existe, lleva al aviso de «llega en una próxima entrega» (D-97).
      crear('a', { class: 'boton-principal', href: '#cargar', texto: 'Cargar el primero' }),
    ]),
  ];
}
