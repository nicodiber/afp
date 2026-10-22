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
export async function abrir(navegador, servidor, opciones = {}, ruta = '') {
  const { viewport = CELULAR, ...resto } = opciones;
  const contexto = await navegador.newContext({ viewport, reducedMotion: 'reduce', ...resto });
  const pedidos = [];
  contexto.on('request', (p) => pedidos.push(p.url()));
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.goto(servidor.url + ruta);
  await pagina.waitForSelector('main h1');
  return { contexto, pagina, errores, pedidos };
}

export const colorDeFondo = (pagina) => pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
export const colorDeTexto = (pagina) => pagina.evaluate(() => getComputedStyle(document.body).color);
export const textoPrincipal = (pagina) => pagina.evaluate(() => document.querySelector('main').innerText);
