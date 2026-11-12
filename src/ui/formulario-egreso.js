// Formulario «Nuevo egreso» / «Nuevo ingreso» (HU-02 CA-1 a CA-3, HU-02b, HU-03): tipo, fecha, hora, monto, descripción, categoría y cuenta. Categoría y
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

let siguiente = 0;

const textoDeFecha = (fecha, hoy) => (fecha === hoy ? `Hoy · ${formatearFecha(fecha)}` : (fecha ? formatearFecha(fecha) : 'Sin fecha'));
const TIPOS = [['egreso', 'Egreso'], ['ingreso', 'Ingreso']];
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
  const controles = { fecha, hora, monto, descripcion, categoria: campoCategoria.boton, cuenta: campoCuenta.boton };

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
  const alElegirCuenta = (elegida) => { cuentaId = elegida; mostrarElegido(); pintarErrores({ ...pendientes(), cuenta: undefined }); };
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
  campoCuenta.boton.addEventListener('click', () => {
    const opciones = cuentas.activas().map((c) => {
      const saldo = cuentas.saldoDe(c);
      return { id: c.id, nombre: c.nombre, emoji: iconoDeCuenta(c), detalle: formatearMonto(saldo, c.monedaId), negativo: saldo < 0 };
    });
    abrirSelector({
      titulo: 'Cuenta', grupos: [{ titulo: null, opciones }], elegidoId: cuentaId, alElegir: alElegirCuenta, pantallaCompleta: !esPC,
      vacio: { texto: 'Todavía no tenés cuentas.' },
      // «＋ Nueva cuenta» al final (HU-39 CA-2): nombre, tipo y saldo inicial; en pesos.
      nuevo: {
        texto: () => '＋ Nueva cuenta',
        formulario: async (contexto) => (await import('./formulario-rapido.js')).formularioCuentaRapida({ cuentas, ...contexto }),
      },
    });
  });

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
  fecha.addEventListener('change', () => { textoFecha.textContent = textoDeFecha(fecha.value, hoy()); });

  // Cambia el tipo: el título, el color del monto y las categorías cambian; la categoría de egreso elegida se borra.
  const elegirTipo = (nuevo, { borrar = true } = {}) => {
    const cambio = nuevo !== tipo;
    tipo = nuevo;
    for (const b of botonesTipo) { b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)); b.tabIndex = b.dataset.tipo === tipo ? 0 : -1; }
    formulario.dataset.tipo = tipo;
    const texto = tipo === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo egreso';
    titulo.textContent = texto;
    if (titulo.isConnected || cambio) document.title = `${texto} · AFP`;
    if (cambio && borrar) { categoriaId = null; mostrarElegido(); pintarErrores({ ...pendientes(), categoria: undefined }); }
  };
  for (const b of botonesTipo) b.addEventListener('click', () => elegirTipo(b.dataset.tipo));

  const vaciar = () => {
    categoriaId = null;
    cuentaId = null;
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
    crear('kbd', { texto: 'Ctrl + Enter' }), ' guarda · ', crear('kbd', { texto: 'Ctrl + Mayús + Enter' }), ' guarda y carga otro',
  ]);

  formulario.append(
    segmentado,
    campo('fecha', 'Fecha', fecha, [textoFecha]),
    campo('hora', 'Hora', hora),
    campo('monto', 'Monto', monto, [textoMonto]),
    campo('descripcion', 'Descripción (opcional)', descripcion),
    campo('categoria', 'Categoría', campoCategoria.boton),
    campo('cuenta', 'Cuenta', campoCuenta.boton),
    resumen,
    crear('div', { class: 'acciones-carga' }, [cancelar, otro, guardar]),
    atajos,
  );
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
      }, seguir);
      if (resultado?.errores) mostrarErrores(resultado.errores);
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
  const orden = [null, fecha, hora, monto, descripcion, campoCategoria.boton, campoCuenta.boton, cancelar, otro, guardar];
  const botones = [cancelar, otro, guardar];
  const enfocarOrden = (k) => (k === 0 ? botonDelTipo() : orden[k]).focus();
  formulario.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
    const i = botonesTipo.includes(evento.target) ? 0 : orden.indexOf(evento.target);
    if (i < 0) return;
    const j = botones.indexOf(evento.target);
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      enfocarOrden(Math.max(0, Math.min(orden.length - 1, i + (evento.key === 'ArrowDown' ? 1 : -1))));
    } else if (i === 0 && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
      evento.preventDefault();
      elegirTipo(TIPOS[evento.key === 'ArrowRight' ? 1 : 0][0]);
      botonDelTipo().focus();
    } else if ((evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') && j >= 0) {
      evento.preventDefault();
      botones[Math.max(0, Math.min(botones.length - 1, j + (evento.key === 'ArrowRight' ? 1 : -1)))].focus();
    }
  });
  // Mientras se guarda, Esc no vuelve (HU-35): la pantalla ya usó la tecla.
  formulario.addEventListener('keydown', (evento) => { if (evento.key === 'Escape' && guardando) evento.preventDefault(); });
  cancelar.addEventListener('click', alCancelar);
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
