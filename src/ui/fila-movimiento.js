// La fila de un movimiento (ícono, descripción, «fecha · hora · categoría · cuenta» y monto en rojo o verde), la misma en la lista de
// Movimientos (HU-04) y en «Últimos movimientos» de Inicio (HU-37). Liviana: Inicio la usa al dibujarse.
import { crear } from './dom.js';
import { formatearMonto } from '../dominio/formato.js';
import { filaDeMovimiento } from '../dominio/tablero.js';

/** Un `<li>` con el botón de la fila. `contexto`: { categoriasPorId, cuentasPorId }; `alTocar` se llama al tocarla. */
export function itemDeMovimiento(movimiento, contexto, { id, alTocar }) {
  const fila = filaDeMovimiento(movimiento, contexto);
  const boton = crear('button', { type: 'button', class: 'movs-fila', id }, [
    crear('span', { class: 'movs-icono', 'aria-hidden': 'true', texto: fila.emoji }),
    crear('span', { class: 'movs-texto' }, [
      crear('span', { class: 'movs-titulo', texto: fila.titulo }),
      crear('span', { class: 'movs-detalle', texto: fila.detalle }),
    ]),
    crear('span', { class: `movs-monto ${fila.tipo === 'egreso' ? 'monto-egreso' : 'monto-ingreso'}`, texto: formatearMonto(fila.monto, fila.monedaId, { conSigno: true }) }),
  ]);
  boton.addEventListener('click', alTocar);
  return crear('li', {}, [boton]);
}
