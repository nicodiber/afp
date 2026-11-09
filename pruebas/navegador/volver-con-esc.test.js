// HU-35: Esc vuelve a la pantalla anterior hasta Inicio (solo en la PC). Recorridos en navegador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const ventana = (pagina) => pagina.locator('dialog[open]').last();
const hash = (pagina) => pagina.evaluate(() => location.hash);
const esperarHash = (pagina, esperado) => pagina.waitForFunction((h) => location.hash === h, esperado);
const titulo = (pagina) => pagina.locator('main h1');
// Abre AFP en Inicio y navega con la barra lateral, como lo haría una persona.
async function enInicio(viewport = ESCRITORIO) {
  const r = await abrir(entorno.navegador, entorno.servidor, { viewport });
  await r.pagina.locator('#titulo-tus-cuentas').waitFor();
  return r;
}
const ir = async (pagina, destino, nombre) => {
  await pagina.locator(`.nav-lista a[data-destino="${destino}"]`).click();
  await titulo(pagina).filter({ hasText: nombre }).waitFor();
};

test('HU-35 CA-1 · con historial, Esc vuelve paso a paso hasta Inicio y ahí no hace nada', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes', 'Ajustes');
  await ir(pagina, 'ajustes/categorias', 'Categorías');
  await ir(pagina, 'ajustes/monedas', 'Monedas');
  await pagina.keyboard.press('Escape');
  await esperarHash(pagina, '#ajustes/categorias');
  await pagina.keyboard.press('Escape');
  await esperarHash(pagina, '#ajustes');
  await pagina.keyboard.press('Escape');
  await esperarHash(pagina, '');
  await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(150);
  assert.equal(await hash(pagina), '', 'en Inicio no hace nada');
  assert.equal(await pagina.locator('main h1').innerText(), 'Inicio');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-1 · vuelve desde Cargar, Movimientos, Cuentas, Categorías, Monedas y Ajustes', async () => {
  const { contexto, pagina, errores } = await enInicio();
  for (const [destino, nombre] of [['cargar', 'Nuevo egreso'], ['movimientos', 'Movimientos'], ['ajustes/cuentas', 'Cuentas'], ['ajustes/categorias', 'Categorías'], ['ajustes/monedas', 'Monedas'], ['ajustes', 'Ajustes']]) {
    await ir(pagina, destino, nombre);
    await pagina.locator('main h1').focus();
    await pagina.keyboard.press('Escape');
    await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-1 · sin historial dentro de AFP, Esc va a la pantalla padre', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO }, '#ajustes/categorias');
  await titulo(pagina).filter({ hasText: 'Categorías' }).waitFor();
  const entradas = await pagina.evaluate(() => history.length);
  await pagina.keyboard.press('Escape');
  await titulo(pagina).filter({ hasText: 'Ajustes' }).waitFor();
  assert.equal(await hash(pagina), '#ajustes');
  await pagina.keyboard.press('Escape');
  await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  assert.equal(await hash(pagina), '#inicio');
  assert.equal(await pagina.evaluate(() => history.length), entradas, 'no se sumaron entradas: se reemplazaron');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-1 · el historial se conserva al recargar: Esc sigue yendo atrás', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes', 'Ajustes');
  await ir(pagina, 'ajustes/monedas', 'Monedas');
  await pagina.reload();
  await titulo(pagina).filter({ hasText: 'Monedas' }).waitFor();
  await pagina.keyboard.press('Escape');
  await esperarHash(pagina, '#ajustes');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-2 · una ventana abierta se cierra con Esc y no se vuelve; el siguiente Esc sí vuelve', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes/categorias', 'Categorías');
  await pagina.locator('#nueva-ingreso').click();
  await ventana(pagina).waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.locator('dialog[open]').waitFor({ state: 'detached' });
  assert.equal(await hash(pagina), '#ajustes/categorias', 'solo se cerró la ventana');
  await pagina.keyboard.press('Escape');
  await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-2 · un tooltip ⓘ abierto se cierra con Esc y no se vuelve', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes', 'Ajustes');
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await ir(pagina, 'ajustes/categorias', 'Categorías');
  await pagina.getByRole('button', { name: 'Qué significan las etiquetas de Aporte familiar' }).click();
  await pagina.locator('#globo-info:not([hidden])').waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.locator('#globo-info').waitFor({ state: 'hidden' });
  assert.equal(await hash(pagina), '#ajustes/categorias');
  await pagina.keyboard.press('Escape');
  await esperarHash(pagina, '#ajustes');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-2 · en Cargar, Esc equivale a «Cancelar» (vuelve sin guardar); con el foco en un campo, el primero lo suelta', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'cargar', 'Nuevo egreso');
  await pagina.getByLabel('Monto').fill('1234');
  await pagina.getByLabel('Descripción (opcional)').fill('Algo');
  assert.equal(await pagina.evaluate(() => document.activeElement.id.startsWith('egreso-descripcion')), true);
  await pagina.keyboard.press('Escape');
  assert.equal(await hash(pagina), '#cargar', 'el primer Esc solo saca el foco del campo');
  assert.equal(await pagina.evaluate(() => document.activeElement === document.body || !document.activeElement.matches('input')), true);
  assert.equal(await pagina.getByLabel('Monto').inputValue(), '1.234,00', 'lo escrito sigue ahí');
  await pagina.keyboard.press('Escape');
  await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  await ir(pagina, 'cargar', 'Nuevo egreso');
  assert.equal(await pagina.getByLabel('Monto').inputValue(), '', 'no se guardó nada ni se conservó lo escrito');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-2 · en el formulario de cuenta, Esc cancela como siempre y el siguiente vuelve', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes/cuentas', 'Cuentas');
  await pagina.getByRole('button', { name: /Crear la primera|Nueva cuenta/ }).click();
  await ventana(pagina).waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.locator('dialog[open]').waitFor({ state: 'detached' });
  assert.equal(await hash(pagina), '#ajustes/cuentas');
  await pagina.keyboard.press('Escape');
  await titulo(pagina).filter({ hasText: 'Inicio' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-2 · mantener Esc apretado no atraviesa varias pantallas', async () => {
  const { contexto, pagina, errores } = await enInicio();
  await ir(pagina, 'ajustes', 'Ajustes');
  await ir(pagina, 'ajustes/monedas', 'Monedas');
  await pagina.keyboard.down('Escape');
  await pagina.keyboard.down('Escape');
  await pagina.keyboard.down('Escape');
  await pagina.keyboard.up('Escape');
  await esperarHash(pagina, '#ajustes');
  await pagina.waitForTimeout(150);
  assert.equal(await hash(pagina), '#ajustes', 'las repeticiones se ignoran');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-35 CA-3 · en el celular, Esc no cambia nada', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR }, '#ajustes/monedas');
  await titulo(pagina).filter({ hasText: 'Monedas' }).waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(150);
  assert.equal(await hash(pagina), '#ajustes/monedas');
  assert.deepEqual(errores, []);
  await contexto.close();
});
