// Prepara la base del dispositivo al abrir AFP (aep#9): configuración por defecto y estado del almacenamiento.
import { CONFIGURACION_POR_DEFECTO } from '../dominio/configuracion.js';

export function crearCasosDatosDispositivo(almacen) {
  let estado = 'comprobando';
  return {
    async preparar() {
      if (!almacen.disponible()) { estado = 'sin-almacenamiento'; return estado; }
      try {
        const configuracion = await almacen.leerConfiguracion();
        if (!configuracion) await almacen.guardarConfiguracion({ ...CONFIGURACION_POR_DEFECTO });
        estado = await almacen.persistencia();
      } catch {
        estado = 'sin-almacenamiento';
      }
      return estado;
    },
    estado: () => estado,
    leerConfiguracion: () => almacen.leerConfiguracion(),
  };
}
