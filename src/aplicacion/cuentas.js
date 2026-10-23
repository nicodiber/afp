// Casos de uso de las cuentas y las monedas (RF-CUE-01, RF-CUE-03, aep#12). Usan el puerto Almacen y el
// Reloj; las reglas están en el dominio. En v0.2.0 todavía no hay movimientos (llegan en v0.3.0).
import {
  validarCuenta, puedeCambiarMoneda, puedeEliminar, necesitaConfirmarArchivo, puedeReactivar,
  ordenParaNueva, moverCuenta, activasEnOrden, archivadas,
} from '../dominio/cuentas.js';
import { MONEDAS_POR_DEFECTO, puedeDesactivar } from '../dominio/monedas.js';

export function crearCasosCuentas({ almacen, reloj, nuevoId, movimientos = async () => [] }) {
  let cuentas = [];
  let monedas = [];
  const recargar = async () => {
    cuentas = await almacen.listar('cuentas');
    monedas = await almacen.listar('monedas');
  };
  const monedasActivas = () => monedas.filter((m) => m.activa).map((m) => m.id);
  const buscar = (id) => cuentas.find((c) => c.id === id);
  /** Saldo de una cuenta. En v0.2.0, sin movimientos, es el saldo inicial (RN-02). */
  const saldoDe = (cuenta) => cuenta.saldoInicial;

  return {
    /** Al abrir AFP (o cambiar de base): ARS y USD si la base todavía no tiene monedas (CA-18). */
    async preparar() {
      await recargar();
      if (monedas.length === 0) {
        await almacen.guardar('monedas', MONEDAS_POR_DEFECTO.map((m) => ({ ...m })));
        await recargar();
      }
    },
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

    /** Datos de ejemplo (RF-DAT-07, D-112): solo en la base de prueba; reemplazan cuentas y monedas. */
    async cargarEjemplo(datos) {
      await almacen.reemplazar({ cuentas: datos.cuentas, monedas: datos.monedas });
      await recargar();
    },
    async borrarTodo() {
      await almacen.reemplazar({ cuentas: [], monedas: MONEDAS_POR_DEFECTO.map((m) => ({ ...m })) });
      await recargar();
    },
  };
}
