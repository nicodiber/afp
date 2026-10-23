// aep#2: pantalla inicial, navegación, destinos que todavía no existen, «Acerca de» y manifiesto.
// Los textos y valores esperados salen de la spec (aep harness/specs/2-base-instalable/spec.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const DESTINOS = ['Inicio', 'Movimientos', 'Cargar', 'Análisis', 'Ajustes'];

test('aep#2 CA-1 · en el celular: logotipo, barra inferior con los cinco destinos, Inicio marcado y pantalla sin datos', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  const cabecera = pagina.locator('header');
  assert.equal((await cabecera.innerText()).trim(), 'AFP');
  assert.ok(await cabecera.locator('img').isVisible(), 'se ve el ícono del brote');

  const nav = pagina.getByRole('navigation', { name: 'Principal' });
  const caja = await nav.boundingBox();
  assert.ok(caja.y + caja.height >= CELULAR.height - 2 && caja.y > CELULAR.height / 2, 'la barra está abajo');
  // Orden visual de izquierda a derecha.
  const enOrden = await nav.getByRole('link').evaluateAll((enlaces) => enlaces
    .map((a) => ({ nombre: a.innerText.trim() || a.getAttribute('aria-label'), x: a.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x).map((a) => a.nombre));
  assert.deepEqual(enOrden, DESTINOS);
  for (const nombre of DESTINOS) assert.ok(await nav.getByRole('link', { name: nombre }).isVisible(), nombre);

  const cargar = nav.getByRole('link', { name: 'Cargar' });
  const cajaCargar = await cargar.boundingBox();
  assert.ok(Math.abs(cajaCargar.width - 56) <= 1 && Math.abs(cajaCargar.height - 56) <= 1, 'Cargar es un botón redondo de 56 px');
  assert.equal(await cargar.evaluate((a) => getComputedStyle(a).borderRadius), '50%');

  const inicio = nav.getByRole('link', { name: 'Inicio' });
  assert.equal(await inicio.getAttribute('aria-current'), 'page');
  const pastilla = await inicio.locator('.nav-icono').evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.notEqual(pastilla, 'rgba(0, 0, 0, 0)', 'pastilla de color detrás del ícono del destino actual');
  const sinPastilla = await nav.getByRole('link', { name: 'Movimientos' }).locator('.nav-icono').evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.equal(sinPastilla, 'rgba(0, 0, 0, 0)');

  assert.match(await textoPrincipal(pagina), /Todavía no cargaste movimientos\./);
  assert.ok(await pagina.getByRole('link', { name: 'Cargar el primero' }).isVisible());
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'sin desplazamiento horizontal');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#2 CA-10 · Movimientos, Cargar, Análisis y «Cargar el primero» muestran el aviso y vuelven al inicio', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  const nav = pagina.getByRole('navigation', { name: 'Principal' });
  const casos = [
    [() => nav.getByRole('link', { name: 'Movimientos' }), 'Movimientos'],
    [() => nav.getByRole('link', { name: 'Cargar' }), 'Cargar'],
    [() => nav.getByRole('link', { name: 'Análisis' }), 'Análisis'],
    [() => pagina.getByRole('link', { name: 'Cargar el primero' }), 'Cargar'],
  ];
  for (const [boton, titulo] of casos) {
    await boton().click();
    await pagina.waitForFunction((t) => document.querySelector('main h1')?.textContent === t, titulo);
    assert.match(await textoPrincipal(pagina), /Esta parte llega en una próxima entrega\./, titulo);
    await pagina.getByRole('link', { name: 'Volver al inicio' }).click();
    await pagina.waitForFunction(() => /Todavía no cargaste movimientos\./.test(document.querySelector('main').innerText));
    assert.equal(await nav.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current'), 'page');
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#2 CA-7 · Ajustes → «Acerca de» muestra el nombre completo y la versión', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  await pagina.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Ajustes' }).click();
  await pagina.getByRole('heading', { name: 'Acerca de' }).waitFor();
  const texto = await textoPrincipal(pagina);
  assert.match(texto, /AFP · Administración Financiera Personal/);
  assert.match(texto, /Versión v0\.2\.0-1$/m, 'versión de la entrega actual (aep#12 CA-23)');
  assert.deepEqual(errores, []);
  await contexto.close();
});

// La parte «sin mover el contenido» de este criterio la reemplazó aep#3 CA-1 (D-101): se prueba en ajustes-base.test.js.
test('aep#2 CA-11 · en la PC: barra lateral compacta que se expande con el mouse o el teclado', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  const nav = pagina.getByRole('navigation', { name: 'Principal' });
  // Playwright arranca con el puntero en (0, 0), encima de la barra: se lo corre al contenido.
  await pagina.mouse.move(ESCRITORIO.width - 10, ESCRITORIO.height / 2);
  const compacta = await nav.boundingBox();
  assert.equal(compacta.x, 0, 'la barra está a la izquierda');
  assert.ok(compacta.width <= 96, `barra compacta (${compacta.width} px)`);
  assert.ok(compacta.height >= ESCRITORIO.height - 1, 'ocupa todo el alto');
  for (const nombre of DESTINOS) assert.equal(await nav.getByRole('link', { name: nombre }).count(), 1, `nombre accesible ${nombre}`);
  const nombreVisible = () => nav.locator('.nav-nombre').first().evaluate((e) => e.getBoundingClientRect().width > 1);
  assert.equal(await nombreVisible(), false, 'compacta: sin nombres a la vista');
  // «Cargar» abajo de todo.
  const ys = await nav.getByRole('link').evaluateAll((enlaces) => enlaces.map((a) => [a.innerText.trim() || a.getAttribute('aria-label'), a.getBoundingClientRect().y]));
  const cargarY = ys.find(([n]) => n === 'Cargar')[1];
  assert.ok(ys.every(([n, y]) => n === 'Cargar' || y < cargarY), 'Cargar abajo');

  await nav.hover();
  await pagina.waitForFunction(() => document.querySelector('nav').getBoundingClientRect().width > 200);
  assert.equal(await nombreVisible(), true, 'con el mouse: nombres a la vista');

  await pagina.mouse.move(ESCRITORIO.width - 10, ESCRITORIO.height / 2);
  await pagina.waitForFunction(() => document.querySelector('nav').getBoundingClientRect().width <= 96);
  await pagina.getByRole('link', { name: 'Inicio' }).focus();
  await pagina.keyboard.press('Tab');
  await pagina.waitForFunction(() => document.querySelector('nav').getBoundingClientRect().width > 200);
  assert.equal(await nombreVisible(), true, 'con el teclado: nombres a la vista');

  await pagina.setViewportSize({ width: 700, height: 800 });
  const angosta = await nav.boundingBox();
  assert.ok(angosta.y > 400 && angosta.width >= 699, 'con menos de 720 px, barra inferior');
  assert.deepEqual(errores, []);
  await contexto.close();
});

// La versión a probar y la real son dos apps distintas (aep#11, D-117, D-118): la de prueba se llama
// «AFP prueba» y usa los íconos con la franja ámbar; la real se llama «AFP» y está en /app/.
for (const caso of [
  { nombre: 'aep#2 CA-2 y aep#11 CA-1 · versión a probar', url: () => entorno.servidor.url, alcance: '/prueba/',
    nombreLargo: 'AFP prueba', nombreCorto: 'AFP prueba', iconos: 'iconos/prueba/' },
  { nombre: 'aep#11 CA-2 · versión real en /app/', url: () => entorno.servidor.urlReal, alcance: '/app/',
    nombreLargo: 'AFP · Administración Financiera Personal', nombreCorto: 'AFP', iconos: 'iconos/' },
]) test(`${caso.nombre}: manifiesto válido y sin errores de instalabilidad`, async () => {
  const perfil = await mkdtemp(join(tmpdir(), 'afp-instalable-'));
  const contexto = await chromium.launchPersistentContext(perfil, { viewport: CELULAR });
  try {
    const pagina = await contexto.newPage();
    await pagina.goto(caso.url());
    await pagina.waitForSelector('main h1');
    const manifiesto = await pagina.evaluate(async () => {
      const enlace = document.querySelector('link[rel="manifest"]');
      const datos = await (await fetch(enlace.href)).json();
      const absoluta = (u) => new URL(u, enlace.href).pathname;
      return { ...datos, scope: absoluta(datos.scope), start_url: absoluta(datos.start_url) };
    });
    assert.equal(manifiesto.name, caso.nombreLargo);
    assert.equal(manifiesto.short_name, caso.nombreCorto);
    assert.equal(manifiesto.display, 'standalone');
    assert.equal(manifiesto.scope, caso.alcance, 'alcance: la carpeta de esa versión en GitHub Pages');
    for (const icono of manifiesto.icons) assert.ok(icono.src.startsWith(caso.iconos) && !icono.src.slice(caso.iconos.length).includes('/'), `ícono de ${caso.iconos}: ${icono.src}`);
    const pestana = await pagina.evaluate(() => [...document.querySelectorAll('link[rel="icon"]')].map((l) => l.getAttribute('href')));
    assert.ok(pestana.length > 0 && pestana.every((h) => h.startsWith(caso.iconos) && !h.slice(caso.iconos.length).includes('/')), `pestaña con ${caso.iconos}: ${pestana}`);
    assert.ok(manifiesto.icons.some((i) => i.sizes === '512x512' && (i.purpose ?? 'any').split(' ').includes('any')), 'ícono de 512 px');
    assert.ok(manifiesto.icons.some((i) => i.sizes === '512x512' && (i.purpose ?? '').split(' ').includes('maskable')), 'ícono maskable');
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await contexto.newCDPSession(pagina);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installabilityErrors, []);
  } finally {
    await contexto.close();
    await rm(perfil, { recursive: true, force: true });
  }
});
