// aep#12: Cuentas y Monedas en el navegador (celular y PC). Valores esperados de la spec y de los datos de
// ejemplo de 05-roadmap.md §5.1, escritos a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = '\u00a0'; // espacio que no se corta entre el símbolo y el número
const MENOS = '−';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const EJEMPLO = [
  ['Billetera', 'Efectivo · ARS', `$${E}50.000,00`],
  ['Caja', 'Efectivo · ARS', `$${E}200.000,00`],
  ['Banco', 'Banco · ARS', `$${E}800.000,00`],
  ['Billetera virtual', 'Billetera virtual · ARS', `$${E}300.000,00`],
  ['Dólares billete', 'Efectivo · USD', `US$${E}500,00`],
  ['Tarjeta transporte', 'Transporte · ARS', `$${E}10.000,00`],
];

/** Abre AFP en modo prueba (base afp-dev-prueba) y, si se pide, carga los datos de ejemplo. */
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
const irACuentas = async (pagina) => {
  await pagina.goto(entorno.servidor.url + '#ajustes/cuentas');
  await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
};
const filas = (pagina) => pagina.locator('ul[aria-labelledby="titulo-activas"] > li').evaluateAll((li) => li.map((x) => [
  x.querySelector('.fila-nombre > span').textContent, x.querySelector('.fila-detalle').textContent, x.querySelector('.fila-monto')?.textContent ?? null,
]));
const archivadas = (pagina) => pagina.locator('.seccion-archivadas li').evaluateAll((li) => li.map((x) => [x.querySelector('.fila-nombre > span').textContent, x.querySelector('.fila-monto').textContent]));
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');

/** Completa el formulario abierto (en ventana o al costado) y lo envía. */
async function completar(pagina, datos, { enviar = true } = {}) {
  const f = pagina.locator('form.formulario-cuenta').last();
  if (datos.nombre !== undefined) await f.getByLabel('Nombre').fill(datos.nombre);
  if (datos.tipo) await f.getByLabel('Tipo').selectOption({ label: datos.tipo });
  if (datos.moneda) await f.getByLabel('Moneda').selectOption(datos.moneda);
  if (datos.saldo !== undefined) await f.getByLabel('Saldo inicial').fill(datos.saldo);
  if (datos.fecha) await f.getByLabel('Al día').fill(datos.fecha);
  if (datos.emoji !== undefined) await f.getByLabel('Emoji').fill(datos.emoji);
  if (datos.notas !== undefined) await f.getByLabel('Notas').fill(datos.notas);
  if (datos.proposito) await f.getByLabel('Propósito').selectOption({ label: datos.proposito });
  if (enviar) await f.getByRole('button', { name: /^(Crear cuenta|Guardar)$/ }).click();
  return f;
}
async function crearBancoUsd(pagina) {
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  await completar(pagina, { nombre: 'Banco USD', tipo: 'Banco', moneda: 'USD', saldo: '150', fecha: '2026-10-01' });
  await ventana(pagina).waitFor({ state: 'detached' });
}

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#12 CA-1 · los datos de ejemplo traen las 6 cuentas en orden, con ARS y USD (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irACuentas(pagina);
    assert.deepEqual(await filas(pagina), EJEMPLO);
    assert.equal(await pagina.locator('.fila-cuenta', { hasText: 'Billetera virtual' }).locator('.marca').textContent(), 'con rendimiento');
    assert.equal(await pagina.locator('.seccion-archivadas').count(), 0, 'ninguna archivada');
    await pagina.locator('#cuenta-cue-caja').click();
    assert.equal(await pagina.locator('form.formulario-cuenta').last().getByLabel('Al día').inputValue(), '2026-09-01');
    await pagina.keyboard.press('Escape');
    await pagina.goto(entorno.servidor.url + '#ajustes/monedas');
    await pagina.getByRole('heading', { name: 'Monedas' }).waitFor();
    assert.equal(await pagina.getByRole('switch', { name: 'USD activa' }).getAttribute('aria-checked'), 'true');
    assert.match(await textoPrincipal(pagina), /ARS · Peso argentino/);
    // Inicio muestra las mismas cuentas como tarjetas, con su saldo.
    await pagina.goto(entorno.servidor.url + '#inicio');
    await pagina.locator('.tarjeta-cuenta').first().waitFor();
    const tarjetas = await pagina.locator('.tarjetas-cuentas .tarjeta-cuenta:not(.tarjeta-nueva)').evaluateAll((t) => t.map((x) => [x.children[0].textContent, x.children[1].textContent]));
    assert.deepEqual(tarjetas, EJEMPLO.map(([n, , m]) => [n, m]));
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#12 CA-2 y CA-3 · restablecer y borrar los datos de ejemplo piden confirmación', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await crearBancoUsd(pagina);
  assert.equal((await filas(pagina)).length, 7);
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  await irACuentas(pagina);
  assert.equal((await filas(pagina)).length, 7, 'con «Cancelar» siguen las 7');
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).click();
  await ventana(pagina).getByRole('button', { name: 'Restablecer' }).click();
  await aviso(pagina).filter({ hasText: 'Cargaste los datos de ejemplo.' }).waitFor();
  await irACuentas(pagina);
  assert.deepEqual(await filas(pagina), EJEMPLO, 'vuelven las 6 y «Banco USD» ya no está');
  // CA-3
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await ventana(pagina).getByRole('button', { name: 'Borrar' }).click();
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).waitFor();
  await irACuentas(pagina);
  assert.match(await textoPrincipal(pagina), /Todavía no tenés cuentas\./);
  assert.equal(await pagina.getByRole('button', { name: 'Crear la primera' }).count(), 1);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-4 · las cuentas de prueba no tocan la base real', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: ESCRITORIO }, '#ajustes/cuentas');
  await pagina.getByRole('button', { name: 'Crear la primera' }).click();
  await completar(pagina, { nombre: 'Efectivo', tipo: 'Efectivo', saldo: '0' });
  await ventana(pagina).waitFor({ state: 'detached' });
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await irACuentas(pagina);
  await crearBancoUsd(pagina);
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.locator('.franja-prueba').waitFor({ state: 'hidden' });
  await irACuentas(pagina);
  await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-activas"] > li').length === 1);
  assert.deepEqual(await filas(pagina), [['Efectivo', 'Efectivo · ARS', `$${E}0,00`]]);
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await irACuentas(pagina);
  await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-activas"] > li').length === 7);
  assert.equal((await filas(pagina)).length, 7);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#12 CA-5 a CA-9 · crear una cuenta: avisos, nombre repetido, largo, saldo y opciones (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irACuentas(pagina);
    await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
    // CA-9: tipos y monedas que se ofrecen; «Tiene rendimiento» en «No».
    const f = pagina.locator('form.formulario-cuenta').last();
    assert.deepEqual(await f.getByLabel('Tipo').locator('option').allTextContents(), ['Efectivo', 'Billetera virtual', 'Banco', 'Broker', 'Transporte', 'Cripto/stablecoin']);
    assert.deepEqual(await f.getByLabel('Moneda').locator('option').evaluateAll((o) => o.map((x) => x.value)), ['ARS', 'USD']);
    assert.equal(await f.getByRole('switch', { name: 'Tiene rendimiento' }).getAttribute('aria-checked'), 'false');
    // CA-5
    await completar(pagina, { nombre: 'Banco USD', tipo: 'Banco', moneda: 'USD', saldo: '150', fecha: '2026-10-01' });
    await aviso(pagina).filter({ hasText: '¡Listo! Creaste la cuenta Banco USD.' }).waitFor();
    assert.deepEqual((await filas(pagina)).at(-1), ['Banco USD', 'Banco · USD', `US$${E}150,00`]);
    // CA-6: repetidos.
    for (const repetido of ['banco usd', ' Banco USD ']) {
      await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
      const g = await completar(pagina, { nombre: repetido, saldo: '1.234,5' });
      await g.locator('.error-campo', { hasText: 'Ya existe una cuenta con ese nombre' }).waitFor();
      assert.equal(await g.getByLabel('Nombre').getAttribute('aria-invalid'), 'true');
      assert.equal(await g.getByLabel('Saldo inicial').inputValue(), '1.234,5', 'conserva lo cargado');
      await g.getByRole('button', { name: 'Cancelar' }).click();
    }
    await pagina.locator('#cuenta-cue-caja').click();
    const caja = await completar(pagina, { nombre: 'BILLETERA' });
    await caja.locator('.error-campo', { hasText: 'Ya existe una cuenta con ese nombre' }).waitFor();
    await caja.getByRole('button', { name: 'Cancelar' }).click();
    // CA-7: largo del nombre.
    await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
    for (const malo of ['', '   ', `X${'x'.repeat(40)}`]) {
      const g = await completar(pagina, { nombre: malo });
      await g.locator('.error-campo', { hasText: 'El nombre tiene que tener entre 1 y 40 caracteres.' }).waitFor();
    }
    // CA-8: saldo inicial.
    // El campo vacío ya no da error: cuenta como 0 (aep#13 CA-6, D-135); se prueba en ajustes-cuentas.test.js.
    for (const malo of ['12,345', 'abc']) {
      const g = await completar(pagina, { nombre: `X${'x'.repeat(39)}`, saldo: malo });
      await g.locator('.error-campo', { hasText: 'Escribí un monto con hasta 2 decimales.' }).waitFor();
    }
    await completar(pagina, { nombre: `X${'x'.repeat(39)}`, saldo: '-5000' });
    await ventana(pagina).waitFor({ state: 'detached' });
    assert.deepEqual((await filas(pagina)).at(-1), [`X${'x'.repeat(39)}`, 'Efectivo · ARS', `${MENOS}$${E}5.000,00`]);
    assert.equal(await pagina.locator('.fila-cuenta', { hasText: `X${'x'.repeat(39)}` }).locator('.fila-monto').evaluate((e) => e.classList.contains('negativo')), true);
    for (const [texto, esperado] of [['1.234,5', `$${E}1.234,50`], ['0', `$${E}0,00`]]) {
      await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
      await completar(pagina, { nombre: `Saldo ${texto}`, saldo: texto });
      await ventana(pagina).waitFor({ state: 'detached' });
      assert.equal((await filas(pagina)).at(-1)[2], esperado, texto);
    }
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#12 CA-10 y CA-11 · editar nombre, saldo y moneda; el nombre se muestra como texto', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await pagina.locator('#cuenta-cue-caja').click();
  await completar(pagina, { nombre: 'Caja fuerte', saldo: '250.000' });
  await aviso(pagina).filter({ hasText: 'Guardaste los cambios.' }).waitFor();
  assert.deepEqual((await filas(pagina))[1], ['Caja fuerte', 'Efectivo · ARS', `$${E}250.000,00`], 'en el mismo lugar del orden');
  await pagina.locator('#cuenta-cue-caja').click();
  await completar(pagina, { nombre: '<b>Caja</b>' });
  await pagina.waitForFunction(() => document.querySelector('#cuenta-cue-caja .fila-nombre > span').textContent === '<b>Caja</b>');
  assert.equal(await pagina.locator('#cuenta-cue-caja b').count(), 0, 'sin HTML');
  // CA-11: «Banco USD» sin movimientos cambia a ARS.
  await crearBancoUsd(pagina);
  const id = await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('button').getAttribute('id');
  await pagina.locator(`#${id}`).click();
  await completar(pagina, { moneda: 'ARS' });
  await pagina.waitForFunction((i) => document.querySelector(`#${i} .fila-monto`).textContent.startsWith('$'), id);
  assert.deepEqual((await filas(pagina)).at(-1), ['Banco USD', 'Banco · ARS', `$${E}150,00`]);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`aep#12 CA-12 · ordenar con las flechas y con el asa, y el orden queda guardado (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await irACuentas(pagina);
    await pagina.getByRole('button', { name: 'Ordenar' }).click();
    await pagina.getByRole('button', { name: 'Subir Dólares billete' }).click();
    await pagina.getByRole('button', { name: 'Subir Dólares billete' }).click();
    await pagina.getByRole('button', { name: 'Listo' }).click();
    const esperado = ['Billetera', 'Caja', 'Dólares billete', 'Banco', 'Billetera virtual', 'Tarjeta transporte'];
    assert.deepEqual((await filas(pagina)).map((f) => f[0]), esperado);
    await pagina.reload();
    await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
    await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-activas"] > li').length === 6);
    assert.deepEqual((await filas(pagina)).map((f) => f[0]), esperado, 'después de volver a abrir');
    // Con el asa: «Tarjeta transporte» arriba de todo.
    await pagina.getByRole('button', { name: 'Ordenar' }).click();
    const asa = pagina.getByRole('button', { name: 'Arrastrar Tarjeta transporte' });
    const destino = await pagina.locator('.ordenando > li').first().boundingBox();
    const caja = await asa.boundingBox();
    await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(caja.x + caja.width / 2, destino.y + 4, { steps: 12 });
    await pagina.mouse.up();
    await pagina.waitForFunction(() => document.querySelector('.ordenando > li .fila-nombre > span').textContent === 'Tarjeta transporte');
    await pagina.getByRole('button', { name: 'Listo' }).click();
    assert.deepEqual((await filas(pagina)).map((f) => f[0]), ['Tarjeta transporte', ...esperado.slice(0, 5)]);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('aep#12 CA-13 a CA-16 y CA-26 · archivar, reactivar y eliminar', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await irACuentas(pagina);
  await crearBancoUsd(pagina);
  const banco = await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('button').getAttribute('id');
  // CA-13: con saldo, pide confirmación mostrando el saldo.
  await pagina.locator(`#${banco}`).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  const confirmacion = ventana(pagina);
  assert.match(await confirmacion.innerText(), new RegExp(`US\\$${E}150,00`));
  await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  assert.equal((await filas(pagina)).at(-1)[0], 'Banco USD', 'con «Cancelar» sigue activa');
  await pagina.locator(`#${banco}`).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await pagina.locator('.seccion-archivadas').waitFor();
  assert.deepEqual(await archivadas(pagina), [['Banco USD', `US$${E}150,00`]]);
  assert.equal((await filas(pagina)).some((f) => f[0] === 'Banco USD'), false);
  // CA-14: con saldo 0, sin confirmación.
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  await completar(pagina, { nombre: 'Vacía', saldo: '0' });
  await ventana(pagina).waitFor({ state: 'detached' });
  const vacia = await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('button').getAttribute('id');
  await pagina.locator(`#${vacia}`).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await pagina.waitForFunction(() => document.querySelectorAll('.seccion-archivadas li').length === 2);
  assert.equal(await pagina.locator('dialog[open]').count(), 0, 'sin confirmación');
  // CA-26: reactivar va al final.
  await pagina.getByRole('button', { name: 'Reactivar Banco USD' }).click();
  await pagina.waitForFunction(() => document.querySelectorAll('.seccion-archivadas li').length === 1);
  assert.equal((await filas(pagina)).at(-1)[0], 'Banco USD');
  // CA-15: con «Banco USD» archivada se puede crear otra activa con el mismo nombre…
  await pagina.locator(`#${banco}`).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
  await pagina.waitForFunction(() => document.querySelectorAll('.seccion-archivadas li').length === 2);
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  await completar(pagina, { nombre: 'Banco USD', moneda: 'USD', saldo: '1' });
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal((await filas(pagina)).at(-1)[0], 'Banco USD');
  assert.ok((await archivadas(pagina)).some((a) => a[0] === 'Banco USD'), 'y las dos se ven');
  // …y entonces la archivada no se reactiva (CA-26).
  await pagina.getByRole('button', { name: 'Reactivar Banco USD' }).click();
  await aviso(pagina).filter({ hasText: 'Ya existe una cuenta con ese nombre' }).waitFor();
  assert.ok((await archivadas(pagina)).some((a) => a[0] === 'Banco USD'));
  // CA-16: eliminar sin movimientos, con confirmación.
  const nuevo = await pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last().locator('button').getAttribute('id');
  await pagina.locator(`#${nuevo}`).click();
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  assert.match(await ventana(pagina).innerText(), /¿Eliminar Banco USD\?[\s\S]*No se puede deshacer\./);
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  await ventana(pagina).getByRole('button', { name: 'Cancelar' }).click();
  assert.equal((await filas(pagina)).at(-1)[0], 'Banco USD');
  await pagina.locator(`#${nuevo}`).click();
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  await ventana(pagina).getByRole('button', { name: 'Eliminar' }).click();
  await aviso(pagina).filter({ hasText: 'Eliminaste Banco USD.' }).waitFor();
  assert.equal(await pagina.locator(`#${nuevo}`).count(), 0);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-17 · USD no se desactiva mientras la usa una cuenta; sin cuentas en USD, sí', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await pagina.goto(entorno.servidor.url + '#ajustes/monedas');
  await pagina.getByRole('switch', { name: 'USD activa' }).click();
  await pagina.getByText('No podés desactivar USD: la usa la cuenta Dólares billete.').waitFor();
  assert.equal(await pagina.getByRole('switch', { name: 'USD activa' }).getAttribute('aria-checked'), 'true');
  assert.equal(await pagina.getByRole('switch', { name: /ARS/ }).count(), 0, 'ARS no tiene interruptor: es la moneda base');
  // Sin cuentas en USD: se desactiva y el formulario ofrece solo ARS.
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await ventana(pagina).getByRole('button', { name: 'Borrar' }).click();
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).waitFor();
  await pagina.goto(entorno.servidor.url + '#ajustes/monedas');
  await pagina.getByRole('switch', { name: 'USD activa' }).click();
  await pagina.waitForFunction(() => document.getElementById('moneda-USD').getAttribute('aria-checked') === 'false');
  await irACuentas(pagina);
  await pagina.getByRole('button', { name: 'Crear la primera' }).click();
  assert.deepEqual(await ventana(pagina).getByLabel('Moneda').locator('option').evaluateAll((o) => o.map((x) => x.value)), ['ARS']);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-24 y CA-25 · fecha por defecto hoy y sin futuro; emoji, notas y propósito', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  const f = pagina.locator('form.formulario-cuenta').last();
  assert.equal(await f.getByLabel('Al día').inputValue(), '2026-10-31', 'la fecha simulada');
  assert.equal(await f.getByLabel('Propósito').inputValue(), 'ninguno');
  await completar(pagina, { nombre: 'Fondo', fecha: '2026-11-01' });
  await f.locator('.error-campo', { hasText: 'La fecha no puede ser posterior a hoy.' }).waitFor();
  await completar(pagina, { fecha: '2026-10-31', emoji: '🛟', notas: 'Para imprevistos', proposito: 'Emergencia' });
  await ventana(pagina).waitFor({ state: 'detached' });
  const fila = pagina.locator('ul[aria-labelledby="titulo-activas"] > li').last();
  assert.equal(await fila.locator('.fila-emoji').textContent(), '🛟');
  await fila.locator('button').click();
  const g = pagina.locator('form.formulario-cuenta').last();
  assert.equal(await g.getByLabel('Notas').inputValue(), 'Para imprevistos');
  assert.equal(await g.getByLabel('Propósito').inputValue(), 'emergencia');
  await pagina.goto(entorno.servidor.url + '#inicio');
  await pagina.getByRole('button', { name: /🛟 Fondo/ }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-18 · una base del esquema 1 pasa al 2 sin perder la configuración', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport: CELULAR }, '#movimientos');
  // Base como la dejó v0.1.1: solo «configuracion», con un valor distinto del de fábrica.
  await pagina.evaluate(() => new Promise((ok) => {
    const borrar = indexedDB.deleteDatabase('afp-dev');
    borrar.onsuccess = borrar.onblocked = () => {
      const p = indexedDB.open('afp-dev', 1);
      p.onupgradeneeded = () => p.result.createObjectStore('configuracion', { keyPath: 'id' });
      p.onsuccess = () => {
        const tx = p.result.transaction('configuracion', 'readwrite');
        tx.objectStore('configuracion').put({ id: 'config', monedaBase: 'ARS', mesesFondoEmergencia: 9 });
        tx.oncomplete = () => { p.result.close(); ok(); };
      };
    };
  }));
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  await pagina.waitForFunction(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev');
    p.onsuccess = () => { const v = p.result.version; p.result.close(); ok(v === 2); };
  }));
  const base = await pagina.evaluate(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev');
    p.onsuccess = () => {
      const db = p.result;
      const tx = db.transaction(['configuracion', 'monedas'], 'readonly');
      const c = tx.objectStore('configuracion').get('config');
      const m = tx.objectStore('monedas').getAll();
      tx.oncomplete = () => { const r = { almacenes: [...db.objectStoreNames].sort(), meses: c.result.mesesFondoEmergencia, monedas: m.result.map((x) => [x.id, x.activa]) }; db.close(); ok(r); };
    };
  }));
  assert.deepEqual(base, { almacenes: ['configuracion', 'cuentas', 'monedas'], meses: 9, monedas: [['ARS', true], ['USD', true]] });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-19 · sin conexión, la cuenta creada sigue ahí', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await irACuentas(pagina);
  await crearBancoUsd(pagina);
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.getByRole('heading', { name: 'Cuentas', level: 1 }).waitFor();
  await pagina.waitForFunction(() => document.querySelectorAll('ul[aria-labelledby="titulo-activas"] > li').length === 7);
  assert.deepEqual((await filas(pagina)).at(-1), ['Banco USD', 'Banco · USD', `US$${E}150,00`]);
  await contexto.setOffline(false);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-20 · en el celular: sin desplazamiento horizontal, controles de 44 px y teclado con coma', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  const medir = () => pagina.evaluate(() => {
    const raiz = document.querySelector('dialog[open]') ?? document.querySelector('main');
    const chicos = [...raiz.querySelectorAll('button, a[href], input, select, textarea')].filter((e) => e.offsetParent !== null || e.closest('dialog[open]'))
      .map((e) => [e.textContent.trim() || e.getAttribute('aria-label') || e.name, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && (r.width < 44 || r.height < 44)).map(([n, r]) => `${n} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return { ancho: document.documentElement.scrollWidth, chicos };
  });
  await irACuentas(pagina);
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'Cuentas');
  await pagina.getByRole('button', { name: 'Ordenar' }).click();
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'Ordenar');
  await pagina.getByRole('button', { name: 'Listo' }).click();
  await pagina.getByRole('button', { name: 'Nueva cuenta' }).click();
  assert.deepEqual(await medir(), { ancho: 390, chicos: [] }, 'formulario');
  const f = ventana(pagina);
  assert.equal(await f.getByLabel('Saldo inicial').getAttribute('inputmode'), 'decimal');
  const cancelar = await f.getByRole('button', { name: 'Cancelar' }).boundingBox();
  const crear = await f.getByRole('button', { name: 'Crear cuenta' }).boundingBox();
  assert.ok(cancelar.x < crear.x, '«Cancelar» a la izquierda de «Crear cuenta» (D-108)');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('aep#12 CA-21 · crear una cuenta solo con el teclado; Esc cierra y devuelve el foco', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await irACuentas(pagina);
  await pagina.locator('#boton-nueva-cuenta').focus();
  await pagina.keyboard.press('Enter');
  await ventana(pagina).waitFor();
  assert.equal(await pagina.evaluate(() => document.activeElement.labels?.[0]?.textContent), 'Nombre', 'el foco empieza en el nombre');
  await pagina.keyboard.press('Escape');
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal(await pagina.evaluate(() => document.activeElement.id), 'boton-nueva-cuenta', 'el foco vuelve al botón');
  await pagina.keyboard.press('Enter');
  await ventana(pagina).waitFor();
  await pagina.keyboard.type('Teclado');
  // Tab hasta «Crear cuenta», viendo siempre el foco.
  for (let i = 0; i < 20; i += 1) {
    await pagina.keyboard.press('Tab');
    const foco = await pagina.evaluate(() => {
      const e = document.activeElement; const s = getComputedStyle(e);
      return { texto: e.textContent.trim() || `${e.tagName} ${e.name ?? ''}`, contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 };
    });
    assert.ok(foco.contorno, `foco visible en «${foco.texto}»`);
    if (foco.texto === 'Crear cuenta') break;
  }
  await pagina.keyboard.press('Enter');
  await ventana(pagina).waitFor({ state: 'detached' });
  assert.equal((await filas(pagina)).at(-1)[0], 'Teclado');
  // Los errores se anuncian: hay una región de alerta con el primero.
  await pagina.locator('#boton-nueva-cuenta').click();
  await completar(pagina, { nombre: 'Teclado' });
  assert.equal(await ventana(pagina).getByRole('alert').textContent(), 'Ya existe una cuenta con ese nombre');
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const colorScheme of ['light', 'dark']) {
  test(`aep#12 CA-21 · axe-core sin problemas graves en Cuentas, formulario, confirmación y Monedas (${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
    const { contexto, pagina } = await enModoPrueba({ viewport: CELULAR, colorScheme, bypassCSP: true });
    const revisar = async (donde) => {
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(graves, [], donde);
    };
    for (const ruta of ['#inicio', '#ajustes', '#ajustes/cuentas', '#ajustes/monedas']) {
      await pagina.goto(entorno.servidor.url + ruta);
      await pagina.waitForSelector('main h1');
      await pagina.waitForTimeout(150);
      await revisar(ruta);
    }
    await irACuentas(pagina);
    await pagina.getByRole('button', { name: 'Ordenar' }).click();
    await revisar('ordenar');
    await pagina.getByRole('button', { name: 'Listo' }).click();
    await pagina.locator('#cuenta-cue-caja').click();
    await revisar('formulario');
    await ventana(pagina).getByRole('button', { name: 'Archivar' }).click();
    await revisar('confirmación de archivar');
    await contexto.close();
  });
}
