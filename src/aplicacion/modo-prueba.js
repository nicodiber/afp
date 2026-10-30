// Casos de uso del modo prueba (RF-DAT-07, aep#6): activar, desactivar, cambiar la fecha simulada
// y el reloj que usa todo AFP («hoy» es la fecha simulada en modo prueba).
import { esFechaValida, FECHA_SIMULADA_POR_DEFECTO } from '../dominio/fecha.js';

export function crearCasosModoPrueba({ preferencias, relojDelDispositivo }) {
  const activo = () => preferencias.leerModoPrueba() === 'si';
  const fechaSimulada = () => {
    const guardada = preferencias.leerFechaSimulada();
    return esFechaValida(guardada) ? guardada : FECHA_SIMULADA_POR_DEFECTO;
  };
  return {
    estado: () => (activo() ? { activo: true, fechaSimulada: fechaSimulada() } : { activo: false }),
    activar: () => preferencias.guardarModoPrueba('si'),
    desactivar: () => preferencias.guardarModoPrueba(null),
    cambiarFecha(fecha) {
      if (!esFechaValida(fecha)) throw new Error(`Fecha simulada no válida: ${fecha}`);
      preferencias.guardarFechaSimulada(fecha);
    },
    volverAFechaPorDefecto: () => preferencias.guardarFechaSimulada(FECHA_SIMULADA_POR_DEFECTO),
    fechaPorDefecto: FECHA_SIMULADA_POR_DEFECTO,
    /** Puerto Reloj para el resto de AFP. */
    reloj: { hoy: () => (activo() ? fechaSimulada() : relojDelDispositivo.hoy()), ahora: () => relojDelDispositivo.ahora() },
  };
}
