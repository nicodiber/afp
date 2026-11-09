// HU-35: a dónde vuelve Esc. Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padreDe, destinoAlVolver, accionDeEscape } from '../../src/dominio/atajos.js';

test('HU-35 CA-1 · la pantalla padre: las subpantallas vuelven a Ajustes; el resto, a Inicio; Inicio no tiene', () => {
  for (const sub of ['ajustes/cuentas', 'ajustes/categorias', 'ajustes/monedas']) assert.equal(padreDe(sub), 'ajustes', sub);
  for (const p of ['movimientos', 'cargar', 'analisis', 'ajustes']) assert.equal(padreDe(p), 'inicio', p);
  assert.equal(padreDe('inicio'), null);
  assert.equal(padreDe('algo/raro'), 'inicio', 'una ruta desconocida cuenta como Inicio');
});

test('HU-35 CA-1 · con historial vuelve atrás; sin historial, a la pantalla padre; en Inicio no hace nada', () => {
  assert.deepEqual(destinoAlVolver({ ruta: 'cargar', hayHistorial: true }), { accion: 'atras' });
  assert.deepEqual(destinoAlVolver({ ruta: 'ajustes/categorias', hayHistorial: true }), { accion: 'atras' });
  assert.deepEqual(destinoAlVolver({ ruta: 'ajustes/categorias', hayHistorial: false }), { accion: 'ir', ruta: 'ajustes' });
  assert.deepEqual(destinoAlVolver({ ruta: 'ajustes', hayHistorial: false }), { accion: 'ir', ruta: 'inicio' });
  assert.deepEqual(destinoAlVolver({ ruta: 'movimientos', hayHistorial: false }), { accion: 'ir', ruta: 'inicio' });
  assert.equal(destinoAlVolver({ ruta: 'inicio', hayHistorial: true }), null);
  assert.equal(destinoAlVolver({ ruta: 'inicio', hayHistorial: false }), null);
});

const base = { tecla: 'Escape', ctrl: false, alt: false, meta: false, shift: false, repetida: false, enCampo: false, hayVentana: false, hayAyuda: false, esPC: true, ruta: 'ajustes/cuentas' };

test('HU-35 CA-1 y CA-2 · Esc vuelve desde cualquier pantalla que no sea Inicio', () => {
  for (const ruta of ['cargar', 'movimientos', 'analisis', 'ajustes', 'ajustes/cuentas', 'ajustes/categorias', 'ajustes/monedas']) {
    assert.equal(accionDeEscape({ ...base, ruta }), 'volver', ruta);
  }
  assert.equal(accionDeEscape({ ...base, ruta: 'inicio' }), 'ignorar');
});

test('HU-35 CA-2 · una ventana o un tooltip abiertos se quedan con Esc', () => {
  assert.equal(accionDeEscape({ ...base, hayVentana: true }), 'ignorar');
  assert.equal(accionDeEscape({ ...base, hayAyuda: true }), 'ignorar');
});

test('HU-35 CA-2 · con el foco en un campo, el primer Esc lo suelta', () => {
  assert.equal(accionDeEscape({ ...base, enCampo: true }), 'soltar-foco');
  assert.equal(accionDeEscape({ ...base, enCampo: true, ruta: 'cargar' }), 'soltar-foco');
});

test('HU-35 CA-2 y CA-3 · otras teclas, modificadores, tecla repetida y el celular no hacen nada', () => {
  assert.equal(accionDeEscape({ ...base, tecla: 'Enter' }), 'ignorar');
  for (const m of ['ctrl', 'alt', 'meta', 'shift', 'repetida']) assert.equal(accionDeEscape({ ...base, [m]: true }), 'ignorar', m);
  assert.equal(accionDeEscape({ ...base, esPC: false }), 'ignorar', 'CA-3: en el celular no cambia nada');
});
