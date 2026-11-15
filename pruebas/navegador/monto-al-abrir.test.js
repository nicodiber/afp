// HU-42: al abrir Cargar en la PC el cursor queda en «Monto»; en el celular o con pantalla táctil, no (no se abre el teclado).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const enMonto = (pagina) => pagina.evaluate(() => document.activeElement?.name === 'monto' && document.activeElement.tagName === 'INPUT');
const montoEscrito = (pagina) => pagina.locator('input[name="monto"]').inputValue();
const hash = (pagina) => pagina.evaluate(() => location.hash);
const titulo = (pagina, texto) => pagina.locator('main h1').filter({ hasText: texto });
async function enInicio(opciones) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones);
  await r.pagina.locator('#titulo-tus-cuentas').waitFor();
  return r;
}

test('HU-42 CA-1 · PC: al abrir Cargar por el menú (con el botón ＋) el cursor está en «Monto» y lo que tecleás va ahí', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: ESCRITORIO });
  await pagina.locator('.nav-lista a[data-destino="cargar"]').click();
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  assert.equal(await enMonto(pagina), true);
  await pagina.keyboard.type('1500');
  assert.equal(await montoEscrito(pagina), '1.500');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-42 CA-1 · PC: con la tecla «c» desde Inicio el cursor está en «Monto», también el primer dígito apretado enseguida', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: ESCRITORIO });
  // La primera vez Cargar se carga recién al abrirse: se visita una vez y se vuelve a Inicio (Esc).
  await pagina.keyboard.press('c');
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.keyboard.press('Escape');
  await titulo(pagina, 'Inicio').waitFor();
  await pagina.keyboard.press('c');
  // Se espera a que la pantalla cambie (lo que una persona tarda entre «c» y el primer dígito); el primer dígito ya va al monto.
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  await pagina.keyboard.type('72');
  assert.equal(await enMonto(pagina), true);
  assert.equal(await montoEscrito(pagina), '72', 'los dígitos apretados enseguida van al monto');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-42 CA-1 · PC: la primera vez que se abre Cargar (el módulo se carga al abrirse), el cursor también queda en «Monto»', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: ESCRITORIO });
  await pagina.keyboard.press('c');
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  assert.equal(await enMonto(pagina), true, 'la primera vez (el módulo se carga al abrirse)');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-42 CA-2 · celular: al abrir Cargar el cursor no se pone solo en ningún campo (no se abre el teclado)', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: CELULAR });
  await pagina.locator('.nav-lista a[data-destino="cargar"]').click();
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  assert.equal(await pagina.evaluate(() => document.activeElement?.matches('input, select, textarea') ?? false), false);
  assert.equal(await montoEscrito(pagina), '');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-42 CA-2 · pantalla táctil ancha (tableta o PC táctil): tampoco se enfoca solo', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  assert.equal(await pagina.evaluate(() => matchMedia('(pointer: coarse)').matches && matchMedia('(min-width: 720px)').matches), true, 'el navegador de la prueba es táctil y ancho');
  await pagina.locator('.nav-lista a[data-destino="cargar"]').tap();
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  assert.equal(await pagina.evaluate(() => document.activeElement?.matches('input, select, textarea') ?? false), false);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-42 CA-3 · con el cursor en «Monto», el primer Esc saca el cursor y el segundo vuelve a la pantalla anterior', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: ESCRITORIO });
  await pagina.locator('.nav-lista a[data-destino="cargar"]').click();
  await titulo(pagina, 'Nuevo egreso').waitFor();
  await pagina.locator('input[name="monto"]').waitFor();
  assert.equal(await enMonto(pagina), true);
  await pagina.keyboard.type('300');
  await pagina.keyboard.press('Escape');
  assert.equal(await hash(pagina), '#cargar', 'el primer Esc solo saca el cursor');
  assert.equal(await enMonto(pagina), false);
  assert.equal(await montoEscrito(pagina), '300,00', 'lo escrito sigue ahí');
  await pagina.keyboard.press('Escape');
  await titulo(pagina, 'Inicio').waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});
