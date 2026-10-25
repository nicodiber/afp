// Ayudas compartidas por los recorridos de la app (aep#2 en adelante).
import { chromium } from 'playwright';
import { iniciarServidor } from '../servidor.mjs';

export const CELULAR = { width: 390, height: 844 };
export const ESCRITORIO = { width: 1280, height: 800 };

export async function prepararEntorno() {
  const servidor = await iniciarServidor();
  const navegador = await chromium.launch();
  return { servidor, navegador, cerrar: async () => { await navegador.close(); await servidor.cerrar(); } };
}

// Abre AFP en un contexto nuevo y junta los errores de la página y los pedidos de red.
// La base nueva ofrece la plantilla antes de Inicio (aep HU-01): salvo que la prueba lo pida con `bienvenida: true`,
// se elige «Empezar vacío» y se vuelve a la ruta pedida, como si la base ya tuviera su punto de partida.
export async function abrir(navegador, servidor, opciones = {}, ruta = '') {
  const { viewport = CELULAR, bienvenida = false, ...resto } = opciones;
  const contexto = await navegador.newContext({ viewport, reducedMotion: 'reduce', ...resto });
  const pedidos = [];
  contexto.on('request', (p) => pedidos.push(p.url()));
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.goto(servidor.url + ruta);
  await pagina.waitForSelector('main h1');
  if (!bienvenida) await pasarBienvenida(pagina, ruta);
  return { contexto, pagina, errores, pedidos };
}

/** Si AFP ofrece la plantilla, elige «Empezar vacío» y vuelve a `volverA` (un «#destino»). */
export async function pasarBienvenida(pagina, volverA = '') {
  await pagina.waitForSelector('main h1');
  const vacio = pagina.locator('#empezar-vacio');
  if (await vacio.count()) {
    await vacio.click();
    await pagina.locator('.navegacion').waitFor({ state: 'visible' });
    if (volverA) await pagina.evaluate((hash) => { location.hash = hash; }, volverA);
    await pagina.waitForSelector('main h1');
  }
}

/** Enciende el modo prueba desde Ajustes; la base de prueba nueva ofrece la plantilla y se elige «Empezar vacío». */
export async function activarModoPrueba(pagina, volverA = '#ajustes') {
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.locator('.franja-prueba').waitFor();
  await pasarBienvenida(pagina, volverA);
}

export const colorDeFondo = (pagina) => pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
export const colorDeTexto = (pagina) => pagina.evaluate(() => getComputedStyle(document.body).color);
export const textoPrincipal = (pagina) => pagina.evaluate(() => document.querySelector('main').innerText);
