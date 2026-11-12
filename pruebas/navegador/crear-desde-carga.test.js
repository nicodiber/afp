// HU-39: crear una categoría o una cuenta sin salir de la carga (celular 390×844 y PC 1366×768). Valores esperados escritos
// a mano a partir de la historia y de los datos de ejemplo (Hoy = 31/10/2026; 25 categorías y 6 cuentas de ejemplo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const PC = { width: 1366, height: 768 };
const E = ' ';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VIEWPORTS = [['celular', CELULAR], ['PC', PC]];
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const enfocadoEsOpcionMarcada = (pagina) => ventana(pagina).locator('[role="option"][aria-selected="true"]').textContent();

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
// `base`: la de prueba (con datos de ejemplo) o la real de desarrollo (los recorridos «sin ninguna categoría o cuenta»).
const leer = (pagina, almacen, base = 'afp-dev-prueba') => pagina.evaluate(([nombre, baseAbierta]) => new Promise((ok) => {
  const p = indexedDB.open(baseAbierta);
  p.onsuccess = () => {
    const db = p.result;
    const g = db.transaction(nombre).objectStore(nombre).getAll();
    g.onsuccess = () => { db.close(); ok(g.result); };
  };
}), [almacen, base]);
const campo = (pagina, nombre) => pagina.getByRole('textbox', { name: nombre, exact: true });
const valorDe = (pagina, indice) => pagina.locator('.boton-campo-valor').nth(indice).textContent();
const abrirCategoria = (pagina) => pagina.getByRole('button', { name: /^Categoría/ }).click();
const abrirCuenta = (pagina) => pagina.getByRole('button', { name: /^Cuenta/ }).click();
const sinDesplazamientoHorizontal = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function escribirLoCargado(pagina) {
  await campo(pagina, 'Monto').fill('12500,5');
  await campo(pagina, 'Descripción (opcional)').fill('compra de prueba');
  await pagina.locator('input[type="time"]').fill('08:15');
  await pagina.locator('input[type="date"]').fill('2026-10-20');
}
async function loCargadoSigue(pagina) {
  assert.equal(await campo(pagina, 'Monto').inputValue(), '12.500,50');
  assert.equal(await campo(pagina, 'Descripción (opcional)').inputValue(), 'Compra de prueba');
  assert.equal(await pagina.locator('input[type="time"]').inputValue(), '08:15');
  assert.equal(await pagina.locator('input[type="date"]').inputValue(), '2026-10-20');
}

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-39 CA-1 · «＋ Nueva categoría» de egreso: formulario corto con lo buscado y el ícono propuesto; crea y elige, sin perder lo cargado (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await escribirLoCargado(pagina);
    const antes = (await leer(pagina, 'categorias')).length;
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    assert.equal(await v.getByRole('option').last().textContent(), '＋ Nueva categoría');
    await v.getByRole('combobox').fill('gimnasio');
    assert.deepEqual(await v.getByRole('option').allTextContents(), ['＋ Nueva categoría']);
    await v.getByRole('option', { name: '＋ Nueva categoría' }).click();
    // El formulario ocupa la misma ventana: nombre con lo buscado y un ícono propuesto.
    await v.getByRole('heading', { name: 'Nueva categoría', level: 2 }).waitFor();
    assert.equal(await campo(pagina, 'Nombre').inputValue(), 'Gimnasio');
    assert.equal(await campo(pagina, 'Nombre').evaluate((e) => e === document.activeElement), true, 'el foco va al nombre');
    const icono = (await v.locator('.icono-actual').textContent()).trim();
    assert.ok(icono.length > 0, 'se ve el ícono propuesto');
    assert.equal(await pagina.locator('dialog[open]').count(), 1, 'una sola ventana');
    assert.ok(await sinDesplazamientoHorizontal(pagina), 'sin desplazamiento horizontal');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await valorDe(pagina, 0), `${icono} Gimnasio`, 'queda elegida en el campo');
    await loCargadoSigue(pagina);
    const todas = await leer(pagina, 'categorias');
    assert.equal(todas.length, antes + 1);
    const creada = todas.find((c) => c.nombre === 'Gimnasio');
    assert.equal(creada.tipo, 'egreso');
    assert.equal(creada.padreId ?? null, null);
    assert.deepEqual([creada.fijoVariable, creada.necesidadDeseo, creada.hormiga, creada.emoji], ['variable', 'necesidad', false, icono]);
    assert.equal(creada.estado, 'activa');
    // Aparece en Categorías y en la lista de la carga.
    assert.equal(new Set(todas.map((c) => c.emoji)).size, todas.length, 'el ícono es único');
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-1 · dentro de una familia dice «＋ Nueva categoría en <familia>» y la crea ahí, con la clasificación de la familia (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    await v.getByRole('option', { name: /Ocio/ }).click();
    assert.equal(await v.getByRole('option').last().textContent(), '＋ Nueva categoría en Ocio');
    await v.getByRole('option').last().click();
    await v.getByRole('heading', { name: 'Nueva categoría en Ocio', level: 2 }).waitFor();
    assert.equal(await campo(pagina, 'Nombre').inputValue(), '');
    await campo(pagina, 'Nombre').fill('cine');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.match(await valorDe(pagina, 0), / Cine$/);
    const creada = (await leer(pagina, 'categorias')).find((c) => c.nombre === 'Cine');
    // La familia Ocio no tiene clasificación propia: la nueva trae la más común (variable y necesidad), como en Categorías (D-137).
    assert.deepEqual([creada.tipo, creada.padreId, creada.fijoVariable, creada.necesidadDeseo], ['egreso', 'cat-ocio', 'variable', 'necesidad']);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-1 · en un ingreso crea una categoría de ingreso con su naturaleza por defecto (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await pagina.getByRole('group', { name: 'Tipo de movimiento' }).getByRole('button', { name: 'Ingreso', exact: true }).click();
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    await v.getByRole('combobox').fill('premios');
    await v.getByRole('option', { name: '＋ Nueva categoría' }).click();
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.match(await valorDe(pagina, 0), / Premios$/);
    const creada = (await leer(pagina, 'categorias')).find((c) => c.nombre === 'Premios');
    assert.deepEqual([creada.tipo, creada.naturaleza, creada.fijoVariable, creada.padreId ?? null], ['ingreso', 'ganado', null, null]);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-1 · sin ninguna categoría, la ventana ofrece «＋ Nueva categoría» y funciona (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#cargar');
    await pagina.locator('.formulario-egreso').waitFor();
    assert.equal((await leer(pagina, 'categorias', 'afp-dev')).length, 0);
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    assert.deepEqual(await v.getByRole('option').allTextContents(), ['＋ Nueva categoría']);
    await v.getByRole('option').click();
    await campo(pagina, 'Nombre').fill('comida');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.match(await valorDe(pagina, 0), / Comida$/);
    assert.equal((await leer(pagina, 'categorias', 'afp-dev')).length, 1);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-2 · «＋ Nueva cuenta»: nombre, tipo y saldo inicial; crea en pesos con el ícono del tipo y la deja elegida (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await escribirLoCargado(pagina);
    const antes = (await leer(pagina, 'cuentas')).length;
    await abrirCuenta(pagina);
    const v = ventana(pagina);
    assert.equal(await v.getByRole('option').last().textContent(), '＋ Nueva cuenta');
    await v.getByRole('combobox').fill('sueldo');
    await v.getByRole('option', { name: '＋ Nueva cuenta' }).click();
    await v.getByRole('heading', { name: 'Nueva cuenta', level: 2 }).waitFor();
    assert.equal(await campo(pagina, 'Nombre').inputValue(), 'Sueldo');
    await campo(pagina, 'Nombre').fill('cuenta sueldo');
    await v.getByLabel('Tipo').selectOption('banco');
    // El saldo lleva el formato de monto de la carga: puntos de miles, coma decimal, el punto escribe una coma.
    await campo(pagina, 'Saldo inicial').pressSequentially('1234567.5');
    assert.equal(await campo(pagina, 'Saldo inicial').inputValue(), '1.234.567,5');
    assert.ok(await sinDesplazamientoHorizontal(pagina));
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await valorDe(pagina, 1), '🏦 Cuenta sueldo');
    assert.match(await pagina.locator('.ayuda').filter({ hasText: 'Ejemplo' }).textContent(), /Moneda de la cuenta: ARS/);
    await loCargadoSigue(pagina);
    const todas = await leer(pagina, 'cuentas');
    assert.equal(todas.length, antes + 1);
    const creada = todas.find((c) => c.nombre === 'Cuenta sueldo');
    assert.deepEqual(
      [creada.tipo, creada.monedaId, creada.saldoInicial, creada.fechaSaldoInicial, creada.emoji, creada.estado],
      ['banco', 'ARS', 123456750, '2026-10-31', '🏦', 'activa'],
    );
    // Aparece en la lista de cuentas de la carga, con su saldo.
    await abrirCuenta(pagina);
    assert.match(await ventana(pagina).getByRole('option', { name: /Cuenta sueldo/ }).textContent(), new RegExp(`\\$${E}1\\.234\\.567,50`));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-2 · sin ninguna cuenta, la ventana ofrece «＋ Nueva cuenta» y el saldo vacío cuenta como 0 (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#cargar');
    await pagina.locator('.formulario-egreso').waitFor();
    await abrirCuenta(pagina);
    const v = ventana(pagina);
    assert.deepEqual(await v.getByRole('option').allTextContents(), ['＋ Nueva cuenta']);
    await v.getByRole('option').click();
    await campo(pagina, 'Nombre').fill('efectivo');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await valorDe(pagina, 1), '💵 Efectivo');
    const [creada] = await leer(pagina, 'cuentas', 'afp-dev');
    assert.deepEqual([creada.tipo, creada.saldoInicial, creada.monedaId], ['efectivo', 0, 'ARS']);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-3 · «Volver» deja la lista como estaba, sin crear nada ni perder lo cargado (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await escribirLoCargado(pagina);
    const [categorias, cuentas] = [(await leer(pagina, 'categorias')).length, (await leer(pagina, 'cuentas')).length];
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    await v.getByRole('option', { name: /Ocio/ }).click();
    await v.getByRole('option').last().click();
    await campo(pagina, 'Nombre').fill('algo');
    await v.getByRole('button', { name: 'Volver' }).click();
    // La lista vuelve en la familia en la que estaba, con el foco en el buscador.
    assert.deepEqual(await v.getByRole('option').allTextContents(), ['🍕Juntada', '🏖️Vacaciones', '＋ Nueva categoría en Ocio']);
    assert.equal(await v.getByRole('combobox').evaluate((e) => e === document.activeElement), true);
    await v.getByRole('button', { name: 'Cerrar' }).click();
    await abrirCuenta(pagina);
    await ventana(pagina).getByRole('option', { name: '＋ Nueva cuenta' }).click();
    await ventana(pagina).getByRole('button', { name: 'Volver' }).click();
    assert.equal(await ventana(pagina).getByRole('option').count(), 7);
    await ventana(pagina).getByRole('button', { name: 'Cerrar' }).click();
    assert.deepEqual([(await leer(pagina, 'categorias')).length, (await leer(pagina, 'cuentas')).length], [categorias, cuentas]);
    await loCargadoSigue(pagina);
    assert.equal(await valorDe(pagina, 0), 'Elegir…');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-3 · Esc en el formulario corto vuelve a la lista: no cierra la ventana ni la carga; otro Esc cierra la ventana (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    await escribirLoCargado(pagina);
    for (const [abrirCampo, crearOpcion] of [[abrirCategoria, '＋ Nueva categoría'], [abrirCuenta, '＋ Nueva cuenta']]) {
      await abrirCampo(pagina);
      const v = ventana(pagina);
      await v.getByRole('option', { name: crearOpcion }).click();
      await campo(pagina, 'Nombre').fill('algo que no se crea');
      await pagina.keyboard.press('Escape');
      assert.equal(await pagina.locator('dialog[open]').count(), 1, 'la ventana sigue abierta, con la lista');
      assert.ok(await v.getByRole('option').count() > 1);
      assert.equal(new URL(pagina.url()).hash, '#cargar', 'no se vuelve de pantalla');
      await pagina.keyboard.press('Escape');
      await v.waitFor({ state: 'detached' });
      assert.equal(new URL(pagina.url()).hash, '#cargar');
      await pagina.locator('.formulario-egreso').waitFor();
    }
    await loCargadoSigue(pagina);
    assert.equal((await leer(pagina, 'categorias')).some((c) => c.nombre === 'Algo que no se crea'), false);
    assert.equal((await leer(pagina, 'cuentas')).some((c) => c.nombre === 'Algo que no se crea'), false);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-39 CA-4 · nombre vacío o repetido: el mismo aviso que en Categorías y Cuentas, y la ventana sigue abierta (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    // Categoría vacía.
    await abrirCategoria(pagina);
    const v = ventana(pagina);
    await v.getByRole('option', { name: '＋ Nueva categoría' }).click();
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.locator('.error-campo:not([hidden])').waitFor();
    assert.equal(await v.locator('.error-campo:not([hidden])').textContent(), 'El nombre tiene que tener entre 1 y 40 caracteres.');
    assert.equal(await campo(pagina, 'Nombre').getAttribute('aria-invalid'), 'true');
    assert.equal(await campo(pagina, 'Nombre').evaluate((e) => e === document.activeElement), true, 'el foco vuelve al nombre');
    // Categoría repetida en el mismo nivel (sin distinguir mayúsculas ni tildes).
    await campo(pagina, 'Nombre').fill('SALUD');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await pagina.waitForFunction(() => document.querySelector('dialog[open] .error-campo:not([hidden])')?.textContent.startsWith('Ya existe'));
    assert.equal(await v.locator('.error-campo:not([hidden])').textContent(), 'Ya existe una categoría con ese nombre en este nivel');
    assert.equal(await pagina.locator('dialog[open]').count(), 1);
    assert.equal((await leer(pagina, 'categorias')).filter((c) => c.nombre === 'Salud').length, 1);
    // Dentro de una familia, el mismo nombre en otro nivel sí se puede, y repetirlo en la familia no.
    await v.getByRole('button', { name: 'Volver' }).click();
    await v.getByRole('option', { name: /Vivienda/ }).click();
    await v.getByRole('option').last().click();
    await campo(pagina, 'Nombre').fill('alquiler');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await pagina.waitForFunction(() => document.querySelector('dialog[open] .error-campo:not([hidden])')?.textContent.startsWith('Ya existe'));
    await v.getByRole('button', { name: 'Volver' }).click();
    await v.getByRole('button', { name: 'Cerrar' }).click();
    // Cuenta vacía y repetida.
    await abrirCuenta(pagina);
    await v.getByRole('option', { name: '＋ Nueva cuenta' }).click();
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.locator('.error-campo:not([hidden])').waitFor();
    assert.equal(await v.locator('.error-campo:not([hidden])').textContent(), 'El nombre tiene que tener entre 1 y 40 caracteres.');
    await campo(pagina, 'Nombre').fill('caja');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await pagina.waitForFunction(() => document.querySelector('dialog[open] .error-campo:not([hidden])')?.textContent.startsWith('Ya existe'));
    assert.equal(await v.locator('.error-campo:not([hidden])').textContent(), 'Ya existe una cuenta con ese nombre');
    assert.equal((await leer(pagina, 'cuentas')).filter((c) => c.nombre === 'Caja').length, 1);
    // Un saldo mal escrito (solo cifras y coma entran, así que se prueba con un monto válido y se corrige el nombre).
    await campo(pagina, 'Nombre').fill('Caja chica');
    await v.getByRole('button', { name: 'Crear y elegir' }).click();
    await v.waitFor({ state: 'detached' });
    assert.equal(await valorDe(pagina, 1), '💵 Caja chica');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-39 CA-4 · en la PC «＋ Nueva…» se alcanza con las flechas y se elige con Enter (categoría y cuenta)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: PC });
  await abrirCarga(pagina);
  await abrirCategoria(pagina);
  const v = ventana(pagina);
  // ↑ desde la primera da la vuelta y llega a la última: «＋ Nueva categoría».
  await pagina.keyboard.press('ArrowUp');
  assert.equal(await enfocadoEsOpcionMarcada(pagina), '＋ Nueva categoría');
  await pagina.keyboard.press('Enter');
  await v.getByRole('heading', { name: 'Nueva categoría', level: 2 }).waitFor();
  await pagina.keyboard.type('Gimnasio');
  await pagina.keyboard.press('Enter'); // Enter en el formulario lo envía
  await v.waitFor({ state: 'detached' });
  assert.match(await valorDe(pagina, 0), / Gimnasio$/);
  // Con el buscador sin resultados, «＋ Nueva…» queda marcada y Enter la abre con lo escrito.
  await abrirCuenta(pagina);
  await pagina.keyboard.type('zzz');
  assert.equal(await enfocadoEsOpcionMarcada(pagina), '＋ Nueva cuenta');
  await pagina.keyboard.press('Enter');
  await v.getByRole('heading', { name: 'Nueva cuenta', level: 2 }).waitFor();
  assert.equal(await campo(pagina, 'Nombre').inputValue(), 'Zzz');
  await pagina.keyboard.press('Escape');
  assert.equal(await v.getByRole('status').textContent(), 'No hay resultados para «zzz».');
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-39 · axe-core sin problemas graves con la ventana y con el formulario corto abiertos, sin desborde (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport, bypassCSP: true });
    await abrirCarga(pagina);
    await pagina.addScriptTag({ path: AXE });
    const graves = () => pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.filter((x) => ['serious', 'critical', 'moderate'].includes(x.impact)).map((x) => `${x.id}: ${x.nodes.map((n) => n.target).join(' | ')}`));
    for (const [abrirCampo, nuevo] of [[abrirCategoria, '＋ Nueva categoría'], [abrirCuenta, '＋ Nueva cuenta']]) {
      await abrirCampo(pagina);
      assert.deepEqual(await graves(), [], `lista de ${nuevo}`);
      await ventana(pagina).getByRole('option', { name: nuevo }).click();
      await ventana(pagina).getByRole('button', { name: 'Crear y elegir' }).waitFor();
      assert.deepEqual(await graves(), [], `formulario de ${nuevo}`);
      await campo(pagina, 'Nombre').fill('x'.repeat(41));
      await ventana(pagina).getByRole('button', { name: 'Crear y elegir' }).click();
      await ventana(pagina).locator('.error-campo:not([hidden])').waitFor();
      assert.deepEqual(await graves(), [], `formulario de ${nuevo} con un error`);
      assert.ok(await sinDesplazamientoHorizontal(pagina));
      await pagina.keyboard.press('Escape');
      await pagina.keyboard.press('Escape');
    }
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
