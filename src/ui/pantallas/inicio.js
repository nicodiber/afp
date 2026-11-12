// Inicio (aep#2 CA-1, aep#12, D-132, HU-37, D-178): la sugerencia de instalar y un tablero. En la PC: arriba los indicadores
// grandes («Saldos de hoy» y el mes en curso) y debajo tus cuentas con «Últimos movimientos» al lado. En el celular: las
// cuentas, el resumen del mes y los últimos movimientos, en ese orden (el CSS reordena y esconde lo que sobra).
// Sin movimientos, una frase y un botón que lleva a Cargar (manual §8.1, D-65, D-97).
import { crear } from '../dom.js';
import { tarjetaInstalar } from '../instalacion.js';
import { formatearMonto } from '../../dominio/formato.js';
import { NOMBRES_DE_TIPO, iconoDeCuenta } from '../../dominio/cuentas.js';

export function pantallaInicio({ instalacion, alInstalar, alDescartar, cuentas, movimientos, categorias, esPC, redibujar }) {
  const { sugerirEnInicio, forma } = instalacion.estado();
  // Sin cuentas ni movimientos no hay tablero que armar: los dos mensajes de siempre, en una sola columna.
  const vacio = cuentas.activas().length === 0 && !movimientos.hay();
  const tablero = crear('div', { class: vacio ? 'tablero tablero-vacio' : 'tablero ancho-pc' }, [
    seccionCuentas({ cuentas, esPC, redibujar }),
    seccionUltimos({ movimientos }),
  ]);
  if (!vacio) {
    const completar = (modulo) => modulo.completarTablero({ tablero, cuentas, movimientos, categorias });
    if (moduloDelTablero) completar(moduloDelTablero);
    else import('../tablero-inicio.js').then((modulo) => { moduloDelTablero = modulo; completar(modulo); });
  }
  return [
    crear('h1', { class: 'titulo titulo-inicio', tabindex: '-1', texto: 'Inicio' }),
    // Sugerencia de instalación arriba de todo (aep#4, D-105).
    ...(sugerirEnInicio ? [tarjetaInstalar({ forma, alInstalar, alDescartar })] : []),
    tablero,
  ];
}

// Los indicadores y los últimos movimientos los arma ui/tablero-inicio.js, que se pide recién cuando hay datos: así Inicio vacío
// se dibuja liviano (LCP). Desde la segunda vez ya está cargado y el tablero se arma sin esperar.
let moduloDelTablero = null;

function seccionUltimos({ movimientos }) {
  const cabecera = crear('div', { class: 'cabecera-lista' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-ultimos', texto: 'Últimos movimientos' }),
    ...(movimientos.hay() ? [crear('a', { class: 'boton-texto', href: '#movimientos', texto: 'Ver todos' })] : []),
  ]);
  const cuerpo = crear('div', { class: 'ultimos-lista' });
  if (!movimientos.hay()) {
    cuerpo.append(crear('div', { class: 'vacio' }, [
      crear('p', { texto: 'Todavía no cargaste movimientos.' }),
      crear('a', { class: 'boton-principal', href: '#cargar', texto: 'Cargar el primero' }),
    ]));
  }
  return crear('section', { class: 'seccion seccion-ultimos', 'aria-labelledby': 'titulo-ultimos' }, [cabecera, cuerpo]);
}

function seccionCuentas({ cuentas, esPC, redibujar }) {
  // El formulario (y la ventana) se cargan recién al tocar: Inicio no los necesita para dibujarse (FC-19).
  const abrir = async (id) => {
    const { abrirFormularioEnVentana } = await import('../cuentas-comun.js');
    abrirFormularioEnVentana({ cuentas, id, pantallaCompleta: !esPC, alTerminar: () => redibujar(id ? `tarjeta-${id}` : null) });
  };
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
        crear('span', { class: 'tarjeta-cuenta-nombre', texto: `${iconoDeCuenta(c)} ${c.nombre}` }),
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
