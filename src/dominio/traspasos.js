// Transferencias entre cuentas propias y cambios de moneda (RF-MOV-04, RF-MOV-05, HU-06, HU-07, D-190, D-191). Funciones puras.
// Dinero en enteros (centavos); el tipo de cambio es un decimal en texto («1450.0000») y se calcula con BigInt, sin coma flotante.
import { capitalizarInicial } from './texto.js';
import { esFechaValida } from './fecha.js';
import { leerMonto } from './formato.js';
import { crearMovimiento, verificarPartidaDoble, ErrorPartidaDoble } from './partida-doble.js';
import { MENSAJES } from './movimientos.js';

export const MENSAJES_TRASPASO = Object.freeze({
  cuentaOrigen: 'Elegí la cuenta de origen.',
  cuentaDestino: 'Elegí la cuenta de destino.',
  mismaCuenta: 'El origen y el destino tienen que ser cuentas distintas.',
  otraMoneda: 'Las cuentas son de distinta moneda: eso es un cambio. Andá a la pestaña «Cambio».',
  mismaMoneda: 'Las cuentas son de la misma moneda: eso es una transferencia. Andá a la pestaña «Transferencia».',
  montoRecibido: 'Escribí el monto que recibís, mayor que 0.',
});

const activa = (x) => x.estado === 'activa';
const DECIMALES_TIPO_CAMBIO = 4;

/** a ÷ b redondeado al entero más cercano (mitades hacia arriba), con BigInt positivos. */
const dividirRedondeando = (a, b) => (a * 2n + b) / (b * 2n);

/**
 * Tipo de cambio de operación (modelo de datos 3.7.5), en texto con 4 decimales: si una moneda es ARS, los pesos ÷ la otra moneda
 * (siempre pesos por unidad); si ninguna lo es, lo entregado ÷ lo recibido. Los montos son centavos (la razón es la misma que en
 * unidades). null si algún monto no es un entero mayor que 0.
 */
export function tipoCambioDeOperacion(entregado, recibido, monedaEntrega, monedaRecibe) {
  if (!Number.isSafeInteger(entregado) || !Number.isSafeInteger(recibido) || entregado <= 0 || recibido <= 0) return null;
  const [numerador, denominador] = monedaEntrega === 'ARS' ? [entregado, recibido] : (monedaRecibe === 'ARS' ? [recibido, entregado] : [entregado, recibido]);
  const escala = 10n ** BigInt(DECIMALES_TIPO_CAMBIO);
  const valor = dividirRedondeando(BigInt(numerador) * escala, BigInt(denominador)).toString().padStart(DECIMALES_TIPO_CAMBIO + 1, '0');
  return `${valor.slice(0, -DECIMALES_TIPO_CAMBIO)}.${valor.slice(-DECIMALES_TIPO_CAMBIO)}`;
}

/** Lo que se escribe como tipo de cambio («1.450,5» → 145050 centésimas); null si no es un número mayor que 0 con hasta 2 decimales. */
export function leerTipoCambio(texto) {
  const centesimas = leerMonto(texto);
  return centesimas !== null && centesimas > 0 ? centesimas : null;
}

/**
 * El monto que se recibe (centavos) dado lo entregado y el tipo de cambio escrito (en centésimas, ver leerTipoCambio): si se entregan
 * pesos, pesos ÷ tipo de cambio; si se reciben pesos, dólares × tipo de cambio; si ninguna es ARS, entregado ÷ tipo de cambio.
 * Redondea al centavo. null si el monto o el tipo de cambio no son válidos.
 */
export function montoRecibidoDesdeTipoCambio(entregado, centesimas, monedaEntrega, monedaRecibe) {
  if (!Number.isSafeInteger(entregado) || entregado <= 0 || !Number.isSafeInteger(centesimas) || centesimas <= 0) return null;
  const e = BigInt(entregado);
  const t = BigInt(centesimas);
  const recibido = monedaRecibe === 'ARS' && monedaEntrega !== 'ARS' ? dividirRedondeando(e * t, 100n) : dividirRedondeando(e * 100n, t);
  return recibido > 0n && recibido <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(recibido) : null;
}

// Fecha, hora y descripción: las mismas reglas que un egreso o un ingreso.
function validarComunes(formulario, hoy, errores) {
  const fecha = String(formulario.fecha ?? '');
  if (!esFechaValida(fecha)) errores.fecha = MENSAJES.fechaInvalida;
  else if (fecha > hoy) errores.fecha = MENSAJES.fechaFutura;
  const hora = String(formulario.hora ?? '').trim();
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) errores.hora = MENSAJES.hora;
  const descripcion = capitalizarInicial(String(formulario.descripcion ?? '').trim());
  if (descripcion.length > 120) errores.descripcion = MENSAJES.descripcion;
  return { fecha, hora: hora || null, descripcion };
}

const montoValido = (texto) => {
  const centavos = leerMonto(texto);
  return centavos !== null && centavos > 0 && Number.isSafeInteger(centavos) ? centavos : null;
};

// Las cuentas de origen y destino, con lo que hay que avisar si la fecha es anterior a su saldo inicial (HU-02b CA-4, D-161).
function validarCuentas(formulario, cuentas, fecha, errores, { monedas }) {
  const origen = cuentas.find((c) => c.id === formulario.cuentaId && activa(c));
  const destino = cuentas.find((c) => c.id === formulario.cuentaDestinoId && activa(c));
  if (!origen) errores.cuenta = MENSAJES_TRASPASO.cuentaOrigen;
  if (!destino) errores.cuentaDestino = MENSAJES_TRASPASO.cuentaDestino;
  if (origen && destino) {
    if (origen.id === destino.id) errores.cuentaDestino = MENSAJES_TRASPASO.mismaCuenta;
    else if (monedas === 'iguales' && origen.monedaId !== destino.monedaId) errores.cuentaDestino = MENSAJES_TRASPASO.otraMoneda;
    else if (monedas === 'distintas' && origen.monedaId === destino.monedaId) errores.cuentaDestino = MENSAJES_TRASPASO.mismaMoneda;
  }
  const adelantan = esFechaValida(fecha) ? [origen, destino].filter((c) => c && fecha < c.fechaSaldoInicial).map((c) => c.id) : [];
  return { origen, destino, adelantan };
}

/**
 * Valida el formulario de una transferencia: { fecha, hora, monto (texto), descripcion, cuentaId (origen), cuentaDestinoId }.
 * Devuelve { errores, datos, sugerirCambio }; `sugerirCambio` es true cuando las cuentas son de distinta moneda (eso es un cambio).
 */
export function validarTransferencia(formulario, { cuentas, hoy }) {
  const errores = {};
  const comunes = validarComunes(formulario, hoy, errores);
  const montoTotal = montoValido(formulario.monto);
  if (montoTotal === null) errores.monto = MENSAJES.monto;
  const { origen, destino, adelantan } = validarCuentas(formulario, cuentas, comunes.fecha, errores, { monedas: 'iguales' });
  return {
    errores,
    sugerirCambio: errores.cuentaDestino === MENSAJES_TRASPASO.otraMoneda,
    datos: { ...comunes, montoTotal, cuentaId: origen?.id, cuentaDestinoId: destino?.id, adelantan },
  };
}

/**
 * Valida el formulario de un cambio de moneda: { fecha, hora, descripcion, cuentaId (entrega), monto (lo que entregás),
 * cuentaDestinoId (recibe), montoRecibido }. El tipo de cambio no se valida: sale de los dos montos.
 * Devuelve { errores, datos, sugerirTransferencia }.
 */
export function validarCambio(formulario, { cuentas, hoy }) {
  const errores = {};
  const comunes = validarComunes(formulario, hoy, errores);
  const montoTotal = montoValido(formulario.monto);
  if (montoTotal === null) errores.monto = MENSAJES.monto;
  const montoRecibido = montoValido(formulario.montoRecibido);
  if (montoRecibido === null) errores.montoRecibido = MENSAJES_TRASPASO.montoRecibido;
  const { origen, destino, adelantan } = validarCuentas(formulario, cuentas, comunes.fecha, errores, { monedas: 'distintas' });
  return {
    errores,
    sugerirTransferencia: errores.cuentaDestino === MENSAJES_TRASPASO.mismaMoneda,
    datos: { ...comunes, montoTotal, montoRecibido, cuentaId: origen?.id, cuentaDestinoId: destino?.id, adelantan },
  };
}

function contexto(cuentas) {
  return {
    monedaDeCuenta: (id) => cuentas.find((c) => c.id === id).monedaId,
    cuentaDePersona: () => { throw new ErrorPartidaDoble('Una transferencia o un cambio no usan cuentas de personas.'); },
  };
}

function armar(tipo, datos, { id, origen, destino }, extra, origenDelDato) {
  const ctx = contexto([origen, destino]);
  const movimiento = crearMovimiento({
    id, tipo, fecha: datos.fecha, hora: datos.hora ?? null, descripcion: datos.descripcion, estado: 'confirmado', origen: origenDelDato,
    cuentaId: origen.id, cuentaDestinoId: destino.id, monedaId: origen.monedaId, montoTotal: datos.montoTotal, ...extra, revisarCategoria: false,
  }, ctx);
  const problemas = verificarPartidaDoble(movimiento, ctx);
  if (problemas.length) throw new ErrorPartidaDoble(problemas.join('; '));
  return movimiento;
}

/** Arma la transferencia (tipo `transferencia`, sin partes ni categoría) y la pasa por el núcleo de partida doble. Lanza ErrorPartidaDoble si no cuadra. */
export function crearTransferencia(datos, referencias, origen = 'manual') {
  if (referencias.origen.monedaId !== referencias.destino.monedaId) throw new ErrorPartidaDoble('Una transferencia es entre cuentas de la misma moneda.');
  return armar('transferencia', datos, referencias, {}, origen);
}

/** Arma el cambio de moneda con su tipo de cambio de operación (3.7.5) y lo pasa por el núcleo de partida doble. */
export function crearCambio(datos, referencias, origen = 'manual') {
  const { origen: cuentaOrigen, destino } = referencias;
  const tipoCambioOperacion = tipoCambioDeOperacion(datos.montoTotal, datos.montoRecibido, cuentaOrigen.monedaId, destino.monedaId);
  if (tipoCambioOperacion === null) throw new ErrorPartidaDoble('Los montos de un cambio de moneda tienen que ser mayores que 0.');
  return armar('cambio_moneda', datos, referencias, { montoRecibido: datos.montoRecibido, tipoCambioOperacion }, origen);
}
