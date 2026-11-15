// Lo que Inicio suma al tablero cuando hay datos (HU-37, D-178): los indicadores («Saldos de hoy» y el mes en curso) y los últimos
// movimientos. Se carga con `import()` después de dibujar Inicio, para que Inicio vacío se dibuje liviano (LCP).
import { crear } from './dom.js';
import { itemDeMovimiento } from './fila-movimiento.js';
import { formatearMonto } from '../dominio/formato.js';
import { saldosDeHoy, resumenDelMes, resumenDelMesEnDolares, ultimosMovimientos } from '../dominio/tablero.js';

const indicador = (rotulo, valor, clase = '') => crear('div', { class: 'indicador' }, [
  crear('dt', { class: 'indicador-rotulo', texto: rotulo }), crear('dd', { class: `indicador-valor ${clase}`.trim(), texto: valor }),
]);
const colorDe = (centavos) => (centavos < 0 ? 'monto-egreso' : (centavos > 0 ? 'monto-ingreso' : ''));

// «Saldos de hoy»: el total en pesos y, si hay cuentas en dólares (u otra moneda), el total de cada una. Solo en la PC (en el celular son las cuentas).
function grupoSaldos(cuentas) {
  const saldos = saldosDeHoy(cuentas.todas(), (c) => cuentas.saldoDe(c));
  return crear('section', { class: 'grupo-indicadores grupo-saldos', 'aria-labelledby': 'titulo-saldos-hoy' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-saldos-hoy', texto: 'Saldos de hoy' }),
    crear('dl', { class: 'indicadores' }, saldos.map((s) => indicador(s.rotulo, formatearMonto(s.total, s.monedaId), colorDe(Math.min(s.total, 0))))),
  ]);
}

// Una fila de tres indicadores del mes: ingresos, egresos y diferencia en una moneda.
const filaDelMes = (t, moneda, clase = '', etiqueta = null) => crear('dl', { class: `indicadores ${clase}`.trim(), ...(etiqueta ? { 'aria-label': etiqueta } : {}) }, [
  indicador('Ingresos', formatearMonto(t.ingresos, moneda, { conSigno: true }), 'monto-ingreso'),
  indicador('Egresos', formatearMonto(-t.egresos, moneda), 'monto-egreso'),
  indicador('Diferencia', formatearMonto(t.diferencia, moneda, { conSigno: true }), colorDe(t.diferencia)),
]);

// El mes en curso con su nombre y sus fechas: ingresos, egresos y diferencia (las transferencias se suman con HU-06). Si el mes tiene
// movimientos en dólares, una segunda fila en US$, sin convertir (HU-43, D-188).
function grupoMes(movimientos) {
  const todos = movimientos.todos();
  const mes = resumenDelMes(todos, movimientos.hoy());
  const dolares = resumenDelMesEnDolares(todos, movimientos.hoy());
  return crear('section', { class: 'grupo-indicadores grupo-mes', 'aria-labelledby': 'titulo-mes-en-curso' }, [
    crear('h2', { class: 'subtitulo', id: 'titulo-mes-en-curso', texto: mes.titulo }),
    filaDelMes(mes, 'ARS'),
    ...(dolares ? [filaDelMes(dolares, 'USD', 'indicadores-usd', 'En dólares, sin convertir')] : []),
  ]);
}

// Los 5 movimientos más nuevos, con la misma fila que Movimientos. Las categorías se cargan después de dibujar Inicio (FC-19):
// la lista se completa cuando están.
function pintarUltimos(lista, { cuentas, movimientos, categorias }) {
  const pintar = () => {
    const categoriasPorId = new Map(categorias.todas().map((c) => [c.id, c]));
    const cuentasPorId = new Map(cuentas.todas().map((c) => [c.id, c]));
    const alTocar = async () => (await import('./dialogo.js')).avisar('Editar llega en HU-05.');
    lista.replaceChildren(crear('ul', { class: 'movs-items', 'aria-labelledby': 'titulo-ultimos' },
      ultimosMovimientos(movimientos.todos(), 5).map((m) => itemDeMovimiento(m, { categoriasPorId, cuentasPorId }, { id: `inicio-ultimo-${m.id}`, alTocar }))));
  };
  if (typeof categorias.todas === 'function') pintar(); else categorias.listas().then(pintar, () => {});
}

/** Suma al tablero de Inicio los indicadores (los de saldos solo con cuentas, los del mes solo con movimientos) y los últimos movimientos. */
export function completarTablero({ tablero, cuentas, movimientos, categorias }) {
  const grupos = [];
  if (cuentas.activas().length) grupos.push(grupoSaldos(cuentas));
  if (movimientos.hay()) grupos.push(grupoMes(movimientos));
  tablero.prepend(...grupos);
  const lista = tablero.querySelector('.ultimos-lista');
  if (movimientos.hay() && lista) pintarUltimos(lista, { cuentas, movimientos, categorias });
}
