// Cálculo cruzado de la pestaña «Cambio» (HU-07 CA-3, D-191): lo que se recibe, el tipo de cambio y lo que se entrega se mantienen
// de acuerdo mientras se escribe. Manda lo último que se tocó entre «monto que recibís» y «tipo de cambio»; el monto que entregás
// recalcula al que mande. Las cuentas que se elijan o se inviertan también recalculan. Las cuentas y los cálculos son del dominio.
import { leerMonto, montoParaEditar, formatearDecimal } from '../dominio/formato.js';
import { tipoCambioDeOperacion, leerTipoCambio, montoRecibidoDesdeTipoCambio } from '../dominio/traspasos.js';

/**
 * @param {Object} o
 * @param {HTMLInputElement} o.monto  Lo que se entrega.
 * @param {HTMLInputElement} o.montoRecibido  Lo que se recibe.
 * @param {HTMLInputElement} o.tipoCambio  Pesos por unidad de la otra moneda, con 2 decimales a la vista.
 * @param {() => ({entrega: string, recibe: string}|null)} o.monedas  Las monedas de las dos cuentas elegidas, o null si falta alguna.
 */
export function enlazarCambio({ monto, montoRecibido, tipoCambio, monedas }) {
  let ultimo = null; // 'recibido' | 'tc': cuál de los dos escribió la persona en último lugar
  const centavos = (campo) => { const v = leerMonto(campo.value); return v !== null && v > 0 ? v : null; };

  function recalcular() {
    const m = monedas();
    const entregado = centavos(monto);
    if (!m || !entregado) return;
    if (ultimo === 'recibido') {
      const recibido = centavos(montoRecibido);
      const tc = recibido ? tipoCambioDeOperacion(entregado, recibido, m.entrega, m.recibe) : null;
      tipoCambio.value = tc ? formatearDecimal(tc, 2) : '';
    } else if (ultimo === 'tc') {
      const recibido = montoRecibidoDesdeTipoCambio(entregado, leerTipoCambio(tipoCambio.value), m.entrega, m.recibe);
      montoRecibido.value = recibido ? montoParaEditar(recibido) : '';
    }
  }
  monto.addEventListener('input', recalcular);
  montoRecibido.addEventListener('input', () => { ultimo = 'recibido'; recalcular(); });
  tipoCambio.addEventListener('input', () => { ultimo = 'tc'; recalcular(); });

  return {
    recalcular,
    /** Cambia lo que se entrega por lo que se recibe (y al revés); el tipo de cambio queda igual. */
    invertir() {
      const entregado = monto.value;
      monto.value = montoRecibido.value;
      montoRecibido.value = entregado;
    },
    reiniciar() { ultimo = null; tipoCambio.value = ''; montoRecibido.value = ''; },
  };
}
