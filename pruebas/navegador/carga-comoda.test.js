// HU-02b: carga más cómoda (monto con puntos en vivo, hora, fecha anterior al saldo inicial). Valores escritos a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = '\u00a0';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function enModoPrueba(opciones = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await r.pagina.goto(`${entorno.servidor.url}#cargar`);
  await r.pagina.locator('.formulario-egreso').waitFor();
  return r;
}
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const monto = (pagina) => pagina.getByRole('textbox', { name: 'Monto', exact: true });
const hora = (pagina) => pagina.getByLabel('Hora', { exact: true });
const leerBase = (pagina, almacen) => pagina.evaluate((a) => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => { const g = p.result.transaction(a).objectStore(a).getAll(); g.onsuccess = () => { p.result.close(); ok(g.result); }; };
}), almacen);
const cursor = (pagina) => monto(pagina).evaluate((e) => [e.selectionStart, e.selectionEnd]);

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-02b CA-1 · el monto lleva los puntos de miles mientras se escribe, con coma decimal de hasta 2 cifras (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await monto(pagina).focus();
    await pagina.keyboard.type('1250');
    assert.equal(await monto(pagina).inputValue(), '1.250', 'sin salir del campo');
    await monto(pagina).fill('');
    await pagina.keyboard.type('1250000');
    assert.equal(await monto(pagina).inputValue(), '1.250.000');
    await pagina.keyboard.type(',5');
    assert.equal(await monto(pagina).inputValue(), '1.250.000,5');
    await pagina.keyboard.type('678');
    assert.equal(await monto(pagina).inputValue(), '1.250.000,56', 'dos decimales como máximo');
    await pagina.keyboard.type(',');
    assert.equal(await monto(pagina).inputValue(), '1.250.000,56', 'una sola coma');
    await pagina.keyboard.press('Backspace');
    await pagina.keyboard.press('Backspace');
    await pagina.keyboard.press('Backspace');
    assert.equal(await monto(pagina).inputValue(), '1.250.000');
    // Sin letras ni otros símbolos.
    await monto(pagina).fill('');
    await pagina.keyboard.type('a1b2$3');
    assert.equal(await monto(pagina).inputValue(), '123');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-02b CA-1 · la tecla punto (común y del teclado numérico) escribe una coma decimal', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await monto(pagina).focus();
  await pagina.keyboard.type('12.5');
  assert.equal(await monto(pagina).inputValue(), '12,5');
  await monto(pagina).fill('');
  await pagina.keyboard.type('300');
  await pagina.keyboard.press('NumpadDecimal');
  await pagina.keyboard.type('75');
  assert.equal(await monto(pagina).inputValue(), '300,75');
  await contexto.close();
  assert.deepEqual(errores, []);
});

test('HU-02b CA-1 · el cursor queda en su lugar al insertar los puntos', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await monto(pagina).focus();
  await pagina.keyboard.type('1250');
  assert.deepEqual(await cursor(pagina), [5, 5], 'al final');
  // Se mueve después del «1» y se escribe un 9: 1.250 → 19.250, con el cursor después del 9.
  await pagina.keyboard.press('Home');
  await pagina.keyboard.press('ArrowRight');
  await pagina.keyboard.type('9');
  assert.equal(await monto(pagina).inputValue(), '19.250');
  assert.deepEqual(await cursor(pagina), [2, 2]);
  await pagina.keyboard.type('9');
  assert.equal(await monto(pagina).inputValue(), '199.250');
  assert.deepEqual(await cursor(pagina), [3, 3]);
  await pagina.keyboard.type('9');
  assert.equal(await monto(pagina).inputValue(), '1.999.250', 'aparece un punto nuevo antes del cursor');
  assert.deepEqual(await cursor(pagina), [5, 5]);
  // Borrar con Retroceso: 1.99|9.250 → 199.250 y el cursor, después del segundo 9.
  await pagina.keyboard.press('Backspace');
  assert.equal(await monto(pagina).inputValue(), '199.250');
  assert.deepEqual(await cursor(pagina), [3, 3]);
  await contexto.close();
  assert.deepEqual(errores, []);
});

test('HU-02b CA-1 · pegar «12.500,50» o «12500.50» se entiende igual y se guarda bien', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await contexto.grantPermissions(['clipboard-read', 'clipboard-write']);
  const pegar = async (texto) => {
    await monto(pagina).fill('');
    await pagina.evaluate((t) => navigator.clipboard.writeText(t), texto);
    await monto(pagina).focus();
    await pagina.keyboard.press('Control+V');
  };
  await pegar('12.500,50');
  assert.equal(await monto(pagina).inputValue(), '12.500,50');
  await pegar('12500.50');
  assert.equal(await monto(pagina).inputValue(), '12.500,50');
  await pegar('1.250.000');
  assert.equal(await monto(pagina).inputValue(), '1.250.000');
  await pegar('12500.50');
  await pagina.getByRole('button', { name: /^Categoría/ }).click();
  await ventana(pagina).getByRole('combobox').fill('alq');
  await ventana(pagina).getByRole('option', { name: /Alquiler/ }).click();
  await pagina.getByRole('button', { name: /^Cuenta/ }).click();
  await ventana(pagina).getByRole('combobox').fill('banco');
  await ventana(pagina).getByRole('option', { name: /Banco/ }).click();
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Guardaste el egreso.' }).waitFor();
  assert.equal((await leerBase(pagina, 'movimientos'))[0].montoTotal, 1250050);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-02b CA-4 · el campo «Hora» está entre la fecha y el monto, arranca con la hora actual y es editable y opcional', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  const rotulos = await pagina.locator('.formulario-egreso .campo > label').allTextContents();
  assert.deepEqual(rotulos.slice(0, 3), ['Fecha', 'Hora', 'Monto']);
  assert.equal(await hora(pagina).getAttribute('type'), 'time');
  // Con la fecha simulada de modo prueba (31/10/2026), la hora es la real del dispositivo, en Argentina.
  const esperada = await pagina.evaluate(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const [h, m] = esperada.split(':').map(Number);
  const [vh, vm] = (await hora(pagina).inputValue()).split(':').map(Number);
  assert.ok(Math.abs((h * 60 + m) - (vh * 60 + vm)) <= 2, `hora ${await hora(pagina).inputValue()} ≈ ${esperada}`);
  assert.equal(await pagina.locator('input[type="date"]').inputValue(), '2026-10-31');
  const cargar = async (descripcion) => {
    await monto(pagina).fill('100');
    await pagina.getByLabel('Descripción (opcional)').fill(descripcion);
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    await ventana(pagina).getByRole('combobox').fill('kiosco');
    await ventana(pagina).getByRole('option', { name: /Kiosco/ }).click();
    await pagina.getByRole('button', { name: /^Cuenta/ }).click();
    await ventana(pagina).getByRole('combobox').fill('caja');
    await ventana(pagina).getByRole('option', { name: /Caja/ }).click();
    await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
    await pagina.waitForFunction(() => document.querySelector('input[name="monto"]').value === '');
  };
  // Editada: se guarda tal cual.
  await hora(pagina).fill('18:30');
  await cargar('con hora');
  // Vuelve a arrancar con la hora actual; borrada, se guarda sin hora.
  assert.notEqual(await hora(pagina).inputValue(), '');
  await hora(pagina).fill('');
  await cargar('sin hora');
  const guardados = await leerBase(pagina, 'movimientos');
  assert.deepEqual(guardados.map((x) => [x.descripcion, x.hora]).sort(), [['Con hora', '18:30'], ['Sin hora', null]]);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-02b CA-4 · un egreso anterior al saldo inicial se guarda y la cuenta pasa a empezar en esa fecha', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  // Caja empieza el 01/09/2026 con $ 200.000,00.
  await pagina.locator('input[type="date"]').fill('2026-08-20');
  await monto(pagina).fill('500');
  await pagina.getByRole('button', { name: /^Categoría/ }).click();
  await ventana(pagina).getByRole('combobox').fill('kiosco');
  await ventana(pagina).getByRole('option', { name: /Kiosco/ }).click();
  await pagina.getByRole('button', { name: /^Cuenta/ }).click();
  await ventana(pagina).getByRole('combobox').fill('caja');
  await ventana(pagina).getByRole('option', { name: /Caja/ }).click();
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Guardaste el egreso. La cuenta Caja ahora empieza el 20/08/2026.' }).waitFor();
  const caja = (await leerBase(pagina, 'cuentas')).find((c) => c.id === 'cue-caja');
  assert.deepEqual([caja.fechaSaldoInicial, caja.saldoInicial], ['2026-08-20', 20000000], 'mismo monto');
  const [mov] = await leerBase(pagina, 'movimientos');
  assert.equal(mov.fecha, '2026-08-20');
  // El saldo en Inicio refleja el egreso.
  await pagina.goto(`${entorno.servidor.url}#inicio`);
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  assert.ok((await pagina.locator('main').innerText()).includes(`$${E}199.500,00`));
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, esquema] of [['claro', 'light'], ['oscuro', 'dark']]) {
  test(`HU-02b · ${nombre}: axe sin problemas graves y sin desplazamiento horizontal en 390×844`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR, colorScheme: esquema, bypassCSP: true });
    const axe = async (donde) => {
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(graves, [], `${nombre}: ${donde}`);
    };
    const ancho = () => pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(await ancho(), 390);
    await axe('formulario');
    await pagina.getByRole('button', { name: /^Categoría/ }).click();
    await ventana(pagina).getByRole('option', { name: /Alimentación/ }).click();
    assert.equal(await ancho(), 390);
    await axe('ventana de categoría en un subnivel');
    await pagina.keyboard.press('Escape');
    await pagina.getByRole('button', { name: /^Cuenta/ }).click();
    await axe('ventana de cuentas con íconos');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
