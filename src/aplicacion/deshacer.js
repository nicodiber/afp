// Deshacer y rehacer (HU-41, D-183): anota cada cambio guardado con lo necesario para revertirlo y repetirlo, y lo revierte
// o repite cuando se pide. Los casos de uso de movimientos, cuentas y categorías piden `cambio(fn, describir)`; el almacén
// «registrado» que devuelve esto mira lo que escribe `fn` (el registro como estaba y como quedó) y lo anota. Las reglas
// y la pila están en el dominio (src/dominio/deshacer.js). La pila vive en memoria: se pierde al recargar.
import { crearPilaDeshacer, sumarCambio, cambiosReales, operacionesDe, problemaAlAplicar } from '../dominio/deshacer.js';

/**
 * @param {Object} o
 * @param {object} o.almacen  Puerto Almacen de la base actual.
 * @param {() => Promise<void>} o.recargar  Vuelve a leer cuentas, categorías y movimientos después de revertir.
 */
export function crearCasosDeshacer({ almacen, recargar }) {
  const pila = crearPilaDeshacer();
  let captura = null; // { cambios, previos } mientras un cambio se está guardando
  // Un cambio, un deshacer o un rehacer a la vez, en el orden en que se piden.
  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  const previos = async (nombre) => {
    if (!captura.previos.has(nombre)) captura.previos.set(nombre, new Map((await almacen.listar(nombre)).map((r) => [r.id, r])));
    return captura.previos.get(nombre);
  };
  const anotar = (cambio) => { captura.cambios = sumarCambio(captura.cambios, cambio); };

  /** El almacén que usan los casos de uso: igual al real, pero anota lo que se guarda o se borra dentro de un cambio. */
  const almacenRegistrado = {
    ...almacen,
    async guardar(nombre, registros) {
      const actuales = captura ? await previos(nombre) : null;
      await almacen.guardar(nombre, registros);
      if (!captura) return;
      for (const r of [].concat(registros)) anotar({ almacen: nombre, id: r.id, antes: actuales.get(r.id) ?? null, despues: structuredClone(r) });
    },
    async borrar(nombre, id) {
      const actuales = captura ? await previos(nombre) : null;
      await almacen.borrar(nombre, id);
      if (captura && actuales.has(id)) anotar({ almacen: nombre, id, antes: actuales.get(id), despues: null });
    },
    // Cargar o borrar los datos de ejemplo cambia todo de golpe: lo anterior ya no se puede deshacer.
    async reemplazar(datos) {
      await almacen.reemplazar(datos);
      pila.vaciar();
    },
  };

  /**
   * Corre `fn` (que guarda cambios) y, si guardó algo, lo anota con el texto que arma `describir(resultado)` (por ejemplo
   * «egreso de $ 12.500,00 en Mercado Pago»); si devuelve algo vacío, no se anota. Dentro de otro cambio, se suma a ese.
   */
  const cambio = (fn, describir) => {
    if (captura) return fn();
    return enCola(async () => {
      captura = { cambios: [], previos: new Map() };
      try {
        const resultado = await fn();
        const cambios = cambiosReales(captura.cambios);
        const texto = cambios.length ? describir(resultado) : null;
        if (texto) pila.registrar({ texto, cambios });
        return resultado;
      } finally { captura = null; }
    });
  };

  const escribir = async (operaciones) => {
    for (const o of operaciones) {
      if (o.tipo === 'guardar') await almacen.guardar(o.almacen, o.registro);
      else await almacen.borrar(o.almacen, o.id);
    }
  };

  const aplicar = (sentido) => enCola(async () => {
    const deshace = sentido === 'deshacer';
    const entrada = deshace ? pila.proximoADeshacer() : pila.proximoARehacer();
    if (!entrada) return { ok: false, texto: `No hay nada para ${sentido}` };
    const operaciones = operacionesDe(entrada, sentido);
    try {
      const [cuentas, categorias, movimientos] = await Promise.all(['cuentas', 'categorias', 'movimientos'].map((n) => almacen.listar(n)));
      const problema = problemaAlAplicar(operaciones, { cuentas, categorias, movimientos });
      if (problema) return { ok: false, texto: `No se puede ${sentido}: ${problema.motivo}` };
      await escribir(operaciones);
      if (deshace) pila.confirmarDeshecho(); else pila.confirmarRehecho();
      await recargar();
      return { ok: true, texto: `${deshace ? 'Deshiciste' : 'Rehiciste'}: ${entrada.texto}` };
    } catch {
      await recargar().catch(() => {});
      return { ok: false, texto: `No se pudo ${sentido}. Probá de nuevo.` };
    }
  });

  return {
    almacenRegistrado,
    cambio,
    deshacer: () => aplicar('deshacer'),
    rehacer: () => aplicar('rehacer'),
    /** Vacía la pila (por ejemplo, al borrar la base de prueba). */
    vaciar: () => pila.vaciar(),
    puedeDeshacer: () => pila.cuantosSeDeshacen() > 0,
    puedeRehacer: () => pila.cuantosSeRehacen() > 0,
  };
}
