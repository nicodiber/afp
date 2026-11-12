// Ventana de selección con buscador (HU-02 CA-1 y CA-3): muestra todas las opciones, agrupadas, y filtra mientras
// se escribe. Con el teclado: ↑/↓ mueven la opción marcada, Enter elige y Esc cierra sin cambiar. El foco queda
// siempre en el buscador (patrón «combobox» con lista). Con `nivel`, sin texto escrito muestra el árbol por niveles
// (HU-02b): primero el primer nivel y, al tocar una familia, sus categorías con «‹ Atrás»; al escribir, busca entre
// todas las opciones de `grupos`. Es un componente: no sabe qué se está eligiendo.
import { crear } from './dom.js';
import { abrirVentana } from './dialogo.js';
import { filtrarOpciones } from '../dominio/movimientos.js';

let contador = 0;

/**
 * @param {Object} o
 * @param {string} o.titulo
 * @param {{titulo: string|null, opciones: {id: string, nombre: string, emoji?: string, detalle?: string, negativo?: boolean}[]}[]} o.grupos
 * @param {string|null} o.elegidoId  La opción que está elegida ahora (empieza marcada).
 * @param {(id: string) => void} o.alElegir
 * @param {boolean} o.pantallaCompleta
 * @param {{texto: string}=} o.vacio  Qué decir si no hay ninguna opción (la lista igual ofrece «＋ Nueva…»).
 * @param {{opciones: (padreId: string|null) => {id: string, nombre: string, emoji?: string, esFamilia: boolean}[], nombreDe: (id: string) => string}=} o.nivel
 * @param {{texto: (familiaId: string|null) => string, formulario: (c: {buscado: string, familiaId: string|null, alCancelar: () => void, alCrear: (id: string) => void}) => Promise<{elemento: HTMLElement, enfocar: () => void}>}=} o.nuevo
 *   «＋ Nueva…» al final de la lista (HU-39): una opción más, que se alcanza con las flechas. Al elegirla, el formulario que arma
 *   `formulario` reemplaza a la lista dentro de la misma ventana; «Volver» o Esc dejan la lista como estaba y `alCrear` la elige.
 */
export function abrirSelector({ titulo, grupos, elegidoId, alElegir, pantallaCompleta, vacio, nivel, nuevo }) {
  const n = ++contador;
  const idLista = `selector-lista-${n}`;
  let ventana;
  let enFormulario = false;
  let abriendo = false;
  let volverALista = () => {};
  const cerrar = () => ventana.cerrar();

  const encabezado = crear('div', { class: 'selector-cabecera' }, [
    crear('h2', { class: 'subtitulo', id: `selector-titulo-${n}`, texto: titulo }),
    (() => { const x = crear('button', { type: 'button', class: 'boton-texto', texto: 'Cerrar' }); x.addEventListener('click', cerrar); return x; })(),
  ]);

  const buscador = crear('input', {
    type: 'search', class: 'selector-buscador', role: 'combobox', 'aria-label': `Buscar: ${titulo}`, 'aria-expanded': 'true',
    'aria-controls': idLista, 'aria-autocomplete': 'list', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Buscar',
  });
  const lista = crear('div', { class: 'selector-lista', id: idLista, role: 'listbox', 'aria-label': titulo });
  const barra = crear('div', { class: 'selector-barra', hidden: '' });
  const aviso = crear('p', { class: 'selector-aviso', role: 'status', hidden: '' });
  let visibles = []; // { opcion, elemento }
  let activa = -1;
  const pila = []; // las familias por las que se entró (solo con `nivel`)

  const marcar = (indice, { desplazar = true } = {}) => {
    activa = indice;
    visibles.forEach(({ elemento }, i) => elemento.setAttribute('aria-selected', String(i === indice)));
    const actual = visibles[indice]?.elemento;
    if (actual) buscador.setAttribute('aria-activedescendant', actual.id); else buscador.removeAttribute('aria-activedescendant');
    if (actual && desplazar) actual.scrollIntoView({ block: 'nearest' });
  };
  const volver = () => { pila.pop(); dibujar(); };
  const elegir = (opcion) => {
    if (opcion.esNueva) { abrirFormulario(); return; }
    if (opcion.esFamilia) { pila.push(opcion.id); buscador.value = ''; dibujar(); return; }
    cerrar();
    alElegir(opcion.id);
  };
  const elementoDe = (opcion) => {
    const elemento = crear('div', { class: 'selector-opcion', role: 'option', id: `selector-${n}-${opcion.id}`, 'aria-selected': 'false' }, [
      ...(opcion.emoji ? [crear('span', { class: 'selector-emoji', 'aria-hidden': 'true', texto: opcion.emoji })] : []),
      crear('span', { class: 'selector-nombre', texto: opcion.nombre }),
      ...(opcion.detalle ? [crear('span', { class: `selector-detalle${opcion.negativo ? ' negativo' : ''}`, texto: opcion.detalle })] : []),
      ...(opcion.esFamilia ? [crear('span', { class: 'chevron', 'aria-hidden': 'true', texto: '›' })] : []),
    ]);
    // El foco se queda en el buscador: no se roba al apretar.
    elemento.addEventListener('mousedown', (evento) => evento.preventDefault());
    elemento.addEventListener('click', () => elegir(opcion));
    if (opcion.esNueva) elemento.classList.add('selector-nueva');
    visibles.push({ opcion, elemento });
    return elemento;
  };
  // La opción «＋ Nueva…»: siempre al final, dentro de la familia en la que se está (si se entró a una).
  const opcionNueva = () => ({ id: 'nueva', nombre: nuevo.texto(pila.at(-1) ?? null), esNueva: true });

  const dibujar = () => {
    const buscado = buscador.value.trim();
    visibles = [];
    const bloques = [];
    if (nivel && !buscado) {
      const actual = pila.at(-1) ?? null;
      if (actual) {
        const atras = crear('button', { type: 'button', class: 'boton-texto selector-atras', texto: '‹ Atrás' });
        atras.addEventListener('mousedown', (evento) => evento.preventDefault());
        atras.addEventListener('click', volver);
        bloques.push(crear('div', { class: 'selector-nivel' }, [atras, crear('span', { class: 'rotulo-grupo', texto: nivel.nombreDe(actual) })]));
      }
      bloques.push(...nivel.opciones(actual).map(elementoDe));
    } else {
      for (const [g, grupo] of grupos.entries()) {
        const coinciden = filtrarOpciones(grupo.opciones.map((o) => ({ ...o, familia: grupo.titulo })), buscado);
        if (!coinciden.length) continue;
        const elementos = coinciden.map(elementoDe);
        if (grupo.titulo) {
          const idTitulo = `selector-${n}-grupo-${g}`;
          bloques.push(crear('div', { role: 'group', 'aria-labelledby': idTitulo, class: 'selector-grupo' }, [crear('div', { class: 'rotulo-grupo', id: idTitulo, texto: grupo.titulo }), ...elementos]));
        } else {
          bloques.push(...elementos);
        }
      }
    }
    const reales = visibles.length;
    if (nuevo) bloques.push(elementoDe(opcionNueva()));
    barra.replaceChildren(...(nivel && !buscado && pila.length ? [bloques.shift()] : []));
    barra.hidden = barra.childElementCount === 0;
    lista.replaceChildren(...bloques);
    aviso.hidden = reales > 0;
    aviso.textContent = reales ? '' : (buscado || !vacio ? `No hay resultados para «${buscador.value.trim()}».` : vacio.texto);
    lista.hidden = visibles.length === 0;
    const indiceElegido = nivel ? -1 : visibles.findIndex(({ opcion }) => opcion.id === elegidoId);
    marcar(visibles.length ? (buscado ? 0 : Math.max(indiceElegido, 0)) : -1);
    if (nivel && !buscado) lista.scrollTop = 0;
  };

  buscador.addEventListener('input', dibujar);
  buscador.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!visibles.length) return;
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      marcar((activa + paso + visibles.length) % visibles.length);
    } else if (evento.key === 'ArrowLeft' && nivel && pila.length && !buscador.value) {
      evento.preventDefault();
      volver();
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (visibles[activa]) elegir(visibles[activa].opcion);
    }
  });

  const contenido = crear('div', { class: 'selector' }, [encabezado, buscador, aviso, crear('div', { class: 'selector-cuerpo' }, [barra, lista])]);
  // El formulario corto de «＋ Nueva…» ocupa el lugar de la lista; lo escrito en el buscador y la familia abierta se conservan.
  async function abrirFormulario() {
    if (abriendo || enFormulario) return;
    abriendo = true;
    const partes = [...contenido.childNodes];
    let hecho;
    try {
      hecho = await nuevo.formulario({
        buscado: buscador.value.trim(), familiaId: pila.at(-1) ?? null,
        alCancelar: () => volverALista(),
        alCrear: (id) => { cerrar(); alElegir(id); },
      });
    } finally { abriendo = false; }
    const { elemento, enfocar } = hecho;
    enFormulario = true;
    volverALista = () => {
      if (!enFormulario) return;
      enFormulario = false;
      contenido.classList.remove('selector-formulario');
      contenido.replaceChildren(...partes);
      dibujar();
      buscador.focus();
    };
    contenido.classList.add('selector-formulario');
    contenido.replaceChildren(elemento);
    enfocar();
  }
  ventana = abrirVentana({
    etiqueta: titulo, contenido, clase: `ventana-selector ${pantallaCompleta ? 'ventana-pantalla' : 'ventana-formulario'}`,
    // Esc en el formulario corto vuelve a la lista (HU-39 CA-3); en la lista cierra la ventana como siempre.
    alEscape: () => { if (!enFormulario) return false; volverALista(); return true; },
  });
  dibujar();
  buscador.focus();
}
