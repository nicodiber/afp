// aep#14 (D-136): al editar una cuenta, el foco va al título y no a un campo (no se abre el teclado del celular).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const foco = (pagina) => pagina.evaluate(() => ({ etiqueta: document.activeElement.tagName, texto: document.activeElement.textContent, id: document.activeElement.id }));
const ventana = (pagina) => pagina.locator('dialog[open]').last();

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#14 CA-1 a CA-4 · editar abre con el foco en el título; nueva, en el nombre (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#ajustes');
    await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
    await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
    // Desde Inicio.
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.locator('#tarjeta-cue-caja').click();
    await ventana(pagina).waitFor();
    assert.deepEqual(await foco(pagina).then((f) => [f.etiqueta, f.texto]), ['H2', 'Editar cuenta'], 'Inicio: foco en el título');
    await pagina.keyboard.press('Tab');
    assert.equal(await pagina.evaluate(() => document.activeElement.name), 'nombre', 'Tab lleva al nombre');
    await pagina.keyboard.press('Escape');
    await ventana(pagina).waitFor({ state: 'detached' });
    assert.equal((await foco(pagina)).id, 'tarjeta-cue-caja');
    // Desde Ajustes → «Cuentas».
    await pagina.goto(entorno.servidor.url + '#ajustes/cuentas');
    await pagina.locator('#cuenta-cue-caja').click();
    await ventana(pagina).waitFor();
    assert.deepEqual(await foco(pagina).then((f) => [f.etiqueta, f.texto]), ['H2', 'Editar cuenta'], 'Cuentas: foco en el título');
    assert.equal(await pagina.evaluate(() => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)), false, 'ningún campo');
    await pagina.keyboard.press('Escape');
    assert.equal((await foco(pagina)).id, 'cuenta-cue-caja', 'Esc devuelve el foco a la cuenta (aep#13 CA-1)');
    // CA-3: «Nueva cuenta», con el cursor en el nombre.
    await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
    await ventana(pagina).waitFor();
    assert.equal(await pagina.evaluate(() => document.activeElement.name), 'nombre');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
