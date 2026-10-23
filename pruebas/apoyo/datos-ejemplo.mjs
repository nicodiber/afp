// Traduce datos-demo/datos-ejemplo.json al formato del núcleo (modelo de datos §3.7) para las pruebas.
// El archivo usa nombres propios para algunos tipos y campos (riesgo anotado en el plan de aep#8).
import { readFileSync } from 'node:fs';

export const datos = JSON.parse(readFileSync(new URL('../../datos-demo/datos-ejemplo.json', import.meta.url), 'utf8'));
const TIPOS = { cambio_de_moneda: 'cambio_moneda', gasto_pagado_por_terceros: 'pagado_por_terceros', cobro_de_prestamo: 'cobro_prestamo' };

export const monedaDe = Object.fromEntries(datos.cuentas.map((c) => [c.id, c.moneda]));

export function traducir(m) {
  const tipo = TIPOS[m.tipo] ?? m.tipo;
  const comun = { id: m.id, tipo, fecha: m.fecha, estado: m.estado === 'pendiente_de_revision' ? 'pendiente_revision' : m.estado };
  const partes = (m.partes ?? []).map((p) => ({ categoriaId: p.categoria, monto: p.monto }));
  switch (tipo) {
    case 'ingreso': case 'egreso': case 'devolucion':
      return { ...comun, cuentaId: m.cuenta, montoTotal: partes.reduce((s, p) => s + p.monto, 0), partes };
    case 'transferencia':
      return { ...comun, cuentaId: m.cuentaOrigen, cuentaDestinoId: m.cuentaDestino, montoTotal: m.monto };
    case 'cambio_moneda':
      return { ...comun, cuentaId: m.cuentaOrigen, cuentaDestinoId: m.cuentaDestino, montoTotal: m.montoOrigen, montoRecibido: m.montoDestino };
    case 'pagado_por_terceros':
      return { ...comun, monedaId: 'ARS', montoTotal: partes.reduce((s, p) => s + p.monto, 0), partes };
    case 'gasto_compartido':
      return { ...comun, cuentaId: m.cuenta, montoTotal: m.total, partes, deudores: m.aCobrar.map((d) => ({ personaId: d.persona, monto: d.monto })) };
    case 'prestamo_otorgado': case 'cobro_prestamo':
      return { ...comun, cuentaId: m.cuenta, personaId: m.persona, montoTotal: m.monto, partes };
    default:
      throw new Error(`Tipo sin traducir: ${m.tipo}`);
  }
}
