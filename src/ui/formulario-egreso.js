// Formulario de Cargar (HU-02, HU-02b, HU-03, HU-06, HU-07): pestañas Egreso, Ingreso, Transferencia y Cambio. Egreso e ingreso piden tipo,
// fecha, hora, monto, descripción, categoría y cuenta; la transferencia, monto, «Desde» y «Hacia»; el cambio, lo que se entrega y lo que se
// recibe (cuenta, monto y tipo de cambio). Categoría y
// cuenta se eligen en una ventana con buscador (selector.js), no en una lista desplegable. Es un componente:
// no sabe cómo se guarda; llama a `alGuardar`. Atajos en la PC: Ctrl+Enter guarda y Ctrl+Mayús+Enter guarda y
// deja la pantalla lista para otro.
import { crear } from './dom.js';
import { abrirSelector } from './selector.js';
import { categoriasAgrupadas, nivelDeCategorias } from '../dominio/movimientos.js';
import { iconoDeCuenta } from '../dominio/cuentas.js';
import { formatearFecha } from '../dominio/fecha.js';
import { formatearMonto } from '../dominio/formato.js';
import { darFormatoDeMonto } from './campo-monto.js';
import { capitalizarInicial } from '../dominio/texto.js';
import { enlazarCambio } from './cambio-moneda.js';

let siguiente = 0;

const textoDeFecha = (fecha, hoy) => (fecha === hoy ? `Hoy · ${formatearFecha(fecha)}` : (fecha ? formatearFecha(fecha) : 'Sin fecha'));
const TIPOS = [['egreso', 'Egreso'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia'], ['cambio_moneda', 'Cambio']];
const TITULOS = { egreso: 'Nuevo egreso', ingreso: 'Nuevo ingreso', transferencia: 'Nueva transferencia', cambio_moneda: 'Nuevo cambio de moneda' };
const conEmoji = (x) => (x.emoji ? `${x.emoji} ${x.nombre}` : x.nombre);

/**
 * @param {Object} o
 * @param {() => string} o.hoy  AAAA-MM-DD (puerto Reloj).
 * @param {() => string} o.ahora  HH:MM (puerto Reloj): la hora con la que arranca el campo «Hora».
 * @param {boolean} o.esPC
 * @param {object} o.cuentas  Casos de uso de cuentas (activas, buscar, saldoDe).
 * @param {object} o.categorias  Casos de uso de categorías (todas, buscar).
 * @param {(valores: object, otro: boolean) => Promise<{errores?: object}>} o.alGuardar
 * @param {() => void} o.alCancelar
 */
export function formularioEgreso({ hoy, ahora, esPC, cuentas, categorias, alGuardar, alCancelar }) {
  const n = ++siguiente;
  const id = (campo) => `egreso-${campo}-${n}`;
  let tipo = 'egreso'; // al abrir Cargar siempre es un egreso (HU-03 CA-2)
  let categoriaId = null;
  let cuentaId = null;
  let cuentaDestinoId = null;
  let guardando = false;

  const fecha = crear('input', { id: id('fecha'), name: 'fecha', type: 'date', required: '', 'aria-describedby': id('fecha-texto') });
  const textoFecha = crear('p', { class: 'ayuda fecha-texto', id: id('fecha-texto') });
  const hora = crear('input', { id: id('hora'), name: 'hora', type: 'time' });
  const monto = crear('input', { id: id('monto'), name: 'monto', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00', class: 'entrada-monto', 'aria-describedby': id('monto-ayuda') });
  const textoMonto = crear('p', { class: 'ayuda', id: id('monto-ayuda') });
  const descripcion = crear('input', { id: id('descripcion'), name: 'descripcion', type: 'text', autocomplete: 'off', autocapitalize: 'sentences', maxlength: '120' });

  // Un botón que muestra lo elegido y abre la ventana de selección.
  const botonCampo = (campo) => {
    const valor = crear('span', { class: 'boton-campo-valor', id: id(`${campo}-valor`) });
    const boton = crear('button', { type: 'button', class: 'boton-campo', id: id(campo), 'aria-haspopup': 'dialog' }, [
      valor, crear('span', { class: 'chevron', 'aria-hidden': 'true', texto: '›' }),
    ]);
    return { boton, valor };
  };
  const campoCategoria = botonCampo('categoria');
  const campoCuenta = botonCampo('cuenta');
  // Solo transferencia y cambio: la cuenta de destino, ⇅ para invertir, lo que se recibe y el tipo de cambio.
  const campoDestino = botonCampo('destino');
  const montoRecibido = crear('input', { id: id('monto-recibido'), name: 'montoRecibido', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00', class: 'entrada-monto' });
  const tipoCambio = crear('input', { id: id('tipo-cambio'), name: 'tipoCambio', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00', 'aria-describedby': id('tipo-cambio-ayuda') });
  const textoTipoCambio = crear('p', { class: 'ayuda', id: id('tipo-cambio-ayuda'), texto: 'Pesos por cada dólar. Si escribís el monto que recibís, se calcula; si escribís el tipo de cambio, se calcula el monto.' });
  const invertir = crear('button', { type: 'button', class: 'flecha boton-invertir', id: id('invertir'), texto: '⇅' });
  const irA = crear('button', { type: 'button', class: 'boton-texto', id: id('ir-a'), hidden: '' });
  const controles = {
    fecha, hora, monto, descripcion, categoria: campoCategoria.boton, cuenta: campoCuenta.boton,
    cuentaDestino: campoDestino.boton, montoRecibido, tipoCambio,
  };

  // Control segmentado «Egreso | Ingreso» (HU-03 CA-1): solo el elegido entra con Tab; ← y → cambian de tipo.
  const botonesTipo = TIPOS.map(([valor, texto]) => crear('button', { type: 'button', id: id(`tipo-${valor}`), 'data-tipo': valor, 'aria-pressed': 'false', texto }));
  const segmentado = crear('div', { class: 'segmentado segmentado-tipo', role: 'group', 'aria-label': 'Tipo de movimiento' }, botonesTipo);
  const botonDelTipo = () => botonesTipo.find((b) => b.dataset.tipo === tipo);

  const mostrarElegido = () => {
    const categoria = categoriaId ? categorias.buscar(categoriaId) : null;
    const cuenta = cuentaId ? cuentas.buscar(cuentaId) : null;
    campoCategoria.valor.textContent = categoria ? conEmoji(categoria) : 'Elegir…';
    campoCategoria.valor.classList.toggle('sin-elegir', !categoria);
    campoCuenta.valor.textContent = cuenta ? conEmoji({ emoji: iconoDeCuenta(cuenta), nombre: cuenta.nombre }) : 'Elegir…';
    campoCuenta.valor.classList.toggle('sin-elegir', !cuenta);
    const destino = cuentaDestinoId ? cuentas.buscar(cuentaDestinoId) : null;
    campoDestino.valor.textContent = destino ? conEmoji({ emoji: iconoDeCuenta(destino), nombre: destino.nombre }) : 'Elegir…';
    campoDestino.valor.classList.toggle('sin-elegir', !destino);
    invertir.setAttribute('aria-label', tipo === 'cambio_moneda' ? 'Invertir lo que entregás y lo que recibís' : 'Invertir origen y destino');
    textoMonto.textContent = `Ejemplo: 12.500,50${cuenta ? ` · Moneda de la cuenta: ${cuenta.monedaId}` : ''}`;
  };

  const errores = {};
  const campo = (nombre, rotulo, control, extras = []) => {
    const error = crear('p', { class: 'error-campo', id: id(`${nombre}-error`), hidden: '' });
    errores[nombre] = error;
    const etiqueta = crear('label', { id: id(`${nombre}-rotulo`), for: control.id, texto: rotulo });
    if (control.classList.contains('boton-campo')) control.setAttribute('aria-labelledby', `${etiqueta.id} ${control.id}-valor`);
    return crear('div', { class: 'campo' }, [etiqueta, control, ...extras, error]);
  };
  const resumen = crear('p', { class: 'solo-lectores', role: 'alert' });
  const pintarErrores = (encontrados) => {
    for (const [nombre, error] of Object.entries(errores)) {
      const control = controles[nombre];
      const mensaje = encontrados[nombre];
      error.hidden = !mensaje;
      error.textContent = mensaje ?? '';
      const descr = (control.getAttribute('aria-describedby') ?? '').split(' ').filter((d) => d && d !== error.id);
      if (mensaje) { control.setAttribute('aria-invalid', 'true'); descr.unshift(error.id); } else control.removeAttribute('aria-invalid');
      if (descr.length) control.setAttribute('aria-describedby', descr.join(' ')); else control.removeAttribute('aria-describedby');
    }
  };
  // Muestra los errores y lleva el foco al primer campo con error, en el orden de la pantalla.
  const mostrarErrores = (encontrados) => {
    pintarErrores(encontrados);
    const primero = Object.keys(controles).find((nombre) => encontrados[nombre]);
    resumen.textContent = primero ? encontrados[primero] : '';
    if (primero) controles[primero].focus();
  };

  const alElegirCategoria = (elegida) => { categoriaId = elegida; mostrarElegido(); pintarErrores({ ...pendientes(), categoria: undefined }); };
  const alElegirCuenta = (elegida) => { cuentaId = elegida; mostrarElegido(); pintarErrores({ ...pendientes(), cuenta: undefined }); cambio.recalcular(); };
  const alElegirDestino = (elegida) => { cuentaDestinoId = elegida; mostrarElegido(); pintarErrores({ ...pendientes(), cuentaDestino: undefined }); irA.hidden = true; cambio.recalcular(); };
  // Los errores que se están mostrando, para quitar solo el del campo que se acaba de arreglar.
  const pendientes = () => Object.fromEntries(Object.entries(errores).filter(([, e]) => !e.hidden).map(([nombre, e]) => [nombre, e.textContent]));

  campoCategoria.boton.addEventListener('click', () => {
    const grupos = categoriasAgrupadas(categorias.todas(), tipo).map((g) => ({
      titulo: g.familia ? conEmoji(g.familia) : 'Sin familia',
      opciones: g.categorias.map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji })),
    }));
    // Sin texto escrito se ve el primer nivel del árbol; al escribir, se busca entre todas las hojas.
    abrirSelector({
      titulo: 'Categoría', grupos,
      nivel: { opciones: (padreId) => nivelDeCategorias(categorias.todas(), padreId, tipo), nombreDe: (familiaId) => conEmoji(categorias.buscar(familiaId)) }, elegidoId: categoriaId, alElegir: alElegirCategoria, pantallaCompleta: !esPC,
      vacio: { texto: `Todavía no tenés categorías de ${tipo}.` },
      // «＋ Nueva categoría» al final (HU-39 CA-1): crea del tipo del movimiento, en la familia abierta si se entró a una.
      nuevo: {
        texto: (familiaId) => (familiaId ? `＋ Nueva categoría en ${categorias.buscar(familiaId).nombre}` : '＋ Nueva categoría'),
        formulario: async (contexto) => (await import('./formulario-rapido.js')).formularioCategoriaRapida({ categorias, tipo, ...contexto }),
      },
    });
  });
  // La ventana de cuentas: la de «Cuenta» o «Desde», y la de «Hacia» (transferencia y cambio).
  const abrirCuentas = (titulo, elegidoId, alElegir) => {
    const opciones = cuentas.activas().map((c) => {
      const saldo = cuentas.saldoDe(c);
      return { id: c.id, nombre: c.nombre, emoji: iconoDeCuenta(c), detalle: formatearMonto(saldo, c.monedaId), negativo: saldo < 0 };
    });
    abrirSelector({
      titulo, grupos: [{ titulo: null, opciones }], elegidoId, alElegir, pantallaCompleta: !esPC,
      vacio: { texto: 'Todavía no tenés cuentas.' },
      // «＋ Nueva cuenta» al final (HU-39 CA-2): nombre, tipo y saldo inicial; en pesos.
      nuevo: {
        texto: () => '＋ Nueva cuenta',
        formulario: async (contexto) => (await import('./formulario-rapido.js')).formularioCuentaRapida({ cuentas, ...contexto }),
      },
    });
  };
  campoCuenta.boton.addEventListener('click', () => abrirCuentas(tipo === 'transferencia' ? 'Cuenta de origen' : (tipo === 'cambio_moneda' ? 'Cuenta con la que entregás' : 'Cuenta'), cuentaId, alElegirCuenta));
  campoDestino.boton.addEventListener('click', () => abrirCuentas(tipo === 'cambio_moneda' ? 'Cuenta en la que recibís' : 'Cuenta de destino', cuentaDestinoId, alElegirDestino));

  // La primera letra de la descripción pasa a mayúscula mientras se escribe (D-134), sin mover el cursor.
  descripcion.addEventListener('input', () => {
    const actual = descripcion.value;
    const corregido = capitalizarInicial(actual);
    if (corregido === actual) return;
    const { selectionStart, selectionEnd } = descripcion;
    descripcion.value = corregido;
    descripcion.setSelectionRange(selectionStart, selectionEnd);
  });
  // El monto se va formateando mientras se escribe (HU-02b CA-1).
  darFormatoDeMonto(monto);
  darFormatoDeMonto(montoRecibido);
  darFormatoDeMonto(tipoCambio);
  // Cambio (HU-07 CA-3): el monto que recibís y el tipo de cambio se calculan uno a otro.
  const cambio = enlazarCambio({
    monto, montoRecibido, tipoCambio,
    monedas: () => (cuentaId && cuentaDestinoId ? { entrega: cuentas.buscar(cuentaId).monedaId, recibe: cuentas.buscar(cuentaDestinoId).monedaId } : null),
  });
  invertir.addEventListener('click', () => {
    [cuentaId, cuentaDestinoId] = [cuentaDestinoId, cuentaId];
    if (tipo === 'cambio_moneda') cambio.invertir();
    mostrarElegido();
    pintarErrores({});
    irA.hidden = true; // los montos ya van invertidos y de acuerdo con el tipo de cambio: no se recalcula
  });
  fecha.addEventListener('change', () => { textoFecha.textContent = textoDeFecha(fecha.value, hoy()); });

  // Cambia el tipo: el título, el color del monto y las categorías cambian; la categoría de egreso elegida se borra.
  const elegirTipo = (nuevo, { borrar = true } = {}) => {
    const cambiaTipo = nuevo !== tipo;
    tipo = nuevo;
    for (const b of botonesTipo) { b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)); b.tabIndex = b.dataset.tipo === tipo ? 0 : -1; }
    formulario.dataset.tipo = tipo;
    const texto = TITULOS[tipo];
    titulo.textContent = texto;
    if (titulo.isConnected || cambiaTipo) document.title = `${texto} · AFP`;
    if (cambiaTipo && borrar) { categoriaId = null; }
    if (cambiaTipo) { irA.hidden = true; pintarErrores({ ...pendientes(), categoria: undefined, cuentaDestino: undefined, montoRecibido: undefined }); }
    componer();
    mostrarElegido();
    cambio.recalcular();
  };
  for (const b of botonesTipo) b.addEventListener('click', () => elegirTipo(b.dataset.tipo));

  const vaciar = () => {
    categoriaId = null;
    cuentaId = null;
    cuentaDestinoId = null;
    cambio.reiniciar();
    irA.hidden = true;
    fecha.max = hoy();
    fecha.value = hoy();
    hora.value = ahora();
    textoFecha.textContent = textoDeFecha(fecha.value, hoy());
    monto.value = '';
    descripcion.value = '';
    mostrarElegido();
    mostrarErrores({});
  };

  const cancelar = crear('button', { type: 'button', class: 'boton-secundario', id: id('cancelar'), texto: 'Cancelar' });
  const otro = crear('button', { type: 'button', class: 'boton-secundario', id: id('otro'), texto: 'Guardar y cargar otro' });
  const guardar = crear('button', { type: 'submit', class: 'boton-principal', id: id('guardar'), texto: 'Guardar' });
  const titulo = crear('h1', { class: 'titulo', tabindex: '-1', texto: 'Nuevo egreso' });
  const formulario = crear('form', { class: 'formulario-egreso', 'aria-labelledby': 'titulo-egreso', novalidate: '' });
  const atajos = crear('p', { class: 'atajos apoyo' }, [
    crear('kbd', { texto: 'Ctrl + Enter' }), ' guarda · ', crear('kbd', { texto: 'Ctrl + Mayús + Enter' }), ' guarda y carga otro · ', crear('kbd', { texto: 'Ctrl + Z' }), ' deshace',
  ]);

  const cFecha = campo('fecha', 'Fecha', fecha, [textoFecha]);
  const cHora = campo('hora', 'Hora', hora);
  const cMonto = campo('monto', 'Monto', monto, [textoMonto]);
  const cDescripcion = campo('descripcion', 'Descripción (opcional)', descripcion);
  const cCategoria = campo('categoria', 'Categoría', campoCategoria.boton);
  const cCuenta = campo('cuenta', 'Cuenta', campoCuenta.boton);
  const cDestino = campo('cuentaDestino', 'Hacia', campoDestino.boton, [irA]);
  const cRecibido = campo('montoRecibido', 'Recibís: monto', montoRecibido);
  const cTipoCambio = campo('tipoCambio', 'Tipo de cambio', tipoCambio, [textoTipoCambio]);
  const rotulo = (c) => c.querySelector('label');
  const acciones = crear('div', { class: 'acciones-carga' }, [cancelar, otro, guardar]);
  const alternar = crear('div', { class: 'invertir' }, [invertir]);
  // Qué campos se ven y en qué orden en cada pestaña (HU-06, HU-07). El segmentado no se mueve: puede tener el foco.
  const componer = () => {
    const rotulos = {
      transferencia: ['Monto', 'Desde', 'Hacia'],
      cambio_moneda: ['Entregás: monto', 'Entregás: cuenta', 'Recibís: cuenta'],
    }[tipo] ?? ['Monto', 'Cuenta', 'Hacia'];
    [rotulo(cMonto).textContent, rotulo(cCuenta).textContent, rotulo(cDestino).textContent] = rotulos;
    const lista = {
      egreso: [cFecha, cHora, cMonto, cDescripcion, cCategoria, cCuenta],
      ingreso: [cFecha, cHora, cMonto, cDescripcion, cCategoria, cCuenta],
      transferencia: [cFecha, cHora, cMonto, cDescripcion, cCuenta, alternar, cDestino],
      cambio_moneda: [cFecha, cHora, cMonto, cCuenta, alternar, cDestino, cRecibido, cTipoCambio, cDescripcion],
    }[tipo];
    // Lo que la pestaña no usa sale del DOM (no queda oculto): así no lo leen los lectores de pantalla ni se confunde con un campo propio.
    for (const c of [cFecha, cHora, cMonto, cDescripcion, cCategoria, cCuenta, alternar, cDestino, cRecibido, cTipoCambio]) if (!lista.includes(c)) c.remove();
    formulario.append(...lista, resumen, acciones, atajos);
  };
  formulario.append(segmentado);
  titulo.id = 'titulo-egreso';

  // Un doble toque no guarda dos veces: mientras se guarda, se ignoran los pedidos nuevos.
  const intentar = async (seguir) => {
    if (guardando) return;
    guardando = true;
    for (const b of [cancelar, otro, guardar]) b.disabled = true;
    let seVa = false;
    try {
      const resultado = await alGuardar({
        fecha: fecha.value, hora: hora.value, monto: monto.value, descripcion: descripcion.value, categoriaId, cuentaId, tipo,
        cuentaDestinoId, montoRecibido: montoRecibido.value,
      }, seguir);
      if (resultado?.errores) {
        mostrarErrores(resultado.errores);
        // Cuentas de otra moneda en una transferencia, o de la misma en un cambio: se ofrece ir a la otra pestaña (HU-06 CA-2, HU-07 CA-2).
        const otra = resultado.sugerirCambio ? ['cambio_moneda', 'Ir a «Cambio»'] : (resultado.sugerirTransferencia ? ['transferencia', 'Ir a «Transferencia»'] : null);
        irA.hidden = !otra;
        if (otra) { irA.dataset.tipo = otra[0]; irA.textContent = otra[1]; }
      }
      else if (seguir) { vaciar(); monto.focus(); } else seVa = true; // vuelve a la pantalla anterior: no se habilita nada más
    } finally {
      if (!seVa) {
        guardando = false;
        for (const b of [cancelar, otro, guardar]) if (b.isConnected) b.disabled = false;
      }
    }
  };
  // Flechas en la PC (HU-02b CA-3): ↓ va al campo o botón siguiente y ↑ al anterior; entre los tres botones, ← y →.
  // En la ventana de selección las flechas son de ella (vive fuera del formulario). Tab no cambia.
  // El segmentado va primero: con el foco en él, ← y → cambian de tipo (HU-03 CA-1).
  const posibles = [fecha, hora, monto, descripcion, campoCategoria.boton, campoCuenta.boton, invertir, campoDestino.boton, montoRecibido, tipoCambio, irA];
  // Los campos que se ven en la pestaña actual, en el orden de la pantalla.
  const ordenActual = () => [null, ...posibles.filter((c) => c.isConnected && !c.closest('[hidden]'))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)), cancelar, otro, guardar];
  const botones = [cancelar, otro, guardar];
  formulario.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
    const orden = ordenActual();
    const enfocarOrden = (k) => (k === 0 ? botonDelTipo() : orden[k]).focus();
    const i = botonesTipo.includes(evento.target) ? 0 : orden.indexOf(evento.target);
    if (i < 0) return;
    const j = botones.indexOf(evento.target);
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      enfocarOrden(Math.max(0, Math.min(orden.length - 1, i + (evento.key === 'ArrowDown' ? 1 : -1))));
    } else if (i === 0 && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
      evento.preventDefault();
      const k = TIPOS.findIndex(([valor]) => valor === tipo) + (evento.key === 'ArrowRight' ? 1 : -1);
      elegirTipo(TIPOS[Math.max(0, Math.min(TIPOS.length - 1, k))][0]);
      botonDelTipo().focus();
    } else if ((evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') && j >= 0) {
      evento.preventDefault();
      botones[Math.max(0, Math.min(botones.length - 1, j + (evento.key === 'ArrowRight' ? 1 : -1)))].focus();
    }
  });
  // Mientras se guarda, Esc no vuelve (HU-35): la pantalla ya usó la tecla.
  formulario.addEventListener('keydown', (evento) => { if (evento.key === 'Escape' && guardando) evento.preventDefault(); });
  cancelar.addEventListener('click', alCancelar);
  irA.addEventListener('click', () => { elegirTipo(irA.dataset.tipo); (irA.dataset.tipo === 'transferencia' ? invertir : monto).focus(); });
  otro.addEventListener('click', () => intentar(true));
  formulario.addEventListener('submit', (evento) => { evento.preventDefault(); intentar(false); });
  // Los atajos valen en toda la pantalla: al cerrarse una ventana de selección el foco puede no estar todavía en un
  // campo. Con una ventana abierta no valen, y el oyente se quita solo cuando el formulario ya no está en pantalla.
  const atajo = (evento) => {
    if (!formulario.isConnected) { document.removeEventListener('keydown', atajo); return; }
    if (evento.key !== 'Enter' || !(evento.ctrlKey || evento.metaKey) || document.querySelector('dialog[open]')) return;
    evento.preventDefault();
    intentar(evento.shiftKey);
  };
  document.addEventListener('keydown', atajo);

  elegirTipo('egreso', { borrar: false });
  vaciar();
  return { elementos: [titulo, formulario], enfocar: () => titulo.focus({ preventScroll: true }) };
}
