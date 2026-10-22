// aep#2 CA-5 y CA-6: abre sin conexión y no pide nada fuera del propio sitio.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, colorDeFondo, textoPrincipal } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

for (const [nombre, viewport] of [['celular', CELULAR], ['escritorio', ESCRITORIO]]) {
  test(`aep#2 CA-5 · abre sin conexión y en el tema elegido (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport, colorScheme: 'light' }, '#ajustes');
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.getByRole('button', { name: 'Oscuro' }).click();
    await contexto.setOffline(true);
    await pagina.goto(entorno.servidor.url);
    await pagina.waitForSelector('main h1');
    assert.match(await textoPrincipal(pagina), /Todavía no cargaste movimientos\./);
    assert.equal(await colorDeFondo(pagina), 'rgb(14, 26, 20)');
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).fontFamily.split(',')[0].replace(/['"]/g, '')), 'Figtree');
    assert.equal(await pagina.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Figtree'); }), true, 'la tipografía también está guardada');
    await pagina.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Ajustes' }).click();
    await pagina.getByRole('heading', { name: 'Acerca de' }).waitFor();
    await contexto.setOffline(false);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#2 CA-6 · todos los pedidos van al mismo origen', async () => {
  const { contexto, pagina, pedidos, errores } = await abrir(entorno.navegador, entorno.servidor);
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  const nav = pagina.getByRole('navigation', { name: 'Principal' });
  for (const nombre of ['Movimientos', 'Cargar', 'Análisis', 'Ajustes', 'Inicio']) await nav.getByRole('link', { name: nombre }).click();
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  const origen = new URL(entorno.servidor.url).origin;
  const externos = pedidos.filter((u) => !u.startsWith('data:') && new URL(u).origin !== origen);
  assert.ok(pedidos.length > 0);
  assert.deepEqual(externos, []);
  assert.deepEqual(errores, []);
  await contexto.close();
});
