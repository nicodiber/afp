// Ajustes → «Monedas» (aep#12, D-122): ARS es la moneda base; USD se desactiva si ninguna cuenta la usa.
import { crear } from '../dom.js';

export function pantallaMonedas({ cuentas, redibujar }) {
  const mensaje = crear('p', { class: 'error-campo', id: 'mensaje-monedas', role: 'alert' });
  const filas = cuentas.monedas().map((m) => {
    const datos = crear('span', { class: 'fila-datos' }, [
      crear('span', { class: 'fila-nombre', texto: `${m.id} · ${m.nombre}` }),
      crear('span', { class: 'fila-detalle', texto: m.id === 'ARS' ? 'Moneda base: no se desactiva.' : m.simbolo }),
    ]);
    if (m.id === 'ARS') return crear('li', { class: 'fila-cuenta' }, [datos]);
    const interruptor = crear('button', { type: 'button', role: 'switch', class: 'interruptor interruptor-solo', id: `moneda-${m.id}`, 'aria-checked': String(m.activa), 'aria-label': `${m.id} activa` }, [
      crear('span', { class: 'interruptor-pista', 'aria-hidden': 'true' }),
    ]);
    interruptor.addEventListener('click', async () => {
      const resultado = await cuentas.cambiarMoneda(m.id, !m.activa);
      if (!resultado.ok) { mensaje.textContent = resultado.motivo; return; }
      redibujar(`moneda-${m.id}`);
    });
    return crear('li', { class: 'fila-cuenta' }, [datos, interruptor]);
  });
  return [
    crear('a', { class: 'volver', href: '#ajustes', texto: '‹ Ajustes' }),
    crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Monedas' }),
    crear('div', { class: 'cuentas-columna' }, [
      crear('ul', { class: 'lista-cuentas', 'aria-label': 'Monedas' }, filas),
      mensaje,
      crear('p', { class: 'apoyo', texto: 'Las otras monedas (USDT, USDC, monedas de viaje) llegan con las cotizaciones.' }),
    ]),
  ];
}
