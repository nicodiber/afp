// Inicio sin datos (aep#2 CA-1): una frase y un botón (manual §8.1, D-65, D-97).
import { crear } from '../dom.js';
import { tarjetaInstalar } from '../instalacion.js';

export function pantallaInicio({ instalacion, alInstalar, alDescartar }) {
  const { sugerirEnInicio, forma } = instalacion.estado();
  return [
    crear('h1', { class: 'titulo titulo-inicio', tabindex: '-1', texto: 'Inicio' }),
    // Sugerencia de instalación arriba de la pantalla sin datos (aep#4, D-105).
    ...(sugerirEnInicio ? [tarjetaInstalar({ forma, alInstalar, alDescartar })] : []),
    crear('div', { class: 'vacio' }, [
      crear('p', { texto: 'Todavía no cargaste movimientos.' }),
      // Mientras la carga no existe, lleva al aviso de «llega en una próxima entrega» (D-97).
      crear('a', { class: 'boton-principal', href: '#cargar', texto: 'Cargar el primero' }),
    ]),
  ];
}
