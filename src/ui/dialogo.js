// Ventanas sobre la pantalla con <dialog> nativo (aep#12): confirmaciones y formularios. El navegador
// atrapa el foco, Esc cierra y, al cerrar, el foco vuelve al control que la abrió.
import { crear } from './dom.js';

/**
 * Abre una ventana con `contenido`; devuelve { cerrar }. `alCerrar` se llama al cerrarse de cualquier forma.
 * `alEscape` (opcional) se llama al apretar Esc: si devuelve true, la ventana se queda abierta (HU-39: Esc vuelve de un
 * formulario a la lista).
 */
export function abrirVentana({ etiqueta, contenido, clase = '', alCerrar = () => {}, alEscape = () => false }) {
  const origen = document.activeElement;
  const ventana = crear('dialog', { class: `ventana ${clase}`.trim(), 'aria-label': etiqueta }, [contenido]);
  document.body.append(ventana);
  // El foco vuelve al control que la abrió en el mismo momento en que se cierra, sin esperar al evento «close»
  // (que llega después): así una tecla apretada enseguida no se pierde ni cae en otro lado (HU-02).
  let terminada = false;
  const terminar = () => {
    if (terminada) return;
    terminada = true;
    ventana.remove();
    alCerrar();
    if (origen?.isConnected) origen.focus();
  };
  ventana.addEventListener('close', terminar);
  // Esc: se cierra por acá para terminar de inmediato, igual que con un botón.
  ventana.addEventListener('cancel', (evento) => { evento.preventDefault(); if (alEscape()) return; ventana.close(); terminar(); });
  ventana.showModal();
  return { cerrar: () => { ventana.close(); terminar(); } };
}

/** Pide confirmación (botón negativo a la izquierda y positivo a la derecha, D-108). Devuelve true o false. */
export function confirmar({ titulo, texto, aceptar, cancelar = 'Cancelar' }) {
  return new Promise((resolver) => {
    let respuesta = false;
    const no = crear('button', { type: 'button', class: 'boton-secundario', texto: cancelar });
    const si = crear('button', { type: 'button', class: 'boton-principal', texto: aceptar });
    const contenido = crear('div', { class: 'confirmacion' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-confirmacion', texto: titulo }),
      ...(texto ? [crear('p', { texto })] : []),
      crear('div', { class: 'acciones' }, [no, si]),
    ]);
    const ventana = abrirVentana({ etiqueta: titulo, contenido, clase: 'ventana-confirmar', alCerrar: () => resolver(respuesta) });
    no.addEventListener('click', () => ventana.cerrar());
    si.addEventListener('click', () => { respuesta = true; ventana.cerrar(); });
    si.focus();
  });
}

const ESPERA_AVISO = 4000;
// Un aviso con botón («Deshacer», HU-41) dura más para dar tiempo a tocarlo (CA-3: al menos 6 s).
const ESPERA_AVISO_CON_ACCION = 7000;
let accionDelAviso = () => {};
let retenido = false; // el mouse o el foco están sobre el aviso: no se esconde

/** Evento con el que el botón «Deshacer» de un aviso le pide a la interfaz (ui/app.js) que deshaga el último cambio (HU-41). */
export const EVENTO_DESHACER = 'afp:deshacer';

function zonaDeAviso() {
  let zona = document.getElementById('aviso-breve');
  if (zona) return zona;
  const boton = crear('button', { type: 'button', class: 'aviso-accion', id: 'aviso-accion', hidden: '' });
  boton.addEventListener('click', () => accionDelAviso());
  zona = crear('div', { id: 'aviso-breve', class: 'aviso-breve', role: 'status' }, [crear('div', { class: 'aviso-cuerpo' }, [crear('span', { class: 'aviso-texto' }), boton])]);
  const programar = () => { retenido = false; esperar(zona); };
  zona.addEventListener('pointerenter', () => { retenido = true; clearTimeout(avisar.temporizador); });
  zona.addEventListener('pointerleave', programar);
  // Con el teclado (foco visible) el aviso espera; tocar o hacer clic en el botón no lo deja fijo.
  zona.addEventListener('focusin', () => { if (zona.querySelector(':focus-visible')) { retenido = true; clearTimeout(avisar.temporizador); } });
  zona.addEventListener('focusout', programar);
  document.body.append(zona);
  return zona;
}

function esperar(zona) {
  clearTimeout(avisar.temporizador);
  if (retenido) return;
  const espera = zona.querySelector('.aviso-accion').hidden ? ESPERA_AVISO : ESPERA_AVISO_CON_ACCION;
  avisar.temporizador = setTimeout(() => { zona.hidden = true; }, espera);
}

/**
 * Aviso breve que se lee en voz alta («¡Listo! Creaste la cuenta…»). Con `accion` ({ texto, alTocar }) lleva un botón y dura
 * más; mientras el mouse o el foco están sobre el aviso, no desaparece.
 */
export function avisar(texto, accion = null) {
  const zona = zonaDeAviso();
  const boton = zona.querySelector('.aviso-accion');
  zona.querySelector('.aviso-texto').textContent = texto;
  boton.hidden = !accion;
  boton.textContent = accion?.texto ?? '';
  accionDelAviso = accion?.alTocar ?? (() => {});
  // Si el aviso se vuelve a escribir con el foco en el botón, lo conserva (el mismo botón cambia de texto).
  retenido = Boolean(zona.querySelector(':focus-visible'));
  zona.hidden = false;
  esperar(zona);
}

/** Aviso de un cambio guardado, con el botón «Deshacer» (HU-41). */
export function avisarCambio(texto) {
  avisar(texto, { texto: 'Deshacer', alTocar: () => document.dispatchEvent(new CustomEvent(EVENTO_DESHACER)) });
}
