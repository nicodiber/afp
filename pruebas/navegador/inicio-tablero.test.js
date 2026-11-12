// HU-37: Inicio como tablero (D-178). Valores esperados calculados a mano a partir de los datos de ejemplo (hoy = 31/10/2026 en modo prueba):
// saldos Billetera 12.900 + Caja 158.900 + Banco 2.411.200 + Billetera virtual 113.400 + Tarjeta de transporte 1.000 = $ 2.697.400,00;
// Dólares billete US$ 500,00; octubre: ingresos 1.070.000, egresos 580.900, diferencia 489.100.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const PC = { width: 1366, height: 768 };
const E = ' ';
const MENOS = '−';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function enInicio(opciones, { ejemplo = true, quitar = [] } = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  if (ejemplo) {
    await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  }
  if (quitar.length) {
    await r.pagina.evaluate((ids) => new Promise((ok) => {
      const p = indexedDB.open('afp-dev-prueba');
      p.onsuccess = () => { const t = p.result.transaction('cuentas', 'readwrite'); for (const id of ids) t.objectStore('cuentas').delete(id); t.oncomplete = () => { p.result.close(); ok(); }; };
    }), quitar);
  }
  await r.pagina.goto(`${entorno.servidor.url}#inicio`);
  await r.pagina.reload();
  await r.pagina.locator('#titulo-tus-cuentas').waitFor();
  // Los indicadores y los últimos movimientos se suman después de dibujar Inicio (LCP): se espera a que estén.
  if (ejemplo) await r.pagina.locator('.grupo-mes').waitFor();
  return r;
}
const caja = (pagina, selector) => pagina.locator(selector).boundingBox();
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const indicadores = async (pagina, grupo) => Object.fromEntries(await pagina.locator(`${grupo} .indicador`).evaluateAll((l) => l.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent])));

test('HU-37 CA-1 · PC: arriba, «Saldos de hoy» y el mes en curso con su nombre y sus fechas', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: PC });
  assert.equal(await pagina.locator('#titulo-saldos-hoy').textContent(), 'Saldos de hoy');
  assert.deepEqual(await indicadores(pagina, '.grupo-saldos'), { 'Total en pesos': `$${E}2.697.400,00`, 'Total en dólares': `US$${E}500,00` });
  assert.equal(await pagina.locator('#titulo-mes-en-curso').textContent(), 'Octubre 2026 · 01/10/2026 al 31/10/2026');
  assert.deepEqual(await indicadores(pagina, '.grupo-mes'), { Ingresos: `+$${E}1.070.000,00`, Egresos: `${MENOS}$${E}580.900,00`, Diferencia: `+$${E}489.100,00` });
  const colores = await pagina.locator('.grupo-mes .indicador-valor').evaluateAll((l) => l.map((x) => getComputedStyle(x).color));
  assert.deepEqual(colores, ['rgb(17, 99, 61)', 'rgb(174, 70, 48)', 'rgb(17, 99, 61)'], 'ingresos en verde, egresos en rojo, diferencia positiva en verde');
  // Los dos grupos están arriba de las cuentas y de los últimos movimientos.
  const [saldos, mes, cuentas, ultimos] = await Promise.all(['.grupo-saldos', '.grupo-mes', '.seccion-cuentas', '.seccion-ultimos'].map((s) => caja(pagina, s)));
  assert.ok(saldos.y + saldos.height <= cuentas.y && mes.y + mes.height <= ultimos.y, 'indicadores arriba');
  assert.ok(Math.abs(saldos.y - mes.y) <= 1 && saldos.x + saldos.width <= mes.x, 'los dos grupos lado a lado');
  assert.ok(await sinDesborde(pagina));
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-37 CA-1 · sin cuentas en dólares no hay «Total en dólares»', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: PC }, { quitar: ['cue-dolares'] });
  assert.deepEqual(await indicadores(pagina, '.grupo-saldos'), { 'Total en pesos': `$${E}2.697.400,00` });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-37 CA-2 · PC: las cuentas en tarjetas y, al lado, los 5 últimos movimientos con «Ver todos»', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: PC });
  assert.equal(await pagina.locator('.tarjetas-cuentas .tarjeta-cuenta').count(), 7, '6 cuentas y «+ Nueva cuenta»');
  await pagina.locator('.ultimos-lista .movs-fila').first().waitFor();
  assert.deepEqual(await pagina.locator('.ultimos-lista .movs-titulo').allTextContents(), ['Compra rápida', 'Almuerzo con amigos', 'Compra de verdura', 'Consulta médica', 'Artículos de limpieza']);
  assert.deepEqual(await pagina.locator('.ultimos-lista .movs-icono').allTextContents(), ['🛒', '🍕', '🥦', '🩺', '🧹']);
  assert.deepEqual(await pagina.locator('.ultimos-lista .movs-detalle').allTextContents(), [
    '31/10/2026 · 10:00 · Supermercado · Billetera virtual', '30/10/2026 · 12:15 · Juntada · Billetera virtual', '29/10/2026 · 18:40 · Verdulería · Billetera',
    '28/10/2026 · 11:30 · Salud · Caja', '27/10/2026 · 11:10 · Limpieza · Caja',
  ]);
  assert.deepEqual(await pagina.locator('.ultimos-lista .movs-monto').allTextContents(), [`${MENOS}$${E}9.200,00`, `${MENOS}$${E}9.800,00`, `${MENOS}$${E}5.100,00`, `${MENOS}$${E}8.000,00`, `${MENOS}$${E}6.100,00`]);
  assert.equal(await pagina.locator('.ultimos-lista .movs-monto').first().evaluate((x) => getComputedStyle(x).color), 'rgb(174, 70, 48)', 'egreso en rojo');
  const enlace = pagina.getByRole('link', { name: 'Ver todos', exact: true }).last();
  assert.equal(await enlace.getAttribute('href'), '#movimientos');
  const [cuentas, ultimos] = await Promise.all(['.seccion-cuentas', '.seccion-ultimos'].map((s) => caja(pagina, s)));
  assert.ok(cuentas.x + cuentas.width <= ultimos.x && Math.abs(cuentas.y - ultimos.y) <= 1, 'cuentas a la izquierda y últimos movimientos al lado');
  await enlace.click();
  await pagina.getByRole('heading', { name: 'Movimientos', level: 1 }).waitFor();
  assert.equal(new URL(pagina.url()).hash, '#movimientos');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-37 CA-3 · celular: cuentas, después el resumen del mes con sus fechas y los últimos movimientos', async () => {
  const { contexto, pagina, errores } = await enInicio({ viewport: CELULAR });
  await pagina.locator('.ultimos-lista .movs-fila').first().waitFor();
  assert.equal(await pagina.locator('.grupo-saldos').isVisible(), false, 'los saldos son las cuentas: no se repiten');
  assert.equal(await pagina.locator('#titulo-mes-en-curso').textContent(), 'Octubre 2026 · 01/10/2026 al 31/10/2026');
  assert.deepEqual(await indicadores(pagina, '.grupo-mes'), { Ingresos: `+$${E}1.070.000,00`, Egresos: `${MENOS}$${E}580.900,00`, Diferencia: `+$${E}489.100,00` });
  assert.equal(await pagina.locator('.ultimos-lista .movs-fila').count(), 5);
  const [cuentas, mes, ultimos] = await Promise.all(['.seccion-cuentas', '.grupo-mes', '.seccion-ultimos'].map((s) => caja(pagina, s)));
  assert.ok(cuentas.y + cuentas.height <= mes.y && mes.y + mes.height <= ultimos.y, 'de arriba abajo: cuentas, mes, últimos movimientos');
  assert.ok(await sinDesborde(pagina), 'sin desplazamiento horizontal');
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', PC]]) {
  test(`HU-37 CA-4 · sin cuentas ni movimientos, los mensajes de siempre (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enInicio({ viewport }, { ejemplo: false });
    assert.equal(await pagina.getByText('Todavía no tenés cuentas.').count(), 1);
    assert.equal(await pagina.getByRole('button', { name: 'Crear la primera' }).count(), 1);
    assert.equal(await pagina.getByText('Todavía no cargaste movimientos.').count(), 1);
    assert.equal(await pagina.getByRole('link', { name: 'Cargar el primero' }).getAttribute('href'), '#cargar');
    assert.equal(await pagina.locator('.grupo-saldos, .grupo-mes').count(), 0, 'sin indicadores');
    assert.ok(await sinDesborde(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-37 CA-4 · con cuentas pero sin movimientos, se ofrece cargar el primero (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enInicio({ viewport }, { quitar: [] });
    await pagina.evaluate(() => new Promise((ok) => {
      const p = indexedDB.open('afp-dev-prueba');
      p.onsuccess = () => { const t = p.result.transaction('movimientos', 'readwrite'); t.objectStore('movimientos').clear(); t.oncomplete = () => { p.result.close(); ok(); }; };
    }));
    await pagina.reload();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal(await pagina.getByText('Todavía no cargaste movimientos.').count(), 1);
    assert.equal(await pagina.getByRole('link', { name: 'Cargar el primero' }).count(), 1);
    assert.equal(await pagina.locator('.grupo-mes').count(), 0, 'sin movimientos no hay resumen del mes');
    if (nombre === 'PC') await pagina.locator('.grupo-saldos').waitFor({ state: 'visible' });
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-37 · axe-core sin violaciones en Inicio (${nombre})`, async () => {
    const { contexto, pagina } = await enInicio({ viewport, bypassCSP: true });
    await pagina.locator('.ultimos-lista .movs-fila').first().waitFor();
    await pagina.addScriptTag({ path: AXE });
    const violaciones = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).filter((t) => String(t) !== '.franja-prueba').join(' | ')}`).filter((t) => !t.endsWith(': ')));
    // La franja del modo prueba (fuera de un punto de referencia) es anterior a esta historia y la mide el recorrido de accesibilidad de aep#2.
    assert.deepEqual(violaciones, []);
    await contexto.close();
  });
}
