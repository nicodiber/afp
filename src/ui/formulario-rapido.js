// Formularios cortos para crear una categoría o una cuenta sin salir de la carga (HU-39, D-131, D-175, D-179).
// Viven dentro de la ventana de elección: piden lo mínimo, usan las validaciones de Categorías y Cuentas (no las repiten)
// y devuelven el id de lo creado para que la carga lo deje elegido. Se cargan con `import()` recién al tocar «＋ Nueva…».
import { crear } from './dom.js';
import { capitalizarInicial } from '../dominio/texto.js';
import { TIPOS_ELEGIBLES, NOMBRES_DE_TIPO, iconoDeTipo } from '../dominio/cuentas.js';
import { darFormatoDeMonto } from './campo-monto.js';

let siguiente = 0;

// Arma el esqueleto común: título, campos, un aviso para lectores de pantalla y «Volver» / «Crear y elegir».
function armar({ titulo, subtitulo, campos, alCancelar, alEnviar }) {
  const n = ++siguiente;
  const resumen = crear('p', { class: 'solo-lectores', role: 'alert' });
  const encabezado = crear('h2', { class: 'subtitulo', id: `rapido-titulo-${n}`, tabindex: '-1', texto: titulo });
  const volver = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Volver' });
  const crearYElegir = crear('button', { type: 'submit', class: 'boton-principal', texto: 'Crear y elegir' });
  volver.addEventListener('click', alCancelar);
  const formulario = crear('form', { class: 'formulario-cuenta formulario-rapido', 'aria-labelledby': encabezado.id, novalidate: '' }, [
    encabezado,
    ...(subtitulo ? [crear('p', { class: 'apoyo', texto: subtitulo })] : []),
    ...campos,
    resumen,
    crear('div', { class: 'acciones' }, [volver, crearYElegir]),
  ]);
  let enviando = false;
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    enviando = true;
    crearYElegir.disabled = true;
    try { await alEnviar(resumen); } finally { enviando = false; if (crearYElegir.isConnected) crearYElegir.disabled = false; }
  });
  return { formulario, n };
}

// Un campo con su rótulo, su control y su error; `mostrar(mensaje)` lo pinta.
function campo({ id, rotulo, control, ayuda }) {
  const error = crear('p', { class: 'error-campo', id: `${id}-error`, hidden: '' });
  const hijos = [crear('label', { for: control.id, texto: rotulo }), control];
  if (ayuda) {
    const pista = crear('p', { class: 'ayuda', id: `${id}-ayuda`, texto: ayuda });
    control.setAttribute('aria-describedby', pista.id);
    hijos.push(pista);
  }
  hijos.push(error);
  const base = control.getAttribute('aria-describedby');
  const mostrar = (mensaje) => {
    error.hidden = !mensaje;
    error.textContent = mensaje ?? '';
    if (mensaje) { control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', [error.id, base].filter(Boolean).join(' ')); }
    else { control.removeAttribute('aria-invalid'); if (base) control.setAttribute('aria-describedby', base); else control.removeAttribute('aria-describedby'); }
  };
  return { elemento: crear('div', { class: 'campo' }, hijos), mostrar };
}

const conMayuscula = (nombre) => nombre.addEventListener('input', () => {
  const corregido = capitalizarInicial(nombre.value);
  if (corregido === nombre.value) return;
  const { selectionStart, selectionEnd } = nombre;
  nombre.value = corregido;
  nombre.setSelectionRange(selectionStart, selectionEnd);
});

/**
 * Categoría nueva: nombre (con lo que se buscó) e ícono que AFP propone. Del tipo del movimiento, dentro de `familiaId` si
 * se estaba en una familia, con la clasificación por defecto de Categorías.
 * @param {Object} o
 * @param {object} o.categorias  Casos de uso de categorías.
 * @param {'egreso'|'ingreso'} o.tipo
 * @param {string} o.buscado  Lo escrito en el buscador: queda como nombre.
 * @param {string|null} o.familiaId
 * @param {() => void} o.alCancelar
 * @param {(id: string) => void} o.alCrear
 */
export function formularioCategoriaRapida({ categorias, tipo, buscado, familiaId, alCancelar, alCrear }) {
  const familia = familiaId ? categorias.buscar(familiaId) : null;
  const nombre = crear('input', { id: 'rapido-categoria-nombre', type: 'text', autocomplete: 'off', autocapitalize: 'sentences', maxlength: '60' });
  nombre.value = capitalizarInicial(buscado);
  const iconoActual = crear('span', { class: 'icono-actual', 'aria-hidden': 'true' });
  const icono = crear('p', { class: 'icono-propuesto', id: 'rapido-categoria-icono' }, [
    iconoActual, crear('span', { class: 'apoyo', texto: 'Lo propone AFP; después lo podés cambiar en Categorías.' }),
  ]);
  let emoji = '';
  const proponer = () => { emoji = categorias.iconoPropuesto(nombre.value); iconoActual.textContent = emoji; icono.setAttribute('aria-label', `Ícono propuesto ${emoji}`); };
  proponer();
  const cNombre = campo({ id: 'rapido-categoria-nombre', rotulo: 'Nombre', control: nombre });
  conMayuscula(nombre);
  nombre.addEventListener('input', proponer);
  const { formulario } = armar({
    titulo: familia ? `Nueva categoría en ${familia.nombre}` : 'Nueva categoría',
    subtitulo: `${tipo === 'ingreso' ? 'De ingresos' : 'De egresos'}${familia ? ` · dentro de ${familia.nombre}` : ''}`,
    campos: [cNombre.elemento, crear('div', { class: 'campo' }, [crear('span', { class: 'rotulo-campo', texto: 'Ícono' }), icono])],
    alCancelar,
    alEnviar: async (resumen) => {
      const resultado = await categorias.crear({ nombre: nombre.value, emoji, ...categorias.clasificacionPorDefecto(familiaId, tipo) }, { padreId: familiaId, tipo });
      if (resultado.errores) {
        cNombre.mostrar(resultado.errores.nombre ?? null);
        resumen.textContent = resultado.errores.nombre ?? Object.values(resultado.errores)[0] ?? '';
        if (resultado.errores.nombre) nombre.focus();
        else proponer(); // el ícono se usó mientras tanto: se propone otro libre
        return;
      }
      alCrear(resultado.categoria.id);
    },
  });
  return { elemento: formulario, enfocar: () => { nombre.focus(); nombre.setSelectionRange(nombre.value.length, nombre.value.length); } };
}

/**
 * Cuenta nueva: nombre, tipo y saldo inicial, en pesos, con el ícono propuesto por tipo y el saldo a la fecha de hoy.
 * @param {Object} o
 * @param {object} o.cuentas  Casos de uso de cuentas.
 * @param {string} o.buscado
 * @param {() => void} o.alCancelar
 * @param {(id: string) => void} o.alCrear
 */
export function formularioCuentaRapida({ cuentas, buscado, alCancelar, alCrear }) {
  const nombre = crear('input', { id: 'rapido-cuenta-nombre', type: 'text', autocomplete: 'off', autocapitalize: 'sentences', maxlength: '60' });
  nombre.value = capitalizarInicial(buscado);
  conMayuscula(nombre);
  const tipo = crear('select', { id: 'rapido-cuenta-tipo' }, TIPOS_ELEGIBLES.map((t) => crear('option', { value: t, texto: NOMBRES_DE_TIPO[t] })));
  const saldo = crear('input', { id: 'rapido-cuenta-saldo', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00', class: 'entrada-monto' });
  darFormatoDeMonto(saldo);
  const cNombre = campo({ id: 'rapido-cuenta-nombre', rotulo: 'Nombre', control: nombre });
  const cTipo = campo({ id: 'rapido-cuenta-tipo', rotulo: 'Tipo', control: tipo });
  const cSaldo = campo({ id: 'rapido-cuenta-saldo', rotulo: 'Saldo inicial', control: saldo, ayuda: 'En pesos (ARS). Vacío es 0.' });
  const mostrar = { nombre: cNombre.mostrar, tipo: cTipo.mostrar, saldoInicial: cSaldo.mostrar };
  const controles = { nombre, tipo, saldoInicial: saldo };
  const { formulario } = armar({
    titulo: 'Nueva cuenta',
    campos: [cNombre.elemento, cTipo.elemento, cSaldo.elemento],
    alCancelar,
    alEnviar: async (resumen) => {
      const resultado = await cuentas.crear({
        nombre: nombre.value, tipo: tipo.value, monedaId: 'ARS', saldoInicial: saldo.value, fechaSaldoInicial: cuentas.hoy(),
        tieneRendimiento: false, emoji: iconoDeTipo(tipo.value), proposito: 'ninguno', notas: '',
      });
      if (resultado.errores) {
        for (const [clave, pintar] of Object.entries(mostrar)) pintar(resultado.errores[clave] ?? null);
        const primero = Object.keys(controles).find((clave) => resultado.errores[clave]);
        resumen.textContent = primero ? resultado.errores[primero] : Object.values(resultado.errores)[0] ?? '';
        controles[primero]?.focus();
        return;
      }
      alCrear(resultado.cuenta.id);
    },
  });
  return { elemento: formulario, enfocar: () => { nombre.focus(); nombre.setSelectionRange(nombre.value.length, nombre.value.length); } };
}
