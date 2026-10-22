// aep#2 CA-3 y CA-4: qué tema se ve según la elección de Ajustes y el tema del sistema.
// Valores esperados escritos a mano a partir de la spec (no se calculan con el código que se prueba).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMAS, normalizarTema, resolverTema } from '../../src/dominio/tema.js';

test('aep#2 CA-3/CA-4 · las tres opciones de Ajustes', () => {
  assert.deepEqual(TEMAS, ['claro', 'oscuro', 'sistema']);
});

test('aep#2 CA-3/CA-4 · tema que se ve según la elección y el sistema', () => {
  const casos = [
    // [elección, sistema oscuro, tema que se ve]
    ['sistema', true, 'oscuro'], // CA-3
    ['sistema', false, 'claro'],
    ['claro', true, 'claro'], // CA-4
    ['claro', false, 'claro'],
    ['oscuro', true, 'oscuro'],
    ['oscuro', false, 'oscuro'],
  ];
  for (const [eleccion, sistemaOscuro, esperado] of casos) {
    assert.equal(resolverTema(eleccion, sistemaOscuro), esperado, `${eleccion} con sistema ${sistemaOscuro ? 'oscuro' : 'claro'}`);
  }
});

test('aep#2 CA-3 · sin elección guardada o con un valor desconocido, sigue al sistema', () => {
  assert.equal(normalizarTema(null), 'sistema');
  assert.equal(normalizarTema(undefined), 'sistema');
  assert.equal(normalizarTema('azul'), 'sistema');
  assert.equal(normalizarTema('oscuro'), 'oscuro');
  assert.equal(resolverTema('azul', true), 'oscuro');
});
