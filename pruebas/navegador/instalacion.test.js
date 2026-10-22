// aep#4: sugerir la instalación al entrar (tarjeta en Inicio) y desde Ajustes; aviso de versión nueva en una línea.
// Textos esperados de la spec (aep harness/specs/4-sugerir-instalacion/spec.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const TEXTO = 'Abre más rápido, con su propio ícono, y funciona sin conexión.';
const YA_INSTALADA = 'Si ya la instalaste en este dispositivo, abrila desde su ícono.';
const PASOS_CELULAR = 'Tocá el menú ⋮ de Brave y elegí «Instalar app».';
const PASOS_PC = 'Tocá el ícono de instalar, a la derecha de la barra de direcciones.';

const tarjeta = (pagina) => pagina.getByRole('region', { name: 'Instalá AFP' });

// Simula lo que hace un navegador que ofrece instalar con un toque: dispara «beforeinstallprompt».
async function ofrecerUnToque(pagina, respuesta = 'accepted') {
  await pagina.evaluate((r) => {
    const evento = new Event('beforeinstallprompt', { cancelable: true });
    window.pedidoMostrado = false;
    evento.prompt = () => { window.pedidoMostrado = true; return Promise.resolve(); };
    evento.userChoice = Promise.resolve({ outcome: r });
    window.dispatchEvent(evento);
  }, respuesta);
}

test('aep#4 CA-1 y CA-4 · la tarjeta aparece arriba en Inicio y vuelve si no se tocó', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  await tarjeta(pagina).waitFor();
  const texto = await textoPrincipal(pagina);
  assert.ok(texto.indexOf('Instalá AFP') < texto.indexOf('Todavía no cargaste movimientos.'), 'arriba de la pantalla sin datos');
  assert.match(texto, new RegExp(TEXTO));
  assert.ok(await pagina.getByRole('button', { name: 'Ahora no' }).isVisible());
  await pagina.reload();
  await tarjeta(pagina).waitFor();
  await pagina.close();
  const otra = await contexto.newPage();
  await otra.goto(entorno.servidor.url);
  await tarjeta(otra).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#4 CA-2 · con un toque, «Instalar» abre el pedido del navegador y, si se acepta, la tarjeta no vuelve', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  await ofrecerUnToque(pagina);
  await tarjeta(pagina).getByRole('button', { name: 'Instalar' }).click();
  assert.equal(await pagina.evaluate(() => window.pedidoMostrado), true, 'se abrió el pedido del navegador');
  await tarjeta(pagina).waitFor({ state: 'detached' });
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  assert.equal(await tarjeta(pagina).count(), 0, 'no vuelve después de instalar');
  // En Ajustes, el botón también abre el pedido.
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await ofrecerUnToque(pagina, 'dismissed');
  await pagina.getByRole('button', { name: 'Instalar AFP' }).click();
  assert.equal(await pagina.evaluate(() => window.pedidoMostrado), true);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#4 CA-3 · «Ahora no» la saca y no vuelve; Ajustes sigue ofreciendo instalar', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor);
  await pagina.getByRole('button', { name: 'Ahora no' }).click();
  await tarjeta(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.evaluate(() => localStorage.getItem('afp-dev-sugerencia-instalacion')), 'descartada');
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  assert.equal(await tarjeta(pagina).count(), 0);
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('heading', { name: 'Instalación' }).waitFor();
  assert.match(await textoPrincipal(pagina), new RegExp(YA_INSTALADA));
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#4 CA-5 · abierta como app instalada: sin tarjeta y Ajustes lo dice', async () => {
  const contexto = await entorno.navegador.newContext({ viewport: CELULAR });
  // Chromium no emula «display-mode: standalone»: se simula la respuesta de matchMedia para esa consulta.
  await contexto.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (consulta) => (consulta.includes('display-mode: standalone')
      ? { matches: true, media: consulta, addEventListener() {}, removeEventListener() {} }
      : original(consulta));
  });
  const pagina = await contexto.newPage();
  await pagina.goto(entorno.servidor.url);
  await pagina.waitForSelector('main h1');
  assert.equal(await tarjeta(pagina).count(), 0);
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('heading', { name: 'Instalación' }).waitFor();
  assert.match(await textoPrincipal(pagina), /AFP está instalada en este dispositivo\./);
  assert.equal(await pagina.getByRole('button', { name: 'Instalar AFP' }).count(), 0);
  await contexto.close();
});

for (const [nombre, opciones, pasos] of [['celular', { viewport: CELULAR, userAgent: ANDROID }, PASOS_CELULAR], ['PC', { viewport: ESCRITORIO }, PASOS_PC]]) {
  test(`aep#4 CA-6 · sin un toque, la tarjeta y Ajustes muestran los pasos a mano (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, opciones);
    await tarjeta(pagina).waitFor();
    const enTarjeta = await tarjeta(pagina).innerText();
    assert.ok(enTarjeta.includes(pasos), enTarjeta);
    assert.ok(enTarjeta.includes(YA_INSTALADA));
    assert.equal(await tarjeta(pagina).getByRole('button', { name: 'Instalar' }).count(), 0, 'sin botón Instalar');
    await pagina.goto(entorno.servidor.url + '#ajustes');
    await pagina.getByRole('heading', { name: 'Instalación' }).waitFor();
    const enAjustes = await textoPrincipal(pagina);
    assert.ok(enAjustes.includes(pasos) && enAjustes.includes(YA_INSTALADA), enAjustes);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#4 CA-7 · en el celular, el aviso de versión nueva va en una sola línea', async () => {
  const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor);
  await pagina.evaluate(() => { document.querySelector('.aviso-version').hidden = false; });
  const lineas = await pagina.evaluate(() => {
    const texto = document.querySelector('.aviso-version span');
    return Math.round(texto.getBoundingClientRect().height / parseFloat(getComputedStyle(texto).lineHeight));
  });
  assert.equal(lineas, 1);
  const boton = await pagina.getByRole('button', { name: 'Actualizar' }).boundingBox();
  const texto = await pagina.locator('.aviso-version span').boundingBox();
  assert.ok(Math.abs((boton.y + boton.height / 2) - (texto.y + texto.height / 2)) <= 2, 'texto y botón en la misma línea');
  await contexto.close();
});
