// Saldos (RN-02). Función pura, aparte del núcleo de partida doble para que la pantalla inicial no cargue todo el núcleo.

/** Saldo de una cuenta a una fecha (RN-02): saldo inicial + asientos de los movimientos confirmados hasta esa fecha. */
export function saldo(cuenta, fecha, movimientos) {
  let total = cuenta.saldoInicial;
  for (const m of movimientos) {
    if (m.estado !== 'confirmado' || m.fecha > fecha) continue;
    for (const a of m.asientos) if (a.cuentaId === cuenta.id) total += a.monto;
  }
  return total;
}
