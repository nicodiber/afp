// Destino que todavía no existe (aep#2 CA-10, D-96).
import { crear } from '../dom.js';

export function pantallaProximamente(titulo) {
  return [
    crear('h1', { class: 'titulo', tabindex: '-1', texto: titulo }),
    crear('div', { class: 'vacio' }, [
      crear('p', { texto: 'Esta parte llega en una próxima entrega.' }),
      crear('a', { class: 'boton-texto', href: '#inicio', texto: 'Volver al inicio' }),
    ]),
  ];
}
