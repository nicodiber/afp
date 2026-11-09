// Datos de ejemplo del modo prueba (RF-DAT-07, D-112, aep#12, aep#15, HU-38): solo en la base de prueba; reemplazan
// cuentas, monedas, categorías y movimientos de una vez (los movimientos se arman con las reglas de partida doble: si
// alguno no cumple, no se guarda nada) y avisan a los casos de uso que vuelvan a leer la base.
import { MONEDAS_POR_DEFECTO } from '../dominio/monedas.js';
import { armarMovimientosDeEjemplo } from '../dominio/movimientos.js';

export function crearCasosDatosEjemplo({ almacen, recargar }) {
  const volverALeer = () => Promise.all(recargar.map((f) => f()));
  return {
    async cargar(datos) {
      const categorias = datos.categorias ?? [];
      const movimientos = armarMovimientosDeEjemplo(datos.movimientosDeEjemplo ?? [], { cuentas: datos.cuentas, categorias });
      await almacen.reemplazar({
        cuentas: datos.cuentas, monedas: datos.monedas,
        categorias, ubicacionesCategoria: datos.ubicacionesCategoria ?? [], movimientos,
      });
      await volverALeer();
    },
    async borrar() {
      await almacen.reemplazar({ cuentas: [], monedas: MONEDAS_POR_DEFECTO.map((m) => ({ ...m })), categorias: [], ubicacionesCategoria: [], movimientos: [] });
      await volverALeer();
    },
  };
}
