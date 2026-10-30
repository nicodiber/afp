// HU-23: barra lateral en la PC con Cuentas, Categorías y Monedas; Ajustes sin esas filas en la PC y con ellas en el celular.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const nombresBarra = (pagina) => pagina.locator('.nav-lista li:not(.nav-item-cargar) a:visible .nav-nombre').allTextContents();
const marcados = (pagina) => pagina.locator('.nav-lista a[aria-current="page"]:visible .nav-nombre').allTextContents();

test('HU-23 CA-1 · en la PC la barra tiene los ítems en orden, con Ajustes y «Cargar» abajo', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  assert.deepEqual(await nombresBarra(pagina), ['Inicio', 'Movimientos', 'Análisis', 'Cuentas', 'Categorías', 'Monedas', 'Ajustes']);
  assert.equal(await pagina.locator('.nav-lista li:last-child a').getAttribute('href'), '#cargar');
  assert.equal(await pagina.getByText('Administrar').count(), 0, 'sin grupo «Administrar»');
  const y = (n) => pagina.locator('.nav-lista a', { hasText: n }).first().boundingBox().then((b) => b.y);
  assert.ok(await y('Ajustes') > await y('Monedas') && await y('Cargar') > await y('Ajustes'));
  // Angosta (solo íconos) y se abre con el mouse.
  await pagina.mouse.move(700, 400);
  assert.ok((await pagina.locator('.navegacion').boundingBox()).width < 100);
  await pagina.locator('.navegacion').hover();
  await pagina.waitForTimeout(100);
  assert.ok((await pagina.locator('.navegacion').boundingBox()).width > 200);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-23 CA-1 · cada ítem lleva a su pantalla y queda marcado, también en una subpantalla', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  for (const [ítem, hash, titulo] of [['Cuentas', '#ajustes/cuentas', 'Cuentas'], ['Categorías', '#ajustes/categorias', 'Categorías'], ['Monedas', '#ajustes/monedas', 'Monedas'], ['Ajustes', '#ajustes', 'Ajustes']]) {
    await pagina.locator('.nav-lista a', { hasText: ítem }).first().click();
    await pagina.getByRole('heading', { name: titulo, level: 1 }).waitFor();
    assert.equal(new URL(pagina.url()).hash, hash);
    assert.deepEqual(await marcados(pagina), [ítem]);
  }
  await pagina.goto(entorno.servidor.url + '#ajustes/cuentas');
  await pagina.locator('#boton-nueva-cuenta, .vacio-cuentas').first().waitFor();
  await pagina.locator('#boton-nueva-cuenta').click();
  assert.deepEqual(await marcados(pagina), ['Cuentas'], 'sigue marcado con la ventana de nueva cuenta');
  await contexto.close();
});

test('HU-23 CA-2 · en la PC Ajustes no tiene las filas Cuentas, Categorías y Monedas', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO }, '#ajustes');
  assert.equal(await pagina.locator('main a[href^="#ajustes/"]').count(), 0);
  await contexto.close();
});

test('HU-23 CA-2 · en el celular la barra no cambia y Ajustes conserva las tres filas', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR }, '#ajustes');
  assert.deepEqual(await nombresBarra(pagina), ['Inicio', 'Movimientos', 'Análisis', 'Ajustes']);
  assert.equal(await pagina.locator('.nav-lista li:nth-child(3) a').getAttribute('href'), '#cargar');
  assert.deepEqual(await pagina.locator('main a[href^="#ajustes/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))), ['#ajustes/cuentas', '#ajustes/categorias', '#ajustes/monedas']);
  assert.deepEqual(await marcados(pagina), ['Ajustes']);
  await pagina.locator('main a[href="#ajustes/monedas"]').click();
  await pagina.getByRole('heading', { name: 'Monedas', level: 1 }).waitFor();
  assert.deepEqual(await marcados(pagina), ['Ajustes']);
  await contexto.close();
});

test('HU-23 CA-2 · al cambiar el ancho de la ventana, Ajustes y la barra se adaptan sin recargar', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO }, '#ajustes');
  await pagina.evaluate(() => { window.marcaSinRecarga = 1; });
  assert.equal(await pagina.locator('main a[href^="#ajustes/"]').count(), 0);
  await pagina.setViewportSize(CELULAR);
  await pagina.locator('main a[href="#ajustes/cuentas"]').waitFor();
  assert.equal(await pagina.locator('.nav-lista a:visible').count(), 5);
  await pagina.setViewportSize(ESCRITORIO);
  await pagina.waitForFunction(() => document.querySelectorAll('main a[href^="#ajustes/"]').length === 0);
  assert.equal(await pagina.locator('.nav-lista a:visible').count(), 8);
  assert.equal(await pagina.evaluate(() => window.marcaSinRecarga), 1);
  await contexto.close();
});

test('HU-23 CA-3 · con Tab se recorre la barra en orden, el foco se ve y Enter navega', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  await pagina.locator('.saltar').focus();
  const recorrido = [];
  for (let i = 0; i < 8; i += 1) {
    await pagina.keyboard.press('Tab');
    recorrido.push(await pagina.evaluate(() => document.activeElement.querySelector('.nav-nombre')?.textContent));
  }
  assert.deepEqual(recorrido, ['Inicio', 'Movimientos', 'Análisis', 'Cuentas', 'Categorías', 'Monedas', 'Ajustes', 'Cargar']);
  const contorno = await pagina.evaluate(() => { const e = getComputedStyle(document.activeElement); return e.outlineStyle !== 'none' && parseFloat(e.outlineWidth) >= 2; });
  assert.ok(contorno, 'el foco se ve');
  await pagina.keyboard.down('Shift');
  for (let i = 0; i < 4; i += 1) await pagina.keyboard.press('Tab');
  await pagina.keyboard.up('Shift');
  assert.equal(await pagina.evaluate(() => document.activeElement.querySelector('.nav-nombre').textContent), 'Cuentas');
  await pagina.keyboard.press('Enter');
  await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
  assert.equal(new URL(pagina.url()).hash, '#ajustes/cuentas');
  await contexto.close();
});

for (const colorScheme of ['light', 'dark']) {
  test(`HU-23 CA-3 · axe-core sin problemas graves con la barra nueva (${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
    const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO, colorScheme, bypassCSP: true });
    for (const ruta of ['#inicio', '#ajustes', '#ajustes/cuentas', '#ajustes/categorias', '#ajustes/monedas']) {
      await pagina.goto(entorno.servidor.url + ruta);
      await pagina.waitForSelector('main h1');
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(graves, [], ruta);
    }
    await contexto.close();
  });
}
