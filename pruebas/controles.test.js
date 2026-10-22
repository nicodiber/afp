// Pruebas de los controles del harness (aep#1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarCuerpo } from '../.github/scripts/control-spec.mjs';
import { revisar } from '../.github/scripts/control-privacidad.mjs';

const TABLA = '| CA | Evidencia |\n|---|---|\n| CA-1 | prueba `x.test.js` › «aep#1 CA-1» |\n';

test('aep#1 CA-4 un PR con spec y evidencia completa pasa', () => {
  assert.deepEqual(revisarCuerpo(`Resuelve nicodiber/aep#1\n\n${TABLA}`), []);
  assert.deepEqual(revisarCuerpo(`Parte de nicodiber/aep#7\n\n${TABLA}`), []);
});

test('aep#1 CA-4 un PR sin spec falla y dice qué falta', () => {
  const errores = revisarCuerpo(TABLA);
  assert.equal(errores.length, 1);
  assert.match(errores[0], /no cita su spec/);
});

test('aep#1 CA-4 un PR sin tabla o con un CA sin evidencia falla', () => {
  assert.match(revisarCuerpo('Resuelve nicodiber/aep#1').join(), /Falta la tabla/);
  const sinEvidencia = `Resuelve nicodiber/aep#1\n\n${TABLA}| CA-2 | … |\n`;
  assert.deepEqual(revisarCuerpo(sinEvidencia), ['CA-2 no tiene evidencia.']);
});

test('aep#1 CA-5 un término prohibido falla sin mostrar el término', () => {
  const errores = revisar([{ ruta: 'src/a.js', contenido: 'const banco = "Banco Inventado";' }], ['banco inventado']);
  assert.equal(errores.length, 1);
  assert.doesNotMatch(errores[0], /inventado/i);
  assert.match(errores[0], /src\/a\.js:1/);
});

test('aep#1 CA-5 un email personal falla; los genéricos no', () => {
  const personal = ['persona', 'gmail.com'].join('@');
  assert.equal(revisar([{ ruta: 'a.md', contenido: `contacto ${personal}` }]).length, 1);
  assert.deepEqual(revisar([{ ruta: 'a.md', contenido: 'Claude <noreply@anthropic.com>' }]), []);
});

test('aep#1 CA-5 un .csv fuera de datos-demo falla; dentro, no', () => {
  assert.equal(revisar([{ ruta: 'mis-datos.csv', contenido: null }]).length, 1);
  assert.deepEqual(revisar([{ ruta: 'datos-demo/v3-prueba-respuestas.csv', contenido: null }]), []);
});
