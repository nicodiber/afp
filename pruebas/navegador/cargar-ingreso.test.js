// HU-03: registrar un ingreso en el navegador (celular 390×844 y PC). Valores esperados escritos a mano a partir de la
// historia y de los datos de ejemplo (Banco: $ 800.000,00 al 01/08/2026 más los movimientos de ejemplo de HU-38; Hoy = 31/10/2026).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const E = '\u00a0';
const ACENTO = 'rgb(17, 99, 61)'; // --color-acento (claro)
const ERROR = 'rgb(174, 70, 48)'; // --color-error (claro)
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VIEWPORTS = [['celular', CELULAR], ['PC', ESCRITORIO]];
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');

async function enModoPrueba(opciones = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  return r;
}
async function abrirCarga(pagina) {
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
  await pagina.locator('.formulario-egreso').waitFor();
}
const grupoTipo = (pagina) => pagina.getByRole('group', { name: 'Tipo de movimiento' });
const botonTipo = (pagina, nombre) => grupoTipo(pagina).getByRole('button', { name: nombre, exact: true });
const elegirTipo = (pagina, nombre) => botonTipo(pagina, nombre).click();
const campo = (pagina, nombre) => pagina.getByRole('textbox', { name: nombre, exact: true });
const colorMonto = (pagina) => campo(pagina, 'Monto').evaluate((e) => getComputedStyle(e).color);
const opciones = (pagina) => ventana(pagina).getByRole('option').allTextContents();
async function elegir(pagina, boton, buscar, nombreOpcion) {
  await pagina.getByRole('button', { name: new RegExp(`^${boton}`) }).click();
  await ventana(pagina).getByRole('combobox').fill(buscar);
  await ventana(pagina).getByRole('option', { name: nombreOpcion }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
}
const movimientosGuardados = (pagina) => pagina.evaluate(() => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => {
    const db = p.result;
    const g = db.transaction('movimientos').objectStore('movimientos').getAll();
    g.onsuccess = () => { db.close(); ok(g.result); };
  };
}));
// Los que cargó la persona; los 61 de los datos de ejemplo (origen datos_ejemplo, HU-38) quedan afuera.
const movimientosPropios = async (pagina) => (await movimientosGuardados(pagina)).filter((m) => m.origen !== 'datos_ejemplo');
const saldoEnInicio = (pagina, id) => pagina.locator(`#tarjeta-${id} .tarjeta-cuenta-monto`).textContent();
const sinDesplazamientoHorizontal = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-03 CA-1 · pestañas «Egreso | Ingreso» debajo del título: cambian título, color del monto y categorías (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    // Al abrir: Egreso elegido, monto en rojo (color de error).
    assert.deepEqual(await grupoTipo(pagina).getByRole('button').allTextContents(), ['Egreso', 'Ingreso']);
    assert.equal(await botonTipo(pagina, 'Egreso').getAttribute('aria-pressed'), 'true');
    assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'false');
    assert.equal(await colorMonto(pagina), ERROR);
    const cajaTitulo = await pagina.locator('h1').boundingBox();
    const cajaTipo = await grupoTipo(pagina).boundingBox();
    assert.ok(cajaTipo.y >= cajaTitulo.y + cajaTitulo.height, 'el segmentado va debajo del título');
    assert.ok(await botonTipo(pagina, 'Egreso').evaluate((b) => b.getBoundingClientRect().height) >= 44, 'objetivo táctil de 44 px');
    // Con una categoría de egreso elegida, al pasar a Ingreso se borra.
    await elegir(pagina, 'Categoría', 'salud', 'Salud');
    assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), '🩺 Salud');
    await elegirTipo(pagina, 'Ingreso');
    await pagina.getByRole('heading', { name: 'Nuevo ingreso', level: 1 }).waitFor();
    assert.equal(await pagina.title(), 'Nuevo ingreso · AFP');
    assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'true');
    assert.equal(await colorMonto(pagina), ACENTO);
    assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), 'Elegir…', 'la categoría de egreso se borró');
    // La ventana de categorías muestra las de ingresos, con su ícono.
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    assert.deepEqual(await opciones(pagina), ['💼Trabajo', '🏷️Ventas', '💹Rendimientos', '👪Aporte familiar', '🎀Regalos recibidos', '💵Sueldo', '🧰Trabajos independientes›', '🤝Ayuda familiar', '🎁Regalos y Reintegros', '＋ Nueva categoría']);
    await ventana(pagina).getByRole('button', { name: 'Cerrar' }).click();
    // Y vuelve a Egreso.
    await elegirTipo(pagina, 'Egreso');
    await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
    assert.equal(await colorMonto(pagina), ERROR);
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    assert.deepEqual(await opciones(pagina), ['🏠Vivienda›', '🍽️Alimentación›', '🚌Transporte›', '🎉Ocio›', '🩺Salud', '＋ Nueva categoría']);
    await ventana(pagina).getByRole('button', { name: 'Cerrar' }).click();
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-03 CA-3 · guardar un ingreso: aviso con el saldo, el saldo sube y queda como ingreso (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await pagina.goto(`${entorno.servidor.url}#inicio`);
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal(await saldoEnInicio(pagina, 'cue-banco'), `$${E}2.411.200,00`);
    await abrirCarga(pagina);
    await elegirTipo(pagina, 'Ingreso');
    await campo(pagina, 'Monto').fill('150000');
    await campo(pagina, 'Descripción (opcional)').fill('sueldo de octubre');
    await elegir(pagina, 'Categoría', 'trab', /Trabajo$/);
    await elegir(pagina, 'Cuenta', 'banc', /^Banco/);
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await aviso(pagina).filter({ hasText: `Guardaste el ingreso. Saldo de Banco: $${E}2.561.200,00.` }).waitFor();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal(await saldoEnInicio(pagina, 'cue-banco'), `$${E}2.561.200,00`);
    const guardados = await movimientosPropios(pagina);
    assert.equal(guardados.length, 1);
    const m = guardados[0];
    assert.deepEqual(
      [m.tipo, m.estado, m.origen, m.fecha, m.montoTotal, m.descripcion, m.cuentaId, m.asientos, m.partes.map((p) => [p.categoriaId, p.monto, p.naturaleza])],
      ['ingreso', 'confirmado', 'manual', '2026-10-31', 15000000, 'Sueldo de octubre', 'cue-banco', [{ cuentaId: 'cue-banco', monto: 15000000 }], [['cat-trabajo', 15000000, 'ganado']]],
    );
    assert.match(m.hora, /^\d\d:\d\d$/, 'se guarda con la hora');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-03 CA-3 · mismas validaciones: sin monto, categoría ni cuenta no guarda; una categoría de egreso no entra', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Ingreso');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|') === 'Escribí un monto mayor que 0.|Elegí una categoría.|Elegí una cuenta.');
  assert.equal((await movimientosPropios(pagina)).length, 0);
  // Cambiar de tipo quita solo el error de la categoría.
  await elegirTipo(pagina, 'Egreso');
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|') === 'Escribí un monto mayor que 0.|Elegí una cuenta.');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-03 CA-2 · al abrir Cargar siempre aparece Egreso, y «Guardar y cargar otro» conserva el tipo', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Ingreso');
  await campo(pagina, 'Monto').fill('1000');
  await elegir(pagina, 'Categoría', 'vent', /Ventas/);
  await elegir(pagina, 'Cuenta', 'caja', /^Caja/);
  await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
  await aviso(pagina).filter({ hasText: `Guardaste el ingreso. Saldo de Caja: $${E}159.900,00.` }).waitFor();
  // La pantalla queda vacía, pero sigue siendo un ingreso.
  assert.equal(await campo(pagina, 'Monto').inputValue(), '');
  assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), 'Elegir…');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).textContent(), 'Nuevo ingreso');
  assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'true');
  assert.equal(await colorMonto(pagina), ACENTO);
  // Ctrl+Mayús+Enter también conserva el tipo.
  await campo(pagina, 'Monto').fill('500');
  await elegir(pagina, 'Categoría', 'rend', /Rendimientos/);
  await elegir(pagina, 'Cuenta', 'caja', /^Caja/);
  await pagina.keyboard.press('Control+Shift+Enter');
  await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}160.400,00.` }).waitFor();
  assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'true');
  // Ctrl+Enter guarda y vuelve atrás.
  await campo(pagina, 'Monto').fill('250');
  await elegir(pagina, 'Categoría', 'trab', /Trabajo$/);
  await elegir(pagina, 'Cuenta', 'caja', /^Caja/);
  await pagina.keyboard.press('Control+Enter');
  await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}160.650,00.` }).waitFor();
  assert.equal(new URL(pagina.url()).hash, '#ajustes', 'vuelve a la pantalla anterior (Ajustes, de donde se vino)');
  // Al volver a abrir Cargar, otra vez Egreso.
  await abrirCarga(pagina);
  assert.equal(await botonTipo(pagina, 'Egreso').getAttribute('aria-pressed'), 'true');
  assert.equal(await colorMonto(pagina), ERROR);
  assert.deepEqual((await movimientosPropios(pagina)).map((m) => [m.tipo, m.montoTotal]).sort((a, b) => a[1] - b[1]), [['ingreso', 25000], ['ingreso', 50000], ['ingreso', 100000]]);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-03 CA-1 · con el teclado en la PC: ← y → cambian de tipo y ↑/↓ incluyen el segmentado antes de la fecha; no hay atajos e/i', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await botonTipo(pagina, 'Egreso').focus();
  await pagina.keyboard.press('ArrowRight');
  await pagina.getByRole('heading', { name: 'Nuevo ingreso', level: 1 }).waitFor();
  assert.equal(await botonTipo(pagina, 'Ingreso').evaluate((b) => b === document.activeElement), true, 'el foco acompaña al tipo elegido');
  assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'true');
  await pagina.keyboard.press('ArrowRight'); // no hay más a la derecha
  assert.equal(await botonTipo(pagina, 'Ingreso').getAttribute('aria-pressed'), 'true');
  await pagina.keyboard.press('ArrowLeft');
  await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
  assert.equal(await botonTipo(pagina, 'Egreso').evaluate((b) => b === document.activeElement), true);
  // ↓ va a la fecha; ↑ desde la fecha vuelve al segmentado.
  await pagina.keyboard.press('ArrowDown');
  assert.equal(await pagina.evaluate(() => document.activeElement.type), 'date');
  await pagina.keyboard.press('ArrowUp');
  assert.equal(await botonTipo(pagina, 'Egreso').evaluate((b) => b === document.activeElement), true);
  // Sin atajos «e» ni «i»: escribir en el segmentado no cambia nada.
  await pagina.keyboard.press('i');
  assert.equal(await botonTipo(pagina, 'Egreso').getAttribute('aria-pressed'), 'true');
  // Tab entra al segmentado una sola vez (solo el elegido) y sigue a la fecha.
  await pagina.keyboard.press('Tab');
  assert.equal(await pagina.evaluate(() => document.activeElement.type), 'date');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-03 CA-3 · sin conexión funciona, y al cerrar y volver a abrir AFP el ingreso y el saldo siguen (celular)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.locator('.franja-prueba').waitFor();
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Ingreso');
  await campo(pagina, 'Monto').fill('150000');
  await elegir(pagina, 'Categoría', 'trab', /Trabajo$/);
  await elegir(pagina, 'Cuenta', 'banc', /^Banco/);
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await aviso(pagina).filter({ hasText: `Guardaste el ingreso. Saldo de Banco: $${E}2.561.200,00.` }).waitFor();
  await pagina.close();
  const nueva = await contexto.newPage();
  await nueva.goto(`${entorno.servidor.url}#inicio`);
  await nueva.locator('#tarjeta-cue-banco').waitFor();
  assert.equal(await saldoEnInicio(nueva, 'cue-banco'), `$${E}2.561.200,00`);
  assert.equal((await movimientosPropios(nueva))[0].tipo, 'ingreso');
  await contexto.setOffline(false);
  assert.deepEqual(errores, []);
  await contexto.close();
});
