// aep#6: modo prueba con franja y fecha simulada; aep#5: orden de los botones de la tarjeta de instalación.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, abrir, activarModoPrueba, CELULAR, ESCRITORIO } from './comun.mjs';

let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const franja = (pagina) => pagina.locator('.franja-prueba');
const interruptor = (pagina) => pagina.getByRole('switch', { name: 'Modo prueba' });

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#6 CA-1 y CA-2 · activar muestra la franja en todas las pantallas; desactivar la saca (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport }, '#ajustes');
    assert.equal(await franja(pagina).isVisible(), false);
    assert.equal(await interruptor(pagina).getAttribute('aria-checked'), 'false');
    await activarModoPrueba(pagina);
    assert.equal(await interruptor(pagina).getAttribute('aria-checked'), 'true');
    await franja(pagina).waitFor();
    assert.equal((await franja(pagina).innerText()).trim(), 'MODO PRUEBA · fecha simulada 31/10/2026');
    const caja = await franja(pagina).boundingBox();
    assert.ok(caja.y <= 1 && caja.width >= viewport.width - 1, 'arriba de todo y de lado a lado');
    for (const ruta of ['#inicio', '#movimientos', '#analisis']) {
      await pagina.goto(entorno.servidor.url + ruta);
      await pagina.waitForSelector('main h1');
      assert.ok(await franja(pagina).isVisible(), ruta);
      // Nada queda tapado por la franja: el contenido y la barra empiezan debajo.
      const debajo = await pagina.evaluate(() => {
        const alto = document.querySelector('.franja-prueba').getBoundingClientRect().bottom;
        const primero = document.querySelector(innerWidth >= 720 ? 'nav' : 'header').getBoundingClientRect().top;
        return primero >= alto - 1;
      });
      assert.ok(debajo, `${ruta}: la franja no tapa nada`);
    }
    await pagina.goto(entorno.servidor.url + '#ajustes');
    await interruptor(pagina).click();
    await franja(pagina).waitFor({ state: 'hidden' });
    assert.equal(await pagina.getByLabel('Fecha simulada').count(), 0, 'sin el campo de fecha');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#6 CA-3 · cambiar la fecha simulada y volver al 31/10/2026', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, {}, '#ajustes');
  await activarModoPrueba(pagina);
  await pagina.getByLabel('Fecha simulada').fill('2026-11-15');
  await pagina.waitForFunction(() => document.querySelector('.franja-prueba')?.textContent.includes('15/11/2026'));
  assert.equal((await franja(pagina).innerText()).trim(), 'MODO PRUEBA · fecha simulada 15/11/2026');
  await pagina.getByRole('button', { name: 'Volver al 31/10/2026' }).click();
  await pagina.waitForFunction(() => document.querySelector('.franja-prueba')?.textContent.includes('31/10/2026'));
  assert.equal(await pagina.getByLabel('Fecha simulada').inputValue(), '2026-10-31');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#6 CA-4 · se recuerda al volver a abrir, sin saltos', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, {}, '#ajustes');
  await activarModoPrueba(pagina);
  await pagina.getByLabel('Fecha simulada').fill('2026-11-15');
  await pagina.waitForFunction(() => document.querySelector('.franja-prueba')?.textContent.includes('15/11/2026'));
  await pagina.close();
  const otra = await contexto.newPage();
  await otra.addInitScript(() => {
    window.desplazamiento = 0;
    new PerformanceObserver((lista) => { for (const e of lista.getEntries()) if (!e.hadRecentInput) window.desplazamiento += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  await otra.goto(entorno.servidor.url);
  await otra.waitForSelector('main h1');
  await otra.evaluate(() => document.fonts.ready);
  await otra.waitForTimeout(500);
  assert.equal((await franja(otra).innerText()).trim(), 'MODO PRUEBA · fecha simulada 15/11/2026');
  const cls = await otra.evaluate(() => window.desplazamiento);
  assert.ok(cls <= 0.1, `CLS ${cls}`);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#6 CA-7 · el interruptor se anuncia con su estado y la franja tiene contraste en los dos temas', async () => {
  for (const colorScheme of ['light', 'dark']) {
    const { contexto, pagina } = await abrir(entorno.navegador, entorno.servidor, { colorScheme }, '#ajustes');
    await activarModoPrueba(pagina);
    await franja(pagina).waitFor();
    const contraste = await pagina.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.franja-prueba'));
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [a, b] = [lum(s.color), lum(s.backgroundColor)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    assert.ok(contraste >= 4.5, `contraste ${contraste.toFixed(2)} en ${colorScheme}`);
    await contexto.close();
  }
});

test('aep#5 CA-1 · en la tarjeta de instalación, «Ahora no» a la izquierda e «Instalar» a la derecha, también con Tab', async () => {
  for (const viewport of [CELULAR, ESCRITORIO]) {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport });
    await pagina.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    const tarjeta = pagina.getByRole('region', { name: 'Instalá AFP' });
    const ahoraNo = await tarjeta.getByRole('button', { name: 'Ahora no' }).boundingBox();
    const instalar = await tarjeta.getByRole('button', { name: 'Instalar' }).boundingBox();
    assert.ok(ahoraNo.x + ahoraNo.width <= instalar.x, '«Ahora no» a la izquierda de «Instalar»');
    await tarjeta.getByRole('button', { name: 'Ahora no' }).focus();
    await pagina.keyboard.press('Tab');
    assert.equal(await pagina.evaluate(() => document.activeElement.textContent), 'Instalar');
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});
