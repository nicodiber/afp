// HU-34: atajo «c» en Inicio, ⓘ en los ingresos, ícono propuesto de las cuentas y carga diferida de lo que Inicio no usa.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function enModoPrueba(opciones = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  return r;
}
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const irAInicio = async (pagina) => { await pagina.goto(`${entorno.servidor.url}#inicio`); await pagina.locator('#titulo-tus-cuentas').waitFor(); };
const enCarga = (pagina) => pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 });

test('HU-34 CA-1 · en la PC, «c» y «C» abren Cargar desde Inicio', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  for (const tecla of ['c', 'C']) {
    await irAInicio(pagina);
    await pagina.keyboard.press(tecla);
    await enCarga(pagina).waitFor();
    assert.match(pagina.url(), /#cargar$/);
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-34 CA-1 · «c» no hace nada con Ctrl, Alt o Meta, con el foco en un campo, con una ventana abierta ni fuera de Inicio', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irAInicio(pagina);
  for (const combinacion of ['Control+c', 'Alt+c', 'Meta+c']) {
    await pagina.keyboard.press(combinacion);
    await pagina.waitForTimeout(100);
    assert.match(pagina.url(), /#inicio$/, combinacion);
  }
  // Con una ventana abierta (el formulario de cuenta) y con el foco en su campo de texto.
  await pagina.getByRole('button', { name: '+ Nueva cuenta' }).click();
  await ventana(pagina).waitFor();
  await pagina.keyboard.press('c');
  await pagina.waitForTimeout(100);
  assert.match(pagina.url(), /#inicio$/, 'ventana abierta');
  await ventana(pagina).getByLabel('Nombre').fill('');
  await ventana(pagina).getByLabel('Nombre').press('c');
  assert.equal(await ventana(pagina).getByLabel('Nombre').inputValue(), 'C', 'la «c» se escribe en el campo');
  await pagina.keyboard.press('Escape');
  await ventana(pagina).waitFor({ state: 'detached' });
  // Fuera de Inicio.
  await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
  await pagina.locator('#titulo-activas').waitFor();
  await pagina.keyboard.press('c');
  await pagina.waitForTimeout(100);
  assert.match(pagina.url(), /#ajustes\/cuentas$/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-34 CA-1 · en el celular «c» no abre Cargar', async () => {
  const { contexto, pagina } = await enModoPrueba({ viewport: CELULAR });
  await irAInicio(pagina);
  await pagina.keyboard.press('c');
  await pagina.waitForTimeout(100);
  assert.match(pagina.url(), /#inicio$/);
  await contexto.close();
});

test('HU-34 CA-1 · junto a «Cargar» se ve «C» solo en la PC', async () => {
  const pc = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  const atajo = pc.pagina.locator('.nav-cargar .nav-atajo');
  assert.equal(await atajo.textContent(), 'C');
  await pc.pagina.locator('.navegacion').hover();
  await pc.pagina.waitForTimeout(150);
  const caja = await atajo.boundingBox();
  assert.ok(caja.width > 10 && caja.height > 10, 'visible con la barra abierta');
  assert.equal(await pc.pagina.locator('.nav-cargar').getAttribute('aria-keyshortcuts'), 'C');
  await pc.contexto.close();
  const cel = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR });
  assert.equal(await cel.pagina.locator('.nav-cargar .nav-atajo').isVisible(), false);
  await cel.contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-34 CA-2 · los ingresos muestran su naturaleza con ⓘ y el formulario explica las tres (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await pagina.goto(`${entorno.servidor.url}#ajustes/categorias`);
    await pagina.locator('#titulo-ingreso').waitFor();
    assert.deepEqual(await pagina.locator('#categoria-cat-trabajo .etiqueta').allTextContents(), ['Ganado']);
    assert.deepEqual(await pagina.locator('#categoria-cat-aporte-familiar .etiqueta').allTextContents(), ['Aporte de terceros']);
    const info = pagina.getByRole('button', { name: 'Qué significan las etiquetas de Aporte familiar' });
    await info.click();
    assert.equal(await pagina.locator('#globo-info').innerText(), 'Aporte de terceros: Plata que otra persona te da sin que sea a cambio de un trabajo (por ejemplo, ayuda familiar).');
    await pagina.keyboard.press('Escape');
    await pagina.locator('#categoria-cat-trabajo').click();
    await ventana(pagina).getByRole('button', { name: 'ⓘ Qué significa' }).click();
    const texto = await ventana(pagina).locator('.que-significa').innerText();
    for (const t of [
      'Ganado: Lo que cobrás por tu trabajo o tus inversiones.',
      'Aporte de terceros: Plata que otra persona te da sin que sea a cambio de un trabajo (por ejemplo, ayuda familiar).',
      'Otro: Lo que no entra en lo anterior (regalos, reintegros, ventas de cosas usadas).',
    ]) assert.ok(texto.includes(t), t);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-34 CA-3 · el formulario de cuenta nueva propone el ícono del tipo y lo cambia hasta que lo tocás (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irAInicio(pagina);
    await pagina.getByRole('button', { name: '+ Nueva cuenta' }).click();
    const f = ventana(pagina);
    const icono = f.getByLabel('Ícono');
    const tipo = f.getByLabel('Tipo');
    assert.equal(await icono.inputValue(), '💵', 'efectivo por defecto');
    for (const [etiqueta, esperado] of [['Banco', '🏦'], ['Billetera virtual', '📱'], ['Broker', '📈'], ['Transporte', '🚌'], ['Cripto/stablecoin', '🪙'], ['Efectivo', '💵']]) {
      await tipo.selectOption({ label: etiqueta });
      assert.equal(await icono.inputValue(), esperado, etiqueta);
    }
    // Lo cambio a mano: el tipo ya no lo pisa.
    await icono.fill('🛟');
    await tipo.selectOption({ label: 'Banco' });
    assert.equal(await icono.inputValue(), '🛟');
    // Se puede repetir el de otra cuenta.
    await f.getByLabel('Nombre').fill('Otra caja');
    await icono.fill('💵');
    await f.getByRole('button', { name: 'Crear cuenta' }).click();
    await ventana(pagina).waitFor({ state: 'detached' });
    assert.ok((await pagina.locator('.tarjeta-cuenta-nombre', { hasText: 'Otra caja' }).textContent()).startsWith('💵 '));
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-34 CA-3 · Inicio y Cuentas muestran el ícono guardado o, si no hay, el del tipo', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  // Una cuenta sin ícono guardado (como las anteriores a esta historia): se escribe directo en la base.
  await pagina.evaluate(() => new Promise((ok, mal) => {
    const p = indexedDB.open('afp-dev-prueba');
    p.onerror = () => mal(p.error);
    p.onsuccess = () => {
      const tx = p.result.transaction('cuentas', 'readwrite');
      const almacen = tx.objectStore('cuentas');
      const g = almacen.getAll();
      g.onsuccess = () => { for (const c of g.result) { if (c.tipo === 'banco') { c.emoji = ''; almacen.put(c); } } };
      tx.oncomplete = () => { p.result.close(); ok(); };
    };
  }));
  await pagina.reload();
  await irAInicio(pagina);
  const nombres = await pagina.locator('.tarjeta-cuenta-nombre').allTextContents();
  assert.ok(nombres.length > 0 && nombres.every((n) => /^\S+ \S/u.test(n)), `todas con ícono: ${nombres.join(' | ')}`);
  assert.ok(nombres.some((n) => n.startsWith('🏦 ')), 'el banco sin ícono muestra el de su tipo');
  await pagina.goto(`${entorno.servidor.url}#ajustes/cuentas`);
  await pagina.locator('#titulo-activas').waitFor();
  const iconos = await pagina.locator('ul[aria-labelledby="titulo-activas"] .fila-emoji').allTextContents();
  assert.equal(iconos.length, nombres.length);
  assert.ok(iconos.every(Boolean) && iconos.includes('🏦'));
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-34 CA-4 · abrir Cargar o Categorías directo, antes de que lleguen las categorías, las espera y se dibuja bien', async () => {
  for (const [ruta, espera] of [['#cargar', () => 'main .formulario-egreso'], ['#ajustes/categorias', () => '#titulo-egreso']]) {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO }, ruta);
    await pagina.locator(espera()).waitFor();
    assert.deepEqual(errores, [], ruta);
    await contexto.close();
  }
});

test('HU-34 CA-4 · Inicio no carga el formulario de cuenta, Ajustes ni la ventana hasta que se usan', async () => {
  const { contexto, pagina, pedidos, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO });
  await pagina.waitForLoadState('networkidle');
  const cargados = () => pedidos.map((u) => new URL(u).pathname.split('/src/')[1]).filter(Boolean);
  for (const diferido of ['ui/pantallas/ajustes.js', 'ui/formulario-cuenta.js', 'ui/cuentas-comun.js', 'ui/dialogo.js', 'ui/pantallas/proximamente.js', 'ui/pantallas/cargar.js', 'ui/pantallas/categorias.js', 'ui/formulario-egreso.js']) {
    assert.ok(!cargados().includes(diferido), `${diferido} no se pide al abrir Inicio`);
  }
  await pagina.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Ajustes', level: 1 }).waitFor();
  await pagina.getByRole('switch', { name: 'Modo prueba' }).waitFor();
  assert.ok(cargados().includes('ui/pantallas/ajustes.js'), 'Ajustes se pide al abrirlo');
  await pagina.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await pagina.getByText('Esta parte llega en una próxima entrega.').waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, esquema] of [['claro', 'light'], ['oscuro', 'dark']]) {
  test(`HU-34 · ${nombre}: sin problemas graves de axe en Inicio con la barra abierta y en el formulario de cuenta, 390×844 y PC`, async () => {
    for (const viewport of [CELULAR, ESCRITORIO]) {
      const { contexto, pagina, errores } = await enModoPrueba({ viewport, colorScheme: esquema, bypassCSP: true });
      const axe = async (donde) => {
        await pagina.addScriptTag({ path: AXE });
        const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
          .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
        assert.deepEqual(graves, [], `${nombre} ${viewport.width}: ${donde}`);
      };
      await irAInicio(pagina);
      if (viewport === ESCRITORIO) await pagina.locator('.navegacion').hover();
      await axe('Inicio');
      assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth), viewport.width);
      await pagina.getByRole('button', { name: '+ Nueva cuenta' }).click();
      await ventana(pagina).waitFor();
      await axe('formulario de cuenta');
      assert.deepEqual(errores, []);
      await contexto.close();
    }
  });
}
