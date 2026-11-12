// Formato del campo de monto mientras se escribe (HU-02b CA-1): puntos de miles, coma decimal con hasta 2 cifras.
// La tecla punto escribe una coma (la del teclado numérico también) y al pegar se entiende «12.500,50» o «12500.50».
// Lo usan la carga de movimientos y el formulario corto de cuenta (HU-39).
import { leerMonto, montoParaEditar, formatearMontoEscrito, interpretarMontoPegado } from '../dominio/formato.js';

/** Le da al campo de texto `monto` el formato de monto. */
export function darFormatoDeMonto(monto) {
  const darFormato = () => {
    const resultado = formatearMontoEscrito(monto.value, monto.selectionStart ?? monto.value.length);
    monto.value = resultado.texto;
    monto.setSelectionRange(resultado.cursor, resultado.cursor);
  };
  const insertar = (texto) => {
    monto.setRangeText(texto, monto.selectionStart, monto.selectionEnd, 'end');
    darFormato();
  };
  // Teclado físico: el punto (también el del teclado numérico) se vuelve coma.
  monto.addEventListener('keydown', (evento) => {
    if ((evento.key === '.' || evento.code === 'NumpadDecimal') && !evento.ctrlKey && !evento.metaKey && !evento.altKey) { evento.preventDefault(); insertar(','); }
  });
  // Teclados del celular, que no mandan la tecla: se mira el texto que entra.
  monto.addEventListener('beforeinput', (evento) => {
    if (evento.inputType === 'insertText' && evento.data === '.') { evento.preventDefault(); insertar(','); }
  });
  monto.addEventListener('paste', (evento) => {
    evento.preventDefault();
    insertar(interpretarMontoPegado(evento.clipboardData?.getData('text') ?? ''));
  });
  monto.addEventListener('input', darFormato);
  monto.addEventListener('blur', () => {
    const centavos = leerMonto(monto.value);
    if (centavos !== null && centavos > 0) monto.value = montoParaEditar(centavos);
  });
}
