// aep#6 CA-6: nombre de la base de datos según el canal y el modo (modelo de datos §6.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreDeBase } from '../../src/adaptadores/canal.js';

test('aep#6 CA-6 · cuatro bases separadas', () => {
  assert.equal(nombreDeBase({ modoPrueba: false, ruta: '/afp/' }), 'afp');
  assert.equal(nombreDeBase({ modoPrueba: true, ruta: '/afp/' }), 'afp-prueba');
  assert.equal(nombreDeBase({ modoPrueba: false, ruta: '/afp/prueba/' }), 'afp-dev');
  assert.equal(nombreDeBase({ modoPrueba: true, ruta: '/afp/prueba/' }), 'afp-dev-prueba');
});
