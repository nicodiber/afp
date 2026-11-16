// La fila de un movimiento (ícono, descripción, «fecha · hora · categoría · cuenta» y monto en rojo o verde), la misma en la lista de
// Movimientos (HU-04) y en «Últimos movimientos» de Inicio (HU-37). Liviana: Inicio la usa al dibujarse.
import { crear } from './dom.js';
import { formatearMonto, formatearDecimal } from '../dominio/formato.js';
import { filaDeMovimiento } from '../dominio/tablero.js';

/** Un `<li>` con el botón de la fila. `contexto`: { categoriasPorId, cuentasPorId }; `alTocar` se llama al tocarla. */
export function itemDeMovimiento(movimiento, contexto, { id, alTocar }) {
  const fila = filaDeMovimiento(movimiento, contexto);
  const traspaso = fila.tipo === 'transferencia' || fila.tipo === 'cambio_moneda';
  // Transferencia o cambio: monto en gris (ni ingreso ni egreso); el cambio muestra entregado → recibido y el tipo de cambio.
  const montoTexto = fila.montoDestino
    ? `${formatearMonto(fila.monto, fila.monedaId)} → ${formatearMonto(fila.montoDestino, fila.monedaDestinoId)}`
    : formatearMonto(fila.monto, fila.monedaId, { conSigno: !traspaso });
  const detalle = fila.tipoCambio ? `${fila.detalle} · TC ${formatearDecimal(fila.tipoCambio, 2)}` : fila.detalle;
  const clase = traspaso ? 'monto-neutro' : (fila.tipo === 'egreso' ? 'monto-egreso' : 'monto-ingreso');
  const boton = crear('button', { type: 'button', class: 'movs-fila', id }, [
    crear('span', { class: 'movs-icono', 'aria-hidden': 'true', texto: fila.emoji }),
    crear('span', { class: 'movs-texto' }, [
      crear('span', { class: 'movs-titulo', texto: fila.titulo }),
      crear('span', { class: 'movs-detalle', texto: detalle }),
    ]),
    crear('span', { class: `movs-monto ${clase}`, texto: montoTexto }),
  ]);
  boton.addEventListener('click', alTocar);
  return crear('li', {}, [boton]);
}
