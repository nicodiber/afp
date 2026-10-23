// Ventanas sobre la pantalla con <dialog> nativo (aep#12): confirmaciones y formularios. El navegador
// atrapa el foco, Esc cierra y, al cerrar, el foco vuelve al control que la abrió.
import { crear } from './dom.js';

/** Abre una ventana con `contenido`; devuelve { cerrar }. `alCerrar` se llama al cerrarse de cualquier forma. */
export function abrirVentana({ etiqueta, contenido, clase = '', alCerrar = () => {} }) {
  const origen = document.activeElement;
  const ventana = crear('dialog', { class: `ventana ${clase}`.trim(), 'aria-label': etiqueta }, [contenido]);
  document.body.append(ventana);
  ventana.addEventListener('close', () => {
    ventana.remove();
    alCerrar();
    if (origen?.isConnected) origen.focus();
  });
  ventana.showModal();
  return { cerrar: () => ventana.close() };
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

/** Aviso breve que se lee en voz alta («¡Listo! Creaste la cuenta…»). */
export function avisar(texto) {
  let zona = document.getElementById('aviso-breve');
  if (!zona) {
    zona = crear('div', { id: 'aviso-breve', class: 'aviso-breve', role: 'status' });
    document.body.append(zona);
  }
  zona.textContent = texto;
  zona.hidden = false;
  clearTimeout(avisar.temporizador);
  avisar.temporizador = setTimeout(() => { zona.hidden = true; }, 4000);
}
