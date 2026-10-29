// aep#2 CA-8 (parte de axe-core) y CA-9: accesibilidad y recorrido con el teclado.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

for (const [nombre, viewport] of [['celular', CELULAR], ['escritorio', ESCRITORIO]]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`aep#2 CA-8 · axe-core sin problemas graves ni críticos (${nombre}, ${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
      // bypassCSP: axe-core se inyecta solo en la prueba; la página no permite scripts ajenos.
      const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { viewport, colorScheme, bypassCSP: true });
      // aep#6 CA-7: también con el modo prueba activo (franja e interruptor).
      for (const ruta of ['#inicio', '#movimientos', '#ajustes', 'modo-prueba']) {
        if (ruta === 'modo-prueba') {
          await pagina.goto(entorno.servidor.url + '#ajustes');
          await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
          await pagina.locator('.franja-prueba').waitFor();
          await pagina.addScriptTag({ path: AXE });
          const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
            .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
          assert.deepEqual(graves, [], 'modo prueba');
          continue;
        }
        await pagina.goto(entorno.servidor.url + ruta);
        await pagina.waitForSelector('main h1');
        await pagina.addScriptTag({ path: AXE });
        const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
          .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
        assert.deepEqual(graves, [], ruta);
      }
      await contexto.close();
    });
  }
}

for (const [nombre, viewport] of [['celular', CELULAR], ['escritorio', ESCRITORIO]]) {
  test(`aep#2 CA-9 · con Tab y Shift+Tab se llega a todos los controles y el foco siempre se ve (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport });
    const controles = await pagina.evaluate(() => [...document.querySelectorAll('a[href], button')].filter((e) => !e.closest('[hidden]')).length);
    const recorrer = async (tecla) => {
      const vistos = [];
      for (let i = 0; i < controles + 3; i += 1) {
        await pagina.keyboard.press(tecla);
        const foco = await pagina.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return { id: e.textContent.trim() || e.getAttribute('aria-label'), contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, visible: r.width > 0 && r.height > 0 };
        });
        if (!foco) continue;
        assert.ok(foco.contorno, `contorno de foco en «${foco.id}»`);
        assert.ok(foco.visible, `«${foco.id}» se ve al tener el foco`);
        if (!vistos.includes(foco.id)) vistos.push(foco.id);
      }
      return vistos;
    };
    const adelante = await recorrer('Tab');
    assert.equal(adelante.length, controles, `llega a los ${controles} controles: ${adelante.join(', ')}`);
    const atras = await recorrer('Shift+Tab');
    assert.deepEqual([...atras].sort(), [...adelante].sort());
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
