// HU-02: Nuevo egreso en el navegador (celular 390×844 y PC). Valores esperados escritos a mano a partir de la
// historia y de los datos de ejemplo de 05-roadmap.md §5.1 (Banco: $ 800.000,00 al 01/09/2026).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = ' ';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VIEWPORTS = [['celular', CELULAR], ['PC', ESCRITORIO]];
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');

/** Abre AFP en modo prueba (base afp-dev-prueba) con los datos de ejemplo. Hoy es 31/10/2026. */
async function enModoPrueba(opciones = {}, { cargar = true } = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  if (cargar) {
    await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  }
  return r;
}
const irAInicio = async (pagina) => { await pagina.goto(`${entorno.servidor.url}#inicio`); await pagina.locator('#titulo-tus-cuentas').waitFor(); };
/** Abre «Nuevo egreso» con el botón «Cargar» de la barra, como lo haría la persona. */
async function abrirCarga(pagina) {
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
  await pagina.locator('.formulario-egreso').waitFor();
}
const campo = (pagina, nombre) => pagina.getByRole('textbox', { name: nombre, exact: true });
const opcion = (pagina, nombre) => ventana(pagina).getByRole('option', { name: nombre });

/** Elige en una de las ventanas de selección. */
async function elegir(pagina, boton, buscar, nombreOpcion) {
  await pagina.getByRole('button', { name: new RegExp(`^${boton}`) }).click();
  await ventana(pagina).getByRole('combobox').fill(buscar);
  await opcion(pagina, nombreOpcion).click();
  await ventana(pagina).waitFor({ state: 'detached' });
}
async function completar(pagina, { monto, descripcion, categoria, cuenta }) {
  if (monto !== undefined) await campo(pagina, 'Monto').fill(monto);
  if (descripcion !== undefined) await campo(pagina, 'Descripción (opcional)').fill(descripcion);
  if (categoria) await elegir(pagina, 'Categoría', categoria[0], categoria[1]);
  if (cuenta) await elegir(pagina, 'Cuenta', cuenta[0], cuenta[1]);
}
const movimientosGuardados = (pagina, base = 'afp-dev-prueba') => pagina.evaluate((nombre) => new Promise((ok) => {
  const p = indexedDB.open(nombre);
  p.onsuccess = () => {
    const db = p.result;
    if (!db.objectStoreNames.contains('movimientos')) { db.close(); ok(null); return; }
    const g = db.transaction('movimientos').objectStore('movimientos').getAll();
    g.onsuccess = () => { db.close(); ok(g.result); };
  };
}), base);
// Las reglas de la carga se cargan al guardar por primera vez: se espera a que aparezcan los mensajes.
const mensajesSon = (pagina, esperados) => pagina.waitForFunction((e) => JSON.stringify([...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent)) === JSON.stringify(e), esperados);
const saldoEnInicio = async (pagina, id) => (await pagina.locator(`#tarjeta-${id} .tarjeta-cuenta-monto`).textContent());
const sinDesplazamientoHorizontal = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-02 CA-1 · «Cargar» abre una pantalla propia «Nuevo egreso» con los campos en orden (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irAInicio(pagina);
    await abrirCarga(pagina);
    assert.equal(new URL(pagina.url()).hash, '#cargar');
    assert.equal(await pagina.title(), 'Nuevo egreso · AFP');
    // Orden de los campos: Fecha, Hora, Monto, Descripción, Categoría, Cuenta.
    const rotulos = await pagina.locator('.formulario-egreso .campo > label').allTextContents();
    assert.deepEqual(rotulos, ['Fecha', 'Hora', 'Monto', 'Descripción (opcional)', 'Categoría', 'Cuenta']);
    assert.equal(await pagina.locator('.fecha-texto').textContent(), 'Hoy · 31/10/2026');
    assert.equal(await pagina.locator('input[type="date"]').inputValue(), '2026-10-31');
    assert.equal(await pagina.locator('input[type="date"]').getAttribute('max'), '2026-10-31', 'no se aceptan fechas posteriores a hoy');
    // Categoría y cuenta no son listas desplegables: son botones.
    assert.equal(await pagina.locator('select').count(), 0);
    assert.equal(await pagina.getByRole('button', { name: /^Categoría/ }).count(), 1);
    assert.equal(await pagina.getByRole('button', { name: /^Cuenta/ }).count(), 1);
    // Tres botones abajo, en este orden.
    assert.deepEqual(await pagina.locator('.acciones-carga button').allTextContents(), ['Cancelar', 'Guardar y cargar otro', 'Guardar']);
    // En el celular ocupa toda la pantalla (sin barra de abajo); en la PC queda la barra lateral.
    assert.equal(await pagina.locator('nav.navegacion').isVisible(), nombre === 'PC');
    assert.equal(await pagina.locator('.atajos').isVisible(), nombre === 'PC', 'los atajos se muestran solo en la PC');
    assert.ok(await sinDesplazamientoHorizontal(pagina), 'sin desplazamiento horizontal');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-1 · la ventana de categorías: solo hojas de egresos, por familia en orden, con buscador (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    const v = ventana(pagina);
    assert.equal(await v.getByRole('combobox').evaluate((e) => e === document.activeElement), true, 'el foco queda en el buscador');
    // HU-02b CA-2: sin buscar, el primer nivel del árbol (familias con › y categorías sueltas) con su ícono.
    const nivel = () => v.getByRole('option').allTextContents();
    assert.deepEqual(await nivel(), ['🏠Vivienda›', '🍽️Alimentación›', '🚌Transporte›', '🎉Ocio›', '🩺Salud']);
    const altos = await v.getByRole('option').evaluateAll((os) => os.map((o) => o.getBoundingClientRect().height));
    assert.equal(altos.length, 5);
    assert.ok(altos.every((alto) => alto >= 44), `alto mínimo ${Math.min(...altos)}`);
    // Tocar una familia muestra sus subcategorías con «‹ Atrás»; el foco sigue en el buscador.
    await opcion(pagina, 'Alimentación').click();
    assert.deepEqual(await nivel(), ['🛒Supermercado', '🥦Verdulería', '🍬Kiosco']);
    assert.equal(await v.getByRole('combobox').evaluate((e) => e === document.activeElement), true);
    await v.getByRole('button', { name: '‹ Atrás' }).click();
    assert.deepEqual(await nivel(), ['🏠Vivienda›', '🍽️Alimentación›', '🚌Transporte›', '🎉Ocio›', '🩺Salud']);
    assert.equal(await v.getByRole('button', { name: '‹ Atrás' }).count(), 0, 'en el primer nivel no hay «Atrás»');
    // El buscador filtra mientras se escribe, sin distinguir tildes ni mayúsculas, entre todas las hojas.
    await v.getByRole('combobox').pressSequentially('verdul');
    assert.deepEqual(await nivel(), ['🥦Verdulería']);
    await v.getByRole('combobox').fill('ALIMENTACION');
    assert.deepEqual(await nivel(), ['🛒Supermercado', '🥦Verdulería', '🍬Kiosco'], 'también por familia');
    await v.getByRole('combobox').fill('zzz');
    assert.equal(await v.getByRole('status').textContent(), 'No hay resultados para «zzz».');
    await v.getByRole('combobox').fill('');
    assert.equal((await nivel()).length, 5, 'sin texto, vuelve el primer nivel');
    // Una categoría sin hijas se elige directo.
    await opcion(pagina, 'Salud').click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), '🩺 Salud');
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    await opcion(pagina, 'Vivienda').click();
    // Al elegir, la ventana se cierra y el campo muestra lo elegido.
    await opcion(pagina, 'Alquiler').click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), '🔑 Alquiler', 'el campo muestra el ícono junto al nombre');
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-1 · la ventana de cuentas: las activas con su saldo (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.getByRole('button', { name: /^Cuenta/ }).click();
    const v = ventana(pagina);
    assert.deepEqual(await v.getByRole('option').allTextContents(), [
      `💵Billetera$${E}50.000,00`, `💵Caja$${E}200.000,00`, `🏦Banco$${E}800.000,00`, `📱Billetera virtual$${E}300.000,00`, `💵Dólares billeteUS$${E}500,00`, `🚌Tarjeta transporte$${E}10.000,00`,
    ]);
    await v.getByRole('combobox').fill('banc');
    assert.deepEqual(await v.getByRole('option').allTextContents(), [`🏦Banco$${E}800.000,00`]);
    await opcion(pagina, /^Banco/).click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await pagina.locator('.boton-campo-valor').nth(1).textContent(), '🏦 Banco');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-1 · sin cuentas ni categorías, la ventana lo dice y lleva a crearlas (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#cargar');
    await pagina.locator('.formulario-egreso').waitFor();
    await pagina.getByRole('button', { name: /^Cuenta/ }).click();
    assert.match(await ventana(pagina).innerText(), /Todavía no tenés cuentas\./);
    await ventana(pagina).getByRole('button', { name: 'Crear una cuenta' }).click();
    await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
    assert.equal(new URL(pagina.url()).hash, '#ajustes/cuentas');
    await pagina.goBack();
    await pagina.locator('.formulario-egreso').waitFor();
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    assert.match(await ventana(pagina).innerText(), /Todavía no tenés categorías de egreso\./);
    await ventana(pagina).getByRole('button', { name: 'Crear categorías' }).click();
    await pagina.getByRole('heading', { name: 'Categorías', level: 1 }).waitFor();
    assert.equal(new URL(pagina.url()).hash, '#ajustes/categorias');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-2 · «Guardar» guarda el egreso, vuelve atrás y avisa el saldo nuevo; Inicio y Cuentas lo muestran (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irAInicio(pagina);
    assert.equal(await saldoEnInicio(pagina, 'cue-banco'), `$${E}800.000,00`);
    await abrirCarga(pagina);
    await completar(pagina, { monto: '12500,5', descripcion: 'cuota del gimnasio', categoria: ['alq', 'Alquiler'], cuenta: ['banc', /^Banco/] });
    // Al salir del campo, el monto queda en formato argentino; la descripción empieza con mayúscula.
    assert.equal(await campo(pagina, 'Monto').inputValue(), '12.500,50');
    assert.equal(await campo(pagina, 'Descripción (opcional)').inputValue(), 'Cuota del gimnasio');
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await aviso(pagina).filter({ hasText: `Guardaste el egreso. Saldo de Banco: $${E}787.499,50.` }).waitFor();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal(new URL(pagina.url()).hash, '#inicio', 'vuelve a la pantalla anterior');
    assert.equal(await saldoEnInicio(pagina, 'cue-banco'), `$${E}787.499,50`);
    assert.equal(await saldoEnInicio(pagina, 'cue-caja'), `$${E}200.000,00`, 'las otras cuentas no cambian');
    await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
    await pagina.locator('#cuenta-cue-banco .fila-monto').waitFor();
    assert.equal(await pagina.locator('#cuenta-cue-banco .fila-monto').textContent(), `$${E}787.499,50`);
    const guardados = await movimientosGuardados(pagina);
    assert.equal(guardados.length, 1);
    const m = guardados[0];
    assert.deepEqual(
      [m.tipo, m.estado, m.origen, m.fecha, m.montoTotal, m.monedaId, m.descripcion, m.cuentaId, m.asientos, m.partes.map((p) => [p.categoriaId, p.monto, p.fijoVariable, p.necesidadDeseo, p.hormiga])],
      ['egreso', 'confirmado', 'manual', '2026-10-31', 1250050, 'ARS', 'Cuota del gimnasio', 'cue-banco', [{ cuentaId: 'cue-banco', monto: -1250050 }], [['cat-alquiler', 1250050, 'fijo', 'necesidad', false]]],
    );
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-2 · «Guardar y cargar otro» deja la pantalla vacía, con la fecha en hoy, y avisa el saldo (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.locator('input[type="date"]').fill('2026-10-20');
    assert.equal(await pagina.locator('.fecha-texto').textContent(), '20/10/2026', 'una fecha pasada no dice «Hoy»');
    await completar(pagina, { monto: '10', descripcion: 'diario', categoria: ['kio', 'Kiosco'], cuenta: ['dól', /^Dólares/] });
    await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
    await aviso(pagina).filter({ hasText: `Saldo de Dólares billete: US$${E}490,00.` }).waitFor();
    assert.equal(new URL(pagina.url()).hash, '#cargar', 'se queda en la carga');
    assert.equal(await campo(pagina, 'Monto').inputValue(), '');
    assert.equal(await campo(pagina, 'Descripción (opcional)').inputValue(), '');
    assert.equal(await pagina.locator('input[type="date"]').inputValue(), '2026-10-31');
    assert.equal(await pagina.locator('.fecha-texto').textContent(), 'Hoy · 31/10/2026');
    assert.deepEqual(await pagina.locator('.boton-campo-valor').allTextContents(), ['Elegir…', 'Elegir…']);
    // Se puede cargar otro encima del anterior.
    await completar(pagina, { monto: '2,50', categoria: ['kio', 'Kiosco'], cuenta: ['dól', /^Dólares/] });
    await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
    await aviso(pagina).filter({ hasText: `Saldo de Dólares billete: US$${E}487,50.` }).waitFor();
    assert.equal((await movimientosGuardados(pagina)).length, 2);
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-2 · sin monto, categoría o cuenta no guarda: cada campo con su mensaje y el foco en el primero (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    const mensajes = () => pagina.locator('.error-campo:not([hidden])').allTextContents();
    await mensajesSon(pagina, ['Escribí un monto mayor que 0.', 'Elegí una categoría.', 'Elegí una cuenta.']);
    assert.deepEqual(await mensajes(), ['Escribí un monto mayor que 0.', 'Elegí una categoría.', 'Elegí una cuenta.']);
    assert.equal(await pagina.evaluate(() => document.activeElement.id.replace(/\d+$/, '')), 'egreso-monto-');
    assert.equal(await campo(pagina, 'Monto').getAttribute('aria-invalid'), 'true');
    // Con monto 0 sigue igual; con monto y sin categoría, el foco va a la categoría.
    await campo(pagina, 'Monto').fill('0');
    await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
    await pagina.waitForFunction(() => !document.querySelector('.formulario-egreso button:disabled'));
    assert.deepEqual(await mensajes(), ['Escribí un monto mayor que 0.', 'Elegí una categoría.', 'Elegí una cuenta.']);
    await campo(pagina, 'Monto').fill('300');
    await elegir(pagina, 'Cuenta', 'caja', /^Caja/);
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await mensajesSon(pagina, ['Elegí una categoría.']);
    assert.deepEqual(await mensajes(), ['Elegí una categoría.']);
    assert.equal(await pagina.evaluate(() => document.activeElement.textContent), 'Elegir…›', 'el foco va al botón de categoría');
    assert.equal(await pagina.getByRole('button', { name: /^Categoría/ }).getAttribute('aria-invalid'), 'true');
    // Al elegir la categoría desaparece su error.
    await elegir(pagina, 'Categoría', 'sal', 'Salud');
    assert.deepEqual(await mensajes(), []);
    assert.equal((await movimientosGuardados(pagina)).length, 0, 'nada se guardó');
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-1 · no acepta fechas posteriores a hoy (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.locator('input[type="date"]').fill('2026-11-02');
    await completar(pagina, { monto: '10', categoria: ['sal', 'Salud'], cuenta: ['caja', /^Caja/] });
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await mensajesSon(pagina, ['La fecha no puede ser posterior a hoy.']);
    assert.deepEqual(await pagina.locator('.error-campo:not([hidden])').allTextContents(), ['La fecha no puede ser posterior a hoy.']);
    assert.equal((await movimientosGuardados(pagina)).length, 0);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-2 · un doble toque en «Guardar» guarda una sola vez (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irAInicio(pagina);
    await abrirCarga(pagina);
    await completar(pagina, { monto: '500', categoria: ['sal', 'Salud'], cuenta: ['caja', /^Caja/] });
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).dblclick();
    await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}199.500,00.` }).waitFor();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal((await movimientosGuardados(pagina)).length, 1);
    assert.equal(await saldoEnInicio(pagina, 'cue-caja'), `$${E}199.500,00`);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-02 CA-2 · «Cancelar» vuelve a la pantalla anterior sin guardar (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
    await pagina.locator('#boton-nueva-cuenta').waitFor();
    await abrirCarga(pagina);
    await completar(pagina, { monto: '500', categoria: ['sal', 'Salud'], cuenta: ['caja', /^Caja/] });
    await pagina.getByRole('button', { name: 'Cancelar' }).click();
    await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
    assert.equal(new URL(pagina.url()).hash, '#ajustes/cuentas');
    assert.equal((await movimientosGuardados(pagina)).length, 0);
    // Si se entró directo a #cargar, no hay pantalla anterior en AFP: vuelve a Inicio.
    await pagina.goto(`${entorno.servidor.url}#cargar`);
    await pagina.reload();
    await pagina.locator('.formulario-egreso').waitFor();
    await pagina.getByRole('button', { name: 'Cancelar' }).click();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal(new URL(pagina.url()).hash, '#inicio');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-02 CA-3 · la carga completa con el teclado, sin un solo clic (PC)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await pagina.goto(`${entorno.servidor.url}#cargar`);
  await pagina.locator('.formulario-egreso').waitFor();
  await pagina.evaluate(() => document.activeElement?.blur());
  const enfocado = () => pagina.evaluate(() => {
    const e = document.activeElement;
    const s = getComputedStyle(e);
    return { id: e.id.replace(/-\d+$/, ''), tipo: e.type ?? null, contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 };
  });
  // Tab recorre los campos en el orden de la pantalla y el foco siempre se ve.
  const recorrido = [];
  for (let i = 0; i < 20; i += 1) {
    await pagina.keyboard.press('Tab');
    const f = await enfocado();
    if (f.id.startsWith('egreso-')) { assert.ok(f.contorno, `se ve el foco en ${f.id}`); if (recorrido.at(-1) !== f.id) recorrido.push(f.id); }
    if (f.id === 'egreso-guardar') break;
  }
  assert.deepEqual(recorrido, ['egreso-fecha', 'egreso-hora', 'egreso-monto', 'egreso-descripcion', 'egreso-categoria', 'egreso-cuenta', 'egreso-cancelar', 'egreso-otro', 'egreso-guardar']);
  // Atrás hasta la fecha y de nuevo hacia adelante hasta el monto.
  for (let i = 0; i < 12 && (await enfocado()).id !== 'egreso-cuenta'; i += 1) await pagina.keyboard.press('Shift+Tab');
  for (let i = 0; i < 12 && (await enfocado()).id !== 'egreso-monto'; i += 1) await pagina.keyboard.press('Shift+Tab');
  await pagina.keyboard.type('1500');
  assert.equal(await campo(pagina, 'Monto').inputValue(), '1.500', 'los puntos de miles aparecen mientras se escribe');
  await pagina.keyboard.press('Tab');
  await pagina.keyboard.type('pan y leche');
  await pagina.keyboard.press('Tab');
  assert.equal((await enfocado()).id, 'egreso-categoria');
  // Enter abre la ventana con el foco en el buscador; ↑/↓ mueven la selección; Esc cierra sin cambiar.
  await pagina.keyboard.press('Enter');
  const v = ventana(pagina);
  await v.waitFor();
  assert.equal(await v.getByRole('combobox').evaluate((e) => e === document.activeElement), true);
  const marcada = () => v.locator('[role="option"][aria-selected="true"]').textContent();
  assert.equal(await marcada(), '🏠Vivienda›');
  await pagina.keyboard.press('ArrowDown');
  assert.equal(await marcada(), '🍽️Alimentación›');
  await pagina.keyboard.press('ArrowUp');
  await pagina.keyboard.press('ArrowUp');
  assert.equal(await marcada(), '🩺Salud', 'da la vuelta al llegar al principio');
  await pagina.keyboard.press('Escape');
  await v.waitFor({ state: 'detached' });
  assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), 'Elegir…', 'Esc no cambia nada');
  assert.equal((await enfocado()).id, 'egreso-categoria', 'el foco vuelve al campo');
  // Espacio también abre; escribir filtra y Enter elige la marcada.
  await pagina.keyboard.press('Space');
  await v.waitFor();
  await pagina.keyboard.type('super');
  assert.equal(await marcada(), '🛒Supermercado');
  await pagina.keyboard.press('Enter');
  await v.waitFor({ state: 'detached' });
  assert.equal(await pagina.locator('.boton-campo-valor').first().textContent(), '🛒 Supermercado');
  await pagina.keyboard.press('Tab');
  assert.equal((await enfocado()).id, 'egreso-cuenta');
  await pagina.keyboard.press('Enter');
  await v.waitFor();
  await pagina.keyboard.type('virtual');
  await pagina.keyboard.press('Enter');
  await v.waitFor({ state: 'detached' });
  // Ctrl+Enter guarda y vuelve a la pantalla anterior (Ajustes, de donde se vino).
  await pagina.keyboard.press('Control+Enter');
  await aviso(pagina).filter({ hasText: `Saldo de Billetera virtual: $${E}298.500,00.` }).waitFor();
  await pagina.getByRole('heading', { name: 'Ajustes', level: 1 }).waitFor();
  const [m] = await movimientosGuardados(pagina);
  assert.deepEqual([m.montoTotal, m.descripcion, m.cuentaId, m.partes[0].categoriaId], [150000, 'Pan y leche', 'cue-billetera-virtual', 'cat-supermercado']);
  // HU-02b CA-3: toda la carga con las flechas ↓/↑ y ← →, sin clics. Se empieza en la fecha con Tab.
  await pagina.goto(`${entorno.servidor.url}#cargar`);
  await pagina.locator('.formulario-egreso').waitFor();
  await pagina.evaluate(() => document.activeElement?.blur());
  await pagina.keyboard.press('Tab');
  assert.equal((await enfocado()).id, 'egreso-fecha');
  const hacia = async (tecla, id) => { await pagina.keyboard.press(tecla); assert.equal((await enfocado()).id, id, `${tecla} → ${id}`); };
  await hacia('ArrowDown', 'egreso-hora');
  await hacia('ArrowDown', 'egreso-monto');
  await hacia('ArrowUp', 'egreso-hora');
  await hacia('ArrowDown', 'egreso-monto');
  await pagina.keyboard.type('200');
  await hacia('ArrowDown', 'egreso-descripcion');
  await hacia('ArrowDown', 'egreso-categoria');
  await pagina.keyboard.press('Enter');
  await v.waitFor();
  await pagina.keyboard.type('kio');
  await pagina.keyboard.press('Enter');
  await v.waitFor({ state: 'detached' });
  await hacia('ArrowDown', 'egreso-cuenta');
  await pagina.keyboard.press('Enter');
  await v.waitFor();
  await pagina.keyboard.type('caja');
  await pagina.keyboard.press('Enter');
  await v.waitFor({ state: 'detached' });
  await hacia('ArrowDown', 'egreso-cancelar');
  await hacia('ArrowRight', 'egreso-otro');
  await hacia('ArrowRight', 'egreso-guardar');
  await hacia('ArrowRight', 'egreso-guardar');
  await hacia('ArrowLeft', 'egreso-otro');
  await hacia('ArrowUp', 'egreso-cancelar');
  await hacia('ArrowUp', 'egreso-cuenta');
  await hacia('ArrowDown', 'egreso-cancelar');
  await hacia('ArrowRight', 'egreso-otro');
  await pagina.keyboard.press('Enter'); // «Guardar y cargar otro»
  await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}199.800,00.` }).waitFor();
  assert.equal(new URL(pagina.url()).hash, '#cargar');
  assert.equal(await campo(pagina, 'Monto').inputValue(), '');
  // Ctrl+Mayús+Enter guarda y deja la pantalla para otro.
  await campo(pagina, 'Monto').focus();
  await pagina.keyboard.type('100');
  await pagina.keyboard.press('Tab');
  await pagina.keyboard.press('Tab');
  await pagina.keyboard.press('Enter');
  await pagina.keyboard.type('kio');
  await pagina.keyboard.press('Enter');
  await pagina.keyboard.press('Tab');
  await pagina.keyboard.press('Enter');
  await pagina.keyboard.type('caja');
  await pagina.keyboard.press('Enter');
  await pagina.keyboard.press('Control+Shift+Enter');
  await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}199.700,00.` }).waitFor();
  assert.equal(await campo(pagina, 'Monto').inputValue(), '');
  assert.equal((await movimientosGuardados(pagina)).length, 3);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-02 CA-3 · los atajos se muestran junto a los botones solo en la PC', async () => {
  const pc = await enModoPrueba({ viewport: ESCRITORIO }, { cargar: false });
  await pc.pagina.goto(`${entorno.servidor.url}#cargar`);
  await pc.pagina.locator('.formulario-egreso').waitFor();
  assert.equal(await pc.pagina.locator('.atajos').innerText(), 'Ctrl + Enter guarda · Ctrl + Mayús + Enter guarda y carga otro');
  await pc.contexto.close();
  const cel = await enModoPrueba({ viewport: CELULAR }, { cargar: false });
  await cel.pagina.goto(`${entorno.servidor.url}#cargar`);
  await cel.pagina.locator('.formulario-egreso').waitFor();
  assert.equal(await cel.pagina.locator('.atajos').isVisible(), false);
  await cel.contexto.close();
});

test('HU-02 CA-4 · una base del esquema 3 pasa al 4 con sus datos y el almacén de movimientos', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR }, '#movimientos');
  await pagina.evaluate(() => new Promise((ok) => {
    const borrar = indexedDB.deleteDatabase('afp-dev');
    borrar.onsuccess = borrar.onblocked = () => {
      const p = indexedDB.open('afp-dev', 3);
      p.onupgradeneeded = () => { for (const a of ['configuracion', 'cuentas', 'monedas', 'categorias', 'ubicacionesCategoria']) p.result.createObjectStore(a, { keyPath: 'id' }); };
      p.onsuccess = () => {
        const tx = p.result.transaction(['configuracion', 'cuentas', 'monedas', 'categorias', 'ubicacionesCategoria'], 'readwrite');
        tx.objectStore('configuracion').put({ id: 'config', monedaBase: 'ARS', mesesFondoEmergencia: 9 });
        tx.objectStore('monedas').put({ id: 'ARS', simbolo: '$', decimales: 2, activa: true, orden: 1 });
        tx.objectStore('cuentas').put({ id: 'cue-x', nombre: 'Efectivo', tipo: 'efectivo', monedaId: 'ARS', saldoInicial: 100000, fechaSaldoInicial: '2026-10-01', orden: 1, estado: 'activa' });
        tx.objectStore('categorias').put({ id: 'cat-v', nombre: 'Vivienda', tipo: 'egreso', padreId: null, emoji: '', orden: 1, estado: 'activa' });
        tx.objectStore('categorias').put({ id: 'cat-a', nombre: 'Alquiler', tipo: 'egreso', padreId: 'cat-v', emoji: '', orden: 2, estado: 'activa', fijoVariable: 'fijo', necesidadDeseo: 'necesidad', hormiga: false });
        tx.objectStore('ubicacionesCategoria').put({ id: 'ubi-a', categoriaId: 'cat-a', padreId: 'cat-v', desde: null });
        tx.oncomplete = () => { p.result.close(); ok(); };
      };
    };
  }));
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  await pagina.waitForFunction(() => new Promise((ok) => { const p = indexedDB.open('afp-dev'); p.onsuccess = () => { const v = p.result.version; p.result.close(); ok(v === 4); }; }));
  const base = await pagina.evaluate(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev');
    p.onsuccess = () => {
      const db = p.result;
      const lista = ['configuracion', 'cuentas', 'monedas', 'categorias', 'ubicacionesCategoria'];
      const lecturas = Object.fromEntries(lista.map((a) => [a, db.transaction(a).objectStore(a).getAll()]));
      const indices = [...db.transaction('movimientos').objectStore('movimientos').indexNames].sort();
      const unico = db.transaction('movimientos').objectStore('movimientos').index('claveImportacion').unique;
      setTimeout(() => {
        const r = { almacenes: [...db.objectStoreNames].sort(), indices, unico, ids: Object.fromEntries(lista.map((a) => [a, lecturas[a].result.map((x) => x.id)])), meses: lecturas.configuracion.result[0].mesesFondoEmergencia };
        db.close(); ok(r);
      }, 200);
    };
  }));
  assert.deepEqual(base, {
    almacenes: ['categorias', 'configuracion', 'cuentas', 'monedas', 'movimientos', 'ubicacionesCategoria'],
    indices: ['claveImportacion', 'estado', 'fecha'],
    unico: true,
    ids: { configuracion: ['config'], cuentas: ['cue-x'], monedas: ['ARS'], categorias: ['cat-a', 'cat-v'], ubicacionesCategoria: ['ubi-a'] },
    meses: 9,
  });
  // Y con esa base ya se puede cargar un egreso.
  await pagina.goto(`${entorno.servidor.url}#cargar`);
  await pagina.locator('.formulario-egreso').waitFor();
  await completar(pagina, { monto: '250', categoria: ['alq', 'Alquiler'], cuenta: ['efec', /^Efectivo/] });
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await aviso(pagina).filter({ hasText: `Saldo de Efectivo: $${E}750,00.` }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-02 CA-4 · sin conexión funciona, y al cerrar y volver a abrir AFP el egreso y el saldo siguen', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.locator('.franja-prueba').waitFor();
  await abrirCarga(pagina);
  await completar(pagina, { monto: '12.500,50', descripcion: 'comida', categoria: ['sup', 'Supermercado'], cuenta: ['banc', /^Banco/] });
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await aviso(pagina).filter({ hasText: `Saldo de Banco: $${E}787.499,50.` }).waitFor();
  // Cerrar y volver a abrir: una página nueva en el mismo contexto (mismo almacenamiento), todavía sin conexión.
  await pagina.close();
  const nueva = await contexto.newPage();
  await nueva.goto(`${entorno.servidor.url}#inicio`);
  await nueva.locator('#tarjeta-cue-banco').waitFor();
  assert.equal(await saldoEnInicio(nueva, 'cue-banco'), `$${E}787.499,50`);
  assert.equal((await movimientosGuardados(nueva)).length, 1);
  await contexto.setOffline(false);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-02 CA-4 · el modo prueba: «Borrar» y «Restablecer» vacían los movimientos y la base real no se toca', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await completar(pagina, { monto: '700', categoria: ['sal', 'Salud'], cuenta: ['caja', /^Caja/] });
  await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
  await aviso(pagina).filter({ hasText: `Saldo de Caja: $${E}199.300,00.` }).waitFor();
  assert.equal((await movimientosGuardados(pagina)).length, 1);
  assert.deepEqual(await movimientosGuardados(pagina, 'afp-dev'), [], 'la base real (afp-dev) no tiene movimientos');
  // Restablecer los datos de ejemplo los deja vacíos y los saldos vuelven a los de ejemplo.
  await pagina.goto(`${entorno.servidor.url}#ajustes`);
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
  await ventana(pagina).getByRole('button', { name: 'Restablecer' }).click();
  await aviso(pagina).filter({ hasText: 'Cargaste los datos de ejemplo.' }).waitFor();
  assert.deepEqual(await movimientosGuardados(pagina), []);
  await irAInicio(pagina);
  assert.equal(await saldoEnInicio(pagina, 'cue-caja'), `$${E}200.000,00`);
  // Y «Borrar datos de prueba» también.
  await abrirCarga(pagina);
  await completar(pagina, { monto: '700', categoria: ['sal', 'Salud'], cuenta: ['caja', /^Caja/] });
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  assert.equal((await movimientosGuardados(pagina)).length, 1);
  await pagina.goto(`${entorno.servidor.url}#ajustes`);
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await ventana(pagina).getByRole('button', { name: 'Borrar', exact: true }).click();
  await aviso(pagina).filter({ hasText: 'Borraste los datos de prueba.' }).waitFor();
  assert.deepEqual(await movimientosGuardados(pagina), []);
  assert.deepEqual(await movimientosGuardados(pagina, 'afp-dev'), []);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of VIEWPORTS) {
  for (const colorScheme of ['light', 'dark']) {
    test(`HU-02 CA-4 · axe-core sin problemas graves en la carga y sus ventanas (${nombre}, ${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
      // bypassCSP: axe-core se inyecta solo en la prueba; la página no permite scripts ajenos.
      const { contexto, pagina, errores } = await enModoPrueba({ viewport, colorScheme, bypassCSP: true });
      await abrirCarga(pagina);
      await pagina.addScriptTag({ path: AXE });
      const graves = () => pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(await graves(), [], 'pantalla de carga');
      await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
      await pagina.locator('.error-campo:not([hidden])').first().waitFor();
      assert.deepEqual(await graves(), [], 'con errores');
      await pagina.getByRole('button', { name: /^Categoría/ }).click();
      await pagina.getByRole('option').first().waitFor();
      assert.deepEqual(await graves(), [], 'ventana de categorías');
      await pagina.keyboard.press('Escape');
      await pagina.getByRole('button', { name: /^Cuenta/ }).click();
      await pagina.getByRole('option').first().waitFor();
      assert.deepEqual(await graves(), [], 'ventana de cuentas');
      await pagina.getByRole('combobox').fill('zzz');
      assert.deepEqual(await graves(), [], 'sin resultados');
      assert.ok(await sinDesplazamientoHorizontal(pagina));
      assert.deepEqual(errores, []);
      await contexto.close();
    });
  }
}
