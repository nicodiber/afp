// HU-38: «Cargar datos de ejemplo» trae categorías de ingresos y movimientos de agosto a octubre. Y HU-38 ajuste A: «Ícono».
// Valores esperados escritos a mano (saldos calculados aparte).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const E = '\u00a0';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const ventana = (pagina) => pagina.locator('dialog[open]').last();
const SALDOS = {
  'cue-billetera': `$${E}12.900,00`, 'cue-caja': `$${E}158.900,00`, 'cue-banco': `$${E}2.411.200,00`,
  'cue-billetera-virtual': `$${E}113.400,00`, 'cue-dolares': `US$${E}500,00`, 'cue-tarjeta-transporte': `$${E}1.000,00`,
};
const leerBase = (pagina, almacen) => pagina.evaluate((a) => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => { const g = p.result.transaction(a).objectStore(a).getAll(); g.onsuccess = () => { p.result.close(); ok(g.result); }; };
}), almacen);
async function saldosEnInicio(pagina) {
  await pagina.goto(`${entorno.servidor.url}#inicio`);
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  return Object.fromEntries(await Promise.all(Object.keys(SALDOS).map(async (id) => [id, await pagina.locator(`#tarjeta-${id} .tarjeta-cuenta-monto`).textContent()])));
}
async function conModoPrueba(opciones) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  return r;
}

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-38 CA-1 y CA-2 · cargar los datos de ejemplo trae 61 movimientos y los saldos de Inicio los incluyen (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conModoPrueba({ viewport });
    await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
    const movimientos = await leerBase(pagina, 'movimientos');
    assert.equal(movimientos.length, 61);
    assert.deepEqual([movimientos.filter((m) => m.tipo === 'ingreso').length, movimientos.filter((m) => m.tipo === 'egreso').length], [9, 52]);
    assert.ok(movimientos.every((m) => m.estado === 'confirmado' && m.origen === 'datos_ejemplo' && /^\d\d:\d\d$/.test(m.hora)));
    assert.deepEqual(await saldosEnInicio(pagina), SALDOS);
    // Las categorías de ingresos nuevas están en el árbol, con su ícono.
    await pagina.goto(`${entorno.servidor.url}#ajustes/categorias`);
    await pagina.locator('#titulo-ingreso').waitFor();
    const nombres = await pagina.locator('#categoria-cat-sueldo, #categoria-cat-trabajos-independientes, #categoria-cat-ayuda-familiar, #categoria-cat-regalos-y-reintegros').allInnerTexts();
    assert.equal(nombres.length, 4);
    assert.ok(nombres[0].includes('💵') && nombres[0].includes('Sueldo'));
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-38 CA-2 · «Restablecer datos de ejemplo» vuelve al mismo estado y «Borrar datos de prueba» borra también los movimientos', async () => {
  const { contexto, pagina, errores } = await conModoPrueba({ viewport: ESCRITORIO });
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  const inicial = await leerBase(pagina, 'movimientos');
  // Se carga un egreso propio: los saldos cambian.
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.locator('.formulario-egreso').waitFor();
  await pagina.getByRole('textbox', { name: 'Monto', exact: true }).fill('1000');
  await pagina.getByRole('button', { name: /^Categoría/ }).click();
  await ventana(pagina).getByRole('combobox').fill('kiosco');
  await ventana(pagina).getByRole('option', { name: /Kiosco/ }).click();
  await pagina.getByRole('button', { name: /^Cuenta/ }).click();
  await ventana(pagina).getByRole('combobox').fill('caja');
  await ventana(pagina).getByRole('option', { name: /Caja/ }).click();
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Guardaste el egreso.' }).waitFor();
  assert.equal((await leerBase(pagina, 'movimientos')).length, 62);
  // Restablecer.
  await pagina.goto(`${entorno.servidor.url}#ajustes`);
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
  await ventana(pagina).getByRole('button', { name: 'Restablecer' }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Cargaste los datos de ejemplo.' }).waitFor();
  assert.deepEqual(await leerBase(pagina, 'movimientos'), inicial, 'los mismos 61, sin cambios');
  assert.deepEqual(await saldosEnInicio(pagina), SALDOS);
  // Borrar.
  await pagina.goto(`${entorno.servidor.url}#ajustes`);
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await ventana(pagina).getByRole('button', { name: 'Borrar', exact: true }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Borraste los datos de prueba.' }).waitFor();
  assert.deepEqual(await leerBase(pagina, 'movimientos'), []);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-38 ajuste A (D-170) · el campo del formulario de cuenta se llama «Ícono», no «Emoji»', async () => {
  const { contexto, pagina, errores } = await conModoPrueba({ viewport: ESCRITORIO });
  await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
  await pagina.getByRole('button', { name: /Crear la primera|Nueva cuenta/ }).click();
  const formulario = ventana(pagina);
  await formulario.getByLabel('Ícono').waitFor();
  assert.equal(await formulario.getByLabel('Emoji').count(), 0);
  assert.equal(await formulario.getByText('Emoji').count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-38 ajuste B (P-043) · Movimientos muestra las fechas de cada período debajo del selector (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conModoPrueba({ viewport });
    await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
    await pagina.goto(`${entorno.servidor.url}#movimientos`);
    const periodo = pagina.getByLabel('Período');
    const fechas = pagina.locator('.fechas-periodo');
    await fechas.waitFor();
    assert.equal(await fechas.textContent(), '01/10/2026 al 31/10/2026', 'este mes por defecto');
    for (const [opcion, esperado] of [
      ['mes-anterior', '01/09/2026 al 30/09/2026'],
      ['ultimos-3', '01/08/2026 al 31/10/2026'],
      ['este-anio', '01/01/2026 al 31/12/2026'],
      ['todo', 'desde el primer movimiento (01/08/2026)'],
    ]) {
      await periodo.selectOption(opcion);
      assert.equal(await fechas.textContent(), esperado, opcion);
    }
    assert.equal(await periodo.getAttribute('aria-describedby'), await fechas.getAttribute('id'));
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-38 corrección P-052 · los datos de ejemplo tienen solo «Ayuda familiar» (no «Aporte familiar»)', async () => {
  const { contexto, pagina, errores } = await conModoPrueba({ viewport: ESCRITORIO });
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  const categorias = await leerBase(pagina, 'categorias');
  assert.deepEqual(categorias.filter((c) => c.nombre.includes('familiar')).map((c) => c.nombre), ['Ayuda familiar']);
  assert.equal(categorias.filter((c) => c.tipo === 'ingreso').length, 10, '11 de antes menos «Aporte familiar»');
  assert.equal(new Set(categorias.map((c) => c.emoji)).size, categorias.length, 'cada categoría conserva un ícono único');
  assert.deepEqual(errores, []);
  await contexto.close();
});
