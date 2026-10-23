// Reglas de las categorías (RF-CAT-01, RF-CAT-02, modelo de datos §3.6 y §3.15, aep#15). Funciones puras.
import { capitalizarInicial } from './texto.js';
import { esFechaValida } from './fecha.js';

export const TIPOS = Object.freeze(['ingreso', 'egreso']);
export const NOMBRE_DE_RAIZ = Object.freeze({ ingreso: 'Ingresos', egreso: 'Egresos' });
export const FIJO_VARIABLE = Object.freeze(['fijo', 'variable']);
export const NECESIDAD_DESEO = Object.freeze(['necesidad', 'deseo']);
export const NATURALEZAS = Object.freeze(['ganado', 'aporte_terceros', 'otro']);
export const NOMBRES_DE_NATURALEZA = Object.freeze({ ganado: 'Ganado', aporte_terceros: 'Aporte de terceros', otro: 'Otro' });

export const MENSAJES = Object.freeze({
  nombreLargo: 'El nombre tiene que tener entre 1 y 40 caracteres.',
  nombreRepetido: 'Ya existe una categoría con ese nombre en este nivel',
  clasificacion: 'Elegí una opción.',
  fechaFutura: 'La fecha no puede ser posterior a hoy.',
  fechaInvalida: 'Elegí una fecha válida.',
  eliminarConMovimientos: 'No podés eliminarla porque tiene movimientos. Podés archivarla.',
  eliminarFamilia: 'Primero mové o eliminá sus categorías.',
});

const clave = (nombre) => nombre.trim().toLocaleLowerCase('es');
const activa = (c) => c.estado === 'activa';

/** Hijas activas de `padreId` (null = la raíz de `tipo`), en orden. */
export function hijasEnOrden(categorias, padreId, tipo) {
  return categorias.filter((c) => activa(c) && (c.padreId ?? null) === padreId && c.tipo === tipo).sort((a, b) => a.orden - b.orden);
}

/** Una familia es una categoría con al menos una hija activa. */
export const esFamilia = (categorias, id) => categorias.some((c) => activa(c) && c.padreId === id);

/** Todas las categorías debajo de `id` (hijas, nietas…), activas o archivadas. */
export function descendientes(categorias, id) {
  const salida = [];
  for (const hija of categorias.filter((c) => c.padreId === id)) salida.push(hija.id, ...descendientes(categorias, hija.id));
  return salida;
}

/** Clasificación que trae una hoja nueva (D-137): la de su familia o, si no tiene, la más común. */
export function clasificacionPorDefecto(categorias, { padreId, tipo }) {
  const familia = padreId ? categorias.find((c) => c.id === padreId) : null;
  if (tipo === 'ingreso') return { naturaleza: familia?.naturaleza ?? 'ganado' };
  return {
    fijoVariable: familia?.fijoVariable ?? 'variable',
    necesidadDeseo: familia?.necesidadDeseo ?? 'necesidad',
    hormiga: familia?.hormiga ?? false,
  };
}

/**
 * Valida el formulario de una categoría en `padreId` de la raíz `tipo`. `id` es la que se edita (o nada si es nueva).
 * Devuelve { errores, datos } con el nombre normalizado y la clasificación que corresponde al tipo.
 */
export function validarCategoria(formulario, { categorias, padreId, tipo, id }) {
  const errores = {};
  const nombre = capitalizarInicial(String(formulario.nombre ?? '').trim());
  if (nombre.length < 1 || nombre.length > 40) errores.nombre = MENSAJES.nombreLargo;
  else if (hijasEnOrden(categorias, padreId, tipo).some((c) => c.id !== id && clave(c.nombre) === clave(nombre))) errores.nombre = MENSAJES.nombreRepetido;
  const datos = { nombre, emoji: String(formulario.emoji ?? '').trim(), fijoVariable: null, necesidadDeseo: null, hormiga: null, naturaleza: null };
  if (tipo === 'egreso') {
    if (!FIJO_VARIABLE.includes(formulario.fijoVariable)) errores.fijoVariable = MENSAJES.clasificacion;
    if (!NECESIDAD_DESEO.includes(formulario.necesidadDeseo)) errores.necesidadDeseo = MENSAJES.clasificacion;
    Object.assign(datos, { fijoVariable: formulario.fijoVariable, necesidadDeseo: formulario.necesidadDeseo, hormiga: Boolean(formulario.hormiga) });
  } else {
    if (!NATURALEZAS.includes(formulario.naturaleza)) errores.naturaleza = MENSAJES.clasificacion;
    datos.naturaleza = formulario.naturaleza;
  }
  return { errores, datos };
}

/** A dónde se puede mover `id`: la raíz (null) y las categorías activas de su tipo, sin ella ni sus descendientes (INV-09). */
export function destinosPara(categorias, id) {
  const propia = categorias.find((c) => c.id === id);
  const prohibidas = new Set([id, ...descendientes(categorias, id)]);
  const salida = [{ id: null, nombre: NOMBRE_DE_RAIZ[propia.tipo], nivel: 0 }];
  const recorrer = (padreId, nivel) => {
    for (const c of hijasEnOrden(categorias, padreId, propia.tipo)) {
      if (prohibidas.has(c.id)) continue;
      salida.push({ id: c.id, nombre: c.nombre, nivel });
      recorrer(c.id, nivel + 1);
    }
  };
  recorrer(null, 1);
  return salida;
}

/**
 * Ubicaciones de una categoría después de moverla (D-33, modelo §3.15): «todo» deja una sola, desde siempre;
 * «fecha» agrega una desde esa fecha (no posterior a hoy).
 */
export function ubicacionesAlMover(ubicaciones, { categoriaId, padreId, alcance, fecha, hoy, nuevoId }) {
  const propias = ubicaciones.filter((u) => u.categoriaId === categoriaId);
  if (alcance === 'todo') return [{ id: propias[0]?.id ?? nuevoId(), categoriaId, padreId, desde: null }];
  if (!esFechaValida(fecha)) throw new Error(MENSAJES.fechaInvalida);
  if (fecha > hoy) throw new Error(MENSAJES.fechaFutura);
  return [...propias.filter((u) => (u.desde ?? '') < fecha), { id: nuevoId(), categoriaId, padreId, desde: fecha }];
}

/** Dónde estaba una categoría en la fecha `fecha` (la ubicación con el `desde` más reciente ≤ fecha). */
export function ubicacionEn(ubicaciones, categoriaId, fecha) {
  const validas = ubicaciones.filter((u) => u.categoriaId === categoriaId && (u.desde === null || u.desde <= fecha));
  validas.sort((a, b) => (a.desde ?? '').localeCompare(b.desde ?? ''));
  return validas.at(-1)?.padreId ?? null;
}

/** Archivar una familia archiva también sus hijas (D-138). */
export const idsParaArchivar = (categorias, id) => [id, ...descendientes(categorias, id).filter((d) => activa(categorias.find((c) => c.id === d)))];

/**
 * Reactivar: vuelve con sus padres archivados (para no quedar colgada) y, si es una familia, con sus hijas.
 * No se reactiva si una hermana activa ya tiene su nombre.
 */
export function idsParaReactivar(categorias, id) {
  const propia = categorias.find((c) => c.id === id);
  const choca = hijasEnOrden(categorias, propia.padreId ?? null, propia.tipo).some((c) => c.id !== id && clave(c.nombre) === clave(propia.nombre));
  if (choca) return { ok: false, motivo: MENSAJES.nombreRepetido };
  const ids = [id, ...descendientes(categorias, id)];
  for (let padre = categorias.find((c) => c.id === propia.padreId); padre; padre = categorias.find((c) => c.id === padre.padreId)) {
    if (!activa(padre)) ids.push(padre.id);
  }
  return { ok: true, ids: ids.filter((x) => !activa(categorias.find((c) => c.id === x))) };
}

const usaLaCategoria = (id) => (m) => (m.partes ?? []).some((p) => p.categoriaId === id);

/** Con movimientos no se elimina (se ofrece archivar); una familia, solo sin hijas (D-138). */
export function puedeEliminar(categorias, id, movimientos) {
  if (categorias.some((c) => c.padreId === id)) return { ok: false, motivo: MENSAJES.eliminarFamilia };
  if (movimientos.some(usaLaCategoria(id))) return { ok: false, motivo: MENSAJES.eliminarConMovimientos };
  return { ok: true };
}

/**
 * Agregar una hija a una hoja con movimientos (RF-CAT-01): una familia no puede tener partes propias, así que se
 * propone «Otros (hoja)» con esos movimientos. null si no hace falta.
 */
export function propuestaAlAgregarHija(categorias, id, movimientos) {
  if (esFamilia(categorias, id)) return null;
  const usados = movimientos.filter(usaLaCategoria(id)).map((m) => m.id);
  if (!usados.length) return null;
  return { nombre: `Otros (${categorias.find((c) => c.id === id).nombre})`, movimientos: usados };
}

/** Lleva `id` a la posición `posicion` (desde 0) entre sus hermanas; devuelve las hermanas con el orden nuevo. */
export function moverEntreHermanas(categorias, id, posicion) {
  const propia = categorias.find((c) => c.id === id);
  const hermanas = hijasEnOrden(categorias, propia.padreId ?? null, propia.tipo);
  const ordenes = hermanas.map((c) => c.orden).sort((a, b) => a - b);
  const desde = hermanas.findIndex((c) => c.id === id);
  const [movida] = hermanas.splice(desde, 1);
  hermanas.splice(Math.max(0, Math.min(posicion, hermanas.length)), 0, movida);
  return hermanas.map((c, i) => ({ ...c, orden: ordenes[i] }));
}

/** Orden para una categoría nueva: al final. */
export const ordenParaNueva = (categorias) => categorias.reduce((m, c) => Math.max(m, c.orden ?? 0), 0) + 1;
