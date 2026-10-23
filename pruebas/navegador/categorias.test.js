// aep#15: Categorías en el navegador (celular y PC). Valores esperados de la spec y de los datos de ejemplo
// de 05-roadmap.md §5.2, escritos a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function enModoPrueba(opciones = {}, { cargar = true } = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  if (cargar) {
    await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
    await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  }
  return r;
}
const irACategorias = async (pagina) => {
  await pagina.goto(entorno.servidor.url + '#ajustes/categorias');
  await pagina.getByRole('heading', { name: 'Categorías', level: 1 }).waitFor();
};
// [nombre, nivel] de cada fila del árbol de un tipo.
const arbol = (pagina, tipo) => pagina.locator(`ul[aria-labelledby="titulo-${tipo}"] > li`).evaluateAll((li) => li.map((x) => [x.querySelector('.fila-nombre').textContent, Number(x.style.getPropertyValue('--nivel'))]));
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');
const abrirCategoria = async (pagina, id) => { await pagina.locator(`#categoria-${id}`).click(); await ventana(pagina).waitFor(); };
async function crearEn(pagina, { padreId, tipo }, nombre, { enviar = true } = {}) {
  if (padreId) {
    await abrirCategoria(pagina, padreId);
    await ventana(pagina).getByRole('button', { name: 'Agregar dentro' }).click();
  } else await pagina.locator(`#nueva-${tipo}`).click();
  await ventana(pagina).getByLabel('Nombre').fill(nombre);
  if (enviar) await ventana(pagina).getByRole('button', { name: 'Crear categoría' }).click();
}
async function mover(pagina, id, destino, { fecha } = {}) {
  await abrirCategoria(pagina, id);
  await ventana(pagina).getByRole('button', { name: 'Mover' }).click();
  // Las opciones llevan «— » por nivel; se elige por el nombre.
  const select = ventana(pagina).getByLabel('¿A dónde?');
  const valor = await select.locator('option').evaluateAll((os, d) => os.find((o) => o.textContent.replace(/^(— )+/, '') === d).value, destino);
  await select.selectOption(valor);
  if (fecha) {
    await ventana(pagina).getByLabel(/Desde una fecha/).check();
    await ventana(pagina).getByLabel('Desde el día', { exact: true }).fill(fecha);
  } else await ventana(pagina).getByLabel(/Todo el historial/).check();
  await ventana(pagina).getByRole('button', { name: 'Mover', exact: true }).click();
}
const leerBase = (pagina, almacen) => pagina.evaluate((a) => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => { const g = p.result.transaction(a).objectStore(a).getAll(); g.onsuccess = () => { p.result.close(); ok(g.result); }; };
}), almacen);

const INGRESOS = [['Trabajo', 0], ['Ventas', 0], ['Rendimientos', 0], ['Aporte familiar', 0], ['Regalos recibidos', 0]];
const EGRESOS = [
  ['Vivienda', 0], ['Alquiler', 1], ['Electricidad', 1], ['Internet', 1], ['Limpieza', 1],
  ['Alimentación', 0], ['Supermercado', 1], ['Verdulería', 1], ['Kiosco', 1],
  ['Transporte', 0], ['Transporte público', 1], ['Ocio', 0], ['Juntada', 1], ['Vacaciones', 1], ['Salud', 0],
];

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#15 CA-1 y CA-2 · el árbol de los datos de ejemplo y su clasificación (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irACategorias(pagina);
    assert.deepEqual(await arbol(pagina, 'ingreso'), INGRESOS);
    assert.deepEqual(await arbol(pagina, 'egreso'), EGRESOS);
    const detalle = (id) => pagina.locator(`#categoria-${id} .fila-detalle`).textContent();
    assert.equal(await detalle('cat-kiosco'), 'Variable · deseo · hormiga');
    assert.equal(await detalle('cat-alquiler'), 'Fijo · necesidad');
    assert.equal(await detalle('cat-aporte-familiar'), 'Aporte de terceros');
    assert.equal(await detalle('cat-alimentacion'), '3 categorías');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#15 CA-3 · con la base de prueba vacía, solo las raíces y cómo crear la primera', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR }, { cargar: false });
  await irACategorias(pagina);
  const texto = await textoPrincipal(pagina);
  assert.match(texto, /Ingresos[\s\S]*Todavía no tenés categorías de ingresos\./);
  assert.match(texto, /Egresos[\s\S]*Todavía no tenés categorías de egresos\./);
  assert.equal(await pagina.getByRole('button', { name: 'Crear la primera' }).count(), 2);
  await pagina.locator('#nueva-ingreso').click();
  assert.equal(await ventana(pagina).getByRole('button', { name: 'Ganado' }).getAttribute('aria-pressed'), 'true', 'un ingreso nuevo trae «ganado» (D-137)');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#15 CA-4 a CA-8 · crear, validar y editar, con la clasificación de la familia', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  // CA-4 · Alimentación no tiene clasificación propia: trae la más común.
  await crearEn(pagina, { padreId: 'cat-alimentacion' }, 'carnicería', { enviar: false });
  const f = ventana(pagina);
  assert.equal(await f.getByLabel('Nombre').inputValue(), 'Carnicería', 'mayúscula inicial (D-134)');
  assert.match(await f.innerText(), /En Alimentación/);
  assert.equal(await f.getByRole('button', { name: 'Variable' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await f.getByRole('button', { name: 'Necesidad' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await f.getByRole('switch', { name: 'Gasto hormiga' }).getAttribute('aria-checked'), 'false');
  // CA-8 · un egreso no ofrece la naturaleza.
  assert.equal(await f.getByRole('button', { name: 'Ganado' }).count(), 0);
  await f.getByRole('button', { name: 'Crear categoría' }).click();
  await aviso(pagina).filter({ hasText: 'Creaste la categoría Carnicería.' }).waitFor();
  assert.deepEqual((await arbol(pagina, 'egreso')).slice(6, 10), [['Supermercado', 1], ['Verdulería', 1], ['Kiosco', 1], ['Carnicería', 1]]);
  // CA-5 · repetida entre hermanas; en otro nivel, sí.
  await crearEn(pagina, { padreId: 'cat-alimentacion' }, 'supermercado');
  await ventana(pagina).locator('.error-campo', { hasText: 'Ya existe una categoría con ese nombre en este nivel' }).waitFor();
  assert.equal(await ventana(pagina).getByRole('alert').textContent(), 'Ya existe una categoría con ese nombre en este nivel');
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  await crearEn(pagina, { padreId: 'cat-ocio' }, 'Supermercado');
  await aviso(pagina).filter({ hasText: 'Creaste la categoría Supermercado.' }).waitFor();
  // CA-6 · largo del nombre.
  for (const malo of ['', '   ', 'x'.repeat(41)]) {
    await crearEn(pagina, { tipo: 'egreso' }, malo);
    await ventana(pagina).locator('.error-campo', { hasText: 'El nombre tiene que tener entre 1 y 40 caracteres.' }).waitFor();
    await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  }
  // CA-7 · renombrar y emoji; el nombre se muestra como texto.
  await abrirCategoria(pagina, 'cat-kiosco');
  assert.equal(await pagina.evaluate(() => document.activeElement.tagName), 'H2', 'editar no pone el foco en un campo (D-136)');
  await ventana(pagina).getByLabel('Nombre').fill('Kiosco y golosinas');
  await ventana(pagina).getByLabel('Emoji').fill('🍬');
  await ventana(pagina).getByRole('button', { name: 'Guardar' }).click();
  await aviso(pagina).filter({ hasText: 'Guardaste los cambios.' }).waitFor();
  assert.equal(await pagina.locator('#categoria-cat-kiosco .fila-nombre').textContent(), 'Kiosco y golosinas');
  assert.equal(await pagina.locator('li:has(#categoria-cat-kiosco) .fila-emoji').textContent(), '🍬');
  await abrirCategoria(pagina, 'cat-kiosco');
  await ventana(pagina).getByLabel('Nombre').fill('<b>Kiosco</b>');
  await ventana(pagina).getByRole('button', { name: 'Guardar' }).click();
  await pagina.waitForFunction(() => document.querySelector('#categoria-cat-kiosco .fila-nombre').textContent === '<b>Kiosco</b>');
  assert.equal(await pagina.locator('#categoria-cat-kiosco b').count(), 0);
  // CA-8 · un ingreso ofrece solo la naturaleza.
  await abrirCategoria(pagina, 'cat-aporte-familiar');
  assert.equal(await ventana(pagina).getByRole('button', { name: 'Aporte de terceros' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await ventana(pagina).getByRole('button', { name: 'Fijo' }).count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#15 CA-9 a CA-12 · mover: todo el historial, desde una fecha, sin fechas futuras y sin ciclos', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACategorias(pagina);
  // CA-12 · destinos.
  await abrirCategoria(pagina, 'cat-alimentacion');
  await ventana(pagina).getByRole('button', { name: 'Mover' }).click();
  const destinos = (await ventana(pagina).getByLabel('¿A dónde?').locator('option').allTextContents()).map((t) => t.replace(/^(— )+/, ''));
  assert.deepEqual(destinos, ['Egresos', 'Vivienda', 'Alquiler', 'Electricidad', 'Internet', 'Limpieza', 'Transporte', 'Transporte público', 'Ocio', 'Juntada', 'Vacaciones', 'Salud'], 'sin ella, sin sus hijas y solo egresos');
  // CA-11 · la fecha empieza en hoy y no acepta el futuro.
  await ventana(pagina).getByLabel(/Desde una fecha/).check();
  assert.equal(await ventana(pagina).getByLabel('Desde el día', { exact: true }).inputValue(), '2026-10-31');
  await ventana(pagina).getByLabel('Desde el día', { exact: true }).fill('2026-11-01');
  await ventana(pagina).getByRole('button', { name: 'Mover', exact: true }).click();
  await ventana(pagina).getByRole('alert').filter({ hasText: 'La fecha no puede ser posterior a hoy.' }).waitFor();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  // CA-9 · todo el historial.
  await mover(pagina, 'cat-kiosco', 'Egresos');
  await aviso(pagina).filter({ hasText: 'Moviste Kiosco a Egresos para todo el historial.' }).waitFor();
  const egresos = await arbol(pagina, 'egreso');
  assert.deepEqual(egresos.slice(5, 8), [['Alimentación', 0], ['Supermercado', 1], ['Verdulería', 1]]);
  assert.deepEqual(egresos.at(-1), ['Kiosco', 0]);
  let ubis = (await leerBase(pagina, 'ubicacionesCategoria')).filter((u) => u.categoriaId === 'cat-kiosco');
  assert.deepEqual(ubis.map((u) => [u.padreId, u.desde]), [[null, null]]);
  // CA-10 · desde una fecha.
  await mover(pagina, 'cat-juntada', 'Alimentación', { fecha: '2026-10-15' });
  await aviso(pagina).filter({ hasText: 'Moviste Juntada a Alimentación desde el 15/10/2026.' }).waitFor();
  assert.ok((await arbol(pagina, 'egreso')).some(([n, nivel]) => n === 'Juntada' && nivel === 1));
  ubis = (await leerBase(pagina, 'ubicacionesCategoria')).filter((u) => u.categoriaId === 'cat-juntada').sort((a, b) => (a.desde ?? '').localeCompare(b.desde ?? ''));
  assert.deepEqual(ubis.map((u) => [u.padreId, u.desde]), [['cat-ocio', null], ['cat-alimentacion', '2026-10-15']]);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#15 CA-13 · ordenar las hijas de una familia con flechas y con el asa (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irACategorias(pagina);
    await pagina.getByRole('button', { name: 'Ordenar' }).click();
    await pagina.getByRole('button', { name: 'Subir Kiosco' }).click();
    await pagina.getByRole('button', { name: 'Subir Kiosco' }).click();
    await pagina.getByRole('button', { name: 'Listo' }).click();
    const alimentacion = async () => (await arbol(pagina, 'egreso')).slice(6, 9).map(([n]) => n);
    assert.deepEqual(await alimentacion(), ['Kiosco', 'Supermercado', 'Verdulería']);
    await pagina.reload();
    await pagina.getByRole('heading', { name: 'Categorías', level: 1 }).waitFor();
    await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-egreso"] > li').length === 15);
    assert.deepEqual(await alimentacion(), ['Kiosco', 'Supermercado', 'Verdulería'], 'después de volver a abrir');
    // Con el asa: Verdulería arriba de todo en Alimentación.
    await pagina.getByRole('button', { name: 'Ordenar' }).click();
    const grupo = pagina.locator('section.grupo-orden', { has: pagina.getByRole('heading', { name: 'Alimentación' }) });
    const asa = grupo.getByRole('button', { name: 'Arrastrar Verdulería' });
    await grupo.scrollIntoViewIfNeeded();
    const destino = await grupo.locator('li').first().boundingBox();
    const caja = await asa.boundingBox();
    await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(caja.x + caja.width / 2, destino.y + 4, { steps: 12 });
    await pagina.mouse.up();
    await pagina.waitForFunction(() => [...document.querySelectorAll('section.grupo-orden')].some((s) => s.querySelector('h3').textContent === 'Alimentación' && s.querySelector('li .fila-nombre').textContent === 'Verdulería'));
    await pagina.getByRole('button', { name: 'Listo' }).click();
    assert.deepEqual(await alimentacion(), ['Verdulería', 'Kiosco', 'Supermercado']);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#15 CA-14 a CA-16 · archivar, reactivar y eliminar', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await irACategorias(pagina);
  // CA-14 · una hoja se archiva sin confirmación y se reactiva.
  await abrirCategoria(pagina, 'cat-vacaciones');
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await aviso(pagina).filter({ hasText: 'Archivaste Vacaciones.' }).waitFor();
  assert.equal((await arbol(pagina, 'egreso')).some(([n]) => n === 'Vacaciones'), false);
  assert.match(await pagina.locator('.seccion-archivadas').innerText(), /Vacaciones/);
  await pagina.getByRole('button', { name: 'Reactivar Vacaciones' }).click();
  await aviso(pagina).filter({ hasText: 'Reactivaste Vacaciones.' }).waitFor();
  assert.ok((await arbol(pagina, 'egreso')).some(([n]) => n === 'Vacaciones'));
  // CA-16 · archivar una familia arrastra a sus hijas, con confirmación que dice cuántas son.
  await abrirCategoria(pagina, 'cat-ocio');
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  assert.match(await ventana(pagina).innerText(), /También se archivan sus 2 categorías\./);
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await aviso(pagina).filter({ hasText: 'Archivaste Ocio.' }).waitFor();
  const archivadas = await pagina.locator('.seccion-archivadas li .fila-nombre').allTextContents();
  assert.deepEqual(archivadas.sort(), ['Juntada', 'Ocio', 'Vacaciones']);
  // Eliminar una familia con hijas no se puede.
  await abrirCategoria(pagina, 'cat-vivienda');
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  await aviso(pagina).filter({ hasText: 'Primero mové o eliminá sus categorías.' }).waitFor();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  // CA-15 · una hoja sin movimientos se elimina después de confirmar.
  await abrirCategoria(pagina, 'cat-salud');
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  assert.match(await ventana(pagina).innerText(), /¿Eliminar Salud\?[\s\S]*No se puede deshacer\./);
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  await aviso(pagina).filter({ hasText: 'Eliminaste Salud.' }).waitFor();
  assert.equal(await pagina.locator('#categoria-cat-salud').count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#15 CA-18 · una base del esquema 2 pasa al 3 sin perder las cuentas', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR }, '#movimientos');
  await pagina.evaluate(() => new Promise((ok) => {
    const borrar = indexedDB.deleteDatabase('afp-dev');
    borrar.onsuccess = borrar.onblocked = () => {
      const p = indexedDB.open('afp-dev', 2);
      p.onupgradeneeded = () => { for (const a of ['configuracion', 'cuentas', 'monedas']) p.result.createObjectStore(a, { keyPath: 'id' }); };
      p.onsuccess = () => {
        const tx = p.result.transaction(['configuracion', 'cuentas'], 'readwrite');
        tx.objectStore('configuracion').put({ id: 'config', monedaBase: 'ARS' });
        tx.objectStore('cuentas').put({ id: 'cue-x', nombre: 'Efectivo', tipo: 'efectivo', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-10-01', orden: 1, estado: 'activa' });
        tx.oncomplete = () => { p.result.close(); ok(); };
      };
    };
  }));
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  await pagina.waitForFunction(() => new Promise((ok) => { const p = indexedDB.open('afp-dev'); p.onsuccess = () => { const v = p.result.version; p.result.close(); ok(v === 3); }; }));
  const base = await pagina.evaluate(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev');
    p.onsuccess = () => { const db = p.result; const g = db.transaction('cuentas').objectStore('cuentas').getAll(); g.onsuccess = () => { const r = { almacenes: [...db.objectStoreNames].sort(), cuentas: g.result.map((c) => c.nombre) }; db.close(); ok(r); }; };
  }));
  assert.deepEqual(base, { almacenes: ['categorias', 'configuracion', 'cuentas', 'monedas', 'ubicacionesCategoria'], cuentas: ['Efectivo'] });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#15 CA-19 · sin conexión, la categoría creada sigue ahí', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await irACategorias(pagina);
  await crearEn(pagina, { padreId: 'cat-alimentacion' }, 'Carnicería');
  await aviso(pagina).filter({ hasText: 'Creaste la categoría Carnicería.' }).waitFor();
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.getByRole('heading', { name: 'Categorías', level: 1 }).waitFor();
  await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-egreso"] > li').length === 16);
  assert.ok((await arbol(pagina, 'egreso')).some(([n, nivel]) => n === 'Carnicería' && nivel === 1));
  await contexto.setOffline(false);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#15 CA-20 · celular sin desplazamiento horizontal ni controles chicos; teclado; axe', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR, bypassCSP: true });
  const medir = () => pagina.evaluate(() => {
    const raiz = document.querySelector('dialog[open]') ?? document.querySelector('main');
    const chicos = [...raiz.querySelectorAll('button, a[href], input, select, textarea')].filter((e) => e.offsetParent !== null || e.closest('dialog[open]'))
      .map((e) => [e.textContent.trim() || e.getAttribute('aria-label') || e.name || e.type, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && (r.width < 44 || r.height < 44)).map(([n, r]) => `${n} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return { ancho: document.documentElement.scrollWidth, chicos };
  });
  const axe = async (donde) => {
    await pagina.addScriptTag({ path: AXE });
    const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
    assert.deepEqual(graves, [], donde);
  };
  await irACategorias(pagina);
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'árbol');
  await axe('árbol');
  await pagina.getByRole('button', { name: 'Ordenar' }).click();
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'ordenar');
  await axe('ordenar');
  await pagina.getByRole('button', { name: 'Listo' }).click();
  await abrirCategoria(pagina, 'cat-kiosco');
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'formulario');
  await axe('formulario');
  await ventana(pagina).getByRole('button', { name: 'Mover' }).click();
  await ventana(pagina).getByLabel(/Desde una fecha/).check();
  assert.deepEqual((await medir()).ancho, 390, 'mover');
  await axe('mover');
  await pagina.keyboard.press('Escape');
  // Plegar con el teclado.
  await pagina.locator('#pliegue-cat-alimentacion').focus();
  await pagina.keyboard.press('Enter');
  await pagina.waitForFunction(() => document.getElementById('pliegue-cat-alimentacion').getAttribute('aria-expanded') === 'false');
  assert.equal((await arbol(pagina, 'egreso')).some(([n]) => n === 'Supermercado'), false, 'plegada');
  assert.equal(await pagina.evaluate(() => document.activeElement.id), 'pliegue-cat-alimentacion', 'el foco sigue en el pliegue');
  // Crear solo con el teclado.
  await pagina.locator('#nueva-egreso').focus();
  await pagina.keyboard.press('Enter');
  await ventana(pagina).waitFor();
  await pagina.keyboard.type('Teclado');
  await pagina.keyboard.press('Enter');
  await aviso(pagina).filter({ hasText: 'Creaste la categoría Teclado.' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});
