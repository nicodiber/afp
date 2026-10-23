// Formulario de una categoría (aep#15, D-137): nombre (con mayúscula inicial, D-134), emoji y la clasificación
// de su tipo. Es un componente: lo abre Categorías y lo puede abrir la carga de movimientos más adelante.
import { crear } from './dom.js';
import { capitalizarInicial } from '../dominio/texto.js';
import { NOMBRES_DE_NATURALEZA, NATURALEZAS, NOMBRE_DE_RAIZ } from '../dominio/categorias.js';

let siguiente = 0;

function segmentado({ rotulo, opciones, valor, id }) {
  let elegido = valor;
  const titulo = crear('span', { class: 'rotulo-campo', id: `${id}-rotulo`, texto: rotulo });
  const botones = opciones.map(([v, texto]) => {
    const b = crear('button', { type: 'button', 'aria-pressed': String(v === valor), texto });
    b.addEventListener('click', () => { elegido = v; for (const o of botones) o.setAttribute('aria-pressed', String(o === b)); });
    return b;
  });
  const grupo = crear('div', { class: 'segmentado', role: 'group', 'aria-labelledby': titulo.id, id }, botones);
  return { elemento: crear('div', { class: 'campo' }, [titulo, grupo]), valor: () => elegido };
}

/**
 * @param {Object} o
 * @param {object|null} o.categoria  La categoría a editar, o null para una nueva.
 * @param {'ingreso'|'egreso'} o.tipo
 * @param {string} o.dondeTexto  «En Alimentación», para que se sepa dónde queda.
 * @param {boolean} o.esFamilia  Una familia no muestra clasificación (las partes van en las hojas).
 * @param {object} o.clasificacion  Valores iniciales (la de la categoría o la que trae una nueva, D-137).
 */
export function formularioCategoria({ categoria, tipo, dondeTexto, esFamilia, clasificacion, alGuardar, alCancelar, acciones = [] }) {
  const n = ++siguiente;
  const id = (campo) => `categoria-${campo}-${n}`;
  const nueva = !categoria;
  const nombre = crear('input', { id: id('nombre'), type: 'text', autocomplete: 'off', autocapitalize: 'sentences', maxlength: '60' });
  nombre.value = categoria?.nombre ?? '';
  nombre.addEventListener('input', () => {
    const corregido = capitalizarInicial(nombre.value);
    if (corregido === nombre.value) return;
    const { selectionStart, selectionEnd } = nombre;
    nombre.value = corregido;
    nombre.setSelectionRange(selectionStart, selectionEnd);
  });
  const emoji = crear('input', { id: id('emoji'), type: 'text', autocomplete: 'off', maxlength: '8' });
  emoji.value = categoria?.emoji ?? '';
  const errorNombre = crear('p', { class: 'error-campo', id: id('nombre-error') });
  const resumen = crear('p', { class: 'solo-lectores', role: 'alert' });

  const controles = {};
  const clasif = [];
  if (!esFamilia) {
    clasif.push(crear('p', { class: 'apoyo', texto: nueva ? 'Clasificación (la podés cambiar):' : 'Clasificación:' }));
    if (tipo === 'egreso') {
      controles.fijoVariable = segmentado({ rotulo: 'Fijo o variable', opciones: [['fijo', 'Fijo'], ['variable', 'Variable']], valor: clasificacion.fijoVariable, id: id('fijo') });
      controles.necesidadDeseo = segmentado({ rotulo: 'Necesidad o deseo', opciones: [['necesidad', 'Necesidad'], ['deseo', 'Deseo']], valor: clasificacion.necesidadDeseo, id: id('necesidad') });
      const hormiga = crear('button', { type: 'button', role: 'switch', class: 'interruptor', id: id('hormiga'), 'aria-checked': String(Boolean(clasificacion.hormiga)) }, [
        crear('span', { class: 'interruptor-texto', texto: 'Gasto hormiga' }),
        crear('span', { class: 'interruptor-pista', 'aria-hidden': 'true' }),
      ]);
      hormiga.addEventListener('click', () => hormiga.setAttribute('aria-checked', String(hormiga.getAttribute('aria-checked') !== 'true')));
      controles.hormiga = { valor: () => hormiga.getAttribute('aria-checked') === 'true' };
      clasif.push(controles.fijoVariable.elemento, controles.necesidadDeseo.elemento, hormiga);
    } else {
      controles.naturaleza = segmentado({ rotulo: 'Naturaleza', opciones: NATURALEZAS.map((v) => [v, NOMBRES_DE_NATURALEZA[v]]), valor: clasificacion.naturaleza, id: id('naturaleza') });
      clasif.push(controles.naturaleza.elemento);
    }
  } else {
    clasif.push(crear('p', { class: 'apoyo', texto: 'Es una familia: la clasificación va en cada una de sus categorías.' }));
  }

  const titulo = crear('h2', { class: 'subtitulo', id: id('titulo'), tabindex: '-1', texto: nueva ? 'Nueva categoría' : 'Editar categoría' });
  const cancelar = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Cancelar' });
  cancelar.addEventListener('click', alCancelar);
  const guardar = crear('button', { type: 'submit', class: 'boton-principal', texto: nueva ? 'Crear categoría' : 'Guardar' });
  const extra = acciones.map(({ texto, peligro, alTocar }) => {
    const b = crear('button', { type: 'button', class: `boton-texto${peligro ? ' boton-peligro' : ''}`, texto });
    b.addEventListener('click', alTocar);
    return b;
  });
  const formulario = crear('form', { class: 'formulario-cuenta formulario-categoria', 'aria-labelledby': titulo.id, novalidate: '' }, [
    titulo,
    crear('p', { class: 'apoyo', texto: dondeTexto }),
    crear('div', { class: 'campos-juntos campos-emoji campos-emoji-final' }, [
      crear('div', { class: 'campo' }, [crear('label', { for: nombre.id, texto: 'Nombre' }), nombre, errorNombre]),
      crear('div', { class: 'campo' }, [crear('label', { for: emoji.id, texto: 'Emoji' }), emoji]),
    ]),
    ...clasif,
    resumen,
    crear('div', { class: 'acciones' }, [cancelar, guardar]),
    ...(extra.length ? [crear('div', { class: 'acciones-extra' }, extra)] : []),
  ]);
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = { nombre: nombre.value, emoji: emoji.value };
    for (const [clave, control] of Object.entries(controles)) datos[clave] = control.valor();
    const resultado = await alGuardar(datos);
    const mensaje = resultado?.errores?.nombre;
    errorNombre.textContent = mensaje ?? '';
    if (mensaje) {
      nombre.setAttribute('aria-invalid', 'true');
      nombre.setAttribute('aria-describedby', errorNombre.id);
      resumen.textContent = mensaje;
      nombre.focus();
    } else nombre.removeAttribute('aria-invalid');
  });
  return { elemento: formulario, enfocar: () => (nueva ? nombre : titulo).focus() };
}

/** Texto de la raíz o de la familia donde está o va a estar una categoría. */
export const textoDonde = (padre, tipo) => `En ${padre ? padre.nombre : NOMBRE_DE_RAIZ[tipo]}`;
