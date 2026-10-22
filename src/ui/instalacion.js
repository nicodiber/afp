// Sugerencia de instalación (aep#4): tarjeta de Inicio y sección de Ajustes, con los mismos textos.
import { crear } from './dom.js';

const BENEFICIO = 'Abre más rápido, con su propio ícono, y funciona sin conexión.';
const YA_INSTALADA = 'Si ya la instalaste en este dispositivo, abrila desde su ícono.';
const PASOS = {
  'pasos-celular': 'Tocá el menú ⋮ de Brave y elegí «Instalar app».',
  'pasos-pc': 'Tocá el ícono de instalar, a la derecha de la barra de direcciones.',
};

const pasosAMano = (forma) => [crear('p', { texto: PASOS[forma] }), crear('p', { class: 'apoyo', texto: YA_INSTALADA })];

export function tarjetaInstalar({ forma, alInstalar, alDescartar }) {
  const acciones = crear('div', { class: 'acciones' });
  if (forma === 'un-toque') {
    const instalar = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Instalar' });
    instalar.addEventListener('click', alInstalar);
    acciones.append(instalar);
  }
  const ahoraNo = crear('button', { type: 'button', class: 'boton-texto', texto: 'Ahora no' });
  ahoraNo.addEventListener('click', alDescartar);
  acciones.append(ahoraNo);
  return crear('section', { class: 'tarjeta tarjeta-instalar', 'aria-labelledby': 'titulo-instalar' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-instalar', texto: 'Instalá AFP' }),
    crear('p', { texto: BENEFICIO }),
    ...(forma === 'un-toque' ? [] : pasosAMano(forma)),
    acciones,
  ]);
}

export function seccionInstalacion({ forma, alInstalar }) {
  const contenido = [];
  if (forma === 'instalada') contenido.push(crear('p', { texto: 'AFP está instalada en este dispositivo.' }));
  else if (forma === 'un-toque') {
    const boton = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Instalar AFP' });
    boton.addEventListener('click', alInstalar);
    contenido.push(crear('p', { class: 'apoyo', texto: BENEFICIO }), boton);
  } else contenido.push(...pasosAMano(forma));
  return crear('section', { class: 'seccion seccion-instalacion', 'aria-labelledby': 'titulo-instalacion' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-instalacion', texto: 'Instalación' }),
    ...contenido,
  ]);
}
