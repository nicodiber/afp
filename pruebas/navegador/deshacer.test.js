// HU-41: deshacer y rehacer en el navegador (celular 390×844 y PC). Valores esperados escritos a mano; hoy es 31/10/2026.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = '\u00a0'; // el espacio que no se corta entre el símbolo y el número
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');
const textoAviso = (pagina) => aviso(pagina).locator('.aviso-texto');
const botonAviso = (pagina) => aviso(pagina).getByRole('button');

async function enModoPrueba(opciones = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  return r;
}
const irAInicio = async (pagina) => { await pagina.goto(`${entorno.servidor.url}#inicio`); await pagina.locator('#titulo-tus-cuentas').waitFor(); };
const saldoDe = (pagina, id) => pagina.locator(`#tarjeta-${id} .tarjeta-cuenta-monto`).textContent();
const movimientosPropios = (pagina) => pagina.evaluate(() => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => {
    const g = p.result.transaction('movimientos').objectStore('movimientos').getAll();
    g.onsuccess = () => { p.result.close(); ok(g.result.filter((m) => m.origen !== 'datos_ejemplo').map((m) => [m.tipo, m.montoTotal, m.cuentaId])); };
  };
}));
const elegir = async (pagina, boton, buscar, nombreOpcion) => {
  await pagina.getByRole('button', { name: new RegExp(`^${boton}`) }).click();
  await ventana(pagina).getByRole('combobox').fill(buscar);
  await ventana(pagina).getByRole('option', { name: nombreOpcion }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
};
/** Carga un egreso de $ 12.500,00 en Banco (Alquiler) y guarda; vuelve a Inicio. */
async function cargarEgreso(pagina) {
  await irAInicio(pagina);
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.locator('.formulario-egreso').waitFor();
  await pagina.getByRole('textbox', { name: 'Monto', exact: true }).fill('12.500');
  await elegir(pagina, 'Categoría', 'alqui', 'Alquiler');
  await elegir(pagina, 'Cuenta', 'banco', 'Banco');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await textoAviso(pagina).filter({ hasText: 'Guardaste el egreso.' }).waitFor();
  await pagina.locator('#titulo-tus-cuentas').waitFor();
}

test('HU-41 CA-1 y CA-2 · PC: Ctrl + Z deshace el egreso, los saldos vuelven, y Ctrl + Y y Ctrl + Mayús + Z lo rehacen', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irAInicio(pagina);
  const antes = await saldoDe(pagina, 'cue-banco');
  await cargarEgreso(pagina);
  const despues = await saldoDe(pagina, 'cue-banco');
  assert.notEqual(despues, antes);
  assert.deepEqual(await movimientosPropios(pagina), [['egreso', 1250000, 'cue-banco']]);

  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste' }).waitFor();
  assert.equal(await textoAviso(pagina).textContent(), `Deshiciste: egreso de $${E}12.500,00 en Banco`);
  assert.equal(await saldoDe(pagina, 'cue-banco'), antes, 'el saldo de Inicio vuelve a como estaba');
  assert.deepEqual(await movimientosPropios(pagina), []);
  assert.match(pagina.url(), /#inicio$/, 'no cambia de pantalla');

  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'No hay nada para deshacer' }).waitFor();
  assert.equal(await botonAviso(pagina).isVisible(), false);

  await pagina.keyboard.press('Control+y');
  await textoAviso(pagina).filter({ hasText: 'Rehiciste' }).waitFor();
  assert.equal(await textoAviso(pagina).textContent(), `Rehiciste: egreso de $${E}12.500,00 en Banco`);
  assert.equal(await saldoDe(pagina, 'cue-banco'), despues);
  assert.deepEqual(await movimientosPropios(pagina), [['egreso', 1250000, 'cue-banco']]);

  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste' }).waitFor();
  await pagina.keyboard.press('Control+Shift+z');
  await textoAviso(pagina).filter({ hasText: 'Rehiciste' }).waitFor();
  assert.equal(await saldoDe(pagina, 'cue-banco'), despues);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-2 · PC: varios cambios se deshacen en orden inverso y uno nuevo borra lo rehacible', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await cargarEgreso(pagina);
  await cargarEgreso(pagina);
  assert.equal((await movimientosPropios(pagina)).length, 2);
  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste' }).waitFor();
  assert.equal((await movimientosPropios(pagina)).length, 1);
  await pagina.keyboard.press('Control+z');
  await pagina.waitForFunction(async () => (await new Promise((ok) => { const p = indexedDB.open('afp-dev-prueba'); p.onsuccess = () => { const g = p.result.transaction('movimientos').objectStore('movimientos').getAll(); g.onsuccess = () => { p.result.close(); ok(g.result.filter((m) => m.origen !== 'datos_ejemplo').length); }; }; })) === 0);
  await cargarEgreso(pagina);
  await pagina.keyboard.press('Control+y');
  await textoAviso(pagina).filter({ hasText: 'No hay nada para rehacer' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-1 · PC: crear una cuenta se deshace con Ctrl + Z y la cuenta desaparece de la lista', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
  await pagina.locator('#boton-nueva-cuenta').waitFor();
  const nombres = () => pagina.locator('ul[aria-labelledby="titulo-activas"] .fila-nombre > span:first-child').allTextContents();
  const inicial = await nombres();
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  const f = pagina.locator('form.formulario-cuenta').last();
  await f.getByLabel('Nombre').fill('ahorros');
  await f.getByRole('button', { name: 'Crear cuenta' }).click();
  await textoAviso(pagina).filter({ hasText: '¡Listo! Creaste la cuenta Ahorros.' }).waitFor();
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.deepEqual(await nombres(), [...inicial, 'Ahorros']);
  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste: creación de la cuenta Ahorros' }).waitFor();
  assert.deepEqual(await nombres(), inicial);
  await pagina.keyboard.press('Control+y');
  await textoAviso(pagina).filter({ hasText: 'Rehiciste: creación de la cuenta Ahorros' }).waitFor();
  assert.deepEqual(await nombres(), [...inicial, 'Ahorros']);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-1 · PC: archivar una categoría se deshace y vuelve a estar activa', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await pagina.goto(`${entorno.servidor.url}#ajustes/categorias`);
  await pagina.locator('#titulo-egreso').waitFor();
  await pagina.locator('#categoria-cat-vacaciones').click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await textoAviso(pagina).filter({ hasText: 'Archivaste Vacaciones.' }).waitFor();
  assert.equal(await pagina.locator('#categoria-cat-vacaciones').count(), 0);
  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste: archivo de la categoría Vacaciones' }).waitFor();
  await pagina.locator('#categoria-cat-vacaciones').waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-3 · celular: el aviso trae «Deshacer»; tocarlo deshace y ofrece «Rehacer»; sin teclado', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR, bypassCSP: true, hasTouch: true });
  await irAInicio(pagina);
  const antes = await saldoDe(pagina, 'cue-banco');
  await cargarEgreso(pagina);
  assert.equal(await botonAviso(pagina).textContent(), 'Deshacer');
  const caja = await botonAviso(pagina).boundingBox();
  assert.ok(caja.height >= 44 && caja.width >= 44, `objetivo táctil de ${caja.width}×${caja.height}`);
  // axe con el aviso y su botón a la vista.
  await pagina.addScriptTag({ path: AXE });
  const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
    .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
  assert.deepEqual(graves, []);
  await botonAviso(pagina).tap();
  await textoAviso(pagina).filter({ hasText: 'Deshiciste' }).waitFor();
  assert.equal(await textoAviso(pagina).textContent(), `Deshiciste: egreso de $${E}12.500,00 en Banco`);
  assert.equal(await saldoDe(pagina, 'cue-banco'), antes);
  assert.deepEqual(await movimientosPropios(pagina), []);
  assert.equal(await botonAviso(pagina).textContent(), 'Rehacer');
  await botonAviso(pagina).tap();
  await textoAviso(pagina).filter({ hasText: 'Rehiciste' }).waitFor();
  assert.deepEqual(await movimientosPropios(pagina), [['egreso', 1250000, 'cue-banco']]);
  assert.equal(await botonAviso(pagina).textContent(), 'Deshacer');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-3 · el aviso con «Deshacer» dura más de 6 s y espera mientras el mouse está encima', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await cargarEgreso(pagina);
  await pagina.waitForTimeout(6100);
  assert.equal(await aviso(pagina).isVisible(), true, 'a los 6,1 s sigue a la vista');
  const caja = await aviso(pagina).boundingBox();
  await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await pagina.waitForTimeout(2500);
  assert.equal(await aviso(pagina).isVisible(), true, 'con el mouse encima no se esconde');
  await pagina.mouse.move(5, 5);
  await aviso(pagina).waitFor({ state: 'hidden', timeout: 10000 });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-3 · el aviso espera también mientras el foco del teclado está en «Deshacer»', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await cargarEgreso(pagina);
  await pagina.keyboard.press('Shift'); // la última interacción es del teclado: el foco se ve
  await botonAviso(pagina).focus();
  await pagina.waitForTimeout(7600);
  assert.equal(await aviso(pagina).isVisible(), true, 'con el foco en el botón no se esconde');
  await pagina.evaluate(() => document.activeElement.blur());
  await aviso(pagina).waitFor({ state: 'hidden', timeout: 10000 });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 CA-4 · con el cursor en un campo de texto, Ctrl + Z no toca el último cambio guardado (lo maneja el navegador)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await cargarEgreso(pagina);
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.locator('.formulario-egreso').waitFor();
  await pagina.evaluate(() => { window.__prevenido = null; window.addEventListener('keydown', (e) => { if (e.key === 'z') window.__prevenido = e.defaultPrevented; }); });
  const monto = pagina.getByRole('textbox', { name: 'Monto', exact: true });
  await monto.click();
  await monto.pressSequentially('123');
  await pagina.keyboard.press('Control+z');
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.evaluate(() => window.__prevenido), false, 'AFP deja pasar la tecla');
  assert.deepEqual(await movimientosPropios(pagina), [['egreso', 1250000, 'cue-banco']], 'el movimiento guardado sigue ahí');
  assert.equal(await pagina.locator('#aviso-breve .aviso-texto').filter({ hasText: 'Deshiciste' }).count(), 0);
  // Con el foco fuera del campo, la misma tecla sí deshace el último cambio guardado.
  await pagina.evaluate(() => document.activeElement.blur());
  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'Deshiciste' }).waitFor();
  assert.deepEqual(await movimientosPropios(pagina), []);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-41 · cargar los datos de ejemplo vacía la pila; la ayuda de Cargar nombra «Ctrl + Z deshace»', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await cargarEgreso(pagina);
  await pagina.goto(`${entorno.servidor.url}#ajustes`);
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
  await ventana(pagina).getByRole('button', { name: 'Restablecer' }).click();
  await textoAviso(pagina).filter({ hasText: 'Cargaste los datos de ejemplo.' }).waitFor();
  await pagina.keyboard.press('Control+z');
  await textoAviso(pagina).filter({ hasText: 'No hay nada para deshacer' }).waitFor();
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  assert.match(await pagina.locator('.atajos').innerText(), /Ctrl \+ Z deshace/);
  assert.deepEqual(errores, []);
  await contexto.close();
});
