// Casos de uso de los movimientos (RF-MOV-01, HU-02): registrar un egreso o un ingreso simple. Usan el puerto
// Almacen y el Reloj; las reglas están en el dominio (src/dominio/movimientos.js). Tienen los movimientos en memoria para calcular saldos
// (RNF-REN-02) y los vuelven a leer al cambiar de base.
import { formatearMonto } from '../dominio/formato.js';

// `cambio` anota cada movimiento guardado para poder deshacerlo (HU-41); sin él, se guarda igual.
export function crearCasosMovimientos({ almacen, reloj, nuevoId, cuentas, categorias, cambio = (fn) => fn() }) {
  let movimientos = [];
  const recargar = async () => { movimientos = await almacen.listar('movimientos'); };

  async function guardarNuevo(tipo, formulario) {
    // Las reglas de la carga se cargan recién al guardar: la pantalla inicial no las necesita (LCP).
    const { validarMovimiento, crearMovimientoSimple } = await import('../dominio/movimientos.js');
    const { errores, datos } = validarMovimiento(formulario, { cuentas: cuentas.todas(), categorias: categorias.todas(), hoy: reloj.hoy() }, tipo);
    if (Object.keys(errores).length) return { errores };
    const cuenta = cuentas.buscar(datos.cuentaId);
    // HU-02b CA-4: una fecha anterior al saldo inicial lo adelanta (mismo monto), antes de guardar el movimiento.
    const cuentaAjustada = datos.adelantaInicio ? await cuentas.adelantarInicio(cuenta.id, datos.fecha) : null;
    const movimiento = crearMovimientoSimple(tipo, datos, { id: nuevoId('mov'), cuenta, categoria: categorias.buscar(datos.categoriaId) });
    await almacen.guardar('movimientos', movimiento);
    movimientos = [...movimientos, movimiento];
    const actual = cuentas.buscar(cuenta.id);
    return { movimiento, cuenta: actual, saldo: cuentas.saldoDe(actual), ...(cuentaAjustada ? { cuentaAjustada } : {}) };
  }

  return {
    preparar: recargar,
    recargar,
    todos: () => movimientos,
    hay: () => movimientos.length > 0,
    hoy: () => reloj.hoy(),
    ahora: () => reloj.ahora(),

    /**
     * Valida y guarda un egreso o un ingreso (`tipo`). `formulario`: { fecha, monto, descripcion, categoriaId, cuentaId }.
     * Devuelve { errores } o { movimiento, cuenta, saldo } con el saldo nuevo de la cuenta. Se puede deshacer (HU-41).
     */
    registrar(tipo, formulario) {
      const texto = (r) => (r.movimiento ? `${tipo} de ${formatearMonto(r.movimiento.montoTotal, r.movimiento.monedaId)} en ${r.cuenta.nombre}` : null);
      return cambio(() => guardarNuevo(tipo, formulario), texto);
    },
    registrarEgreso(formulario) { return this.registrar('egreso', formulario); },
    registrarIngreso(formulario) { return this.registrar('ingreso', formulario); },
  };
}
