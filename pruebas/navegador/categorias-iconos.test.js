// HU-31: árbol de categorías con ícono, etiquetas y ⓘ; ícono obligatorio y único; datos existentes; calidad.
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
const irACategorias = async (pagina) => {
  await pagina.goto(entorno.servidor.url + '#ajustes/categorias');
  await pagina.locator('#titulo-egreso').waitFor();
};
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const globo = (pagina) => pagina.locator('#globo-info');
const TEXTOS = {
  Fijo: 'Se paga todos los meses por un monto parecido (alquiler, internet, la cuota del gimnasio).',
  Variable: 'Cambia de un mes a otro según cuánto usás o comprás (supermercado, salidas, combustible).',
  Necesidad: 'Hace falta para vivir o trabajar: si lo dejás de pagar, te afecta lo básico.',
  Deseo: 'Te gusta o te da gusto, pero podrías no gastarlo sin afectar lo básico.',
  Hormiga: 'Gastos chicos y frecuentes que, sumados, pesan (el kiosco, el café de paso).',
};
const iconosDeLaBase = (pagina) => pagina.evaluate(() => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => { const g = p.result.transaction('categorias').objectStore('categorias').getAll(); g.onsuccess = () => { p.result.close(); ok(g.result.map((c) => [c.id, c.emoji])); }; };
}));

test('HU-31 CA-1 · cada fila muestra ícono en pastilla, nombre y etiquetas; la familia tiene la flecha circular que gira', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  assert.equal(await pagina.locator('#categoria-cat-kiosco .pastilla-icono').textContent(), '🍬');
  assert.equal(await pagina.locator('#categoria-cat-kiosco .fila-nombre').textContent(), 'Kiosco');
  assert.deepEqual(await pagina.locator('#categoria-cat-kiosco .etiqueta').allTextContents(), ['Variable', 'Deseo', 'Hormiga']);
  assert.equal(await pagina.locator('#categoria-cat-vivienda .pastilla-icono').textContent(), '🏠');
  assert.equal(await pagina.locator('#categoria-cat-vivienda .fila-detalle').textContent(), '4 categorías');
  // Flecha: círculo de 36 px dentro de un botón táctil de 44 px, con fondo de acento tenue y chevron ›.
  const flecha = pagina.locator('#pliegue-cat-vivienda');
  const circulo = flecha.locator('> span');
  assert.equal(await circulo.textContent(), '›');
  const caja = await circulo.boundingBox();
  assert.deepEqual([Math.round(caja.width), Math.round(caja.height)], [36, 36]);
  assert.equal(await circulo.evaluate((e) => getComputedStyle(e).borderRadius), '999px');
  assert.notEqual(await circulo.evaluate((e) => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
  // Gira 90° al desplegar (matrix(0, 1, -1, 0, …)) y vuelve a 0° al plegar.
  const giro = () => circulo.evaluate((e) => getComputedStyle(e).transform);
  assert.match(await giro(), /^matrix\(6\.1\d*e-17, 1, -1, 6\.1\d*e-17, 0, 0\)$|^matrix\(0, 1, -1, 0, 0, 0\)$/, 'desplegada');
  await flecha.click();
  await pagina.waitForFunction(() => document.getElementById('pliegue-cat-vivienda').getAttribute('aria-expanded') === 'false');
  assert.equal(await giro(), 'none', 'plegada');
  assert.equal(await pagina.locator('#categoria-cat-alquiler').count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-1 · PC: el ⓘ muestra el tooltip con el mouse y con el foco, y se va al salir', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  const info = pagina.getByRole('button', { name: 'Qué significan las etiquetas de Kiosco' });
  assert.equal(await pagina.getByRole('button', { name: /Qué significan las etiquetas de Vivienda/ }).count(), 0, 'la familia no tiene etiquetas');
  await info.hover();
  await globo(pagina).waitFor({ state: 'visible' });
  const texto = await globo(pagina).innerText();
  for (const clave of ['Variable', 'Deseo', 'Hormiga']) assert.ok(texto.includes(`${clave}: ${TEXTOS[clave]}`), clave);
  assert.ok(!texto.includes(TEXTOS.Fijo), 'solo las etiquetas de esa categoría');
  assert.equal(await info.getAttribute('aria-describedby'), 'globo-info');
  await pagina.mouse.move(5, 5);
  await globo(pagina).waitFor({ state: 'hidden' });
  // Con el teclado.
  await pagina.locator('#categoria-cat-alquiler').focus();
  await pagina.keyboard.press('Tab');
  await globo(pagina).waitFor({ state: 'visible' });
  assert.ok((await globo(pagina).innerText()).includes(`Fijo: ${TEXTOS.Fijo}`));
  await pagina.keyboard.press('Escape');
  await globo(pagina).waitFor({ state: 'hidden' });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-1 · celular: el ⓘ se abre al tocarlo y se cierra al tocar afuera, al tocarlo de nuevo o con Esc', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR, hasTouch: true, isMobile: true });
  await irACategorias(pagina);
  const info = pagina.getByRole('button', { name: 'Qué significan las etiquetas de Alquiler' });
  assert.equal(await globo(pagina).count() === 0 || await globo(pagina).isHidden(), true);
  await info.tap();
  await globo(pagina).waitFor({ state: 'visible' });
  assert.ok((await globo(pagina).innerText()).includes(`Necesidad: ${TEXTOS.Necesidad}`));
  const caja = await globo(pagina).boundingBox();
  assert.ok(caja.x >= 0 && caja.x + caja.width <= 390, 'el globo entra en la pantalla');
  assert.ok(!(await pagina.locator('dialog[open]').count()), 'tocar el ⓘ no abre la edición');
  await pagina.locator('#titulo-categorias').tap();
  await globo(pagina).waitFor({ state: 'hidden' });
  await info.tap();
  await globo(pagina).waitFor({ state: 'visible' });
  await info.tap();
  await globo(pagina).waitFor({ state: 'hidden' });
  await info.tap();
  await globo(pagina).waitFor({ state: 'visible' });
  await pagina.keyboard.press('Escape');
  await globo(pagina).waitFor({ state: 'hidden' });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-1 · el formulario tiene «ⓘ Qué significa» con las cinco explicaciones y «Agregar subcategoría»', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  await pagina.locator('#categoria-cat-alimentacion').click();
  assert.equal(await ventana(pagina).getByRole('button', { name: 'Agregar dentro' }).count(), 0);
  await ventana(pagina).getByRole('button', { name: 'Agregar subcategoría' }).click();
  const f = ventana(pagina);
  const boton = f.getByRole('button', { name: 'ⓘ Qué significa' });
  assert.equal(await boton.getAttribute('aria-expanded'), 'false');
  await boton.click();
  assert.equal(await boton.getAttribute('aria-expanded'), 'true');
  const texto = await f.locator('.que-significa').innerText();
  for (const [clave, explicacion] of Object.entries(TEXTOS)) assert.ok(texto.includes(`${clave}: ${explicacion}`), clave);
  await boton.click();
  assert.equal(await f.locator('.que-significa').isHidden(), true);
  // Un ingreso no tiene esas etiquetas.
  await f.getByRole('button', { name: 'Cancelar' }).click();
  await pagina.locator('#nueva-ingreso').click();
  assert.equal(await ventana(pagina).getByRole('button', { name: 'ⓘ Qué significa' }).count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-2 · una categoría nueva propone un ícono libre según el nombre; la grilla deshabilita los usados', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  await pagina.locator('#nueva-egreso').click();
  const f = ventana(pagina);
  const actual = () => f.locator('.icono-actual').textContent();
  await f.getByLabel('Nombre').fill('farmacia');
  assert.equal(await actual(), '💊');
  await f.getByLabel('Nombre').fill('Supermercado');
  assert.notEqual(await actual(), '🛒', 'el 🛒 lo usa «Supermercado» de los datos de ejemplo');
  await f.getByLabel('Nombre').fill('Sueldo');
  assert.notEqual(await actual(), '💼', 'el 💼 lo usa «Trabajo», que es de ingresos: tampoco se repite entre tipos');
  await f.getByLabel('Nombre').fill('Farmacia');
  assert.equal(await actual(), '💊');
  // La grilla: los usados, deshabilitados; elegir uno libre lo cambia y deja de seguir al nombre.
  await f.getByRole('button', { name: /^Ícono/ }).click();
  assert.equal(await f.locator('.celda-icono[data-emoji="🛒"]').isDisabled(), true);
  assert.equal(await f.locator('.celda-icono[data-emoji="💼"]').isDisabled(), true, 'de ingresos');
  assert.equal(await f.locator('.celda-icono[data-emoji="💊"]').isDisabled(), false);
  assert.equal(await f.locator('.celda-icono[data-emoji="💊"]').getAttribute('aria-pressed'), 'true');
  await f.locator('.celda-icono[data-emoji="🧴"]').click();
  assert.equal(await actual(), '🧴');
  await f.getByLabel('Nombre').fill('Farmacia y perfumería');
  assert.equal(await actual(), '🧴', 'si lo elegiste vos, no se cambia solo');
  await f.getByRole('button', { name: 'Crear categoría' }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Creaste la categoría Farmacia y perfumería.' }).waitFor();
  assert.equal(await pagina.locator('li:has(.fila-nombre:text-is("Farmacia y perfumería")) .pastilla-icono').textContent(), '🧴');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-2 · guardar con un ícono repetido da el error y no guarda; el propio se conserva al editar', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  await pagina.locator('#nueva-egreso').click();
  const f = ventana(pagina);
  await f.getByLabel('Nombre').fill('Compras');
  await f.getByRole('button', { name: /^Ícono/ }).click();
  // Se fuerza la celda del 🛒 (la usa Supermercado) como si el navegador la dejara tocar.
  await f.locator('.celda-icono[data-emoji="🛒"]').evaluate((b) => { b.disabled = false; });
  await f.locator('.celda-icono[data-emoji="🛒"]').click();
  await f.getByRole('button', { name: 'Crear categoría' }).click();
  await f.locator('.error-campo', { hasText: 'Elegí un ícono que no use otra categoría.' }).waitFor();
  assert.equal(await f.getByRole('alert').textContent(), 'Elegí un ícono que no use otra categoría.');
  assert.equal(await pagina.evaluate(() => document.activeElement.id.startsWith('categoria-icono')), true, 'el foco va al ícono');
  assert.equal((await iconosDeLaBase(pagina)).length, 20, 'no se guardó nada');
  // Editar sin tocar el ícono funciona.
  await f.getByRole('button', { name: 'Cancelar' }).click();
  await pagina.locator('#categoria-cat-supermercado').click();
  await ventana(pagina).getByLabel('Nombre').fill('Súper');
  await ventana(pagina).getByRole('button', { name: 'Guardar' }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Guardaste los cambios.' }).waitFor();
  assert.equal(await pagina.locator('#categoria-cat-supermercado .pastilla-icono').textContent(), '🛒');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-31 CA-3 · al abrir una base con categorías sin ícono o repetidas, AFP les asigna uno libre', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  // Se dejan sin ícono Kiosco y Salud, y a Limpieza con el mismo que Alquiler.
  await pagina.evaluate(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev-prueba');
    p.onsuccess = () => {
      const tx = p.result.transaction('categorias', 'readwrite');
      const almacen = tx.objectStore('categorias');
      const g = almacen.getAll();
      g.onsuccess = () => {
        const alquiler = g.result.find((c) => c.id === 'cat-alquiler').emoji;
        for (const c of g.result) {
          if (c.id === 'cat-kiosco' || c.id === 'cat-salud') almacen.put({ ...c, emoji: '' });
          if (c.id === 'cat-limpieza') almacen.put({ ...c, emoji: alquiler });
        }
      };
      tx.oncomplete = () => { p.result.close(); ok(); };
    };
  }));
  await pagina.reload();
  await irACategorias(pagina);
  const base = await iconosDeLaBase(pagina);
  const emojis = base.map(([, e]) => e.replaceAll('️', ''));
  assert.ok(emojis.every(Boolean), 'todas con ícono');
  assert.equal(new Set(emojis).size, base.length, 'sin repetir');
  const de = (id) => base.find(([i]) => i === id)[1];
  assert.equal(de('cat-salud'), '🩺', 'Salud recibe el que corresponde a su nombre');
  assert.equal(de('cat-alquiler'), '🔑', 'la primera conserva el suyo');
  assert.notEqual(de('cat-limpieza'), de('cat-alquiler'));
  assert.equal(await pagina.locator('#categoria-cat-salud .pastilla-icono').textContent(), '🩺');
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, esquema] of [['claro', 'light'], ['oscuro', 'dark']]) {
  test(`HU-31 CA-4 · ${nombre}: sin problemas graves de axe ni desplazamiento horizontal en 390×844`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR, colorScheme: esquema, bypassCSP: true });
    const axe = async (donde) => {
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(graves, [], `${nombre}: ${donde}`);
    };
    const ancho = () => pagina.evaluate(() => document.documentElement.scrollWidth);
    await irACategorias(pagina);
    assert.equal(await ancho(), 390, 'árbol');
    await axe('árbol');
    await pagina.getByRole('button', { name: 'Qué significan las etiquetas de Kiosco' }).click();
    await globo(pagina).waitFor({ state: 'visible' });
    await axe('árbol con el ⓘ abierto');
    await pagina.keyboard.press('Escape');
    await pagina.locator('#categoria-cat-kiosco').click();
    const f = ventana(pagina);
    await f.getByRole('button', { name: 'ⓘ Qué significa' }).click();
    await f.getByRole('button', { name: /^Ícono/ }).click();
    assert.equal(await ancho(), 390, 'formulario');
    await axe('formulario con la grilla y las explicaciones');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}
