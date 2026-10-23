// aep#13: editar en ventana en la PC, velo oscuro, mayúscula inicial y saldo sin «0». Valores de la spec.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const E = ' ';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function conEjemplo(opciones) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  return r;
}
const irACuentas = async (pagina) => {
  await pagina.goto(entorno.servidor.url + '#ajustes/cuentas');
  await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
};
const ventana = (pagina) => pagina.locator('dialog[open]').last();

test('aep#13 CA-1 · en la PC, editar desde Cuentas abre una ventana y Esc devuelve el foco a la cuenta', async () => {
  const { contexto, pagina, errores } = await conEjemplo({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await pagina.locator('#cuenta-cue-caja').click();
  await ventana(pagina).getByRole('heading', { name: 'Editar cuenta' }).waitFor();
  assert.equal(await pagina.locator('aside').count(), 0, 'nada al costado');
  assert.equal(await ventana(pagina).evaluate((d) => d.classList.contains('ventana-pantalla')), false, 'ventana, no pantalla completa');
  await pagina.keyboard.press('Escape');
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.evaluate(() => document.activeElement.id), 'cuenta-cue-caja');
  await pagina.locator('#cuenta-cue-caja').click();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.evaluate(() => document.activeElement.id), 'cuenta-cue-caja');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#13 CA-2 y CA-3 · desde Inicio en la PC, la misma ventana; en el celular, pantalla completa', async () => {
  for (const [viewport, completa] of [[ESCRITORIO, false], [CELULAR, true]]) {
    const { contexto, pagina, errores } = await conEjemplo({ viewport });
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.locator('#tarjeta-cue-caja').click();
    await ventana(pagina).getByRole('heading', { name: 'Editar cuenta' }).waitFor();
    assert.equal(await ventana(pagina).evaluate((d) => d.classList.contains('ventana-pantalla')), completa, completa ? 'celular' : 'PC');
    await irACuentas(pagina);
    await pagina.locator('#cuenta-cue-caja').click();
    assert.equal(await ventana(pagina).evaluate((d) => d.classList.contains('ventana-pantalla')), completa, `Cuentas (${completa ? 'celular' : 'PC'})`);
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});

test('aep#13 CA-4 · detrás de una ventana la pantalla se oscurece, en claro y en oscuro', async () => {
  // Luminancia relativa (WCAG) del color que se ve detrás: el fondo de la página bajo el velo.
  const luminancia = ([r, g, b]) => {
    const c = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
  };
  for (const [colorScheme, elegir] of [['light', null], ['dark', null], ['light', 'Oscuro']]) {
    const { contexto, pagina, errores } = await conEjemplo({ viewport: ESCRITORIO, colorScheme });
    if (elegir) await pagina.getByRole('button', { name: elegir }).click();
    await irACuentas(pagina);
    await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
    await ventana(pagina).waitFor();
    const { fondo, velo } = await pagina.evaluate(() => {
      const rgba = (t) => t.match(/[\d.]+/g).map(Number);
      return { fondo: rgba(getComputedStyle(document.body).backgroundColor), velo: rgba(getComputedStyle(document.querySelector('dialog[open]'), '::backdrop').backgroundColor) };
    });
    const alfa = velo[3] ?? 1;
    const visto = fondo.slice(0, 3).map((v, i) => v * (1 - alfa) + velo[i] * alfa);
    assert.ok(luminancia(visto) < luminancia(fondo) * 0.6, `${colorScheme}${elegir ? ' + Oscuro' : ''}: ${fondo} → ${visto.map(Math.round)}`);
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});

test('aep#13 CA-5 · el nombre empieza con mayúscula mientras escribís', async () => {
  const { contexto, pagina, errores } = await conEjemplo({ viewport: CELULAR });
  await irACuentas(pagina);
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  const nombre = ventana(pagina).getByLabel('Nombre');
  assert.equal(await nombre.getAttribute('autocapitalize'), 'sentences');
  await nombre.pressSequentially('banco');
  assert.equal(await nombre.inputValue(), 'Banco', 'mientras escribís');
  await nombre.pressSequentially(' nación');
  assert.equal(await nombre.inputValue(), 'Banco nación');
  await ventana(pagina).getByRole('button', { name: 'Crear cuenta' }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('.fila-nombre > span').textContent(), 'Banco nación');
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  await ventana(pagina).getByLabel('Nombre').pressSequentially('BBVA');
  assert.equal(await ventana(pagina).getByLabel('Nombre').inputValue(), 'BBVA');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#13 CA-6 · el saldo inicial empieza vacío con «0» de ejemplo, y vacío es 0', async () => {
  const { contexto, pagina, errores } = await conEjemplo({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  const saldo = ventana(pagina).getByLabel('Saldo inicial');
  assert.equal(await saldo.inputValue(), '');
  assert.equal(await saldo.getAttribute('placeholder'), '0');
  await ventana(pagina).getByLabel('Nombre').fill('Sin saldo');
  await ventana(pagina).getByRole('button', { name: 'Crear cuenta' }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('.fila-monto').textContent(), `$${E}0,00`);
  // Lo mal escrito sigue sin guardarse.
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  await ventana(pagina).getByLabel('Nombre').fill('Mal');
  await ventana(pagina).getByLabel('Saldo inicial').fill('abc');
  await ventana(pagina).getByRole('button', { name: 'Crear cuenta' }).click();
  await ventana(pagina).locator('.error-campo', { hasText: 'Escribí un monto con hasta 2 decimales.' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});
