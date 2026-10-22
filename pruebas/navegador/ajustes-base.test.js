// aep#3: barra lateral que corre el contenido, columna centrada en la PC, color de la barra de Android
// y aviso de versión nueva. Valores esperados de la spec (aep harness/specs/3-ajustes-base/spec.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, ESCRITORIO, textoPrincipal } from './comun.mjs';
import { VERSION } from '../../src/version.js';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const anchoBarra = (pagina) => pagina.evaluate(() => document.querySelector('nav').getBoundingClientRect().width);
const xTitulo = (pagina) => pagina.evaluate(() => document.querySelector('main h1').getBoundingClientRect().x);

// Centro horizontal del título respecto del espacio a la derecha de la barra.
const desvioDelCentro = (pagina) => pagina.evaluate(() => {
  const barra = document.querySelector('nav').getBoundingClientRect();
  const columna = document.querySelector('main h1').getBoundingClientRect();
  return { desvio: columna.x + columna.width / 2 - (barra.right + (innerWidth - barra.right) / 2), libre: columna.x - barra.right };
});

for (const viewport of [ESCRITORIO, { width: 800, height: 800 }]) {
  test(`aep#3 CA-1 · en la PC (${viewport.width} px), la barra al abrirse corre el contenido, que queda centrado a su derecha, y al cerrarse vuelve`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport });
    const nav = pagina.getByRole('navigation', { name: 'Principal' });
    const lejos = () => pagina.mouse.move(viewport.width - 10, viewport.height / 2);
    await lejos();
    const barraCerrada = await anchoBarra(pagina);
    const tituloAntes = await xTitulo(pagina);
    const comprobarAbierta = async (como) => {
      await pagina.waitForFunction(() => document.querySelector('nav').getBoundingClientRect().width > 200);
      const { desvio, libre } = await desvioDelCentro(pagina);
      assert.ok(libre >= 0, `${como}: el contenido no queda debajo de la barra (${libre} px)`);
      assert.ok(Math.abs(desvio) <= 2, `${como}: centrado en el espacio que queda (desvío ${desvio} px)`);
      assert.ok(await xTitulo(pagina) > tituloAntes, `${como}: el contenido se corrió a la derecha`);
    };
    const comprobarCerrada = async (como) => {
      await pagina.waitForFunction((ancho) => document.querySelector('nav').getBoundingClientRect().width <= ancho, barraCerrada);
      assert.ok(Math.abs((await xTitulo(pagina)) - tituloAntes) <= 2, `${como}: vuelve a su lugar`);
    };

    await nav.hover();
    await comprobarAbierta('con el mouse');
    await lejos();
    await comprobarCerrada('con el mouse');

    await pagina.getByRole('link', { name: 'Ir al contenido' }).focus();
    await pagina.keyboard.press('Tab');
    await comprobarAbierta('con el teclado');
    await pagina.getByRole('link', { name: 'Cargar el primero' }).focus();
    await comprobarCerrada('con el teclado');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#3 CA-2 · en la PC, el contenido va en una columna de hasta 480 px centrada a la derecha de la barra', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  await pagina.mouse.move(ESCRITORIO.width - 10, ESCRITORIO.height / 2);
  const barra = await anchoBarra(pagina);
  const centroEsperado = barra + (ESCRITORIO.width - barra) / 2;
  const medir = (selector) => pagina.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { centro: r.x + r.width / 2, ancho: r.width }; }, selector);
  for (const [ruta, selectores] of [['#ajustes', ['.segmentado', 'main h1']], ['#inicio', ['main h1', '.vacio']], ['#movimientos', ['main h1', '.vacio']]]) {
    await pagina.goto(entorno.servidor.url + ruta);
    await pagina.waitForSelector('main h1');
    await pagina.mouse.move(ESCRITORIO.width - 10, ESCRITORIO.height / 2);
    for (const selector of selectores) {
      const { centro, ancho } = await medir(selector);
      assert.ok(Math.abs(centro - centroEsperado) <= 2, `${ruta} ${selector}: centro ${centro}, esperado ${centroEsperado}`);
      assert.ok(ancho <= 480, `${ruta} ${selector}: ancho ${ancho}`);
    }
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#3 CA-3 · el manifiesto pinta la barra de Android con el color de la barra en oscuro', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor);
  const manifiesto = await pagina.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(manifiesto.background_color, '#16251D');
  await contexto.close();
});

// La spec lo dice con v0.1.0-1 → v0.1.0-2; la prueba usa la versión actual y una anterior simulada,
// para seguir valiendo en cada entrega nueva.
test('aep#3 CA-4 · con la versión anterior activa, al publicarse la nueva aparece el aviso y «Actualizar» la instala', async () => {
  const VIEJA = 'v0.0.0-anterior';
  const anterior = (texto) => texto.replaceAll(VERSION, VIEJA);
  entorno.servidor.sustituir('/prueba/sw.js', anterior);
  entorno.servidor.sustituir('/prueba/src/version.js', anterior);
  try {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, {}, '#ajustes');
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.reload();
    await pagina.waitForSelector('main h1');
    assert.ok((await textoPrincipal(pagina)).includes(VIEJA), 'arranca en la versión anterior');
    assert.equal(await pagina.locator('.aviso-version').isVisible(), false);

    entorno.servidor.restaurar(); // Se publica la versión nueva.
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // AFP vuelve a quedar a la vista.
    await pagina.getByText('Hay una versión nueva').waitFor({ timeout: 15000 });
    await Promise.all([pagina.waitForEvent('load'), pagina.getByRole('button', { name: 'Actualizar' }).click()]);
    await pagina.waitForSelector('main h1');
    await pagina.goto(entorno.servidor.url + '#ajustes');
    await pagina.getByRole('heading', { name: 'Acerca de' }).waitFor();
    assert.ok((await textoPrincipal(pagina)).includes(VERSION));
    assert.deepEqual(errores, []);
    await contexto.close();
  } finally {
    entorno.servidor.restaurar();
  }
});
