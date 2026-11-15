// HU-43: Movimientos en la PC (título, filtros, totales en tarjetas, lista con «Egresos por categoría» a la derecha), barra lateral que
// empuja el contenido y resumen del mes en dólares. Valores esperados escritos a mano; «hoy» es 31/10/2026 en modo prueba.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = '\u00a0';
const MENOS = '−';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

/** Abre AFP con los datos de ejemplo (modo prueba) y, si hay, siembra movimientos de más; deja la pantalla en `ruta`. */
async function conEjemplo(opciones, ruta, extras = []) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  if (extras.length) {
    await r.pagina.evaluate((lista) => new Promise((ok, fallo) => {
      const p = indexedDB.open('afp-dev-prueba');
      p.onsuccess = () => {
        const t = p.result.transaction('movimientos', 'readwrite');
        for (const m of lista) t.objectStore('movimientos').put(m);
        t.oncomplete = () => { p.result.close(); ok(); };
        t.onerror = () => fallo(t.error);
      };
    }), extras);
  }
  await r.pagina.goto(`${entorno.servidor.url}${ruta}`);
  await r.pagina.reload();
  await r.pagina.locator('main h1').waitFor();
  return r;
}
const enMovimientos = async (opciones) => { const r = await conEjemplo(opciones, '#movimientos'); await r.pagina.locator('.movs-fila').first().waitFor(); return r; };
const usd = (id, tipo, fecha, monto) => ({
  id, tipo, fecha, hora: '10:00', descripcion: id, estado: 'confirmado', origen: 'manual', cuentaId: 'cue-dolares', monedaId: 'USD', montoTotal: monto,
  asientos: [{ cuentaId: 'cue-dolares', monto: tipo === 'egreso' ? -monto : monto }], partes: [],
});
const caja = (pagina, selector) => pagina.locator(selector).first().boundingBox();
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('HU-43 CA-1 · PC: de arriba abajo, el título, los filtros en una fila, los totales en tarjetas y la lista con las barras a su derecha', async () => {
  const { contexto, pagina, errores } = await enMovimientos({ viewport: { width: 1366, height: 768 } });
  const [titulo, filtros, totales, lista, barras] = await Promise.all(['main h1', '.movs-filtros', '.movs-totales', '.movs-lista', '.movs-barras'].map((s) => caja(pagina, s)));
  assert.ok(titulo.y + titulo.height <= filtros.y && filtros.y + filtros.height <= totales.y && totales.y + totales.height <= lista.y, 'título, filtros, totales y lista, en ese orden');
  assert.ok(lista.x + lista.width <= barras.x && Math.abs(lista.y - barras.y) <= 1, 'las barras, a la derecha de la lista');
  assert.ok(lista.width > barras.width * 2, `lista ancha (${lista.width}) y gráfico angosto (${barras.width})`);
  // Los filtros van en una sola fila: período, tipo, categoría, cuenta y búsqueda a la misma altura.
  const ys = await pagina.locator('.movs-filtros select:visible, .movs-filtros input[type="search"]').evaluateAll((l) => l.map((x) => Math.round(x.getBoundingClientRect().y)));
  assert.equal(ys.length, 5);
  assert.ok(Math.max(...ys) - Math.min(...ys) <= 1, `los cinco filtros en una fila (${ys})`);
  assert.ok(await pagina.locator('.movs-filtros input[type="search"]').evaluate((x) => x.getBoundingClientRect().x) > await pagina.getByLabel('Cuenta', { exact: true }).evaluate((x) => x.getBoundingClientRect().x), 'la búsqueda va al final');
  // Totales del mes (octubre) como tarjetas, en una fila, con los colores de Inicio.
  const tarjetas = await pagina.locator('.movs-totales .indicador').evaluateAll((l) => l.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent, Math.round(x.getBoundingClientRect().y)]));
  assert.deepEqual(tarjetas.map((t) => t.slice(0, 2)), [['Ingresos', `+$${E}1.070.000,00`], ['Egresos', `${MENOS}$${E}580.900,00`], ['Diferencia', `+$${E}489.100,00`]]);
  assert.equal(new Set(tarjetas.map((t) => t[2])).size, 1, 'las tres tarjetas en una fila');
  assert.deepEqual(await pagina.locator('.movs-totales .indicador-valor').evaluateAll((l) => l.map((x) => getComputedStyle(x).color)), ['rgb(17, 99, 61)', 'rgb(174, 70, 48)', 'rgb(17, 99, 61)']);
  const estilo = (selector) => pagina.locator(selector).first().evaluate((x) => { const c = getComputedStyle(x); return [c.borderRadius, c.padding, c.boxShadow, c.backgroundColor, c.borderTopWidth]; });
  const deMovimientos = await estilo('.movs-totales .indicador');
  assert.equal(deMovimientos[0], '20px', 'tarjeta redondeada como la de Inicio');
  await pagina.goto(`${entorno.servidor.url}#inicio`);
  await pagina.locator('.grupo-mes .indicador').first().waitFor();
  assert.deepEqual(deMovimientos, await estilo('.grupo-mes .indicador'), 'mismo estilo que las tarjetas de Inicio');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-43 CA-1 · PC: con el ancho justo los filtros bajan a una segunda línea y no hay desborde; en 720 px las barras quedan debajo de la lista', async () => {
  const { contexto, pagina, errores } = await enMovimientos({ viewport: { width: 720, height: 800 } });
  const ys = await pagina.locator('.movs-filtros select:visible, .movs-filtros input[type="search"]').evaluateAll((l) => l.map((x) => Math.round(x.getBoundingClientRect().y)));
  assert.ok(new Set(ys).size >= 2, `bajan a una segunda línea (${ys})`);
  const [lista, barras] = await Promise.all(['.movs-lista', '.movs-barras'].map((s) => caja(pagina, s)));
  assert.ok(lista.y + lista.height <= barras.y, 'sin lugar al costado, las barras van debajo');
  assert.ok(await sinDesborde(pagina));
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-43 CA-1 · celular: el orden no cambia (búsqueda y filtros arriba, la lista y los totales al pie, sin barras)', async () => {
  const { contexto, pagina, errores } = await enMovimientos({ viewport: CELULAR });
  const [buscador, lista, totales] = await Promise.all(['.movs-buscador', '.movs-lista', '.movs-totales'].map((s) => caja(pagina, s)));
  assert.ok(buscador.y < lista.y && lista.y + lista.height <= totales.y + 1);
  assert.equal(await pagina.locator('.movs-barras').isVisible(), false);
  assert.ok(await sinDesborde(pagina));
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const ancho of [720, 1024, 1280, 1366]) {
  for (const ruta of ['#movimientos', '#inicio', '#ajustes/cuentas', '#ajustes/categorias']) {
    test(`HU-43 CA-2 · ${ancho} px, ${ruta}: con la barra expandida el contenido se angosta y los montos siguen a la vista, sin desborde`, async () => {
      const { contexto, pagina, errores } = await conEjemplo({ viewport: { width: ancho, height: 800 } }, ruta);
      await pagina.locator('.movs-fila, .tarjeta-cuenta, .fila-categoria, main h1').first().waitFor();
      if (ruta === '#inicio') await pagina.locator('.ultimos-lista .movs-fila').first().waitFor();
      const ancho_main = async () => (await pagina.locator('main').boundingBox()).width;
      const compacta = await ancho_main();
      await pagina.locator('.navegacion').hover();
      await pagina.waitForFunction(() => document.querySelector('.navegacion').getBoundingClientRect().width > 200);
      await pagina.waitForTimeout(150);
      const navegacion = await pagina.locator('.navegacion').boundingBox();
      assert.ok(await ancho_main() < compacta - 100, 'el contenido se angosta al expandirse la barra');
      const medidas = await pagina.evaluate(() => {
        const fila = document.querySelector('.movs-fila');
        const monto = fila?.querySelector('.movs-monto');
        const texto = fila?.querySelector('.movs-texto');
        const r = (x) => x?.getBoundingClientRect();
        return {
          ventana: window.innerWidth, ancho: document.documentElement.scrollWidth, izquierdaMain: r(document.querySelector('main')).left,
          monto: monto ? [r(monto).left, r(monto).right] : null, filaDerecha: fila ? r(fila).right : null, textoDerecha: texto ? r(texto).right : null,
          anchoMonto: monto ? monto.scrollWidth - monto.clientWidth : 0,
        };
      });
      assert.ok(medidas.ancho <= medidas.ventana, `sin desborde horizontal (${medidas.ancho} > ${medidas.ventana})`);
      assert.ok(medidas.izquierdaMain >= navegacion.x + navegacion.width - 1, 'el contenido no queda tapado por la barra');
      if (medidas.monto) {
        assert.ok(medidas.monto[1] <= medidas.ventana, `el monto de la primera fila queda dentro de la ventana (${medidas.monto[1]} > ${medidas.ventana})`);
        assert.ok(medidas.monto[1] <= medidas.filaDerecha + 0.5 && medidas.monto[0] >= medidas.textoDerecha - 0.5, 'el monto entero está dentro de su fila y no se pisa con el texto');
        assert.equal(medidas.anchoMonto, 0, 'el monto no está recortado');
      }
      assert.deepEqual(errores, []);
      await contexto.close();
    });
  }
}

for (const [nombre, ruta] of [['Movimientos', '#movimientos'], ['Inicio', '#inicio']]) {
  test(`HU-43 · axe-core sin problemas graves en ${nombre} (PC 1366 × 768)`, async () => {
    const { contexto, pagina, errores } = await conEjemplo({ viewport: { width: 1366, height: 768 }, bypassCSP: true }, ruta);
    await pagina.locator('.movs-fila').first().waitFor();
    await pagina.addScriptTag({ path: AXE });
    const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((x) => x.target).join(' | ')}`));
    assert.deepEqual(graves, []);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

const filaUsd = (pagina) => pagina.locator('.grupo-mes .indicadores').evaluateAll((dls) => dls.map((dl) => [...dl.querySelectorAll('.indicador')].map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent])));

test('HU-43 CA-3 · con movimientos en dólares este mes, el resumen suma una segunda fila en US$ sin convertir', async () => {
  // Octubre: ingreso US$ 500,00 + ingreso US$ 20,50 = 520,50; egreso US$ 120,25; diferencia 400,25. Septiembre no cuenta.
  const extras = [usd('u1', 'ingreso', '2026-10-05', 50000), usd('u2', 'ingreso', '2026-10-31', 2050), usd('u3', 'egreso', '2026-10-20', 12025), usd('u4', 'egreso', '2026-09-30', 99999)];
  for (const viewport of [{ width: 1366, height: 768 }, CELULAR]) {
    const { contexto, pagina, errores } = await conEjemplo({ viewport }, '#inicio', extras);
    await pagina.locator('.grupo-mes').waitFor();
    assert.deepEqual(await filaUsd(pagina), [
      [['Ingresos', `+$${E}1.070.000,00`], ['Egresos', `${MENOS}$${E}580.900,00`], ['Diferencia', `+$${E}489.100,00`]],
      [['Ingresos', `+US$${E}520,50`], ['Egresos', `${MENOS}US$${E}120,25`], ['Diferencia', `+US$${E}400,25`]],
    ], 'primero pesos, después dólares, sin convertir');
    assert.equal(await pagina.locator('.grupo-mes .indicadores').nth(1).evaluate((x) => x.querySelectorAll('.indicador').length), 3);
    const [pesos, dolares] = await pagina.locator('.grupo-mes .indicadores').evaluateAll((l) => l.map((x) => x.getBoundingClientRect().y));
    assert.ok(dolares > pesos, 'la fila en dólares va debajo');
    assert.ok(await sinDesborde(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});

test('HU-43 CA-3 · sin movimientos en dólares este mes (solo en otro mes, o ninguno), no hay segunda fila', async () => {
  for (const extras of [[], [usd('u9', 'egreso', '2026-09-30', 5000)]]) {
    const { contexto, pagina, errores } = await conEjemplo({ viewport: { width: 1366, height: 768 } }, '#inicio', extras);
    await pagina.locator('.grupo-mes').waitFor();
    assert.equal(await pagina.locator('.grupo-mes .indicadores').count(), 1);
    assert.deepEqual(errores, []);
    await contexto.close();
  }
});
