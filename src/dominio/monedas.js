// Monedas (RF-CUE-03, modelo de datos §3.3, aep#12). En v0.2.0, ARS y USD. Funciones puras.

export const MONEDA_BASE = 'ARS';

export const MONEDAS_POR_DEFECTO = Object.freeze([
  Object.freeze({ id: 'ARS', nombre: 'Peso argentino', simbolo: '$', decimales: 2, clase: 'fiat', cotizacion: 'base', activa: true }),
  Object.freeze({ id: 'USD', nombre: 'Dólar estadounidense', simbolo: 'US$', decimales: 2, clase: 'fiat', cotizacion: 'diaria', activa: true }),
]);

/** ARS nunca se desactiva; otra moneda, solo si ninguna cuenta (activa o archivada) la usa (D-122). */
export function puedeDesactivar(monedaId, cuentas) {
  if (monedaId === MONEDA_BASE) return { ok: false, motivo: `${MONEDA_BASE} es la moneda base: no se puede desactivar.` };
  const usa = cuentas.find((c) => c.monedaId === monedaId);
  if (usa) return { ok: false, motivo: `No podés desactivar ${monedaId}: la usa la cuenta ${usa.nombre}.` };
  return { ok: true };
}
