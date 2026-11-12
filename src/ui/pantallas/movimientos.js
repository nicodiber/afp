// Movimientos (HU-04): la lista de lo que cargaste, con búsqueda, filtros, totales y, en la PC, «Egresos por categoría».
// En el celular: filtros arriba, tarjetas y totales al pie. En la PC: la lista a la izquierda y un panel a la derecha
// (filtros, totales y barras por categoría). Las reglas están en dominio/lista-movimientos.js.
import { crear } from '../dom.js';
import { avisar } from '../dialogo.js';
import { itemDeMovimiento } from '../fila-movimiento.js';
import { formatearMonto } from '../../dominio/formato.js';
import {
  PERIODOS, TIPOS_DE_FILTRO, rangoDePeriodo, textoDelRango, idsDeCategoria, filtrarMovimientos, totalesPorMoneda, egresosPorCategoria,
} from '../../dominio/lista-movimientos.js';

let contador = 0;
// `categoriaDeBarra`: la categoría la eligió una barra (y no el selector); las barras no se achican para poder cambiar de una a otra.
const INICIAL = { texto: '', periodo: 'este-mes', mes: null, tipo: 'todos', categoriaId: null, cuentaId: null, categoriaDeBarra: false };
const estado = { ...INICIAL };
/** Al salir de la pantalla, los filtros vuelven a los de siempre (el mes en curso). */
export const reiniciarMovimientos = () => Object.assign(estado, INICIAL);

const SANGRIA = '   ';
const conEmoji = (x) => (x.emoji ? `${x.emoji} ${x.nombre}` : x.nombre);

/** Las opciones del filtro de categoría, en el orden del árbol y con sangría: [{ grupo, id, texto }]. */
function opcionesDeCategoria(categorias, tipo) {
  const salida = [];
  const recorrer = (padreId, t, nivel, grupo) => {
    const hijas = categorias.filter((c) => (c.padreId ?? null) === padreId && c.tipo === t).sort((a, b) => a.orden - b.orden);
    for (const c of hijas) {
      salida.push({ grupo, id: c.id, tipo: t, texto: `${SANGRIA.repeat(nivel)}${conEmoji(c)}${c.estado === 'archivada' ? ' (archivada)' : ''}` });
      recorrer(c.id, t, nivel + 1, grupo);
    }
  };
  for (const [t, grupo] of [['egreso', 'Egresos'], ['ingreso', 'Ingresos']]) if (tipo === 'todos' || tipo === t) recorrer(null, t, 0, grupo);
  return salida;
}

/**
 * @param {Object} o
 * @param {object} o.movimientos  Casos de uso de movimientos (todos, hoy).
 * @param {object} o.cuentas
 * @param {object} o.categorias
 */
export function pantallaMovimientos({ movimientos, cuentas, categorias }) {
  const n = ++contador;
  const id = (campo) => `mov-${campo}-${n}`;
  const hoy = movimientos.hoy();

  // --- Filtros ---------------------------------------------------------------------------------------------
  const buscador = crear('input', {
    id: id('buscar'), type: 'search', class: 'movs-buscador', autocomplete: 'off', spellcheck: 'false', placeholder: 'Buscar por descripción o categoría', 'aria-label': 'Buscar',
  });
  buscador.value = estado.texto;
  const selector = (campo, rotulo, control, clase = '', extras = []) => crear('div', { class: `campo campo-filtro ${clase}`.trim() }, [crear('label', { for: control.id, texto: rotulo }), control, ...extras]);
  // Las fechas del período, debajo del selector (HU-38, P-043).
  const fechasDelPeriodo = crear('p', { class: 'ayuda fechas-periodo', id: id('periodo-fechas') });
  const selectPeriodo = crear('select', { id: id('periodo') }, PERIODOS.map(([valor, texto]) => crear('option', { value: valor, texto })));
  const entradaMes = crear('input', { id: id('mes'), type: 'month', max: hoy.slice(0, 7) });
  const selectTipo = crear('select', { id: id('tipo') }, TIPOS_DE_FILTRO.map(([valor, texto]) => crear('option', { value: valor, texto })));
  const selectCategoria = crear('select', { id: id('categoria') });
  const selectCuenta = crear('select', { id: id('cuenta') });
  selectPeriodo.value = estado.periodo;
  selectPeriodo.setAttribute('aria-describedby', fechasDelPeriodo.id);
  entradaMes.value = estado.mes ?? hoy.slice(0, 7);
  selectTipo.value = estado.tipo;

  const llenarCategorias = () => {
    const opciones = opcionesDeCategoria(categorias.todas(), estado.tipo);
    if (estado.categoriaId && !opciones.some((o) => o.id === estado.categoriaId)) estado.categoriaId = null;
    const hijos = [crear('option', { value: '', texto: 'Todas las categorías' })];
    // Con «Todos», las categorías van separadas en Egresos e Ingresos; con un tipo, en una sola lista.
    for (const grupo of estado.tipo === 'todos' ? ['Egresos', 'Ingresos'] : [null]) {
      const delGrupo = opciones.filter((o) => grupo === null || o.grupo === grupo).map((o) => crear('option', { value: o.id, texto: o.texto }));
      if (!delGrupo.length) continue;
      if (grupo) hijos.push(crear('optgroup', { label: grupo }, delGrupo)); else hijos.push(...delGrupo);
    }
    selectCategoria.replaceChildren(...hijos);
    selectCategoria.value = estado.categoriaId ?? '';
  };
  const llenarCuentas = () => {
    const todas = cuentas.todas();
    const activas = todas.filter((c) => c.estado === 'activa').sort((a, b) => a.orden - b.orden);
    const archivadas = todas.filter((c) => c.estado !== 'activa').sort((a, b) => a.orden - b.orden);
    selectCuenta.replaceChildren(
      crear('option', { value: '', texto: 'Todas las cuentas' }),
      ...activas.map((c) => crear('option', { value: c.id, texto: c.nombre })),
      ...archivadas.map((c) => crear('option', { value: c.id, texto: `${c.nombre} (archivada)` })),
    );
    selectCuenta.value = todas.some((c) => c.id === estado.cuentaId) ? estado.cuentaId : '';
    if (!selectCuenta.value) estado.cuentaId = null;
  };
  llenarCategorias();
  llenarCuentas();

  const filtros = crear('section', { class: 'movs-filtros', 'aria-label': 'Filtros' }, [
    crear('div', { class: 'movs-busqueda' }, [buscador]),
    crear('div', { class: 'movs-selects' }, [
      selector('periodo', 'Período', selectPeriodo, '', [fechasDelPeriodo]),
      selector('mes', 'Mes', entradaMes, 'campo-mes'),
      selector('tipo', 'Tipo', selectTipo),
      selector('categoria', 'Categoría', selectCategoria),
      selector('cuenta', 'Cuenta', selectCuenta),
    ]),
  ]);

  // --- Lista, totales y barras -----------------------------------------------------------------------------
  const resumenLectores = crear('p', { class: 'solo-lectores', role: 'status' });
  const lista = crear('div', { class: 'movs-lista' });
  const bloqueTotales = crear('section', { class: 'movs-totales', 'aria-labelledby': id('totales-titulo') });
  const bloqueBarras = crear('section', { class: 'movs-barras', 'aria-labelledby': id('barras-titulo') });
  const resumen = crear('aside', { class: 'movs-resumen' }, [bloqueTotales, bloqueBarras]);
  const lado = crear('div', { class: 'movs-lado' }, [filtros, resumen]);
  const raiz = crear('div', { class: 'movs' }, [lado, lista, resumenLectores]);

  const filaTotal = (rotulo, centavos, moneda, clase, conSigno) => crear('div', { class: 'movs-total' }, [
    crear('dt', { texto: rotulo }), crear('dd', { class: clase, texto: formatearMonto(centavos, moneda, { conSigno }) }),
  ]);
  const pintarTotales = (movs) => {
    const porMoneda = totalesPorMoneda(movs);
    const bloques = porMoneda.length ? porMoneda : [{ monedaId: 'ARS', ingresos: 0, egresos: 0, diferencia: 0 }];
    bloqueTotales.replaceChildren(
      crear('h2', { class: 'subtitulo', id: id('totales-titulo'), texto: 'Totales' }),
      ...bloques.map((t) => crear('dl', { class: 'movs-total-lista', 'aria-label': bloques.length > 1 ? `Totales en ${t.monedaId}` : 'Totales del filtro' }, [
        filaTotal('Ingresos', t.ingresos, t.monedaId, 'monto-ingreso', true),
        filaTotal('Egresos', -t.egresos, t.monedaId, 'monto-egreso', false),
        filaTotal('Diferencia', t.diferencia, t.monedaId, t.diferencia < 0 ? 'monto-egreso' : (t.diferencia > 0 ? 'monto-ingreso' : ''), true),
      ])),
    );
  };

  const pintarBarras = (movs, categoriasPorId) => {
    const barras = egresosPorCategoria(movs, categoriasPorId, 'ARS');
    const maximo = barras[0]?.monto ?? 1;
    const items = barras.map((b) => {
      const relleno = crear('span', { class: 'barra-relleno' });
      relleno.style.setProperty('--ancho', `${Math.max(2, Math.round((b.monto / maximo) * 100))}%`);
      const boton = crear('button', { type: 'button', class: 'barra', 'data-categoria': b.categoriaId, 'aria-pressed': String(estado.categoriaId === b.categoriaId) }, [
        crear('span', { class: 'barra-texto' }, [
          crear('span', { class: 'barra-nombre', texto: conEmoji({ emoji: b.emoji, nombre: b.nombre }) }),
          crear('span', { class: 'barra-monto', texto: formatearMonto(b.monto, 'ARS') }),
        ]),
        crear('span', { class: 'barra-pista', 'aria-hidden': 'true' }, [relleno]),
      ]);
      // Tocar una barra filtra por esa categoría; tocarla de nuevo saca el filtro.
      boton.addEventListener('click', () => {
        estado.categoriaId = estado.categoriaId === b.categoriaId ? null : b.categoriaId;
        estado.categoriaDeBarra = estado.categoriaId !== null;
        selectCategoria.value = estado.categoriaId ?? '';
        actualizar();
        // Las barras se vuelven a dibujar: el foco vuelve a la que se tocó (con el teclado, Enter la saca de nuevo).
        bloqueBarras.querySelector(`[data-categoria="${b.categoriaId}"]`)?.focus();
      });
      return crear('li', {}, [boton]);
    });
    bloqueBarras.replaceChildren(
      crear('h2', { class: 'subtitulo', id: id('barras-titulo'), texto: 'Egresos por categoría' }),
      items.length ? crear('ul', { class: 'barras-lista' }, items) : crear('p', { class: 'apoyo', texto: 'No hay egresos con estos filtros.' }),
    );
  };

  const pintarLista = (movs, contexto) => {
    if (!movs.length) {
      lista.replaceChildren(crear('div', { class: 'vacio' }, [crear('p', { texto: 'No hay movimientos con estos filtros.' })]));
      return;
    }
    const items = movs.map((m) => itemDeMovimiento(m, contexto, { id: id(`fila-${m.id}`), alTocar: () => avisar('Editar llega en HU-05.') }));
    lista.replaceChildren(crear('ul', { class: 'movs-items', 'aria-label': 'Movimientos' }, items));
  };

  function actualizar() {
    const todos = movimientos.todos();
    const todasCategorias = categorias.todas();
    const categoriasPorId = new Map(todasCategorias.map((c) => [c.id, c]));
    const cuentasPorId = new Map(cuentas.todas().map((c) => [c.id, c]));
    const rango = rangoDePeriodo(estado.periodo, hoy, estado.mes);
    const base = { texto: estado.texto, ...rango, tipo: estado.tipo, cuentaId: estado.cuentaId };
    const visibles = filtrarMovimientos(todos, { ...base, categoriaIds: estado.categoriaId ? idsDeCategoria(todasCategorias, estado.categoriaId) : null }, categoriasPorId);
    entradaMes.closest('.campo').hidden = estado.periodo !== 'mes';
    fechasDelPeriodo.textContent = textoDelRango(estado.periodo, rango, todos.reduce((primero, m) => (primero === null || m.fecha < primero ? m.fecha : primero), null));
    pintarLista(visibles, { categoriasPorId, cuentasPorId });
    pintarTotales(visibles);
    // HU-04 (corrección P-053, D-180): las barras siguen los mismos filtros que los totales y la lista. Única excepción: con una
    // categoría elegida tocando una barra, las otras barras quedan (sin el filtro de categoría) para poder cambiar de una a otra.
    pintarBarras(estado.categoriaId && estado.categoriaDeBarra ? filtrarMovimientos(todos, { ...base, categoriaIds: null }, categoriasPorId) : visibles, categoriasPorId);
    resumenLectores.textContent = visibles.length === 1 ? '1 movimiento.' : `${visibles.length} movimientos.`;
  }

  buscador.addEventListener('input', () => { estado.texto = buscador.value; actualizar(); });
  selectPeriodo.addEventListener('change', () => { estado.periodo = selectPeriodo.value; if (estado.periodo === 'mes') estado.mes = entradaMes.value || hoy.slice(0, 7); actualizar(); });
  entradaMes.addEventListener('change', () => { estado.mes = entradaMes.value || hoy.slice(0, 7); actualizar(); });
  selectTipo.addEventListener('change', () => { estado.tipo = selectTipo.value; estado.categoriaDeBarra = false; llenarCategorias(); actualizar(); });
  selectCategoria.addEventListener('change', () => { estado.categoriaId = selectCategoria.value || null; estado.categoriaDeBarra = false; actualizar(); });
  selectCuenta.addEventListener('change', () => { estado.cuentaId = selectCuenta.value || null; actualizar(); });

  actualizar();
  return [crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Movimientos' }), raiz];
}
