// Reglas de las cuentas (RF-CUE-01, modelo de datos §3.4, aep#12). Funciones puras: sin navegador ni almacenamiento.
import { leerMonto } from './formato.js';
import { esFechaValida } from './fecha.js';
import { capitalizarInicial } from './texto.js';

/** Tipos que se eligen a mano; «Préstamos a cobrar» y «Deuda» las crea AFP sola (INV-17). */
export const TIPOS_ELEGIBLES = Object.freeze(['efectivo', 'billetera_virtual', 'banco', 'broker', 'transporte', 'cripto']);
export const NOMBRES_DE_TIPO = Object.freeze({
  efectivo: 'Efectivo', billetera_virtual: 'Billetera virtual', banco: 'Banco', broker: 'Broker', transporte: 'Transporte',
  cripto: 'Cripto/stablecoin', prestamo_a_cobrar: 'Préstamos a cobrar', deuda: 'Deuda',
});
export const PROPOSITOS = Object.freeze(['ninguno', 'emergencia', 'ahorro', 'inversion']);
export const NOMBRES_DE_PROPOSITO = Object.freeze({ ninguno: 'Ninguno', emergencia: 'Emergencia', ahorro: 'Ahorro', inversion: 'Inversión' });

export const MENSAJES = Object.freeze({
  nombreLargo: 'El nombre tiene que tener entre 1 y 40 caracteres.',
  nombreRepetido: 'Ya existe una cuenta con ese nombre',
  monto: 'Escribí un monto con hasta 2 decimales.',
  fechaFutura: 'La fecha no puede ser posterior a hoy.',
  fechaInvalida: 'Elegí una fecha válida.',
  tipo: 'Elegí un tipo de cuenta.',
  moneda: 'Elegí una moneda activa.',
  notas: 'Las notas pueden tener hasta 500 caracteres.',
  monedaConMovimientos: 'No podés cambiar la moneda: la cuenta tiene movimientos.',
  eliminarConMovimientos: 'No podés eliminarla porque tiene movimientos. Podés archivarla.',
});

const clave = (nombre) => nombre.trim().toLocaleLowerCase('es');
const usaLaCuenta = (id) => (m) => m.cuentaId === id || m.cuentaDestinoId === id;

export const activasEnOrden = (cuentas) => cuentas.filter((c) => c.estado === 'activa').sort((a, b) => a.orden - b.orden);
export const archivadas = (cuentas) => cuentas.filter((c) => c.estado === 'archivada');

/** true si otra cuenta activa ya usa ese nombre (INV-07: sin distinguir mayúsculas ni espacios alrededor). */
export function nombreOcupado(nombre, cuentas, salvoId) {
  return cuentas.some((c) => c.estado === 'activa' && c.id !== salvoId && clave(c.nombre) === clave(nombre));
}

/**
 * Valida el formulario de una cuenta. `id` es el de la cuenta que se edita (o nada si es nueva).
 * Devuelve { errores: {campo: mensaje}, datos } con los datos normalizados (saldo en centavos).
 */
export function validarCuenta(formulario, { cuentas, hoy, monedasActivas, id }) {
  const errores = {};
  const nombre = capitalizarInicial(String(formulario.nombre ?? '').trim());
  if (nombre.length < 1 || nombre.length > 40) errores.nombre = MENSAJES.nombreLargo;
  else if (nombreOcupado(nombre, cuentas, id)) errores.nombre = MENSAJES.nombreRepetido;
  if (!TIPOS_ELEGIBLES.includes(formulario.tipo)) errores.tipo = MENSAJES.tipo;
  if (!monedasActivas.includes(formulario.monedaId)) errores.monedaId = MENSAJES.moneda;
  // Vacío cuenta como 0 (D-135).
  const textoSaldo = String(formulario.saldoInicial ?? '').trim();
  const saldoInicial = textoSaldo === '' ? 0 : leerMonto(textoSaldo);
  if (saldoInicial === null) errores.saldoInicial = MENSAJES.monto;
  const fecha = formulario.fechaSaldoInicial;
  if (!esFechaValida(fecha)) errores.fechaSaldoInicial = MENSAJES.fechaInvalida;
  else if (fecha > hoy) errores.fechaSaldoInicial = MENSAJES.fechaFutura;
  const notas = String(formulario.notas ?? '');
  if (notas.length > 500) errores.notas = MENSAJES.notas;
  const proposito = PROPOSITOS.includes(formulario.proposito) ? formulario.proposito : 'ninguno';
  return {
    errores,
    datos: {
      nombre, tipo: formulario.tipo, monedaId: formulario.monedaId, saldoInicial, fechaSaldoInicial: fecha,
      tieneRendimiento: Boolean(formulario.tieneRendimiento), emoji: String(formulario.emoji ?? '').trim(), notas, proposito,
    },
  };
}

/** La moneda no cambia si la cuenta tiene movimientos (INV-06, D-121). */
export function puedeCambiarMoneda(cuenta, movimientos) {
  return movimientos.some(usaLaCuenta(cuenta.id)) ? { ok: false, motivo: MENSAJES.monedaConMovimientos } : { ok: true };
}

/** Una cuenta con movimientos no se elimina: se ofrece archivarla (RF-CUE-01, D-120). */
export function puedeEliminar(cuenta, movimientos) {
  return movimientos.some(usaLaCuenta(cuenta.id)) ? { ok: false, motivo: MENSAJES.eliminarConMovimientos } : { ok: true };
}

/** Archivar pide confirmación si el saldo no es 0 (RF-CUE-01). */
export const necesitaConfirmarArchivo = (saldo) => saldo !== 0;

/** Reactivar una archivada, salvo que una activa tenga su nombre (D-125). */
export function puedeReactivar(cuenta, cuentas) {
  return nombreOcupado(cuenta.nombre, cuentas, cuenta.id) ? { ok: false, motivo: MENSAJES.nombreRepetido } : { ok: true };
}

/** Una cuenta nueva (o reactivada) va al final del orden (D-126). */
export const ordenParaNueva = (cuentas) => cuentas.reduce((maximo, c) => Math.max(maximo, c.orden ?? 0), 0) + 1;

/** Lleva la cuenta `id` a la posición `posicion` (desde 0) entre las activas; devuelve las activas con orden 1…n. */
export function moverCuenta(cuentas, id, posicion) {
  const lista = activasEnOrden(cuentas);
  const desde = lista.findIndex((c) => c.id === id);
  if (desde < 0) return lista;
  const [movida] = lista.splice(desde, 1);
  lista.splice(Math.max(0, Math.min(posicion, lista.length)), 0, movida);
  return lista.map((c, i) => ({ ...c, orden: i + 1 }));
}
