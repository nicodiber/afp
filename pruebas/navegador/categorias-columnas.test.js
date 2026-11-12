// HU-36: Categorías en dos mitades en la PC (D-177) y una debajo de la otra en el celular. Valores de los datos de ejemplo, escritos a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const PC = { width: 1366, height: 768 };
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

async function enCategorias(opciones) {
  const r = await abrir(entorno.navegador, entorno.servidor, opciones, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await r.pagina.goto(`${entorno.servidor.url}#ajustes/categorias`);
  await r.pagina.locator('#titulo-egreso').waitFor();
  return r;
}
const caja = (pagina, selector) => pagina.locator(selector).boundingBox();
const nombres = (pagina, tipo) => pagina.locator(`ul[aria-labelledby="titulo-${tipo}"] > li .fila-nombre`).allTextContents();
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const ventana = (pagina) => pagina.locator('dialog[open]').last();

test('HU-36 CA-1 · PC: Ingresos y Egresos en dos columnas de igual ancho, cada una con su «Nueva»', async () => {
  const { contexto, pagina, errores } = await enCategorias({ viewport: PC });
  const ingresos = await caja(pagina, 'section[aria-labelledby="titulo-ingreso"]');
  const egresos = await caja(pagina, 'section[aria-labelledby="titulo-egreso"]');
  assert.ok(Math.abs(ingresos.width - egresos.width) <= 1, `anchos iguales: ${ingresos.width} y ${egresos.width}`);
  assert.ok(Math.abs(ingresos.y - egresos.y) <= 1, 'a la misma altura (lado a lado)');
  assert.ok(egresos.x >= ingresos.x + ingresos.width, 'Egresos a la derecha de Ingresos');
  for (const tipo of ['ingreso', 'egreso']) {
    const nueva = await caja(pagina, `#nueva-${tipo}`);
    const columna = await caja(pagina, `section[aria-labelledby="titulo-${tipo}"]`);
    assert.equal(await pagina.locator(`#nueva-${tipo}`).textContent(), '+ Nueva');
    assert.ok(nueva.x >= columna.x && nueva.x + nueva.width <= columna.x + columna.width, `«Nueva» de ${tipo} dentro de su columna`);
  }
  assert.ok(await sinDesborde(pagina), 'sin desplazamiento horizontal');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-36 CA-2 · celular: una debajo de la otra, como hasta ahora', async () => {
  const { contexto, pagina, errores } = await enCategorias({ viewport: CELULAR });
  const ingresos = await caja(pagina, 'section[aria-labelledby="titulo-ingreso"]');
  const egresos = await caja(pagina, 'section[aria-labelledby="titulo-egreso"]');
  assert.ok(egresos.y >= ingresos.y + ingresos.height - 1, 'Egresos debajo de Ingresos');
  assert.ok(Math.abs(egresos.x - ingresos.x) <= 1 && Math.abs(egresos.width - ingresos.width) <= 1, 'mismo ancho y alineadas');
  assert.ok(await sinDesborde(pagina), 'sin desplazamiento horizontal');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-36 CA-3 · PC, dos columnas: crear, editar, plegar y ordenar funcionan igual', async () => {
  const { contexto, pagina, errores } = await enCategorias({ viewport: PC });
  // Crear en la columna de Ingresos.
  await pagina.locator('#nueva-ingreso').click();
  await ventana(pagina).getByLabel('Nombre').fill('premios');
  await ventana(pagina).getByRole('button', { name: 'Crear categoría' }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Creaste la categoría Premios.' }).waitFor();
  assert.deepEqual((await nombres(pagina, 'ingreso')).slice(-2), ['Regalos y Reintegros', 'Premios']);
  assert.equal((await nombres(pagina, 'ingreso')).length, 11, '10 de los datos de ejemplo y la nueva');
  // Editar una de Egresos.
  await pagina.locator('#categoria-cat-kiosco').click();
  await ventana(pagina).getByLabel('Nombre').fill('Kiosco y golosinas');
  await ventana(pagina).getByRole('button', { name: 'Guardar' }).click();
  await pagina.locator('#aviso-breve', { hasText: 'Guardaste los cambios.' }).waitFor();
  assert.equal(await pagina.locator('#categoria-cat-kiosco .fila-nombre').textContent(), 'Kiosco y golosinas');
  // Plegar y desplegar Vivienda (Egresos).
  assert.equal((await nombres(pagina, 'egreso')).length, 15);
  await pagina.locator('#pliegue-cat-vivienda').click();
  assert.equal((await nombres(pagina, 'egreso')).length, 11, 'sin las 4 hijas de Vivienda');
  await pagina.locator('#pliegue-cat-vivienda').click();
  assert.equal((await nombres(pagina, 'egreso')).length, 15);
  // Ordenar: Ventas sube por encima de Trabajo (Ingresos).
  await pagina.locator('#boton-ordenar-categorias').click();
  await pagina.locator('#subir-cat-ventas').click();
  await pagina.locator('#boton-ordenar-categorias').click();
  assert.deepEqual((await nombres(pagina, 'ingreso')).slice(0, 2), ['Ventas', 'Trabajo']);
  assert.ok(await sinDesborde(pagina));
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', PC]]) {
  test(`HU-36 · axe-core sin violaciones en Categorías (${nombre})`, async () => {
    const { contexto, pagina } = await enCategorias({ viewport, bypassCSP: true });
    await pagina.addScriptTag({ path: AXE });
    const violaciones = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).filter((t) => String(t) !== '.franja-prueba').join(' | ')}`).filter((t) => !t.endsWith(': ')));
    // La franja del modo prueba (fuera de un punto de referencia) es anterior a esta historia y la mide el recorrido de accesibilidad de aep#2.
    assert.deepEqual(violaciones, []);
    await contexto.close();
  });
}
