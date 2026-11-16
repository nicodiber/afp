// Cargar (HU-02, HU-03, HU-06, HU-07): un egreso, un ingreso, una transferencia o un cambio de moneda. Es una pantalla propia (#cargar), no una ventana: en el celular ocupa
// toda la pantalla y en la PC va en la columna central.
import { formularioEgreso } from '../formulario-egreso.js';
import { avisar, avisarCambio } from '../dialogo.js';
import { formatearMonto } from '../../dominio/formato.js';
import { formatearFecha } from '../../dominio/fecha.js';

const NOMBRES = {
  egreso: { articulo: 'el egreso' }, ingreso: { articulo: 'el ingreso' },
  transferencia: { articulo: 'la transferencia' }, cambio_moneda: { articulo: 'el cambio de moneda' },
};

/**
 * @param {Object} o
 * @param {object} o.movimientos  Casos de uso de movimientos.
 * @param {object} o.cuentas
 * @param {object} o.categorias
 * @param {boolean} o.esPC
 * @param {() => void} o.volver  Vuelve a la pantalla anterior.
 */
export function pantallaCargar({ movimientos, cuentas, categorias, esPC, volver }) {
  const { elementos } = formularioEgreso({
    hoy: movimientos.hoy, ahora: movimientos.ahora, esPC, cuentas, categorias, alCancelar: volver,
    alGuardar: async (formulario, otro) => {
      let resultado;
      try {
        resultado = await movimientos.registrar(formulario.tipo, formulario);
      } catch {
        avisar(`No se pudo guardar ${NOMBRES[formulario.tipo].articulo}. Probá de nuevo.`);
        return { errores: {} };
      }
      if (resultado.errores) return resultado;
      const que = NOMBRES[formulario.tipo];
      if (resultado.cuentaAjustada) avisarCambio(`Guardaste ${que.articulo}. La cuenta ${resultado.cuentaAjustada.nombre} ahora empieza el ${formatearFecha(resultado.cuentaAjustada.fechaSaldoInicial)}.`);
      else if (resultado.cuentaDestino) {
        avisarCambio(`Guardaste ${que.articulo}. Saldo de ${resultado.cuenta.nombre}: ${formatearMonto(resultado.saldo, resultado.cuenta.monedaId)} · ${resultado.cuentaDestino.nombre}: ${formatearMonto(resultado.saldoDestino, resultado.cuentaDestino.monedaId)}.`);
      } else avisarCambio(`Guardaste ${que.articulo}. Saldo de ${resultado.cuenta.nombre}: ${formatearMonto(resultado.saldo, resultado.cuenta.monedaId)}.`);
      if (!otro) volver();
      return {};
    },
  });
  return elementos;
}
