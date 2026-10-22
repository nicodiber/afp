// aep#4: cuándo sugerir la instalación y de qué forma. Casos escritos a mano a partir de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debeSugerirInstalacion, formaDeInstalar } from '../../src/dominio/instalacion.js';

test('aep#4 CA-1/CA-3/CA-4/CA-5 · la tarjeta aparece solo desde el navegador y hasta instalar o «Ahora no»', () => {
  const casos = [
    // [instalada (abierta como app), sugerencia guardada, ¿tarjeta?]
    [false, 'pendiente', true], // CA-1 y CA-4
    [false, null, true], // nunca se guardó nada: primera vez
    [false, 'descartada', false], // CA-3
    [true, 'pendiente', false], // CA-5
    [true, 'descartada', false],
    [false, 'otra-cosa', true], // valor desconocido cuenta como pendiente
  ];
  for (const [instalada, sugerencia, esperado] of casos) {
    assert.equal(debeSugerirInstalacion({ instalada, sugerencia }), esperado, `instalada=${instalada}, sugerencia=${sugerencia}`);
  }
});

test('aep#4 CA-2/CA-5/CA-6 · forma de instalar según el navegador y el dispositivo', () => {
  const casos = [
    // [instalada, con un toque, dispositivo, forma]
    [true, true, 'celular', 'instalada'],
    [true, false, 'pc', 'instalada'],
    [false, true, 'celular', 'un-toque'],
    [false, true, 'pc', 'un-toque'],
    [false, false, 'celular', 'pasos-celular'],
    [false, false, 'pc', 'pasos-pc'],
  ];
  for (const [instalada, conUnToque, dispositivo, esperado] of casos) {
    assert.equal(formaDeInstalar({ instalada, conUnToque, dispositivo }), esperado, `${instalada}/${conUnToque}/${dispositivo}`);
  }
});
