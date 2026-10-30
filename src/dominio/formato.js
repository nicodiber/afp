// Formatos de montos, decimales, porcentajes y horas (RNF-USA-05, manual §8.2, aep#7). Funciones puras,
// sin números con coma flotante: los montos son enteros en centavos y los decimales, texto.

const ESPACIO = ' '; // espacio que no se corta entre el símbolo y el número
const MENOS = '−'; // signo menos tipográfico
const SIMBOLOS = { ARS: '$', USD: 'US$' };

const miles = (entero) => entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Redondeo comercial de un decimal en texto a `decimales` cifras (D-113). Devuelve { negativo, entero, fraccion }. */
function redondear(texto, decimales) {
  const limpio = String(texto).trim();
  const negativo = limpio.startsWith('-');
  const [ent = '0', frac = ''] = limpio.replace(/^[-+]/, '').split('.');
  const digitos = BigInt(ent + frac.padEnd(decimales, '0').slice(0, decimales));
  const sube = (frac[decimales] ?? '0') >= '5';
  const valor = (digitos + (sube ? 1n : 0n)).toString().padStart(decimales + 1, '0');
  const entero = valor.slice(0, valor.length - decimales);
  const fraccion = valor.slice(valor.length - decimales);
  const esCero = /^0*$/.test(entero + fraccion);
  return { negativo: negativo && !esCero, entero, fraccion };
}

/** «1234567.891» → «1.234.567,89». */
export function formatearDecimal(texto, decimales = 2) {
  const { negativo, entero, fraccion } = redondear(texto, decimales);
  return `${negativo ? MENOS : ''}${miles(entero)}${decimales ? `,${fraccion}` : ''}`;
}

/** Centavos → «$ 1.234.567,89», «US$ 600,00», «−$ 9.000,00»; con { conSigno: true }, «+$ 1.140.000,00». */
export function formatearMonto(centavos, moneda = 'ARS', { conSigno = false } = {}) {
  const absoluto = Math.abs(centavos).toString().padStart(3, '0');
  const numero = `${miles(absoluto.slice(0, -2))},${absoluto.slice(-2)}`;
  const signo = centavos < 0 ? MENOS : (conSigno && centavos > 0 ? '+' : '');
  return `${signo}${SIMBOLOS[moneda] ?? moneda}${ESPACIO}${numero}`;
}

/** «7.07» → «7,07 %». */
export function formatearPorcentaje(texto, decimales = 2) {
  return `${formatearDecimal(texto, decimales)}${ESPACIO}%`;
}

/** Instante ISO en UTC → hora de 24 h en UTC−3 (Argentina no cambia la hora): «2026-10-31T21:42:00.000Z» → «18:42». */
export function formatearHora(instante) {
  const [, hh, mm] = instante.match(/T(\d{2}):(\d{2})/);
  const hora = (Number(hh) + 24 - 3) % 24;
  return `${String(hora).padStart(2, '0')}:${mm}`;
}

/**
 * Lee un monto escrito por el usuario (aep#12 CA-8, D-123): «1.234,5» → 123450 centavos, «-5000» → −500000.
 * Punto para los miles (en grupos de 3) y coma para hasta 2 decimales. null si no es un monto así.
 */
export function leerMonto(texto) {
  const limpio = String(texto ?? '').trim().replace(/^[−-]/, '-');
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(limpio)) return null;
  const negativo = limpio.startsWith('-');
  const [entero, decimales = ''] = limpio.replace('-', '').replaceAll('.', '').split(',');
  const centavos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'));
  return negativo && centavos !== 0 ? -centavos : centavos;
}

/** Centavos → texto para editar en un campo: 15000 → «150,00», −500000 → «-5.000,00» (lo lee leerMonto). */
export function montoParaEditar(centavos) {
  const absoluto = Math.abs(centavos).toString().padStart(3, '0');
  return `${centavos < 0 ? '-' : ''}${miles(absoluto.slice(0, -2))},${absoluto.slice(-2)}`;
}

const MAX_CIFRAS_ENTERAS = 13;

/** Agrupa de a tres el entero de un monto: «1250000» → «1.250.000». */
const agruparMiles = miles;

/**
 * Lo que se ve en el campo de monto mientras se escribe (HU-02b CA-1): puntos de miles en tiempo real, coma para
 * los decimales (hasta 2). `texto` es el contenido del campo y `cursor` dónde está el cursor. Devuelve
 * { texto, cursor } con el cursor en el mismo lugar entre las cifras: «1250|» → «1.250|», «12|50» → «1.2|50».
 */
export function formatearMontoEscrito(texto, cursor = String(texto).length) {
  const crudo = String(texto);
  const antes = crudo.slice(0, cursor);
  const significativos = (t) => (t.match(/[\d,]/g) ?? []).length;
  const hayComa = crudo.includes(',');
  const [parteEntera, ...resto] = crudo.replace(/[^\d,]/g, '').split(',');
  let entero = parteEntera.slice(0, MAX_CIFRAS_ENTERAS).replace(/^0+(?=\d)/, '');
  const decimales = resto.join('').slice(0, 2);
  let sig = significativos(antes);
  // Una coma sin entero adelante lleva un 0 («,5» → «0,5»).
  const ceroAgregado = hayComa && entero === '';
  if (ceroAgregado) { entero = '0'; if (sig > 0) sig += 1; }
  // Lo que se descartó (cifras de más, comas repetidas) no cuenta para el cursor.
  const largoUtil = entero.length + (hayComa ? 1 + decimales.length : 0);
  sig = Math.min(sig, largoUtil);
  const formateado = `${agruparMiles(entero)}${hayComa ? `,${decimales}` : ''}`;
  if (crudo.replace(/[^\d,]/g, '') === '') return { texto: '', cursor: 0 };
  let posicion = 0;
  for (let vistos = 0; posicion < formateado.length && vistos < sig; posicion += 1) if (/[\d,]/.test(formateado[posicion])) vistos += 1;
  return { texto: formateado, cursor: posicion };
}

/**
 * Entiende un monto pegado, con la convención argentina o la anglosajona: «12.500,50» y «12500.50» → «12500,50»;
 * «1.250.000» → «1250000». Con coma, la coma es el decimal; con solo puntos, el último es decimal si lo siguen
 * 1 o 2 cifras y es el único; si no, son miles. Devuelve texto con cifras y a lo sumo una coma.
 */
export function interpretarMontoPegado(texto) {
  const limpio = String(texto).trim().replace(/[^\d.,]/g, '');
  if (limpio.includes(',')) {
    const i = limpio.lastIndexOf(',');
    return `${limpio.slice(0, i).replace(/[.,]/g, '')},${limpio.slice(i + 1).replace(/[.,]/g, '')}`;
  }
  const puntos = limpio.split('.');
  if (puntos.length === 2 && /^\d{1,2}$/.test(puntos[1])) return `${puntos[0]},${puntos[1]}`;
  return puntos.join('');
}
