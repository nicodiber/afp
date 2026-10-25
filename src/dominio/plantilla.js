// Plantilla inicial (RF-CAT-03, aep HU-01): reglas para armar las cuentas y categorías del punto de partida a
// partir de los datos del archivo plantilla/plantilla-inicial.json. Funciones puras: sin navegador ni almacenamiento.
// Los nombres no están en el código (RNF-FLE-01): salen solo del archivo.
import { validarCuenta } from './cuentas.js';
import { validarCategoria } from './categorias.js';

export const FORMATO_PLANTILLA = 'afp-plantilla-inicial';

/** Se ofrece la plantilla si la base no tiene cuentas ni categorías (activas o archivadas) y no se completó el inicio. */
export const debeOfrecerse = ({ configuracion, cuentas, categorias }) =>
  !configuracion?.inicioCompletado && cuentas.length === 0 && categorias.length === 0;

/**
 * Arma lo que se guarda al elegir la plantilla. Cada cuenta y categoría pasa por las reglas de siempre
 * (validarCuenta, validarCategoria). Los ids se generan acá: `padre` en el archivo es la `ref` de otra categoría
 * anterior y del mismo tipo (así no hay ciclos, INV-09). Devuelve { errores, cuentas, categorias, ubicaciones }.
 */
export function armarPlantilla(datos, { hoy, monedasActivas, nuevoId }) {
  const errores = [];
  const cuentas = [];
  const categorias = [];
  const ubicaciones = [];
  if (datos?.formato !== FORMATO_PLANTILLA || !Array.isArray(datos.cuentas) || !Array.isArray(datos.categorias)) {
    return { errores: ['El archivo no tiene el formato de la plantilla.'], cuentas, categorias, ubicaciones };
  }
  datos.cuentas.forEach((fila, i) => {
    const formulario = { ...fila, saldoInicial: '', fechaSaldoInicial: hoy, tieneRendimiento: false, emoji: '', notas: '', proposito: 'ninguno' };
    const { errores: malas, datos: validos } = validarCuenta(formulario, { cuentas, hoy, monedasActivas });
    if (Object.keys(malas).length) errores.push(`Cuenta ${i + 1}: ${Object.values(malas).join(' ')}`);
    else cuentas.push({ id: nuevoId('cue'), ...validos, orden: i + 1, estado: 'activa' });
  });
  const idPorRef = new Map();
  datos.categorias.forEach((fila, i) => {
    const donde = `Categoría ${i + 1}`;
    if (!fila.ref || idPorRef.has(fila.ref)) { errores.push(`${donde}: falta la referencia o está repetida.`); return; }
    let padreId = null;
    if (fila.padre != null) {
      const padre = categorias.find((c) => c.id === idPorRef.get(fila.padre));
      if (!padre) { errores.push(`${donde}: su padre no está antes en el archivo.`); return; }
      if (padre.tipo !== fila.tipo) { errores.push(`${donde}: no es del mismo tipo que su padre.`); return; }
      padreId = padre.id;
    }
    const { errores: malas, datos: validos } = validarCategoria(fila, { categorias, padreId, tipo: fila.tipo });
    if (Object.keys(malas).length || !['ingreso', 'egreso'].includes(fila.tipo)) { errores.push(`${donde}: ${Object.values(malas).join(' ') || 'tipo no válido.'}`); return; }
    const categoria = { id: nuevoId('cat'), ...validos, tipo: fila.tipo, padreId, orden: i + 1, estado: 'activa', esSistema: false, esHistorica: false };
    idPorRef.set(fila.ref, categoria.id);
    categorias.push(categoria);
    ubicaciones.push({ id: nuevoId('ubi'), categoriaId: categoria.id, padreId, desde: null });
  });
  return { errores, cuentas, categorias, ubicaciones };
}
