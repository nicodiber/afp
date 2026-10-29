// HU-22: AFP empieza vacía, sin bienvenida ni plantilla. Valores esperados escritos a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VISTAS = [['celular', CELULAR], ['PC', ESCRITORIO]];
const hayBienvenida = (pagina) => pagina.evaluate(() => /bienvenida|plantilla/i.test(document.body.innerText) || !!document.querySelector('.bienvenida, #empezar-plantilla, #empezar-vacio'));
const activarPrueba = async (pagina) => {
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.locator('.franja-prueba').waitFor();
};

for (const [nombre, viewport] of VISTAS) {
  test(`HU-22 CA-1 · una base nueva abre en Inicio vacío, sin bienvenida, con la navegación (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport });
    await pagina.getByRole('button', { name: 'Crear la primera' }).waitFor();
    assert.equal(await pagina.locator('main h1').textContent(), 'Inicio');
    assert.match(await textoPrincipal(pagina), /Todavía no tenés cuentas\./);
    assert.equal(await hayBienvenida(pagina), false);
    assert.equal(await pagina.locator('.navegacion').isVisible(), true);
    assert.equal(await pagina.title(), 'Inicio · AFP');
    // Ninguna ruta pasa por una bienvenida.
    for (const [ruta, titulo] of [['#ajustes', 'Ajustes'], ['#ajustes/cuentas', 'Cuentas'], ['#ajustes/categorias', 'Categorías'], ['#inicio', 'Inicio']]) {
      const otra = await contexto.newPage();
      await otra.goto(entorno.servidor.url + ruta);
      await otra.locator('main h1').filter({ hasText: titulo }).waitFor();
      assert.equal(await hayBienvenida(otra), false, ruta);
      await otra.close();
    }
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-22 CA-1 · la base de prueba nueva también abre en Inicio vacío (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#ajustes');
    await activarPrueba(pagina);
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.reload();
    await pagina.getByRole('button', { name: 'Crear la primera' }).waitFor();
    assert.equal(await hayBienvenida(pagina), false);
    assert.equal(await pagina.locator('main h1').textContent(), 'Inicio');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-22 CA-2 · una base con datos o con la configuración de versiones anteriores sigue igual (${nombre})`, async () => {
    for (const marca of [true, false]) {
      const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#ajustes');
      // Configuración de v0.2.0-5 o anterior, escrita a mano en la base real.
      await pagina.evaluate(async (inicioCompletado) => {
        const base = await new Promise((ok, mal) => { const p = indexedDB.open('afp-dev'); p.onsuccess = () => ok(p.result); p.onerror = () => mal(p.error); });
        await new Promise((ok, mal) => {
          const tx = base.transaction('configuracion', 'readwrite');
          const almacen = tx.objectStore('configuracion');
          const g = almacen.get('config');
          g.onsuccess = () => { almacen.put({ ...(g.result ?? { id: 'config' }), inicioCompletado }); };
          tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
        });
        base.close();
      }, marca);
      await pagina.goto(entorno.servidor.url + '#inicio');
      await pagina.reload();
      await pagina.getByRole('button', { name: 'Crear la primera' }).waitFor();
      assert.equal(await hayBienvenida(pagina), false);
      // Crear una cuenta funciona como siempre.
      await pagina.getByRole('button', { name: 'Crear la primera' }).click();
      await pagina.getByLabel('Nombre').fill('Efectivo');
      await pagina.getByRole('button', { name: /Guardar|Crear/ }).last().click();
      await pagina.getByText('Efectivo').first().waitFor();
      await pagina.reload();
      await pagina.getByText('Efectivo').first().waitFor();
      assert.equal(await hayBienvenida(pagina), false);
      for (const [ruta, titulo] of [['#ajustes/cuentas', 'Cuentas'], ['#ajustes/categorias', 'Categorías'], ['#ajustes/monedas', 'Monedas']]) {
        await pagina.goto(entorno.servidor.url + ruta);
        await pagina.locator('main h1').filter({ hasText: titulo }).waitFor();
      }
      assert.deepEqual(errores, []);
      await contexto.close();
    }
  });

  test(`HU-22 CA-3 · datos de ejemplo: cargar, restablecer y borrar; borrar deja Inicio vacío y la base real no se toca (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#ajustes');
    await activarPrueba(pagina);
    await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.locator('main h1').filter({ hasText: 'Inicio' }).waitFor();
    await pagina.waitForFunction(() => !document.querySelector('main').innerText.includes('Todavía no tenés cuentas.') && document.querySelectorAll('main li, main article').length > 0);
    await pagina.goto(entorno.servidor.url + '#ajustes');
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
    await pagina.getByRole('dialog').getByRole('button', { name: 'Restablecer' }).click();
    await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
    await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
    await pagina.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
    await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).waitFor();
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.reload();
    await pagina.getByRole('button', { name: 'Crear la primera' }).waitFor();
    assert.match(await textoPrincipal(pagina), /Todavía no tenés cuentas\./);
    assert.equal(await hayBienvenida(pagina), false);
    assert.equal(await pagina.locator('main h1').textContent(), 'Inicio');
    // La base real sigue vacía: no se tocó.
    const reales = await pagina.evaluate(async () => {
      const base = await new Promise((ok, mal) => { const p = indexedDB.open('afp-dev'); p.onsuccess = () => ok(p.result); p.onerror = () => mal(p.error); });
      const n = await new Promise((ok) => { const r = base.transaction('cuentas').objectStore('cuentas').count(); r.onsuccess = () => ok(r.result); });
      base.close();
      return n;
    });
    assert.equal(reales, 0);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-22 CA-4 · ya no existen la plantilla ni la pantalla de bienvenida', async () => {
  for (const ruta of ['plantilla/plantilla-inicial.json', 'src/ui/pantallas/bienvenida.js', 'src/dominio/plantilla.js', 'src/adaptadores/plantilla.js']) {
    await assert.rejects(access(new URL(`../../${ruta}`, import.meta.url)), { code: 'ENOENT' }, ruta);
  }
});
