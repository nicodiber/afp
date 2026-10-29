// Reglas de la carga de un egreso simple (RF-MOV-01, modelo de datos §3.7, HU-02). Funciones puras.
import { capitalizarInicial } from './texto.js';
import { esFechaValida, formatearFecha } from './fecha.js';
import { leerMonto } from './formato.js';
import { crearMovimiento, verificarPartidaDoble, ErrorPartidaDoble } from './partida-doble.js';
import { hijasEnOrden, esFamilia } from './categorias.js';

export const MENSAJES = Object.freeze({
  monto: 'Escribí un monto mayor que 0.',
  categoria: 'Elegí una categoría.',
  cuenta: 'Elegí una cuenta.',
  fechaInvalida: 'Elegí una fecha válida.',
  fechaFutura: 'La fecha no puede ser posterior a hoy.',
  descripcion: 'La descripción puede tener hasta 120 caracteres.',
});

const activa = (x) => x.estado === 'activa';

/** Categorías de egreso en las que se puede cargar: las hojas activas (INV-03). */
export function hojasDeEgreso(categorias) {
  return categorias.filter((c) => c.tipo === 'egreso' && activa(c) && !esFamilia(categorias, c.id));
}

/**
 * Las hojas activas de egreso agrupadas por familia, en el orden del árbol. Cada grupo: { familia, categorias }.
 * `familia` es la categoría de primer nivel (null para las hojas que están en la raíz: van juntas al final).
 */
export function categoriasDeEgresoAgrupadas(categorias) {
  const hojasDe = (c) => (esFamilia(categorias, c.id) ? hijasEnOrden(categorias, c.id, 'egreso').flatMap(hojasDe) : [c]);
  const grupos = [];
  const sueltas = [];
  for (const raiz of hijasEnOrden(categorias, null, 'egreso')) {
    if (!esFamilia(categorias, raiz.id)) { sueltas.push(raiz); continue; }
    const hojas = hojasDe(raiz);
    if (hojas.length) grupos.push({ familia: raiz, categorias: hojas });
  }
  if (sueltas.length) grupos.push({ familia: null, categorias: sueltas });
  return grupos;
}

/** Minúsculas y sin tildes, para buscar mientras se escribe. */
export const normalizarBusqueda = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

/** Deja las opciones cuyo texto (o el de su familia) contiene lo escrito. Sin texto, deja todas. */
export function filtrarOpciones(opciones, texto) {
  const buscado = normalizarBusqueda(texto);
  if (!buscado) return opciones;
  return opciones.filter((o) => normalizarBusqueda(`${o.nombre} ${o.familia ?? ''}`).includes(buscado));
}

/**
 * Valida el formulario del egreso: { fecha, monto (texto), descripcion, categoriaId, cuentaId }.
 * Devuelve { errores, datos }; `errores` tiene una clave por campo con problema.
 */
export function validarEgreso(formulario, { cuentas, categorias, hoy }) {
  const errores = {};
  const fecha = String(formulario.fecha ?? '');
  const cuenta = cuentas.find((c) => c.id === formulario.cuentaId && activa(c));
  const categoria = hojasDeEgreso(categorias).find((c) => c.id === formulario.categoriaId);
  if (!esFechaValida(fecha)) errores.fecha = MENSAJES.fechaInvalida;
  else if (fecha > hoy) errores.fecha = MENSAJES.fechaFutura;
  else if (cuenta && fecha < cuenta.fechaSaldoInicial) {
    // INV-16: los movimientos de una cuenta no son anteriores a su saldo inicial.
    errores.fecha = `La cuenta ${cuenta.nombre} empieza el ${formatearFecha(cuenta.fechaSaldoInicial)}: elegí esa fecha o una posterior.`;
  }
  const montoTotal = leerMonto(formulario.monto);
  if (montoTotal === null || montoTotal <= 0 || !Number.isSafeInteger(montoTotal)) errores.monto = MENSAJES.monto;
  const descripcion = capitalizarInicial(String(formulario.descripcion ?? '').trim());
  if (descripcion.length > 120) errores.descripcion = MENSAJES.descripcion;
  if (!categoria) errores.categoria = MENSAJES.categoria;
  if (!cuenta) errores.cuenta = MENSAJES.cuenta;
  return { errores, datos: { fecha, montoTotal, descripcion, categoriaId: formulario.categoriaId, cuentaId: formulario.cuentaId } };
}

/**
 * Arma el egreso (tipo `egreso`, una parte, estado confirmado, origen manual) y lo pasa por el núcleo de partida
 * doble. Lanza ErrorPartidaDoble si no cuadra.
 */
export function crearEgreso(datos, { id, cuenta, categoria }) {
  const contexto = {
    monedaDeCuenta: () => cuenta.monedaId,
    cuentaDePersona: () => { throw new ErrorPartidaDoble('Un egreso simple no usa cuentas de personas.'); },
  };
  const movimiento = crearMovimiento({
    id,
    tipo: 'egreso',
    fecha: datos.fecha,
    descripcion: datos.descripcion,
    estado: 'confirmado',
    origen: 'manual',
    cuentaId: cuenta.id,
    monedaId: cuenta.monedaId,
    montoTotal: datos.montoTotal,
    // La parte copia la clasificación de la categoría al crearla (RN-17).
    partes: [{
      categoriaId: categoria.id, monto: datos.montoTotal,
      fijoVariable: categoria.fijoVariable, necesidadDeseo: categoria.necesidadDeseo, hormiga: categoria.hormiga,
    }],
    revisarCategoria: false,
  }, contexto);
  const problemas = verificarPartidaDoble(movimiento, contexto);
  if (problemas.length) throw new ErrorPartidaDoble(problemas.join('; '));
  return movimiento;
}
