// Ajustes (aep#2 CA-4 y CA-7, aep#4, aep#6, aep#9, aep#12): cuentas y monedas, tema, instalación, modo prueba
// con los datos de ejemplo, datos del dispositivo y «Acerca de».
import { crear } from '../dom.js';
import { seccionInstalacion } from '../instalacion.js';
import { confirmar, avisar } from '../dialogo.js';

const NOMBRES_TEMA = { claro: 'Claro', oscuro: 'Oscuro', sistema: 'Como el sistema' };

export function pantallaAjustes({ preferencias, version, alElegirTema, instalacion, alInstalar, modoPrueba, alCambiarModoPrueba, datosDispositivo, cuentas, datosDeEjemplo, redibujar }) {
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
    accesos(cuentas),
    crear('section', { class: 'seccion', 'aria-labelledby': 'titulo-tema' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-tema', texto: 'Tema' }),
      crear('div', { class: 'segmentado', role: 'group', 'aria-labelledby': 'titulo-tema' }, botones),
    ]),
    seccionInstalacion({ forma: instalacion.estado().forma, alInstalar }),
    seccionModoPrueba({ modoPrueba, alCambiar: alCambiarModoPrueba, cuentas, datosDeEjemplo, redibujar }),
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
function seccionModoPrueba({ modoPrueba, alCambiar, cuentas, datosDeEjemplo, redibujar }) {
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
    contenido.push(botonesDatosDeEjemplo({ cuentas, datosDeEjemplo, redibujar }));
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

// Cuentas y monedas (aep#12, D-132): se administran desde acá.
function accesos(cuentas) {
  const fila = (href, titulo, detalle) => crear('li', {}, [crear('a', { class: 'fila-cuenta fila-acceso', href }, [
    crear('span', { class: 'fila-datos' }, [crear('span', { class: 'fila-nombre', texto: titulo }), crear('span', { class: 'fila-detalle', texto: detalle })]),
    crear('span', { class: 'chevron', 'aria-hidden': 'true', texto: '›' }),
  ])]);
  const activas = cuentas.activas().length;
  const monedas = cuentas.monedas().filter((m) => m.activa).map((m) => m.id).join(' y ');
  return crear('ul', { class: 'lista-cuentas accesos', 'aria-label': 'Cuentas y monedas' }, [
    fila('#ajustes/cuentas', 'Cuentas', activas === 1 ? '1 activa' : `${activas} activas`),
    fila('#ajustes/monedas', 'Monedas', monedas),
  ]);
}

// Datos de ejemplo del modo prueba (RF-DAT-07, aep#12): cargar con la base vacía; restablecer o borrar, con confirmación.
function botonesDatosDeEjemplo({ cuentas, datosDeEjemplo, redibujar }) {
  const caja = crear('div', { class: 'acciones-prueba' });
  const boton = (id, texto, accion) => {
    const b = crear('button', { type: 'button', class: 'boton-secundario', id, texto });
    b.addEventListener('click', accion);
    caja.append(b);
  };
  const cargar = async (foco) => {
    try {
      await cuentas.cargarEjemplo(await datosDeEjemplo());
      avisar('Cargaste los datos de ejemplo.');
      redibujar(foco);
    } catch {
      avisar('No se pudieron cargar los datos de ejemplo.');
    }
  };
  if (!cuentas.hayCuentas()) {
    boton('cargar-ejemplo', 'Cargar datos de ejemplo', () => cargar('restablecer-ejemplo'));
  } else {
    boton('restablecer-ejemplo', 'Restablecer datos de ejemplo', async () => {
      if (await confirmar({ titulo: '¿Restablecer los datos de ejemplo?', texto: 'Se reemplaza todo lo que cargaste en modo prueba.', aceptar: 'Restablecer' })) cargar('restablecer-ejemplo');
    });
    boton('borrar-prueba', 'Borrar datos de prueba', async () => {
      if (!await confirmar({ titulo: '¿Borrar los datos de prueba?', texto: 'Quedan vacíos. Tus datos reales no se tocan.', aceptar: 'Borrar' })) return;
      await cuentas.borrarTodo();
      avisar('Borraste los datos de prueba.');
      redibujar('cargar-ejemplo');
    });
  }
  return caja;
}
