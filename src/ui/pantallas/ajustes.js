// Ajustes (aep#2 CA-4 y CA-7, aep#4, aep#6, aep#9): tema, instalación, modo prueba, datos del dispositivo y «Acerca de».
import { crear } from '../dom.js';
import { seccionInstalacion } from '../instalacion.js';

const NOMBRES_TEMA = { claro: 'Claro', oscuro: 'Oscuro', sistema: 'Como el sistema' };

export function pantallaAjustes({ preferencias, version, alElegirTema, instalacion, alInstalar, modoPrueba, alCambiarModoPrueba, datosDispositivo }) {
  const elegido = preferencias.temaElegido();
  const botones = preferencias.opcionesDeTema().map((tema) => {
    const boton = crear('button', { type: 'button', 'aria-pressed': String(tema === elegido), texto: NOMBRES_TEMA[tema] });
    boton.addEventListener('click', () => {
      alElegirTema(tema);
      for (const otro of botones) otro.setAttribute('aria-pressed', String(otro === boton));
    });
    return boton;
  });
  return [
    crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Ajustes' }),
    crear('section', { class: 'seccion', 'aria-labelledby': 'titulo-tema' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-tema', texto: 'Tema' }),
      crear('div', { class: 'segmentado', role: 'group', 'aria-labelledby': 'titulo-tema' }, botones),
    ]),
    seccionInstalacion({ forma: instalacion.estado().forma, alInstalar }),
    seccionModoPrueba({ modoPrueba, alCambiar: alCambiarModoPrueba }),
    seccionDatos(datosDispositivo.estado()),
    crear('section', { class: 'seccion', 'aria-labelledby': 'titulo-acerca' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-acerca', texto: 'Acerca de' }),
      crear('div', { class: 'tarjeta' }, [
        crear('p', {}, [crear('strong', { texto: 'AFP · Administración Financiera Personal' })]),
        crear('p', { class: 'apoyo', texto: `Versión ${version}` }),
      ]),
    ]),
  ];
}

// Modo prueba (aep#6, D-111, D-112): interruptor directo y, con el modo activo, la fecha simulada.
function seccionModoPrueba({ modoPrueba, alCambiar }) {
  const estado = modoPrueba.estado();
  const interruptor = crear('button', { type: 'button', role: 'switch', class: 'interruptor', 'aria-checked': String(estado.activo), id: 'interruptor-prueba' }, [
    crear('span', { class: 'interruptor-texto', texto: 'Modo prueba' }),
    crear('span', { class: 'interruptor-pista', 'aria-hidden': 'true' }),
  ]);
  interruptor.addEventListener('click', () => {
    if (modoPrueba.estado().activo) modoPrueba.desactivar(); else modoPrueba.activar();
    alCambiar();
  });
  const contenido = [
    crear('h2', { class: 'subtitulo', id: 'titulo-prueba', texto: 'Modo prueba' }),
    interruptor,
    crear('p', { class: 'apoyo', texto: 'Usa datos aparte y una fecha simulada. Tus datos reales no se tocan.' }),
  ];
  if (estado.activo) {
    const campo = crear('input', { type: 'date', id: 'fecha-simulada', value: estado.fechaSimulada, required: '' });
    campo.addEventListener('change', () => {
      try { modoPrueba.cambiarFecha(campo.value); alCambiar(); } catch { campo.value = modoPrueba.estado().fechaSimulada; }
    });
    const volver = crear('button', { type: 'button', class: 'boton-texto', texto: 'Volver al 31/10/2026' });
    volver.addEventListener('click', () => { modoPrueba.volverAFechaPorDefecto(); alCambiar(); });
    contenido.push(crear('div', { class: 'campo' }, [crear('label', { for: 'fecha-simulada', texto: 'Fecha simulada' }), campo]), volver);
  }
  return crear('section', { class: 'seccion seccion-prueba', 'aria-labelledby': 'titulo-prueba' }, contenido);
}

// Datos de este dispositivo (aep#9, D-114).
const TEXTOS_PERSISTENCIA = {
  persistente: 'El navegador no los borra aunque le falte espacio.',
  'puede-borrarse': 'El navegador podría borrarlos si se queda sin espacio.',
  desconocido: 'No se pudo comprobar si el navegador los conserva.',
  comprobando: 'Comprobando si el navegador los conserva…',
};
function seccionDatos(estado) {
  const contenido = estado === 'sin-almacenamiento'
    ? [crear('p', { texto: 'No se pueden guardar datos en este dispositivo.' })]
    : [crear('p', { texto: 'Tus datos se guardan en este dispositivo.' }), crear('p', { class: 'apoyo', texto: TEXTOS_PERSISTENCIA[estado] })];
  return crear('section', { class: 'seccion seccion-datos', 'aria-labelledby': 'titulo-datos' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-datos', texto: 'Datos de este dispositivo' }),
    ...contenido,
  ]);
}
