// Botón «ⓘ» con la explicación de las etiquetas de una categoría (HU-31). Un solo globo para toda la pantalla:
// en la PC aparece al pasar el mouse o con el foco del teclado; en el celular, al tocar, y se cierra al tocar afuera,
// al tocar de nuevo o con Esc. Los textos siempre con textContent.
import { crear } from './dom.js';

let globo = null;
let abierto = null; // { boton, fijo }
let oyentes = false;

const cerrar = () => {
  if (!abierto) return;
  abierto.boton.removeAttribute('aria-describedby');
  abierto.boton.setAttribute('aria-expanded', 'false');
  abierto = null;
  if (globo) globo.hidden = true;
};

function ubicar(boton) {
  const r = boton.getBoundingClientRect();
  const ancho = Math.min(300, window.innerWidth - 32);
  globo.style.setProperty('--globo-ancho', `${ancho}px`);
  const izquierda = Math.max(16, Math.min(r.left + r.width / 2 - ancho / 2, window.innerWidth - ancho - 16));
  globo.style.setProperty('--globo-x', `${izquierda}px`);
  const alto = globo.offsetHeight;
  const arriba = r.top - alto - 8;
  globo.style.setProperty('--globo-y', `${arriba >= 8 ? arriba : r.bottom + 8}px`);
}

function mostrar(boton, textos, fijo) {
  if (!globo) {
    globo = crear('div', { class: 'globo-info', id: 'globo-info', role: 'tooltip', hidden: '' });
    document.body.append(globo);
  }
  if (abierto && abierto.boton !== boton) cerrar();
  globo.replaceChildren(...textos().map(({ nombre, texto }) => crear('p', {}, [crear('strong', { texto: `${nombre}: ` }), texto])));
  globo.hidden = false;
  boton.setAttribute('aria-describedby', globo.id);
  boton.setAttribute('aria-expanded', 'true');
  abierto = { boton, fijo: fijo || (abierto?.boton === boton && abierto.fijo) };
  ubicar(boton);
  if (!oyentes) {
    oyentes = true;
    document.addEventListener('pointerdown', (e) => { if (abierto && !abierto.boton.contains(e.target) && !globo.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto) { const b = abierto.boton; cerrar(); b.focus(); } });
    // Si la pantalla se mueve o cambia de tamaño, el globo sigue pegado a su ⓘ.
    const reubicar = () => { if (abierto) ubicar(abierto.boton); };
    window.addEventListener('resize', reubicar);
    window.addEventListener('scroll', reubicar, { capture: true, passive: true });
  }
}

/**
 * @param {Object} o
 * @param {string} o.rotulo  Nombre accesible del botón.
 * @param {() => {nombre: string, texto: string}[]} o.textos  Las explicaciones a mostrar.
 */
export function botonInfo({ rotulo, textos }) {
  const boton = crear('button', { type: 'button', class: 'boton-info', 'aria-label': rotulo, 'aria-expanded': 'false', texto: 'ⓘ' });
  // Con mouse: al pasar por encima. El toque no genera «mouse», así que en el celular solo vale el clic.
  boton.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') mostrar(boton, textos, false); });
  boton.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && abierto?.boton === boton && !abierto.fijo) cerrar(); });
  // Con el teclado: el foco la muestra (solo si es foco de teclado, no el de un toque).
  boton.addEventListener('focus', () => { if (boton.matches(':focus-visible')) mostrar(boton, textos, false); });
  boton.addEventListener('blur', () => { if (abierto?.boton === boton) cerrar(); });
  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (abierto?.boton === boton && abierto.fijo) cerrar(); else mostrar(boton, textos, true);
  });
  return boton;
}

/** Panel desplegable «ⓘ Qué significa» del formulario: las mismas explicaciones, en el lugar. */
export function panelQueSignifica({ id, explicaciones }) {
  const panel = crear('div', { class: 'que-significa', id, hidden: '' }, explicaciones.map(({ nombre, texto }) => crear('p', {}, [crear('strong', { texto: `${nombre}: ` }), texto])));
  const boton = crear('button', { type: 'button', class: 'boton-texto boton-que-significa', 'aria-expanded': 'false', 'aria-controls': id, texto: 'ⓘ Qué significa' });
  boton.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    boton.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return { boton, panel };
}
