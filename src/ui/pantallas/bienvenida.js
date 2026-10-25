// Bienvenida (RF-CAT-03, aep HU-01): lo primero que ve quien abre AFP con la base vacía. Hay que elegir una de
// las dos opciones; no hay «Más tarde». Se carga solo cuando hace falta (no pesa en el arranque normal).
import { crear } from '../dom.js';
import { avisar } from '../dialogo.js';
import { NOMBRES_DE_TIPO } from '../../dominio/cuentas.js';

const ERROR_PLANTILLA = 'No se pudo cargar la plantilla. Probá de nuevo.';
const ERROR_VACIO = 'No se pudo guardar tu elección. Probá de nuevo.';

export function pantallaBienvenida({ inicio, alTerminar }) {
  const opcion = (id, titulo, detalle) => crear('button', { type: 'button', class: 'opcion-inicio', id }, [
    crear('span', { class: 'opcion-inicio-titulo', texto: titulo }),
    crear('span', { class: 'opcion-inicio-detalle', texto: detalle }),
  ]);
  const plantilla = opcion('empezar-plantilla', 'Empezar con la plantilla', '4 cuentas y un árbol de categorías comunes, con saldo 0. Podés cambiarlas o borrarlas cuando quieras.');
  const vacio = opcion('empezar-vacio', 'Empezar vacío', 'Sin cuentas ni categorías: las creás vos.');
  const error = crear('p', { class: 'error-campo', id: 'error-bienvenida', role: 'alert' });
  const ver = crear('button', { type: 'button', class: 'boton-texto', id: 'ver-plantilla', 'aria-expanded': 'false', 'aria-controls': 'contenido-plantilla', texto: 'Ver qué trae la plantilla' });
  const contenido = crear('div', { id: 'contenido-plantilla', class: 'contenido-plantilla', hidden: '' });

  // Mientras se guarda, las dos opciones quedan quietas: un doble toque no repite nada.
  const elegir = async (accion, mensajeDeError, alOk) => {
    plantilla.disabled = true;
    vacio.disabled = true;
    error.textContent = '';
    const resultado = await accion();
    if (resultado.ok) { alOk(resultado); alTerminar(); return; }
    plantilla.disabled = false;
    vacio.disabled = false;
    error.textContent = mensajeDeError;
    plantilla.focus();
  };
  plantilla.addEventListener('click', () => elegir(() => inicio.usarPlantilla(), ERROR_PLANTILLA,
    (r) => avisar(`¡Listo! Empezaste con ${r.cuentas} cuentas y ${r.categorias} categorías. Podés cambiarlas cuando quieras.`)));
  vacio.addEventListener('click', () => elegir(() => inicio.empezarVacio(), ERROR_VACIO, () => {}));

  ver.addEventListener('click', async () => {
    const abrir = ver.getAttribute('aria-expanded') !== 'true';
    ver.setAttribute('aria-expanded', String(abrir));
    ver.textContent = abrir ? 'Ocultar lo que trae la plantilla' : 'Ver qué trae la plantilla';
    contenido.hidden = !abrir;
    if (abrir && !contenido.childElementCount) {
      try { contenido.append(...detalleDePlantilla(await inicio.leerPlantilla())); } catch { contenido.append(crear('p', { class: 'apoyo', texto: 'No se pudo leer la plantilla.' })); }
    }
  });

  return [
    crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Te damos la bienvenida a AFP' }),
    crear('section', { class: 'bienvenida', 'aria-labelledby': 'titulo-como-empezar' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-como-empezar', texto: '¿Cómo querés empezar?' }),
      plantilla, vacio, error, ver, contenido,
    ]),
  ];
}

// La lista de lo que trae la plantilla sale del archivo: ningún nombre está en el código (RNF-FLE-01).
function detalleDePlantilla(datos) {
  const hijas = (padre, tipo) => datos.categorias.filter((c) => c.tipo === tipo && (c.padre ?? null) === padre);
  const rama = (c) => {
    const sub = hijas(c.ref, c.tipo);
    return crear('li', {}, [crear('span', { texto: c.emoji ? `${c.emoji} ${c.nombre}` : c.nombre }), ...(sub.length ? [crear('ul', {}, sub.map(rama))] : [])]);
  };
  const arbol = (titulo, tipo) => [crear('h3', { class: 'subtitulo-chico', texto: titulo }), crear('ul', { class: 'lista-plantilla' }, hijas(null, tipo).map(rama))];
  return [
    crear('h3', { class: 'subtitulo-chico', texto: 'Cuentas' }),
    crear('ul', { class: 'lista-plantilla' }, datos.cuentas.map((c) => crear('li', { texto: `${c.nombre} · ${NOMBRES_DE_TIPO[c.tipo]} · ${c.monedaId}` }))),
    ...arbol('Categorías de ingresos', 'ingreso'),
    ...arbol('Categorías de egresos', 'egreso'),
  ];
}
