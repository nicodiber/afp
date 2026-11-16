// Casos de uso de la transferencia y del cambio de moneda (RF-MOV-04, RF-MOV-05, HU-06, HU-07). Se cargan con `import()` al guardar
// (no son parte del arranque). Las reglas están en el dominio (src/dominio/traspasos.js).
import { formatearMonto } from '../dominio/formato.js';

/**
 * Valida y guarda una transferencia (`transferencia`) o un cambio de moneda (`cambio_moneda`): dos cuentas, sin categoría. Una fecha
 * anterior al saldo inicial de cualquiera de las dos lo adelanta (D-161) antes de guardar. Devuelve { errores } (con
 * `sugerirCambio` o `sugerirTransferencia` si las monedas no son las que corresponden) o el movimiento con las dos cuentas y sus saldos.
 */
export async function guardarTraspaso(tipo, formulario, { almacen, reloj, nuevoId, cuentas, agregar }) {
  const { validarTransferencia, validarCambio, crearTransferencia, crearCambio } = await import('../dominio/traspasos.js');
  const contexto = { cuentas: cuentas.todas(), hoy: reloj.hoy() };
  const { errores, datos, ...aviso } = tipo === 'cambio_moneda' ? validarCambio(formulario, contexto) : validarTransferencia(formulario, contexto);
  if (Object.keys(errores).length) return { errores, ...aviso };
  const ajustadas = [];
  for (const id of datos.adelantan) ajustadas.push(await cuentas.adelantarInicio(id, datos.fecha));
  const referencias = { id: nuevoId('mov'), origen: cuentas.buscar(datos.cuentaId), destino: cuentas.buscar(datos.cuentaDestinoId) };
  const movimiento = (tipo === 'cambio_moneda' ? crearCambio : crearTransferencia)(datos, referencias);
  await almacen.guardar('movimientos', movimiento);
  agregar(movimiento);
  const origen = cuentas.buscar(datos.cuentaId);
  const destino = cuentas.buscar(datos.cuentaDestinoId);
  return {
    texto: tipo === 'cambio_moneda'
      ? `cambio de ${formatearMonto(movimiento.montoTotal, movimiento.monedaId)} a ${formatearMonto(movimiento.montoRecibido, destino.monedaId)} (${origen.nombre} a ${destino.nombre})`
      : `transferencia de ${formatearMonto(movimiento.montoTotal, movimiento.monedaId)} de ${origen.nombre} a ${destino.nombre}`,
    movimiento, cuenta: origen, saldo: cuentas.saldoDe(origen), cuentaDestino: destino, saldoDestino: cuentas.saldoDe(destino),
    ...(ajustadas.length ? { cuentaAjustada: ajustadas[0] } : {}),
  };
}
