// Casos de uso de las categorías (RF-CAT-01, RF-CAT-02, aep#15). Usan el puerto Almacen y el Reloj; las reglas
// están en el dominio.
import {
  validarCategoria, clasificacionPorDefecto, esFamilia, hijasEnOrden, destinosPara, ubicacionesAlMover,
  idsParaArchivar, idsParaReactivar, puedeEliminar, moverEntreHermanas, ordenParaNueva,
} from '../dominio/categorias.js';
import { asignarIconosFaltantes, proponerIcono, iconosUsados, claveIcono } from '../dominio/iconos.js';

// `cambio` anota cada cambio guardado para poder deshacerlo (HU-41); sin él, se guarda igual.
export function crearCasosCategorias({ almacen, reloj, nuevoId, movimientos = async () => [], cambio = (fn) => fn() }) {
  let categorias = [];
  let ubicaciones = [];
  const recargar = async () => {
    categorias = await almacen.listar('categorias');
    ubicaciones = await almacen.listar('ubicacionesCategoria');
    // HU-31: una base con categorías sin ícono o con íconos repetidos recibe uno libre (sin migración de esquema).
    const conIcono = asignarIconosFaltantes(categorias);
    if (conIcono.length) {
      await almacen.guardar('categorias', conIcono);
      categorias = await almacen.listar('categorias');
    }
  };
  const buscar = (id) => categorias.find((c) => c.id === id);
  const guardar = async (lista) => { await almacen.guardar('categorias', lista); await recargar(); };

  return {
    preparar: recargar,
    recargar,
    buscar,
    todas: () => categorias,
    hoy: () => reloj.hoy(),
    hijas: (padreId, tipo) => hijasEnOrden(categorias, padreId, tipo),
    esFamilia: (id) => esFamilia(categorias, id),
    archivadas: () => categorias.filter((c) => c.estado === 'archivada'),
    hayCategorias: () => categorias.length > 0,
    clasificacionPorDefecto: (padreId, tipo) => clasificacionPorDefecto(categorias, { padreId, tipo }),
    /** Ícono libre propuesto para `nombre` (HU-31) y las claves de los íconos que ya usan otras categorías. */
    iconoPropuesto: (nombre, salvoId) => proponerIcono(nombre, iconosUsados(categorias, salvoId)),
    iconoEnUso: (emoji, salvoId) => iconosUsados(categorias, salvoId).has(claveIcono(emoji)),
    destinosPara: (id) => destinosPara(categorias, id),
    ubicaciones: (id) => ubicaciones.filter((u) => u.categoriaId === id),

    /** Crea una categoría en `padreId` (null = la raíz de `tipo`), al final de sus hermanas. */
    crear(formulario, { padreId, tipo }) {
      return cambio(async () => {
        const { errores, datos } = validarCategoria(formulario, { categorias, padreId, tipo });
        if (Object.keys(errores).length) return { errores };
        const categoria = { id: nuevoId('cat'), ...datos, tipo, padreId, orden: ordenParaNueva(categorias), estado: 'activa', esSistema: false, esHistorica: false };
        await almacen.guardar('ubicacionesCategoria', { id: nuevoId('ubi'), categoriaId: categoria.id, padreId, desde: null });
        await guardar(categoria);
        return { categoria };
      }, (r) => (r.categoria ? `creación de la categoría ${r.categoria.nombre}` : null));
    },
    editar(id, formulario) {
      return cambio(async () => {
        const actual = buscar(id);
        const { errores, datos } = validarCategoria(formulario, { categorias, padreId: actual.padreId ?? null, tipo: actual.tipo, id });
        if (Object.keys(errores).length) return { errores };
        const categoria = { ...actual, ...datos };
        await guardar(categoria);
        return { categoria };
      }, (r) => (r.categoria ? `cambios en la categoría ${r.categoria.nombre}` : null));
    },
    /** Mueve a `padreId` para todo el historial o desde una fecha (D-33); va al final de sus nuevas hermanas. */
    mover(id, { padreId, alcance, fecha }) {
      const nombre = buscar(id).nombre;
      return cambio(async () => {
        const nuevas = ubicacionesAlMover(ubicaciones, { categoriaId: id, padreId, alcance, fecha, hoy: reloj.hoy(), nuevoId: () => nuevoId('ubi') });
        for (const vieja of ubicaciones.filter((u) => u.categoriaId === id && !nuevas.some((n) => n.id === u.id))) await almacen.borrar('ubicacionesCategoria', vieja.id);
        await almacen.guardar('ubicacionesCategoria', nuevas);
        await guardar({ ...buscar(id), padreId, orden: ordenParaNueva(categorias) });
      }, () => `traslado de la categoría ${nombre}`);
    },
    ordenar(id, posicion) {
      const nombre = buscar(id).nombre;
      return cambio(() => guardar(moverEntreHermanas(categorias, id, posicion)), () => `cambio de orden de la categoría ${nombre}`);
    },
    cuantasSeArchivan: (id) => idsParaArchivar(categorias, id).length,
    archivar(id) {
      const nombre = buscar(id).nombre;
      return cambio(() => guardar(idsParaArchivar(categorias, id).map((x) => ({ ...buscar(x), estado: 'archivada' }))), () => `archivo de la categoría ${nombre}`);
    },
    reactivar(id) {
      const nombre = buscar(id).nombre;
      return cambio(async () => {
        const resultado = idsParaReactivar(categorias, id);
        if (!resultado.ok) return resultado;
        await guardar(resultado.ids.map((x) => ({ ...buscar(x), estado: 'activa' })));
        return { ok: true };
      }, (r) => (r.ok ? `reactivación de la categoría ${nombre}` : null));
    },
    async puedeEliminar(id) { return puedeEliminar(categorias, id, await movimientos()); },
    eliminar(id) {
      const nombre = buscar(id).nombre;
      return cambio(async () => {
        const permiso = await this.puedeEliminar(id);
        if (!permiso.ok) return permiso;
        for (const u of ubicaciones.filter((x) => x.categoriaId === id)) await almacen.borrar('ubicacionesCategoria', u.id);
        await almacen.borrar('categorias', id);
        await recargar();
        return { ok: true };
      }, (r) => (r.ok ? `eliminación de la categoría ${nombre}` : null));
    },
  };
}
