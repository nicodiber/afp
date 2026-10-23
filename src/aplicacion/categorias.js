// Casos de uso de las categorías (RF-CAT-01, RF-CAT-02, aep#15). Usan el puerto Almacen y el Reloj; las reglas
// están en el dominio. En v0.2.0 todavía no hay movimientos (llegan en v0.3.0).
import {
  validarCategoria, clasificacionPorDefecto, esFamilia, hijasEnOrden, destinosPara, ubicacionesAlMover,
  idsParaArchivar, idsParaReactivar, puedeEliminar, moverEntreHermanas, ordenParaNueva,
} from '../dominio/categorias.js';

export function crearCasosCategorias({ almacen, reloj, nuevoId, movimientos = async () => [] }) {
  let categorias = [];
  let ubicaciones = [];
  const recargar = async () => {
    categorias = await almacen.listar('categorias');
    ubicaciones = await almacen.listar('ubicacionesCategoria');
  };
  const buscar = (id) => categorias.find((c) => c.id === id);
  const guardar = async (lista) => { await almacen.guardar('categorias', lista); await recargar(); };

  return {
    preparar: recargar,
    recargar,
    buscar,
    hoy: () => reloj.hoy(),
    hijas: (padreId, tipo) => hijasEnOrden(categorias, padreId, tipo),
    esFamilia: (id) => esFamilia(categorias, id),
    archivadas: () => categorias.filter((c) => c.estado === 'archivada'),
    hayCategorias: () => categorias.length > 0,
    clasificacionPorDefecto: (padreId, tipo) => clasificacionPorDefecto(categorias, { padreId, tipo }),
    destinosPara: (id) => destinosPara(categorias, id),
    ubicaciones: (id) => ubicaciones.filter((u) => u.categoriaId === id),

    /** Crea una categoría en `padreId` (null = la raíz de `tipo`), al final de sus hermanas. */
    async crear(formulario, { padreId, tipo }) {
      const { errores, datos } = validarCategoria(formulario, { categorias, padreId, tipo });
      if (Object.keys(errores).length) return { errores };
      const categoria = { id: nuevoId('cat'), ...datos, tipo, padreId, orden: ordenParaNueva(categorias), estado: 'activa', esSistema: false, esHistorica: false };
      await almacen.guardar('ubicacionesCategoria', { id: nuevoId('ubi'), categoriaId: categoria.id, padreId, desde: null });
      await guardar(categoria);
      return { categoria };
    },
    async editar(id, formulario) {
      const actual = buscar(id);
      const { errores, datos } = validarCategoria(formulario, { categorias, padreId: actual.padreId ?? null, tipo: actual.tipo, id });
      if (Object.keys(errores).length) return { errores };
      const categoria = { ...actual, ...datos };
      await guardar(categoria);
      return { categoria };
    },
    /** Mueve a `padreId` para todo el historial o desde una fecha (D-33); va al final de sus nuevas hermanas. */
    async mover(id, { padreId, alcance, fecha }) {
      const nuevas = ubicacionesAlMover(ubicaciones, { categoriaId: id, padreId, alcance, fecha, hoy: reloj.hoy(), nuevoId: () => nuevoId('ubi') });
      for (const vieja of ubicaciones.filter((u) => u.categoriaId === id && !nuevas.some((n) => n.id === u.id))) await almacen.borrar('ubicacionesCategoria', vieja.id);
      await almacen.guardar('ubicacionesCategoria', nuevas);
      await guardar({ ...buscar(id), padreId, orden: ordenParaNueva(categorias) });
    },
    async ordenar(id, posicion) { await guardar(moverEntreHermanas(categorias, id, posicion)); },
    cuantasSeArchivan: (id) => idsParaArchivar(categorias, id).length,
    async archivar(id) { await guardar(idsParaArchivar(categorias, id).map((x) => ({ ...buscar(x), estado: 'archivada' }))); },
    async reactivar(id) {
      const resultado = idsParaReactivar(categorias, id);
      if (!resultado.ok) return resultado;
      await guardar(resultado.ids.map((x) => ({ ...buscar(x), estado: 'activa' })));
      return { ok: true };
    },
    async puedeEliminar(id) { return puedeEliminar(categorias, id, await movimientos()); },
    async eliminar(id) {
      const permiso = await this.puedeEliminar(id);
      if (!permiso.ok) return permiso;
      for (const u of ubicaciones.filter((x) => x.categoriaId === id)) await almacen.borrar('ubicacionesCategoria', u.id);
      await almacen.borrar('categorias', id);
      await recargar();
      return { ok: true };
    },
  };
}
