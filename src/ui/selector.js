// Ventana de selección con buscador (HU-02 CA-1 y CA-3): muestra todas las opciones, agrupadas, y filtra mientras
// se escribe. Con el teclado: ↑/↓ mueven la opción marcada, Enter elige y Esc cierra sin cambiar. El foco queda
// siempre en el buscador (patrón «combobox» con lista). Es un componente: no sabe qué se está eligiendo.
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
 * @param {{texto: string, boton: string, alTocar: () => void}=} o.vacio  Qué mostrar si no hay ninguna opción.
 */
export function abrirSelector({ titulo, grupos, elegidoId, alElegir, pantallaCompleta, vacio }) {
  const n = ++contador;
  const idLista = `selector-lista-${n}`;
  const total = grupos.reduce((suma, g) => suma + g.opciones.length, 0);
  let ventana;
  const cerrar = () => ventana.cerrar();

  const encabezado = crear('div', { class: 'selector-cabecera' }, [
    crear('h2', { class: 'subtitulo', id: `selector-titulo-${n}`, texto: titulo }),
    (() => { const x = crear('button', { type: 'button', class: 'boton-texto', texto: 'Cerrar' }); x.addEventListener('click', cerrar); return x; })(),
  ]);

  if (total === 0) {
    const boton = crear('button', { type: 'button', class: 'boton-principal', texto: vacio.boton });
    boton.addEventListener('click', () => { cerrar(); vacio.alTocar(); });
    const contenido = crear('div', { class: 'selector selector-vacio' }, [encabezado, crear('p', { texto: vacio.texto }), boton]);
    ventana = abrirVentana({ etiqueta: titulo, contenido, clase: pantallaCompleta ? 'ventana-pantalla' : 'ventana-formulario' });
    boton.focus();
    return;
  }

  const buscador = crear('input', {
    type: 'search', class: 'selector-buscador', role: 'combobox', 'aria-label': `Buscar: ${titulo}`, 'aria-expanded': 'true',
    'aria-controls': idLista, 'aria-autocomplete': 'list', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Buscar',
  });
  const lista = crear('div', { class: 'selector-lista', id: idLista, role: 'listbox', 'aria-label': titulo });
  const aviso = crear('p', { class: 'selector-aviso', role: 'status', hidden: '' });
  let visibles = []; // { opcion, elemento }
  let activa = -1;

  const marcar = (indice, { desplazar = true } = {}) => {
    activa = indice;
    visibles.forEach(({ elemento }, i) => elemento.setAttribute('aria-selected', String(i === indice)));
    const actual = visibles[indice]?.elemento;
    if (actual) buscador.setAttribute('aria-activedescendant', actual.id); else buscador.removeAttribute('aria-activedescendant');
    if (actual && desplazar) actual.scrollIntoView({ block: 'nearest' });
  };
  const elegir = (opcion) => { cerrar(); alElegir(opcion.id); };

  const dibujar = () => {
    const buscado = buscador.value.trim();
    visibles = [];
    const bloques = [];
    for (const [g, grupo] of grupos.entries()) {
      const coinciden = filtrarOpciones(grupo.opciones.map((o) => ({ ...o, familia: grupo.titulo })), buscado);
      if (!coinciden.length) continue;
      const elementos = coinciden.map((opcion) => {
        const elemento = crear('div', { class: 'selector-opcion', role: 'option', id: `selector-${n}-${opcion.id}`, 'aria-selected': 'false' }, [
          ...(opcion.emoji ? [crear('span', { class: 'selector-emoji', 'aria-hidden': 'true', texto: opcion.emoji })] : []),
          crear('span', { class: 'selector-nombre', texto: opcion.nombre }),
          ...(opcion.detalle ? [crear('span', { class: `selector-detalle${opcion.negativo ? ' negativo' : ''}`, texto: opcion.detalle })] : []),
        ]);
        // El foco se queda en el buscador: no se roba al apretar.
        elemento.addEventListener('mousedown', (evento) => evento.preventDefault());
        elemento.addEventListener('click', () => elegir(opcion));
        visibles.push({ opcion, elemento });
        return elemento;
      });
      if (grupo.titulo) {
        const idTitulo = `selector-${n}-grupo-${g}`;
        bloques.push(crear('div', { role: 'group', 'aria-labelledby': idTitulo, class: 'selector-grupo' }, [crear('div', { class: 'rotulo-grupo', id: idTitulo, texto: grupo.titulo }), ...elementos]));
      } else {
        bloques.push(...elementos);
      }
    }
    lista.replaceChildren(...bloques);
    aviso.hidden = visibles.length > 0;
    aviso.textContent = visibles.length ? '' : `No hay resultados para «${buscador.value.trim()}».`;
    lista.hidden = visibles.length === 0;
    const indiceElegido = visibles.findIndex(({ opcion }) => opcion.id === elegidoId);
    marcar(visibles.length ? (buscado ? 0 : Math.max(indiceElegido, 0)) : -1);
  };

  buscador.addEventListener('input', dibujar);
  buscador.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!visibles.length) return;
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      marcar((activa + paso + visibles.length) % visibles.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (visibles[activa]) elegir(visibles[activa].opcion);
    }
  });

  const contenido = crear('div', { class: 'selector' }, [encabezado, buscador, aviso, lista]);
  ventana = abrirVentana({ etiqueta: titulo, contenido, clase: `ventana-selector ${pantallaCompleta ? 'ventana-pantalla' : 'ventana-formulario'}` });
  dibujar();
  buscador.focus();
}
