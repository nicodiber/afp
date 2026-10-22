// Ajustes (aep#2 CA-4 y CA-7): tema y «Acerca de».
import { crear } from '../dom.js';

const NOMBRES_TEMA = { claro: 'Claro', oscuro: 'Oscuro', sistema: 'Como el sistema' };

export function pantallaAjustes({ preferencias, version, alElegirTema }) {
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
    crear('section', { class: 'seccion', 'aria-labelledby': 'titulo-acerca' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-acerca', texto: 'Acerca de' }),
      crear('div', { class: 'tarjeta' }, [
        crear('p', {}, [crear('strong', { texto: 'AFP · Administración Financiera Personal' })]),
        crear('p', { class: 'apoyo', texto: `Versión ${version}` }),
      ]),
    ]),
  ];
}
