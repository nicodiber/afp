// Ajustes → «Cuentas» (aep#12, D-132, D-133): activas en orden, «Ordenar» con asa y flechas, archivadas con
// «Reactivar». En la PC, crear y editar abren el formulario en una ventana sobre las cuentas; en el celular,
// el formulario ocupa toda la pantalla.
import { crear } from '../dom.js';
import { avisar } from '../dialogo.js';
import { abrirFormularioEnVentana } from '../cuentas-comun.js';
import { NOMBRES_DE_TIPO } from '../../dominio/cuentas.js';
import { formatearMonto } from '../../dominio/formato.js';

// Estado de la pantalla mientras se está en ella (se reinicia al salir).
export const estadoCuentas = { ordenar: false };
export const reiniciarCuentas = () => { estadoCuentas.ordenar = false; };

const montoDe = (cuentas, c) => formatearMonto(cuentas.saldoDe(c), c.monedaId);

export function datosDeFila(cuentas, c) {
  const nombre = crear('span', { class: 'fila-nombre' }, [crear('span', { texto: c.nombre })]);
  if (c.tieneRendimiento) nombre.append(crear('span', { class: 'marca', texto: 'con rendimiento' }));
  const datos = crear('span', { class: 'fila-datos' }, [nombre, crear('span', { class: 'fila-detalle', texto: `${NOMBRES_DE_TIPO[c.tipo]} · ${c.monedaId}` })]);
  return [
    ...(c.emoji ? [crear('span', { class: 'fila-emoji', 'aria-hidden': 'true', texto: c.emoji })] : []),
    datos,
  ];
}

export function pantallaCuentas({ cuentas, esPC, redibujar }) {
  const activas = cuentas.activas();
  const archivadas = cuentas.archivadas();
  const { ordenar } = estadoCuentas;

  const abrirNueva = () => abrirFormularioEnVentana({ cuentas, pantallaCompleta: !esPC, alTerminar: () => redibujar() });
  const abrirEdicion = (id) => abrirFormularioEnVentana({ cuentas, id, pantallaCompleta: !esPC, alTerminar: () => redibujar(`cuenta-${id}`) });

  const cabecera = crear('div', { class: 'cabecera-lista' }, [crear('h2', { class: 'subtitulo', id: 'titulo-activas', texto: ordenar ? 'Ordenar cuentas' : 'Activas' })]);
  const botones = crear('div', { class: 'botones-lista' });
  if (activas.length > 1 || ordenar) {
    const botonOrdenar = crear('button', { type: 'button', class: 'boton-secundario', id: 'boton-ordenar', 'aria-pressed': String(ordenar), texto: ordenar ? 'Listo' : 'Ordenar' });
    botonOrdenar.addEventListener('click', () => { estadoCuentas.ordenar = !ordenar; redibujar('boton-ordenar'); });
    botones.append(botonOrdenar);
  }
  if (!ordenar && activas.length) {
    const nueva = crear('button', { type: 'button', class: 'boton-principal boton-chico', id: 'boton-nueva-cuenta', texto: 'Nueva cuenta' });
    nueva.addEventListener('click', abrirNueva);
    botones.append(nueva);
  }
  cabecera.append(botones);

  let lista;
  if (!activas.length) {
    const crearPrimera = crear('button', { type: 'button', class: 'boton-principal', id: 'boton-nueva-cuenta', texto: 'Crear la primera' });
    crearPrimera.addEventListener('click', abrirNueva);
    lista = crear('div', { class: 'vacio vacio-cuentas' }, [crear('p', { texto: 'Todavía no tenés cuentas.' }), crearPrimera]);
  } else if (ordenar) {
    lista = listaParaOrdenar({ cuentas, activas, redibujar });
  } else {
    lista = crear('ul', { class: 'lista-cuentas', 'aria-labelledby': 'titulo-activas' }, activas.map((c) => {
      const fila = crear('button', { type: 'button', class: 'fila-cuenta', id: `cuenta-${c.id}` }, [
        ...datosDeFila(cuentas, c),
        crear('span', { class: `fila-monto${cuentas.saldoDe(c) < 0 ? ' negativo' : ''}`, texto: montoDe(cuentas, c) }),
      ]);
      fila.addEventListener('click', () => abrirEdicion(c.id));
      return crear('li', {}, [fila]);
    }));
  }

  const columna = [cabecera, lista];
  if (ordenar) columna.push(crear('p', { class: 'apoyo', texto: 'Arrastrá cada cuenta por ⠿, o usá ↑ y ↓. Una cuenta nueva va al final.' }));
  if (archivadas.length && !ordenar) columna.push(seccionArchivadas({ cuentas, archivadas, redibujar }));

  const contenido = [
    crear('a', { class: 'volver', href: '#ajustes', texto: '‹ Ajustes' }),
    crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Cuentas' }),
  ];
  contenido.push(crear('div', { class: 'cuentas-columna' }, columna));
  return contenido;
}

function listaParaOrdenar({ cuentas, activas, redibujar }) {
  const lista = crear('ul', { class: 'lista-cuentas ordenando', 'aria-labelledby': 'titulo-activas' });
  const mover = async (id, posicion, foco) => { await cuentas.mover(id, posicion); redibujar(foco); };
  activas.forEach((c, i) => {
    const asa = crear('button', { type: 'button', class: 'asa', 'aria-label': `Arrastrar ${c.nombre}`, texto: '⠿' });
    const subir = crear('button', { type: 'button', class: 'flecha', id: `subir-${c.id}`, 'aria-label': `Subir ${c.nombre}`, texto: '↑' });
    const bajar = crear('button', { type: 'button', class: 'flecha', id: `bajar-${c.id}`, 'aria-label': `Bajar ${c.nombre}`, texto: '↓' });
    subir.disabled = i === 0;
    bajar.disabled = i === activas.length - 1;
    subir.addEventListener('click', () => mover(c.id, i - 1, i - 1 === 0 ? `bajar-${c.id}` : `subir-${c.id}`));
    bajar.addEventListener('click', () => mover(c.id, i + 1, i + 1 === activas.length - 1 ? `subir-${c.id}` : `bajar-${c.id}`));
    const fila = crear('li', { class: 'fila-cuenta', 'data-id': c.id }, [asa, ...datosDeFila(cuentas, c), crear('span', { class: 'flechas' }, [subir, bajar])]);
    asa.addEventListener('pointerdown', (evento) => arrastrar(evento, fila, lista, (posicion) => mover(c.id, posicion, `subir-${c.id}`)));
    lista.append(fila);
  });
  return lista;
}

// Arrastrar con el mouse o el dedo: la fila se mueve entre las otras y, al soltar, se guarda la posición.
function arrastrar(evento, fila, lista, alSoltar) {
  evento.preventDefault();
  fila.classList.add('arrastrando');
  const inicial = [...lista.children].indexOf(fila);
  // Se escucha en la ventana: al mover la fila en la lista, el navegador suelta la captura del puntero.
  const alMover = (e) => {
    const otras = [...lista.children].filter((x) => x !== fila);
    const antes = otras.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; }) ?? null;
    if (fila.nextElementSibling !== antes) lista.insertBefore(fila, antes);
  };
  const alTerminar = () => {
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alTerminar);
    window.removeEventListener('pointercancel', alTerminar);
    fila.classList.remove('arrastrando');
    const final = [...lista.children].indexOf(fila);
    if (final !== inicial) alSoltar(final);
  };
  window.addEventListener('pointermove', alMover);
  window.addEventListener('pointerup', alTerminar);
  window.addEventListener('pointercancel', alTerminar);
}

function seccionArchivadas({ cuentas, archivadas, redibujar }) {
  return crear('section', { class: 'seccion-archivadas', 'aria-labelledby': 'titulo-archivadas' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-archivadas', texto: 'Archivadas' }),
    crear('ul', { class: 'lista-cuentas' }, archivadas.map((c) => {
      const reactivar = crear('button', { type: 'button', class: 'boton-secundario boton-chico', id: `reactivar-${c.id}`, texto: 'Reactivar', 'aria-label': `Reactivar ${c.nombre}` });
      reactivar.addEventListener('click', async () => {
        const resultado = await cuentas.reactivar(c.id);
        if (!resultado.ok) { avisar(resultado.motivo); return; }
        avisar(`Reactivaste ${c.nombre}.`);
        redibujar(`cuenta-${c.id}`);
      });
      return crear('li', { class: 'fila-cuenta fila-archivada' }, [
        ...datosDeFila(cuentas, c),
        crear('span', { class: 'fila-monto', texto: montoDe(cuentas, c) }),
        reactivar,
      ]);
    })),
  ]);
}
