// Recorrido de la página de pruebas de factibilidad, en escritorio y en 390 × 844, con y sin conexión.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { iniciarServidor } from '../servidor.mjs';

let servidor;
let navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); await servidor?.cerrar(); });

// Respuestas grabadas: las pruebas no salen a internet.
const GRABADAS = [
  [/dolarapi\.com\/v1\/dolares\/oficial$/, { venta: 1450, fechaActualizacion: '2026-10-31T12:00:00Z' }],
  [/dolarapi\.com\/v1\/dolares$/, [{ casa: 'oficial' }, { casa: 'blue' }]],
  [/argentinadatos\.com\/v1\/cotizaciones\/dolares\//, [{ fecha: '2025-01-01' }, { fecha: '2026-10-30' }]],
  [/argentinadatos\.com\/v1\/finanzas\/indices\/inflacion$/, [{ fecha: '2026-09-30', valor: 2.1 }]],
  [/apis\.datos\.gob\.ar\//, { data: [['2026-09-01', 100]] }],
];

for (const [nombre, viewport] of [['escritorio', { width: 1280, height: 900 }], ['celular', { width: 390, height: 844 }]]) {
  test(`factibilidad en ${nombre}`, async () => {
    const contexto = await navegador.newContext({ viewport });
    const externos = [];
    await contexto.route(/^https?:\/\/(?!127\.0\.0\.1)/, (ruta) => {
      const url = ruta.request().url();
      const grabada = GRABADAS.find(([re]) => re.test(url));
      if (!grabada) { externos.push(url); return ruta.abort(); }
      return ruta.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(grabada[1]) });
    });
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(e.message));
    await pagina.goto(servidor.url + 'factibilidad/');
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.reload();
    await pagina.click('#probar');
    await pagina.waitForFunction(() => document.getElementById('probar').textContent.includes('de nuevo'));
    const texto = await pagina.inputValue('#resultados');
    assert.equal((texto.match(/^✓ (DolarApi|ArgentinaDatos|datos\.gob\.ar)/gm) || []).length, 6, texto);
    assert.match(texto, /✓ Base local \(IndexedDB\)/);
    assert.match(texto, /✓ Funciona sin conexión/);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'sin desplazamiento horizontal');

    await contexto.setOffline(true);
    await pagina.reload();
    assert.match(await pagina.textContent('h1'), /Pruebas de factibilidad/);
    await contexto.setOffline(false);

    assert.deepEqual(errores, []);
    assert.deepEqual(externos, [], 'pedidos a destinos no previstos');
    await contexto.close();
  });
}
