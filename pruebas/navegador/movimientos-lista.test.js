// HU-04: Ver y buscar mis movimientos, en el navegador (celular 390×844 y PC). Valores esperados escritos a mano a
// partir de la historia y de los movimientos que siembra cada prueba (hoy es 31/10/2026 en modo prueba).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = ' ';
const MENOS = '−';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VIEWPORTS = [['celular', CELULAR], ['PC', ESCRITORIO]];
const mov = (id, tipo, fecha, hora, monto, categoriaId, cuentaId, descripcion = '') => ({
  id, tipo, fecha, hora, descripcion, estado: 'confirmado', origen: 'manual', cuentaId, monedaId: 'ARS', montoTotal: monto,
  asientos: [{ cuentaId, monto: tipo === 'egreso' ? -monto : monto }], partes: [{ categoriaId, monto }],
});
// Este mes (octubre): e2, e1, e4, e3, i1 (del más nuevo al más viejo). Septiembre: e5, e6. Julio: e7.
const SEMILLA = [
  mov('e1', 'egreso', '2026-10-31', '09:00', 1250000, 'cat-alquiler', 'cue-banco', 'Alquiler de octubre'),
  mov('e2', 'egreso', '2026-10-31', '18:30', 350000, 'cat-supermercado', 'cue-caja', 'Compra del mes'),
  mov('i1', 'ingreso', '2026-10-05', '08:00', 15000000, 'cat-trabajo', 'cue-banco', 'Sueldo'),
  mov('e3', 'egreso', '2026-10-12', '10:00', 80000, 'cat-electricidad', 'cue-banco'),
  mov('e4', 'egreso', '2026-10-20', '12:00', 420000, 'cat-verduleria', 'cue-caja', 'Feria'),
  mov('e5', 'egreso', '2026-09-30', '21:00', 90000, 'cat-kiosco', 'cue-caja', 'Café con facturas'),
  mov('e6', 'egreso', '2026-09-10', '10:00', 500000, 'cat-salud', 'cue-banco'),
  mov('e7', 'egreso', '2026-07-15', '10:00', 100000, 'cat-supermercado', 'cue-caja', 'Compra de julio'),
];

/** Abre AFP en modo prueba con los datos de ejemplo y los movimientos sembrados, y va a Movimientos. */
async function conMovimientos(opciones = {}, { movimientos = SEMILLA, ruta = '#movimientos' } = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await r.pagina.evaluate((lista) => new Promise((ok, fallo) => {
    const p = indexedDB.open('afp-dev-prueba');
    p.onsuccess = () => {
      const db = p.result;
      const t = db.transaction('movimientos', 'readwrite');
      // Los 61 movimientos de los datos de ejemplo (HU-38) se quitan: estas pruebas esperan solo los que siembran.
      t.objectStore('movimientos').clear();
      for (const m of lista) t.objectStore('movimientos').put(m);
      t.oncomplete = () => { db.close(); ok(); };
      t.onerror = () => fallo(t.error);
    };
  }), movimientos);
  await r.pagina.goto(`${entorno.servidor.url}${ruta}`);
  await r.pagina.reload();
  await r.pagina.getByRole('heading', { name: 'Movimientos', level: 1 }).waitFor();
  await r.pagina.locator('.movs').waitFor();
  return r;
}
const filas = (pagina) => pagina.locator('.movs-fila');
const titulos = (pagina) => pagina.locator('.movs-fila .movs-titulo').allTextContents();
const totales = async (pagina) => Object.fromEntries((await pagina.locator('.movs-total').evaluateAll((l) => l.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent]))));
const sinDesplazamientoHorizontal = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const esperarTitulos = (pagina, esperados) => pagina.waitForFunction((e) => JSON.stringify([...document.querySelectorAll('.movs-fila .movs-titulo')].map((x) => x.textContent)) === JSON.stringify(e), esperados);

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-04 CA-1 · la lista del mes: del más nuevo al más viejo, con ícono, descripción, detalle y monto con signo (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conMovimientos({ viewport });
    assert.equal(new URL(pagina.url()).hash, '#movimientos');
    assert.equal(await pagina.title(), 'Movimientos · AFP');
    assert.deepEqual(await titulos(pagina), ['Compra del mes', 'Alquiler de octubre', 'Feria', 'Electricidad', 'Sueldo'], 'sin descripción, el nombre de la categoría');
    assert.deepEqual(await pagina.locator('.movs-fila .movs-icono').allTextContents(), ['🛒', '🔑', '🥦', '💡', '💼']);
    assert.deepEqual(await pagina.locator('.movs-fila .movs-detalle').allTextContents(), [
      '31/10/2026 · 18:30 · Supermercado · Caja', '31/10/2026 · 09:00 · Alquiler · Banco', '20/10/2026 · 12:00 · Verdulería · Caja',
      '12/10/2026 · 10:00 · Electricidad · Banco', '05/10/2026 · 08:00 · Trabajo · Banco',
    ]);
    assert.deepEqual(await pagina.locator('.movs-fila .movs-monto').allTextContents(), [
      `${MENOS}$${E}3.500,00`, `${MENOS}$${E}12.500,00`, `${MENOS}$${E}4.200,00`, `${MENOS}$${E}800,00`, `+$${E}150.000,00`,
    ]);
    const colores = await pagina.locator('.movs-fila .movs-monto').evaluateAll((l) => l.map((x) => getComputedStyle(x).color));
    assert.equal(colores[0], 'rgb(174, 70, 48)', 'egreso en rojo');
    assert.equal(colores[4], 'rgb(17, 99, 61)', 'ingreso en verde');
    assert.ok(await sinDesplazamientoHorizontal(pagina), 'sin desplazamiento horizontal');
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-04 CA-1 · tocar una fila avisa «Editar llega en HU-05.» y sin resultados dice «No hay movimientos con estos filtros.» (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conMovimientos({ viewport });
    await filas(pagina).first().click();
    await pagina.locator('#aviso-breve', { hasText: 'Editar llega en HU-05.' }).waitFor();
    await pagina.getByRole('searchbox', { name: 'Buscar' }).fill('zzz');
    await pagina.locator('.vacio', { hasText: 'No hay movimientos con estos filtros.' }).waitFor();
    assert.equal(await filas(pagina).count(), 0);
    assert.deepEqual(await totales(pagina), { Ingresos: `$${E}0,00`, Egresos: `$${E}0,00`, Diferencia: `$${E}0,00` });
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-04 CA-2 · búsqueda sin mayúsculas ni acentos, por descripción y por categoría (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conMovimientos({ viewport });
    const buscador = pagina.getByRole('searchbox', { name: 'Buscar' });
    await buscador.fill('CAFE');
    await pagina.locator('.vacio').waitFor(); // «Café con facturas» es de septiembre: este mes no hay
    await pagina.getByLabel('Período', { exact: true }).selectOption('todo');
    await esperarTitulos(pagina, ['Café con facturas']);
    await buscador.fill('verduleria');
    await esperarTitulos(pagina, ['Feria']);
    await buscador.fill('electricidad');
    await esperarTitulos(pagina, ['Electricidad']);
    await buscador.fill('');
    assert.equal(await filas(pagina).count(), 8);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-04 CA-2 · períodos: este mes, mes anterior, últimos 3 meses, este año, todo y elegir un mes (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conMovimientos({ viewport });
    const periodo = pagina.getByLabel('Período', { exact: true });
    assert.deepEqual(await periodo.locator('option').allTextContents(), ['Este mes', 'Mes anterior', 'Últimos 3 meses', 'Este año', 'Todo', 'Elegir un mes…']);
    assert.equal(await periodo.inputValue(), 'este-mes', 'por defecto, el mes en curso');
    assert.equal(await pagina.getByLabel('Mes', { exact: true }).isVisible(), false);
    await periodo.selectOption('mes-anterior');
    await esperarTitulos(pagina, ['Café con facturas', 'Salud']);
    await periodo.selectOption('ultimos-3');
    assert.equal(await filas(pagina).count(), 7, 'agosto, septiembre y octubre (sin el de julio)');
    await periodo.selectOption('este-anio');
    assert.equal(await filas(pagina).count(), 8);
    await periodo.selectOption('todo');
    assert.equal(await filas(pagina).count(), 8);
    await periodo.selectOption('mes');
    await pagina.getByLabel('Mes', { exact: true }).fill('2026-07');
    await esperarTitulos(pagina, ['Compra de julio']);
    await pagina.getByLabel('Mes', { exact: true }).fill('2026-09');
    await esperarTitulos(pagina, ['Café con facturas', 'Salud']);
    assert.deepEqual(await totales(pagina), { Ingresos: `$${E}0,00`, Egresos: `${MENOS}$${E}5.900,00`, Diferencia: `${MENOS}$${E}5.900,00` });
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-04 CA-2 · tipo, categoría (una familia incluye sus subcategorías) y cuenta, con sus totales (${nombre})`, async () => {
    const { contexto, pagina, errores } = await conMovimientos({ viewport });
    // Totales del mes: ingresos 150.000,00; egresos 12.500 + 3.500 + 4.200 + 800 = 21.000,00; diferencia 129.000,00.
    assert.deepEqual(await totales(pagina), { Ingresos: `+$${E}150.000,00`, Egresos: `${MENOS}$${E}21.000,00`, Diferencia: `+$${E}129.000,00` });
    await pagina.getByLabel('Tipo', { exact: true }).selectOption('ingreso');
    await esperarTitulos(pagina, ['Sueldo']);
    assert.deepEqual(await totales(pagina), { Ingresos: `+$${E}150.000,00`, Egresos: `$${E}0,00`, Diferencia: `+$${E}150.000,00` });
    await pagina.getByLabel('Tipo', { exact: true }).selectOption('egreso');
    await esperarTitulos(pagina, ['Compra del mes', 'Alquiler de octubre', 'Feria', 'Electricidad']);
    // Familia «Alimentación»: Supermercado y Verdulería.
    await pagina.getByLabel('Categoría', { exact: true }).selectOption({ label: '🍽️ Alimentación' });
    await esperarTitulos(pagina, ['Compra del mes', 'Feria']);
    assert.deepEqual(await totales(pagina), { Ingresos: `$${E}0,00`, Egresos: `${MENOS}$${E}7.700,00`, Diferencia: `${MENOS}$${E}7.700,00` });
    await pagina.getByLabel('Cuenta', { exact: true }).selectOption('cue-caja');
    await esperarTitulos(pagina, ['Compra del mes', 'Feria']);
    await pagina.getByLabel('Cuenta', { exact: true }).selectOption('cue-banco');
    await pagina.locator('.vacio').waitFor();
    await pagina.getByLabel('Cuenta', { exact: true }).selectOption('');
    await pagina.getByLabel('Categoría', { exact: true }).selectOption('');
    // Cambiar de tipo quita la categoría que ya no corresponde.
    await pagina.getByLabel('Tipo', { exact: true }).selectOption('todos');
    await pagina.getByLabel('Categoría', { exact: true }).selectOption({ label: '💼 Trabajo' });
    await esperarTitulos(pagina, ['Sueldo']);
    await pagina.getByLabel('Tipo', { exact: true }).selectOption('egreso');
    assert.equal(await pagina.getByLabel('Categoría', { exact: true }).inputValue(), '');
    assert.equal(await filas(pagina).count(), 4);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-04 CA-2 · celular: filtros arriba (búsqueda a todo el ancho, selects en grilla), tarjetas y totales al pie, sin barras', async () => {
  const { contexto, pagina, errores } = await conMovimientos({ viewport: CELULAR });
  const caja = (selector) => pagina.locator(selector).first().boundingBox();
  const buscador = await caja('.movs-buscador');
  const lista = await caja('.movs-lista');
  const totalesCaja = await caja('.movs-totales');
  assert.ok(buscador.y < lista.y && lista.y + lista.height <= totalesCaja.y + 1, 'filtros, lista y totales, en ese orden');
  const filtros = await caja('.movs-filtros');
  assert.ok(buscador.width >= filtros.width - 1, 'la búsqueda ocupa todo el ancho');
  const periodo = await caja('select >> nth=0');
  const tipo = await caja('select >> nth=1');
  assert.ok(Math.abs(periodo.y - tipo.y) < 2 && tipo.x > periodo.x, 'los selects van en grilla de dos columnas');
  assert.equal(await pagina.locator('.movs-barras').isVisible(), false, 'las barras son de la PC');
  assert.ok(await sinDesplazamientoHorizontal(pagina));
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-04 CA-2 · PC: la lista a la izquierda y un panel de 280 px a la derecha con filtros, totales y «Egresos por categoría»', async () => {
  const { contexto, pagina, errores } = await conMovimientos({ viewport: ESCRITORIO });
  const lista = await pagina.locator('.movs-lista').boundingBox();
  const lado = await pagina.locator('.movs-lado').boundingBox();
  assert.ok(lista.x + lista.width <= lado.x, 'la lista está a la izquierda del panel');
  assert.ok(Math.abs(lado.width - 280) <= 2, `el panel mide unos 280 px (${lado.width})`);
  assert.ok(lista.width > 480, `la lista aprovecha el ancho (${lista.width})`);
  const filtros = await pagina.locator('.movs-filtros').boundingBox();
  const totalesCaja = await pagina.locator('.movs-totales').boundingBox();
  const barras = await pagina.locator('.movs-barras').boundingBox();
  assert.ok(filtros.y < totalesCaja.y && totalesCaja.y < barras.y, 'filtros, totales y barras, de arriba abajo');
  await pagina.getByRole('heading', { name: 'Egresos por categoría', level: 2 }).waitFor();
  // De mayor a menor: Alquiler 12.500, Verdulería 4.200, Supermercado 3.500, Electricidad 800 (solo egresos del mes).
  assert.deepEqual(await pagina.locator('.barra .barra-nombre').allTextContents(), ['🔑 Alquiler', '🥦 Verdulería', '🛒 Supermercado', '💡 Electricidad']);
  assert.deepEqual(await pagina.locator('.barra .barra-monto').allTextContents(), [`$${E}12.500,00`, `$${E}4.200,00`, `$${E}3.500,00`, `$${E}800,00`]);
  const anchos = await pagina.locator('.barra-relleno').evaluateAll((l) => l.map((x) => x.getBoundingClientRect().width));
  assert.ok(anchos[0] > anchos[1] && anchos[1] > anchos[2] && anchos[2] > anchos[3] && anchos[3] > 0, `anchos decrecientes ${anchos}`);
  assert.ok(Math.abs(anchos[1] / anchos[0] - 4200 / 12500) < 0.02, 'el ancho es proporcional al monto');
  // Tocar una barra filtra por esa categoría; tocarla de nuevo saca el filtro.
  await pagina.locator('.barra', { hasText: 'Verdulería' }).click();
  await esperarTitulos(pagina, ['Feria']);
  assert.equal(await pagina.getByLabel('Categoría', { exact: true }).inputValue(), 'cat-verduleria');
  assert.equal(await pagina.locator('.barra', { hasText: 'Verdulería' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await pagina.locator('.barra').count(), 4, 'las otras barras siguen para poder cambiar de categoría');
  await pagina.locator('.barra', { hasText: 'Alquiler' }).click();
  await esperarTitulos(pagina, ['Alquiler de octubre']);
  await pagina.locator('.barra', { hasText: 'Alquiler' }).click();
  await esperarTitulos(pagina, ['Compra del mes', 'Alquiler de octubre', 'Feria', 'Electricidad', 'Sueldo']);
  assert.equal(await pagina.getByLabel('Categoría', { exact: true }).inputValue(), '');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-04 CA-3 · PC: se usa con el teclado (Tab por los filtros, las barras y la lista)', async () => {
  const { contexto, pagina, errores } = await conMovimientos({ viewport: ESCRITORIO });
  await pagina.getByRole('searchbox', { name: 'Buscar' }).focus();
  const recorrido = [];
  for (let i = 0; i < 14; i++) {
    await pagina.keyboard.press('Tab');
    recorrido.push(await pagina.evaluate(() => { const a = document.activeElement; return a.tagName === 'SELECT' ? 'select' : (a.classList.contains('barra') ? 'barra' : (a.classList.contains('movs-fila') ? 'fila' : a.tagName)); }));
  }
  assert.deepEqual(recorrido.slice(0, 8), ['select', 'select', 'select', 'select', 'barra', 'barra', 'barra', 'barra'], 'filtros, después las barras');
  assert.deepEqual(recorrido.slice(8, 13), ['fila', 'fila', 'fila', 'fila', 'fila'], 'y después la lista');
  // Enter sobre una barra filtra; Enter de nuevo la saca.
  await pagina.locator('.barra', { hasText: 'Alquiler' }).focus();
  await pagina.keyboard.press('Enter');
  await esperarTitulos(pagina, ['Alquiler de octubre']);
  await pagina.keyboard.press('Enter');
  assert.equal(await filas(pagina).count(), 5);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of VIEWPORTS) {
  for (const colorScheme of ['light', 'dark']) {
    test(`HU-04 CA-3 · axe-core sin problemas graves en Movimientos con datos (${nombre}, ${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
      const { contexto, pagina, errores } = await conMovimientos({ viewport, colorScheme, bypassCSP: true });
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((x) => x.target).join(' | ')}`));
      assert.deepEqual(graves, []);
      assert.deepEqual(errores, []);
      await contexto.close();
    });
  }
}

test('HU-04 CA-3 · sin conexión funciona y los movimientos siguen al volver a abrir AFP (celular)', async () => {
  const { contexto, pagina, errores } = await conMovimientos({ viewport: CELULAR });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.getByRole('heading', { name: 'Movimientos', level: 1 }).waitFor();
  await esperarTitulos(pagina, ['Compra del mes', 'Alquiler de octubre', 'Feria', 'Electricidad', 'Sueldo']);
  await pagina.getByLabel('Período', { exact: true }).selectOption('todo');
  assert.equal(await filas(pagina).count(), 8);
  await contexto.setOffline(false);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-04 CA-3 · con 500 movimientos filtrar responde en menos de 200 ms (celular)', async () => {
  const muchos = Array.from({ length: 500 }, (_, i) => mov(`p${i}`, i % 5 === 0 ? 'ingreso' : 'egreso', `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`,
    `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, 1000 + i, i % 5 === 0 ? 'cat-trabajo' : ['cat-alquiler', 'cat-supermercado', 'cat-kiosco', 'cat-salud'][i % 4], i % 2 ? 'cue-banco' : 'cue-caja', `Movimiento ${i}`));
  const { contexto, pagina, errores } = await conMovimientos({ viewport: CELULAR }, { movimientos: muchos });
  assert.equal(await filas(pagina).count(), 500);
  const ms = await pagina.evaluate(async () => {
    const busca = document.querySelector('.movs-buscador');
    const t0 = performance.now();
    busca.value = 'movimiento 4';
    busca.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((ok) => requestAnimationFrame(() => ok()));
    return performance.now() - t0;
  });
  assert.equal(await filas(pagina).count(), 111, '«Movimiento 4», 40–49, 400–499 y el 4: 1 + 10 + 100');
  assert.ok(ms < 200, `filtrar tardó ${ms.toFixed(0)} ms`);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-04 corrección P-053 · «Egresos por categoría» sigue los mismos filtros que los totales y la lista', async () => {
  const { contexto, pagina, errores } = await conMovimientos({ viewport: ESCRITORIO });
  // Antes de filtrar: las 4 barras de siempre.
  assert.deepEqual(await pagina.locator('.barra .barra-nombre').allTextContents(), ['🔑 Alquiler', '🥦 Verdulería', '🛒 Supermercado', '💡 Electricidad']);
  // Categoría = Trabajo (un ingreso, elegida en el selector): totales sin egresos y, ahora también, sin barras.
  await pagina.getByLabel('Categoría', { exact: true }).selectOption('cat-trabajo');
  await esperarTitulos(pagina, ['Sueldo']);
  assert.deepEqual(await totales(pagina), { Ingresos: `+$${E}150.000,00`, Egresos: `$${E}0,00`, Diferencia: `+$${E}150.000,00` });
  assert.equal(await pagina.locator('.barra').count(), 0, 'sin barras');
  assert.equal(await pagina.locator('.movs-barras').getByText('No hay egresos con estos filtros.').count(), 1);
  // Cuenta = Caja: los egresos de Caja (Compra del mes 3.500 y Feria 4.200 en octubre) y solo esas barras.
  await pagina.getByLabel('Categoría', { exact: true }).selectOption('');
  await pagina.getByLabel('Cuenta', { exact: true }).selectOption('cue-caja');
  await esperarTitulos(pagina, ['Compra del mes', 'Feria']);
  assert.deepEqual(await pagina.locator('.barra .barra-nombre').allTextContents(), ['🥦 Verdulería', '🛒 Supermercado']);
  assert.deepEqual(await pagina.locator('.barra .barra-monto').allTextContents(), [`$${E}4.200,00`, `$${E}3.500,00`]);
  // Tipo = Ingresos: ningún egreso en la lista, en los totales ni en las barras.
  await pagina.getByLabel('Cuenta', { exact: true }).selectOption('');
  await pagina.getByLabel('Tipo', { exact: true }).selectOption('ingreso');
  await esperarTitulos(pagina, ['Sueldo']);
  assert.equal(await pagina.locator('.barra').count(), 0);
  assert.equal(await pagina.locator('.movs-barras').getByText('No hay egresos con estos filtros.').count(), 1);
  assert.deepEqual(errores, []);
  await contexto.close();
});
