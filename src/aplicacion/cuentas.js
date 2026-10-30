// Casos de uso de las cuentas y las monedas (RF-CUE-01, RF-CUE-03, aep#12). Usan el puerto Almacen y el
// Reloj; las reglas están en el dominio.
import {
  validarCuenta, puedeCambiarMoneda, puedeEliminar, necesitaConfirmarArchivo, puedeReactivar,
  ordenParaNueva, moverCuenta, activasEnOrden, archivadas,
} from '../dominio/cuentas.js';
import { MONEDAS_POR_DEFECTO, puedeDesactivar } from '../dominio/monedas.js';
import { saldo } from '../dominio/saldos.js';

// `movimientos` lee los movimientos (para saber si una cuenta se usa); `movimientosEnMemoria`, los que ya están
// cargados, para calcular saldos sin esperar (HU-02).
export function crearCasosCuentas({ almacen, reloj, nuevoId, movimientos = async () => [], movimientosEnMemoria = () => [] }) {
  let cuentas = [];
  let monedas = [];
  const recargar = async () => {
    cuentas = await almacen.listar('cuentas');
    monedas = await almacen.listar('monedas');
  };
  const monedasActivas = () => monedas.filter((m) => m.activa).map((m) => m.id);
  const buscar = (id) => cuentas.find((c) => c.id === id);
  /** Saldo de una cuenta a hoy (RN-02): su saldo inicial más los asientos de los movimientos confirmados. */
  const saldoDe = (cuenta) => saldo(cuenta, reloj.hoy(), movimientosEnMemoria());

  return {
    /** Al abrir AFP (o cambiar de base): ARS y USD si la base todavía no tiene monedas (CA-18). */
    async preparar() {
      await recargar();
      if (monedas.length === 0) {
        await almacen.guardar('monedas', MONEDAS_POR_DEFECTO.map((m) => ({ ...m })));
        await recargar();
      }
    },
    todas: () => cuentas,
    activas: () => activasEnOrden(cuentas),
    archivadas: () => archivadas(cuentas),
    hayCuentas: () => cuentas.length > 0,
    monedas: () => monedas.map((m) => ({ ...m })),
    monedasActivas,
    buscar,
    saldoDe,
    hoy: () => reloj.hoy(),

    /** Crea una cuenta; al final del orden (D-126). Devuelve { errores } o { cuenta }. */
    async crear(formulario) {
      const { errores, datos } = validarCuenta(formulario, { cuentas, hoy: reloj.hoy(), monedasActivas: monedasActivas() });
      if (Object.keys(errores).length) return { errores };
      const cuenta = { id: nuevoId(), ...datos, orden: ordenParaNueva(cuentas), estado: 'activa' };
      await almacen.guardar('cuentas', cuenta);
      await recargar();
      return { cuenta };
    },

    /** Hace que la cuenta empiece en `fecha` (anterior a su saldo inicial), con el mismo monto (HU-02b CA-4). */
    async adelantarInicio(id, fecha) {
      const cuenta = { ...buscar(id), fechaSaldoInicial: fecha };
      await almacen.guardar('cuentas', cuenta);
      await recargar();
      return buscar(id);
    },

    async editar(id, formulario) {
      const actual = buscar(id);
      const { errores, datos } = validarCuenta(formulario, { cuentas, hoy: reloj.hoy(), monedasActivas: [...new Set([...monedasActivas(), actual.monedaId])], id });
      if (!errores.monedaId && datos.monedaId !== actual.monedaId) {
        const permiso = puedeCambiarMoneda(actual, await movimientos());
        if (!permiso.ok) errores.monedaId = permiso.motivo;
      }
      if (Object.keys(errores).length) return { errores };
      const cuenta = { ...actual, ...datos };
      await almacen.guardar('cuentas', cuenta);
      await recargar();
      return { cuenta };
    },

    necesitaConfirmarArchivo: (id) => necesitaConfirmarArchivo(saldoDe(buscar(id))),
    async archivar(id) {
      await almacen.guardar('cuentas', { ...buscar(id), estado: 'archivada' });
      await recargar();
    },
    async reactivar(id) {
      const cuenta = buscar(id);
      const permiso = puedeReactivar(cuenta, cuentas);
      if (!permiso.ok) return permiso;
      await almacen.guardar('cuentas', { ...cuenta, estado: 'activa', orden: ordenParaNueva(cuentas) });
      await recargar();
      return { ok: true };
    },
    async puedeEliminar(id) { return puedeEliminar(buscar(id), await movimientos()); },
    async eliminar(id) {
      const permiso = await this.puedeEliminar(id);
      if (!permiso.ok) return permiso;
      await almacen.borrar('cuentas', id);
      await recargar();
      return { ok: true };
    },
    /** Lleva una cuenta activa a otra posición (desde 0). */
    async mover(id, posicion) {
      await almacen.guardar('cuentas', moverCuenta(cuentas, id, posicion));
      await recargar();
    },

    puedeDesactivarMoneda: (monedaId) => puedeDesactivar(monedaId, cuentas),
    async cambiarMoneda(monedaId, activa) {
      if (!activa) {
        const permiso = puedeDesactivar(monedaId, cuentas);
        if (!permiso.ok) return permiso;
      }
      await almacen.guardar('monedas', { ...monedas.find((m) => m.id === monedaId), activa });
      await recargar();
      return { ok: true };
    },

    /** Vuelve a leer la base (por ejemplo, después de cargar los datos de ejemplo). */
    recargar,
  };
}
