// Deshacer y rehacer desde la interfaz (HU-41): corre la acción, redibuja la pantalla y avisa. Se carga con `import()` recién
// cuando se usa (Ctrl + Z o el botón «Deshacer» de un aviso), para que Inicio no cargue de más (LCP).
import { avisar } from './dialogo.js';

/**
 * @param {Object} o
 * @param {{deshacer: () => Promise<{ok: boolean, texto: string}>, rehacer: () => Promise<{ok: boolean, texto: string}>}} o.deshacer
 * @param {() => void} o.redibujar  Vuelve a dibujar la pantalla actual sin perder el foco.
 * @returns {(sentido: 'deshacer' | 'rehacer') => Promise<void>}
 */
export function crearHistorial({ deshacer, redibujar }) {
  let enCurso = false;
  const ejecutar = async (sentido) => {
    if (enCurso) return;
    enCurso = true;
    try {
      const resultado = await deshacer[sentido]();
      if (resultado.ok) redibujar();
      // Deshecho, se ofrece rehacer (y al revés): en el celular no hay teclado.
      const otro = sentido === 'deshacer' ? 'rehacer' : 'deshacer';
      avisar(resultado.texto, resultado.ok ? { texto: otro === 'rehacer' ? 'Rehacer' : 'Deshacer', alTocar: () => ejecutar(otro) } : null);
    } finally { enCurso = false; }
  };
  return ejecutar;
}
