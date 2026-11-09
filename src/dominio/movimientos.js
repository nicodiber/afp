// Reglas de la carga de un egreso o un ingreso simple (RF-MOV-01, modelo de datos §3.7, HU-02, HU-03). Funciones puras.
import { capitalizarInicial } from './texto.js';
import { esFechaValida } from './fecha.js';
import { leerMonto } from './formato.js';
import { crearMovimiento, verificarPartidaDoble, ErrorPartidaDoble } from './partida-doble.js';
import { hijasEnOrden, esFamilia } from './categorias.js';

export const MENSAJES = Object.freeze({
  monto: 'Escribí un monto mayor que 0.',
  categoria: 'Elegí una categoría.',
  cuenta: 'Elegí una cuenta.',
  fechaInvalida: 'Elegí una fecha válida.',
  fechaFutura: 'La fecha no puede ser posterior a hoy.',
  hora: 'Escribí una hora válida (por ejemplo 18:30) o dejala vacía.',
  descripcion: 'La descripción puede tener hasta 120 caracteres.',
});

const activa = (x) => x.estado === 'activa';

/** Categorías de `tipo` ('egreso' o 'ingreso') en las que se puede cargar: las hojas activas (INV-03). */
export function hojasDeTipo(categorias, tipo) {
  return categorias.filter((c) => c.tipo === tipo && activa(c) && !esFamilia(categorias, c.id));
}

/** Categorías de egreso en las que se puede cargar: las hojas activas (INV-03). */
export const hojasDeEgreso = (categorias) => hojasDeTipo(categorias, 'egreso');

/**
 * Las hojas activas de `tipo` agrupadas por familia, en el orden del árbol. Cada grupo: { familia, categorias }.
 * `familia` es la categoría de primer nivel (null para las hojas que están en la raíz: van juntas al final).
 */
export function categoriasAgrupadas(categorias, tipo) {
  const hojasDe = (c) => (esFamilia(categorias, c.id) ? hijasEnOrden(categorias, c.id, tipo).flatMap(hojasDe) : [c]);
  const grupos = [];
  const sueltas = [];
  for (const raiz of hijasEnOrden(categorias, null, tipo)) {
    if (!esFamilia(categorias, raiz.id)) { sueltas.push(raiz); continue; }
    const hojas = hojasDe(raiz);
    if (hojas.length) grupos.push({ familia: raiz, categorias: hojas });
  }
  if (sueltas.length) grupos.push({ familia: null, categorias: sueltas });
  return grupos;
}
export const categoriasDeEgresoAgrupadas = (categorias) => categoriasAgrupadas(categorias, 'egreso');

/**
 * Un nivel del árbol de categorías de `tipo` para la ventana de selección (HU-02b CA-2): las hijas activas de
 * `padreId` (null = el primer nivel) en el orden del árbol, mezclando familias y categorías sueltas. Cada una:
 * { id, nombre, emoji, esFamilia }.
 */
export function nivelDeCategorias(categorias, padreId, tipo) {
  return hijasEnOrden(categorias, padreId, tipo)
    .map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji ?? '', esFamilia: esFamilia(categorias, c.id) }));
}
export const nivelDeCategoriasDeEgreso = (categorias, padreId = null) => nivelDeCategorias(categorias, padreId, 'egreso');

/** Minúsculas y sin tildes, para buscar mientras se escribe. */
export const normalizarBusqueda = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

/** Deja las opciones cuyo texto (o el de su familia) contiene lo escrito. Sin texto, deja todas. */
export function filtrarOpciones(opciones, texto) {
  const buscado = normalizarBusqueda(texto);
  if (!buscado) return opciones;
  return opciones.filter((o) => normalizarBusqueda(`${o.nombre} ${o.familia ?? ''}`).includes(buscado));
}

/**
 * Valida el formulario de un egreso o un ingreso (`tipo`, por defecto 'egreso'): { fecha, monto (texto),
 * descripcion, categoriaId, cuentaId }. Las reglas son las mismas; solo cambia el tipo de la categoría.
 * Devuelve { errores, datos }; `errores` tiene una clave por campo con problema.
 */
export function validarMovimiento(formulario, { cuentas, categorias, hoy }, tipo = 'egreso') {
  const errores = {};
  const fecha = String(formulario.fecha ?? '');
  const cuenta = cuentas.find((c) => c.id === formulario.cuentaId && activa(c));
  const categoria = hojasDeTipo(categorias, tipo).find((c) => c.id === formulario.categoriaId);
  if (!esFechaValida(fecha)) errores.fecha = MENSAJES.fechaInvalida;
  else if (fecha > hoy) errores.fecha = MENSAJES.fechaFutura;
  // Hora opcional (HH:MM): vacía se guarda sin hora.
  const hora = String(formulario.hora ?? '').trim();
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) errores.hora = MENSAJES.hora;
  const montoTotal = leerMonto(formulario.monto);
  if (montoTotal === null || montoTotal <= 0 || !Number.isSafeInteger(montoTotal)) errores.monto = MENSAJES.monto;
  const descripcion = capitalizarInicial(String(formulario.descripcion ?? '').trim());
  if (descripcion.length > 120) errores.descripcion = MENSAJES.descripcion;
  if (!categoria) errores.categoria = MENSAJES.categoria;
  if (!cuenta) errores.cuenta = MENSAJES.cuenta;
  // Una fecha anterior a la del saldo inicial se guarda igual: la cuenta pasa a empezar en esa fecha (HU-02b CA-4).
  const adelantaInicio = Boolean(cuenta && esFechaValida(fecha) && fecha < cuenta.fechaSaldoInicial);
  return { errores, datos: { fecha, hora: hora || null, adelantaInicio, montoTotal, descripcion, categoriaId: formulario.categoriaId, cuentaId: formulario.cuentaId } };
}

export const validarEgreso = (formulario, contexto) => validarMovimiento(formulario, contexto, 'egreso');
export const validarIngreso = (formulario, contexto) => validarMovimiento(formulario, contexto, 'ingreso');

/**
 * Arma el movimiento simple (tipo `egreso` o `ingreso`, una parte, estado confirmado, origen manual salvo que se indique otro) y lo pasa por el
 * núcleo de partida doble. Lanza ErrorPartidaDoble si no cuadra.
 */
export function crearMovimientoSimple(tipo, datos, { id, cuenta, categoria }, origen = 'manual') {
  const contexto = {
    monedaDeCuenta: () => cuenta.monedaId,
    cuentaDePersona: () => { throw new ErrorPartidaDoble('Un movimiento simple no usa cuentas de personas.'); },
  };
  // La parte copia la clasificación de la categoría al crearla (RN-17): la de egresos o la naturaleza de ingresos.
  const clasificacion = tipo === 'ingreso'
    ? { naturaleza: categoria.naturaleza }
    : { fijoVariable: categoria.fijoVariable, necesidadDeseo: categoria.necesidadDeseo, hormiga: categoria.hormiga };
  const movimiento = crearMovimiento({
    id,
    tipo,
    fecha: datos.fecha,
    hora: datos.hora ?? null,
    descripcion: datos.descripcion,
    estado: 'confirmado',
    origen,
    cuentaId: cuenta.id,
    monedaId: cuenta.monedaId,
    montoTotal: datos.montoTotal,
    partes: [{ categoriaId: categoria.id, monto: datos.montoTotal, ...clasificacion }],
    revisarCategoria: false,
  }, contexto);
  const problemas = verificarPartidaDoble(movimiento, contexto);
  if (problemas.length) throw new ErrorPartidaDoble(problemas.join('; '));
  return movimiento;
}

export const crearEgreso = (datos, referencias) => crearMovimientoSimple('egreso', datos, referencias);
export const crearIngreso = (datos, referencias) => crearMovimientoSimple('ingreso', datos, referencias);

/**
 * Arma los movimientos de los datos de ejemplo (HU-38, origen `datos_ejemplo`) a partir de su forma compacta { id, fecha,
 * hora, tipo, cuentaId, categoriaId, monto, descripcion }. Lanza ErrorPartidaDoble si alguno no cumple las reglas de
 * partida doble, usa una cuenta o una categoría que no existe, o una categoría que no es hoja activa de su tipo.
 */
export function armarMovimientosDeEjemplo(compactos, { cuentas, categorias }) {
  return compactos.map((c) => {
    const cuenta = cuentas.find((x) => x.id === c.cuentaId && activa(x));
    const categoria = hojasDeTipo(categorias, c.tipo).find((x) => x.id === c.categoriaId);
    if (!cuenta) throw new ErrorPartidaDoble(`${c.id}: la cuenta ${c.cuentaId} no existe o no está activa`);
    if (!categoria) throw new ErrorPartidaDoble(`${c.id}: la categoría ${c.categoriaId} no es una hoja activa de ${c.tipo}`);
    return crearMovimientoSimple(c.tipo, { fecha: c.fecha, hora: c.hora ?? null, descripcion: c.descripcion ?? '', montoTotal: c.monto }, { id: c.id, cuenta, categoria }, 'datos_ejemplo');
  });
}
