// aep#2 CA-3 y CA-4: tema claro y oscuro, con los colores del manual de marca (§3.1).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, colorDeFondo, colorDeTexto } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const OSCURO = { fondo: 'rgb(14, 26, 20)', texto: 'rgb(231, 243, 235)' }; // #0E1A14 y #E7F3EB
const CLARO = { fondo: 'rgb(242, 248, 243)', texto: 'rgb(17, 37, 27)' }; // #F2F8F3 y #11251B

test('aep#2 CA-3 · con el sistema en oscuro y «Como el sistema», AFP se ve en oscuro', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { colorScheme: 'dark' });
  assert.equal(await colorDeFondo(pagina), OSCURO.fondo);
  assert.equal(await colorDeTexto(pagina), OSCURO.texto);
  await pagina.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Ajustes' }).click();
  assert.equal(await pagina.getByRole('button', { name: 'Como el sistema' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#2 CA-3 · con el sistema en claro, AFP se ve en claro', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { colorScheme: 'light' });
  assert.equal(await colorDeFondo(pagina), CLARO.fondo);
  assert.equal(await colorDeTexto(pagina), CLARO.texto);
  await contexto.close();
});

test('aep#2 CA-4 · con el sistema en oscuro, «Claro» en Ajustes se recuerda al volver a abrir', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { colorScheme: 'dark' }, '#ajustes');
  await pagina.getByRole('button', { name: 'Claro' }).click();
  assert.equal(await pagina.getByRole('button', { name: 'Claro' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await colorDeFondo(pagina), CLARO.fondo, 'cambia en el momento');
  assert.equal(await pagina.evaluate(() => localStorage.getItem('afp-dev-tema')), 'claro', 'clave con el canal de la versión a probar');
  await pagina.close();

  const otra = await contexto.newPage();
  await otra.goto(entorno.servidor.url);
  await otra.waitForSelector('main h1');
  assert.equal(await colorDeFondo(otra), CLARO.fondo);
  // Y se puede volver a «Como el sistema».
  await otra.goto(entorno.servidor.url + '#ajustes');
  await otra.getByRole('button', { name: 'Como el sistema' }).click();
  assert.equal(await colorDeFondo(otra), OSCURO.fondo);
  assert.deepEqual(errores, []);
  await contexto.close();
});
