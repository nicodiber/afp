// Formulario de una cuenta (aep#12, D-127, D-132). Es un componente: lo usan Cuentas e Inicio, y lo va a usar
// la carga de movimientos para crear una cuenta sin salir (D-131). No sabe dónde se muestra.
import { crear } from './dom.js';
import { TIPOS_ELEGIBLES, NOMBRES_DE_TIPO, PROPOSITOS, NOMBRES_DE_PROPOSITO } from '../dominio/cuentas.js';
import { montoParaEditar } from '../dominio/formato.js';

let siguiente = 0;

/**
 * @param {Object} o
 * @param {object|null} o.cuenta  La cuenta a editar, o null para una nueva.
 * @param {{id: string, simbolo: string}[]} o.monedas  Monedas que se pueden elegir.
 * @param {string} o.hoy  AAAA-MM-DD (puerto Reloj).
 * @param {(formulario: object) => Promise<{errores?: object}>} o.alGuardar
 * @param {() => void} o.alCancelar
 * @param {(() => void)=} o.alArchivar  Solo al editar una cuenta activa.
 * @param {(() => void)=} o.alEliminar  Solo al editar.
 */
export function formularioCuenta({ cuenta, monedas, hoy, alGuardar, alCancelar, alArchivar, alEliminar }) {
  const n = ++siguiente;
  const id = (campo) => `cuenta-${campo}-${n}`;
  const nueva = !cuenta;
  const valor = (campo, defecto) => (cuenta ? cuenta[campo] : defecto);

  const entrada = (campo, atributos) => crear('input', { id: id(campo), name: campo, ...atributos });
  const opciones = (lista, elegido) => lista.map(([v, t]) => {
    const o = crear('option', { value: v, texto: t });
    if (v === elegido) o.selected = true;
    return o;
  });
  const campos = {
    nombre: entrada('nombre', { type: 'text', autocomplete: 'off', maxlength: '60', required: '' }),
    tipo: crear('select', { id: id('tipo'), name: 'tipo' }, opciones(TIPOS_ELEGIBLES.map((t) => [t, NOMBRES_DE_TIPO[t]]), valor('tipo', 'efectivo'))),
    monedaId: crear('select', { id: id('monedaId'), name: 'monedaId' }, opciones(monedas.map((m) => [m.id, `${m.id} · ${m.simbolo}`]), valor('monedaId', 'ARS'))),
    saldoInicial: entrada('saldoInicial', { type: 'text', inputmode: 'decimal', autocomplete: 'off' }),
    fechaSaldoInicial: entrada('fechaSaldoInicial', { type: 'date', max: hoy, required: '' }),
    emoji: entrada('emoji', { type: 'text', autocomplete: 'off', maxlength: '8' }),
    proposito: crear('select', { id: id('proposito'), name: 'proposito' }, opciones(PROPOSITOS.map((p) => [p, NOMBRES_DE_PROPOSITO[p]]), valor('proposito', 'ninguno'))),
    notas: crear('textarea', { id: id('notas'), name: 'notas', maxlength: '500', rows: '3' }),
  };
  campos.nombre.value = valor('nombre', '');
  campos.saldoInicial.value = cuenta ? montoParaEditar(cuenta.saldoInicial) : '0';
  campos.fechaSaldoInicial.value = valor('fechaSaldoInicial', hoy);
  campos.emoji.value = valor('emoji', '');
  campos.notas.value = valor('notas', '');
  const rendimiento = crear('button', { type: 'button', role: 'switch', class: 'interruptor', id: id('rendimiento'), 'aria-checked': String(valor('tieneRendimiento', false)) }, [
    crear('span', { class: 'interruptor-texto', texto: 'Tiene rendimiento' }),
    crear('span', { class: 'interruptor-pista', 'aria-hidden': 'true' }),
  ]);
  rendimiento.addEventListener('click', () => rendimiento.setAttribute('aria-checked', String(rendimiento.getAttribute('aria-checked') !== 'true')));

  const errores = {};
  const campo = (nombre, rotulo, ayuda) => {
    const control = campos[nombre];
    const error = crear('p', { class: 'error-campo', id: id(`${nombre}-error`), hidden: '' });
    errores[nombre] = error;
    const hijos = [crear('label', { for: control.id, texto: rotulo }), control];
    if (ayuda) {
      const pista = crear('p', { class: 'ayuda', id: id(`${nombre}-ayuda`), texto: ayuda });
      control.setAttribute('aria-describedby', pista.id);
      hijos.push(pista);
    }
    hijos.push(error);
    return crear('div', { class: 'campo' }, hijos);
  };
  const resumen = crear('p', { class: 'solo-lectores', role: 'alert' });
  const mostrarErrores = (encontrados) => {
    for (const [nombre, error] of Object.entries(errores)) {
      const control = campos[nombre];
      const mensaje = encontrados[nombre];
      error.hidden = !mensaje;
      error.textContent = mensaje ?? '';
      if (mensaje) {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', [error.id, control.getAttribute('aria-describedby')].filter(Boolean).join(' '));
      } else {
        control.removeAttribute('aria-invalid');
        const descr = (control.getAttribute('aria-describedby') ?? '').split(' ').filter((d) => d && d !== error.id).join(' ');
        if (descr) control.setAttribute('aria-describedby', descr); else control.removeAttribute('aria-describedby');
      }
    }
    const primero = Object.keys(campos).find((nombre) => encontrados[nombre]);
    resumen.textContent = primero ? encontrados[primero] : '';
    if (primero) campos[primero].focus();
  };

  const titulo = crear('h2', { class: 'subtitulo', id: id('titulo'), texto: nueva ? 'Nueva cuenta' : 'Editar cuenta' });
  const cancelar = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Cancelar' });
  cancelar.addEventListener('click', alCancelar);
  const guardar = crear('button', { type: 'submit', class: 'boton-principal', texto: nueva ? 'Crear cuenta' : 'Guardar' });
  const extra = [];
  if (alArchivar) {
    const archivar = crear('button', { type: 'button', class: 'boton-texto', texto: 'Archivar' });
    archivar.addEventListener('click', alArchivar);
    extra.push(archivar);
  }
  if (alEliminar) {
    const eliminar = crear('button', { type: 'button', class: 'boton-texto boton-peligro', texto: 'Eliminar' });
    eliminar.addEventListener('click', alEliminar);
    extra.push(eliminar);
  }

  const formulario = crear('form', { class: 'formulario-cuenta', 'aria-labelledby': titulo.id, novalidate: '' }, [
    titulo,
    campo('nombre', 'Nombre', 'Hasta 40 caracteres.'),
    crear('div', { class: 'campos-juntos' }, [campo('tipo', 'Tipo'), campo('monedaId', 'Moneda')]),
    crear('div', { class: 'campos-juntos' }, [campo('saldoInicial', 'Saldo inicial', 'Puede ser negativo.'), campo('fechaSaldoInicial', 'Al día')]),
    rendimiento,
    crear('div', { class: 'campos-juntos campos-emoji' }, [campo('emoji', 'Emoji'), campo('proposito', 'Propósito')]),
    campo('notas', 'Notas', 'Hasta 500 caracteres.'),
    resumen,
    crear('div', { class: 'acciones' }, [cancelar, guardar]),
    ...(extra.length ? [crear('div', { class: 'acciones-extra' }, extra)] : []),
  ]);
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    guardar.disabled = true;
    try {
      const resultado = await alGuardar({
        nombre: campos.nombre.value, tipo: campos.tipo.value, monedaId: campos.monedaId.value,
        saldoInicial: campos.saldoInicial.value, fechaSaldoInicial: campos.fechaSaldoInicial.value,
        tieneRendimiento: rendimiento.getAttribute('aria-checked') === 'true',
        emoji: campos.emoji.value, proposito: campos.proposito.value, notas: campos.notas.value,
      });
      if (resultado?.errores) mostrarErrores(resultado.errores);
    } finally {
      if (guardar.isConnected) guardar.disabled = false;
    }
  });
  formulario.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !formulario.closest('dialog')) { evento.preventDefault(); alCancelar(); }
  });
  return { elemento: formulario, enfocar: () => campos.nombre.focus() };
}
