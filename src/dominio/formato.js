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
