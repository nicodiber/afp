// Cargar (HU-02): hoy, «Nuevo egreso». Es una pantalla propia (#cargar), no una ventana: en el celular ocupa
// toda la pantalla y en la PC va en la columna central.
import { formularioEgreso } from '../formulario-egreso.js';
import { avisar } from '../dialogo.js';
import { formatearMonto } from '../../dominio/formato.js';

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
    hoy: movimientos.hoy, esPC, cuentas, categorias, alCancelar: volver,
    alGuardar: async (formulario, otro) => {
      let resultado;
      try {
        resultado = await movimientos.registrarEgreso(formulario);
      } catch {
        avisar('No se pudo guardar el egreso. Probá de nuevo.');
        return { errores: {} };
      }
      if (resultado.errores) return resultado;
      avisar(`Guardaste el egreso. Saldo de ${resultado.cuenta.nombre}: ${formatearMonto(resultado.saldo, resultado.cuenta.monedaId)}.`);
      if (!otro) volver();
      return {};
    },
  });
  return elementos;
}
