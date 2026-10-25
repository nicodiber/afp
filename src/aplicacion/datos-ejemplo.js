// Datos de ejemplo del modo prueba (RF-DAT-07, D-112, aep#12, aep#15): solo en la base de prueba; reemplazan
// cuentas, monedas y categorías de una vez, y avisan a los casos de uso que vuelvan a leer la base.
// Cargarlos deja resuelto el primer uso (inicioCompletado verdadero); borrarlos lo vuelve a ofrecer (aep HU-01).
import { MONEDAS_POR_DEFECTO } from '../dominio/monedas.js';
import { CONFIGURACION_POR_DEFECTO } from '../dominio/configuracion.js';

export function crearCasosDatosEjemplo({ almacen, recargar }) {
  const volverALeer = () => Promise.all(recargar.map((f) => f()));
  const configuracion = async (inicioCompletado) => ({ ...((await almacen.leerConfiguracion()) ?? CONFIGURACION_POR_DEFECTO), inicioCompletado });
  return {
    async cargar(datos) {
      await almacen.reemplazar({
        cuentas: datos.cuentas, monedas: datos.monedas,
        categorias: datos.categorias ?? [], ubicacionesCategoria: datos.ubicacionesCategoria ?? [],
        configuracion: [await configuracion(true)],
      });
      await volverALeer();
    },
    async borrar() {
      await almacen.reemplazar({
        cuentas: [], monedas: MONEDAS_POR_DEFECTO.map((m) => ({ ...m })), categorias: [], ubicacionesCategoria: [],
        configuracion: [await configuracion(false)],
      });
      await volverALeer();
    },
  };
}
