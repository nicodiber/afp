// Inicio (aep#2 CA-1, aep#12, D-132): la sugerencia de instalar, tus cuentas como tarjetas con su saldo y,
// mientras no haya movimientos, una frase y un botón (manual §8.1, D-65, D-97).
import { crear } from '../dom.js';
import { tarjetaInstalar } from '../instalacion.js';
import { abrirFormularioEnVentana } from '../cuentas-comun.js';
import { formatearMonto } from '../../dominio/formato.js';
import { NOMBRES_DE_TIPO } from '../../dominio/cuentas.js';

export function pantallaInicio({ instalacion, alInstalar, alDescartar, cuentas, esPC, redibujar }) {
  const { sugerirEnInicio, forma } = instalacion.estado();
  return [
    crear('h1', { class: 'titulo titulo-inicio', tabindex: '-1', texto: 'Inicio' }),
    // Sugerencia de instalación arriba de todo (aep#4, D-105).
    ...(sugerirEnInicio ? [tarjetaInstalar({ forma, alInstalar, alDescartar })] : []),
    seccionCuentas({ cuentas, esPC, redibujar }),
    crear('div', { class: 'vacio' }, [
      crear('p', { texto: 'Todavía no cargaste movimientos.' }),
      // Mientras la carga no existe, lleva al aviso de «llega en una próxima entrega» (D-97).
      crear('a', { class: 'boton-principal', href: '#cargar', texto: 'Cargar el primero' }),
    ]),
  ];
}

function seccionCuentas({ cuentas, esPC, redibujar }) {
  const abrir = (id) => abrirFormularioEnVentana({ cuentas, id, pantallaCompleta: !esPC, alTerminar: () => redibujar(id ? `tarjeta-${id}` : null) });
  const activas = cuentas.activas();
  const contenido = [crear('div', { class: 'cabecera-lista' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-tus-cuentas', texto: 'Tus cuentas' }),
    crear('a', { class: 'boton-texto', href: '#ajustes/cuentas', texto: 'Ver todas' }),
  ])];
  if (!activas.length) {
    const primera = crear('button', { type: 'button', class: 'boton-secundario', id: 'inicio-crear-cuenta', texto: 'Crear la primera' });
    primera.addEventListener('click', () => abrir(null));
    contenido.push(crear('p', { texto: 'Todavía no tenés cuentas.' }), primera);
  } else {
    const tarjetas = activas.map((c) => {
      const saldo = cuentas.saldoDe(c);
      const boton = crear('button', { type: 'button', class: 'tarjeta-cuenta', id: `tarjeta-${c.id}` }, [
        crear('span', { class: 'tarjeta-cuenta-nombre', texto: c.emoji ? `${c.emoji} ${c.nombre}` : c.nombre }),
        crear('span', { class: `tarjeta-cuenta-monto${saldo < 0 ? ' negativo' : ''}`, texto: formatearMonto(saldo, c.monedaId) }),
        crear('span', { class: 'tarjeta-cuenta-detalle', texto: c.tieneRendimiento ? 'Con rendimiento' : NOMBRES_DE_TIPO[c.tipo] }),
      ]);
      boton.addEventListener('click', () => abrir(c.id));
      return crear('li', {}, [boton]);
    });
    const nueva = crear('button', { type: 'button', class: 'tarjeta-cuenta tarjeta-nueva', id: 'inicio-nueva-cuenta', texto: '+ Nueva cuenta' });
    nueva.addEventListener('click', () => abrir(null));
    contenido.push(crear('ul', { class: 'tarjetas-cuentas', 'aria-labelledby': 'titulo-tus-cuentas' }, [...tarjetas, crear('li', {}, [nueva])]));
  }
  return crear('section', { class: 'seccion seccion-cuentas', 'aria-labelledby': 'titulo-tus-cuentas' }, contenido);
}
