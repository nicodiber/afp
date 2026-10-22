// aep#6 CA-5: «hoy» sale de la fecha simulada en modo prueba y del reloj del dispositivo fuera de él.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCasosModoPrueba } from '../../src/aplicacion/modo-prueba.js';

function preferenciasEnMemoria(inicial = {}) {
  const datos = { modoPrueba: null, fechaSimulada: null, ...inicial };
  return {
    leerModoPrueba: () => datos.modoPrueba,
    guardarModoPrueba: (v) => { datos.modoPrueba = v; },
    leerFechaSimulada: () => datos.fechaSimulada,
    guardarFechaSimulada: (v) => { datos.fechaSimulada = v; },
  };
}
const relojDelDispositivo = { hoy: () => '2026-10-22' };

test('aep#6 CA-5 · sin modo prueba, «hoy» es la fecha del dispositivo', () => {
  const casos = crearCasosModoPrueba({ preferencias: preferenciasEnMemoria(), relojDelDispositivo });
  assert.equal(casos.estado().activo, false);
  assert.equal(casos.reloj.hoy(), '2026-10-22');
});

test('aep#6 CA-5 · en modo prueba, «hoy» es la fecha simulada (31/10/2026 por defecto, después la elegida)', () => {
  const casos = crearCasosModoPrueba({ preferencias: preferenciasEnMemoria(), relojDelDispositivo });
  casos.activar();
  assert.deepEqual(casos.estado(), { activo: true, fechaSimulada: '2026-10-31' });
  assert.equal(casos.reloj.hoy(), '2026-10-31');
  casos.cambiarFecha('2026-11-15');
  assert.equal(casos.reloj.hoy(), '2026-11-15');
  casos.volverAFechaPorDefecto();
  assert.equal(casos.reloj.hoy(), '2026-10-31');
  casos.desactivar();
  assert.equal(casos.reloj.hoy(), '2026-10-22');
});

test('aep#6 CA-3 · una fecha inválida no se guarda', () => {
  const casos = crearCasosModoPrueba({ preferencias: preferenciasEnMemoria({ modoPrueba: 'si' }), relojDelDispositivo });
  assert.throws(() => casos.cambiarFecha('2026-02-30'));
  assert.equal(casos.reloj.hoy(), '2026-10-31');
});
