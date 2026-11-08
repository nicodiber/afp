// HU-34 CA-1: cuándo la tecla «c» abre Cargar. Valores esperados escritos a mano a partir de la historia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abreCarga } from '../../src/dominio/atajos.js';

const base = { tecla: 'c', ctrl: false, alt: false, meta: false, enCampo: false, hayVentana: false, esPC: true, ruta: 'inicio' };

test('HU-34 CA-1 · «c» y «C» abren Cargar en Inicio, en la PC', () => {
  assert.equal(abreCarga(base), true);
  assert.equal(abreCarga({ ...base, tecla: 'C' }), true);
});

test('HU-34 CA-1 · no abre con otra tecla, fuera de Inicio ni en el celular', () => {
  assert.equal(abreCarga({ ...base, tecla: 'x' }), false);
  assert.equal(abreCarga({ ...base, tecla: 'Enter' }), false);
  assert.equal(abreCarga({ ...base, ruta: 'cargar' }), false);
  assert.equal(abreCarga({ ...base, ruta: 'ajustes' }), false);
  assert.equal(abreCarga({ ...base, esPC: false }), false);
});

test('HU-34 CA-1 · no abre con el foco en un campo, con una ventana abierta ni con Ctrl, Alt o Meta', () => {
  assert.equal(abreCarga({ ...base, enCampo: true }), false);
  assert.equal(abreCarga({ ...base, hayVentana: true }), false);
  assert.equal(abreCarga({ ...base, ctrl: true }), false);
  assert.equal(abreCarga({ ...base, alt: true }), false);
  assert.equal(abreCarga({ ...base, meta: true }), false);
});
