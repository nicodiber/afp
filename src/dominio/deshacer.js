// Deshacer y rehacer (HU-41, D-183). Lógica pura: la pila de cambios de la sesión y las reglas para revertir uno sin dejar
// datos huérfanos. Cada entrada es { texto, cambios }; cada cambio, { almacen, id, antes, despues } con el registro como
// estaba antes (null si no existía) y como quedó después (null si se borró). No sabe cómo se guardan los datos: la
// aplicación le pasa los registros y aplica las operaciones que le devuelve.

/** Cuántos cambios se pueden deshacer en una sesión. */
export const LIMITE_DESHACER = 20;

/**
 * La pila de la sesión. `deshacer()` y `rehacer()` solo miran la entrada que toca; la aplicación llama a
 * `confirmarDeshecho()` o `confirmarRehecho()` cuando logró revertirla (si no pudo, la pila no cambia).
 */
export function crearPilaDeshacer(limite = LIMITE_DESHACER) {
  let hechos = [];
  let deshechos = [];
  return {
    /** Anota un cambio nuevo: borra lo que se podía rehacer y descarta el más viejo si se pasa del límite. */
    registrar(entrada) {
      hechos.push(entrada);
      if (hechos.length > limite) hechos = hechos.slice(hechos.length - limite);
      deshechos = [];
    },
    proximoADeshacer: () => hechos.at(-1) ?? null,
    proximoARehacer: () => deshechos.at(-1) ?? null,
    confirmarDeshecho() { const e = hechos.pop() ?? null; if (e) deshechos.push(e); return e; },
    confirmarRehecho() { const e = deshechos.pop() ?? null; if (e) hechos.push(e); return e; },
    vaciar() { hechos = []; deshechos = []; },
    cuantosSeDeshacen: () => hechos.length,
    cuantosSeRehacen: () => deshechos.length,
  };
}

/**
 * Suma un cambio a la lista de una entrada en armado: si ese registro ya cambió en la misma entrada, conserva el «antes»
 * del primero y el «después» del último.
 */
export function sumarCambio(cambios, nuevo) {
  const i = cambios.findIndex((c) => c.almacen === nuevo.almacen && c.id === nuevo.id);
  if (i < 0) return [...cambios, nuevo];
  const copia = [...cambios];
  copia[i] = { ...copia[i], despues: nuevo.despues };
  return copia;
}

/** Los cambios que no cambian nada (el registro quedó igual) se descartan. */
export function cambiosReales(cambios) {
  return cambios.filter((c) => JSON.stringify(c.antes) !== JSON.stringify(c.despues));
}

/**
 * Qué hay que escribir para revertir (`sentido` 'deshacer': vuelve al «antes») o repetir ('rehacer': vuelve al «después»)
 * una entrada: una lista de { tipo: 'guardar', almacen, registro } o { tipo: 'borrar', almacen, id }.
 */
export function operacionesDe(entrada, sentido) {
  const cambios = sentido === 'deshacer' ? [...entrada.cambios].reverse() : entrada.cambios;
  return cambios.map((c) => {
    const registro = sentido === 'deshacer' ? c.antes : c.despues;
    return registro === null ? { tipo: 'borrar', almacen: c.almacen, id: c.id } : { tipo: 'guardar', almacen: c.almacen, registro };
  });
}

/**
 * Comprueba que aplicar `operaciones` no deja datos huérfanos: una cuenta o una categoría que se borra no puede tener
 * movimientos ni subcategorías, y un movimiento que se guarda necesita su cuenta y sus categorías.
 * `estado`: { cuentas, categorias, movimientos } como están ahora. Devuelve null si se puede, o { motivo }
 * (por ejemplo «Mercado Pago ya tiene movimientos»).
 */
export function problemaAlAplicar(operaciones, { cuentas, categorias, movimientos }) {
  const borra = (almacen) => new Set(operaciones.filter((o) => o.tipo === 'borrar' && o.almacen === almacen).map((o) => o.id));
  const guarda = (almacen) => operaciones.filter((o) => o.tipo === 'guardar' && o.almacen === almacen).map((o) => o.registro);
  const cuentasBorradas = borra('cuentas');
  const categoriasBorradas = borra('categorias');
  const movimientosBorrados = borra('movimientos');
  const movimientosQueQuedan = [...movimientos.filter((m) => !movimientosBorrados.has(m.id)), ...guarda('movimientos')];
  const categoriasQueQuedan = [...categorias.filter((c) => !categoriasBorradas.has(c.id)), ...guarda('categorias')];
  const cuentasQueQuedan = [...cuentas.filter((c) => !cuentasBorradas.has(c.id)), ...guarda('cuentas')];
  const usaCategoria = (m, id) => (m.partes ?? []).some((p) => p.categoriaId === id);

  for (const id of cuentasBorradas) {
    if (movimientosQueQuedan.some((m) => m.cuentaId === id)) return { motivo: `${cuentas.find((c) => c.id === id)?.nombre ?? 'La cuenta'} ya tiene movimientos` };
  }
  for (const id of categoriasBorradas) {
    const nombre = categorias.find((c) => c.id === id)?.nombre ?? 'La categoría';
    if (movimientosQueQuedan.some((m) => usaCategoria(m, id))) return { motivo: `${nombre} ya tiene movimientos` };
    if (categoriasQueQuedan.some((c) => c.padreId === id)) return { motivo: `${nombre} ya tiene subcategorías` };
  }
  for (const m of guarda('movimientos')) {
    const faltaCuenta = !cuentasQueQuedan.some((c) => c.id === m.cuentaId);
    const faltaCategoria = (m.partes ?? []).some((p) => !categoriasQueQuedan.some((c) => c.id === p.categoriaId));
    if (faltaCuenta || faltaCategoria) return { motivo: 'la cuenta o la categoría del movimiento ya no existe' };
  }
  return null;
}
