// Casos de uso de los movimientos (RF-MOV-01, HU-02): por ahora, registrar un egreso simple. Usan el puerto
// Almacen y el Reloj; las reglas están en el dominio (src/dominio/movimientos.js). Tienen los movimientos en memoria para calcular saldos
// (RNF-REN-02) y los vuelven a leer al cambiar de base.
export function crearCasosMovimientos({ almacen, reloj, nuevoId, cuentas, categorias }) {
  let movimientos = [];
  const recargar = async () => { movimientos = await almacen.listar('movimientos'); };

  return {
    preparar: recargar,
    recargar,
    todos: () => movimientos,
    hay: () => movimientos.length > 0,
    hoy: () => reloj.hoy(),

    /**
     * Valida y guarda un egreso. `formulario`: { fecha, monto, descripcion, categoriaId, cuentaId }.
     * Devuelve { errores } o { movimiento, cuenta, saldo } con el saldo nuevo de la cuenta.
     */
    async registrarEgreso(formulario) {
      // Las reglas de la carga se cargan recién al guardar: la pantalla inicial no las necesita (LCP).
      const { validarEgreso, crearEgreso } = await import('../dominio/movimientos.js');
      const { errores, datos } = validarEgreso(formulario, { cuentas: cuentas.todas(), categorias: categorias.todas(), hoy: reloj.hoy() });
      if (Object.keys(errores).length) return { errores };
      const cuenta = cuentas.buscar(datos.cuentaId);
      const movimiento = crearEgreso(datos, { id: nuevoId('mov'), cuenta, categoria: categorias.buscar(datos.categoriaId) });
      await almacen.guardar('movimientos', movimiento);
      movimientos = [...movimientos, movimiento];
      return { movimiento, cuenta, saldo: cuentas.saldoDe(cuenta) };
    },
  };
}
