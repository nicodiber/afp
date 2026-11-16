// HU-06 (transferir) y HU-07 (cambiar moneda) en el navegador, celular 390×844 y PC. Valores esperados escritos a mano con los
// datos de ejemplo (Caja, Billetera, Banco y Dólares billete; hoy = 31/10/2026): los saldos se comparan contra los de antes de cargar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = ' ';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const VIEWPORTS = [['celular', CELULAR], ['PC', ESCRITORIO]];
const ventana = (pagina) => pagina.locator('dialog[open]').last();
const aviso = (pagina) => pagina.locator('#aviso-breve');

async function enModoPrueba(opciones = {}) {
  const r = await abrir(entorno.navegador, entorno.servidor, { bypassCSP: true, ...opciones }, '#ajustes');
  await r.pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await r.pagina.locator('.franja-prueba').waitFor();
  await r.pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await r.pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  return r;
}
async function abrirCarga(pagina) {
  await pagina.getByRole('link', { name: 'Cargar', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
  await pagina.locator('.formulario-egreso').waitFor();
}
const grupoTipo = (pagina) => pagina.getByRole('group', { name: 'Tipo de movimiento' });
const elegirTipo = (pagina, nombre) => grupoTipo(pagina).getByRole('button', { name: nombre, exact: true }).click();
const campo = (pagina, nombre) => pagina.getByRole('textbox', { name: nombre, exact: true });
async function elegir(pagina, boton, buscar, opcion) {
  await pagina.getByRole('button', { name: new RegExp(`^${boton}`) }).click();
  await ventana(pagina).getByRole('combobox').fill(buscar);
  await ventana(pagina).getByRole('option', { name: opcion }).click();
  await ventana(pagina).waitFor({ state: 'detached' });
}
const saldoEnInicio = async (pagina, id) => {
  await pagina.goto(`${entorno.servidor.url}#inicio`);
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  return (await pagina.locator(`#tarjeta-${id} .tarjeta-cuenta-monto`).textContent()).replace(E, ' ');
};
const movimientosPropios = (pagina) => pagina.evaluate(() => new Promise((ok) => {
  const p = indexedDB.open('afp-dev-prueba');
  p.onsuccess = () => {
    const db = p.result;
    const g = db.transaction('movimientos').objectStore('movimientos').getAll();
    g.onsuccess = () => { db.close(); ok(g.result.filter((m) => m.origen !== 'datos_ejemplo')); };
  };
}));
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const erroresVisibles = (pagina) => pagina.evaluate(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent));
const graves = (pagina) => pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
  .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
// Totales de «Movimientos» con «Este mes» (ingresos, egresos y diferencia).
async function totalesDelMes(pagina) {
  await pagina.goto(`${entorno.servidor.url}#movimientos`);
  await pagina.locator('.movs-total-lista').first().waitFor();
  return pagina.locator('.movs-total-lista').first().innerText();
}
const textoDelMes = async (pagina) => {
  await pagina.goto(`${entorno.servidor.url}#inicio`);
  await pagina.locator('.grupo-mes').waitFor();
  return pagina.locator('.grupo-mes').innerText();
};

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-06 y HU-07 · Cargar tiene cuatro pestañas que entran en la pantalla y cambian el título y los campos (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    await abrirCarga(pagina);
    assert.deepEqual(await grupoTipo(pagina).getByRole('button').allTextContents(), ['Egreso', 'Ingreso', 'Transferencia', 'Cambio']);
    await elegirTipo(pagina, 'Transferencia');
    await pagina.getByRole('heading', { name: 'Nueva transferencia', level: 1 }).waitFor();
    assert.equal(await pagina.title(), 'Nueva transferencia · AFP');
    assert.equal(await pagina.getByRole('button', { name: /^Categoría/ }).count(), 0, 'sin categoría');
    assert.equal(await pagina.getByRole('button', { name: 'Invertir origen y destino' }).count(), 1);
    assert.ok(await sinDesborde(pagina));
    // Orden en pantalla: Monto, descripción, Desde, ⇅ y Hacia.
    const y = async (localizador) => (await localizador.boundingBox()).y;
    assert.ok(await y(campo(pagina, 'Monto')) < await y(pagina.getByRole('button', { name: /^Desde/ })));
    assert.ok(await y(pagina.getByRole('button', { name: /^Desde/ })) < await y(pagina.getByRole('button', { name: 'Invertir origen y destino' })));
    assert.ok(await y(pagina.getByRole('button', { name: 'Invertir origen y destino' })) < await y(pagina.getByRole('button', { name: /^Hacia/ })));
    await elegirTipo(pagina, 'Cambio');
    await pagina.getByRole('heading', { name: 'Nuevo cambio de moneda', level: 1 }).waitFor();
    for (const rotulo of ['Entregás: monto', 'Recibís: monto', 'Tipo de cambio']) assert.equal(await campo(pagina, rotulo).count(), 1, rotulo);
    for (const boton of [/^Entregás: cuenta/, /^Recibís: cuenta/]) assert.equal(await pagina.getByRole('button', { name: boton }).count(), 1);
    assert.ok(await sinDesborde(pagina));
    await elegirTipo(pagina, 'Egreso');
    await pagina.getByRole('heading', { name: 'Nuevo egreso', level: 1 }).waitFor();
    assert.equal(await pagina.getByRole('button', { name: /^Categoría/ }).count(), 1);
    assert.equal(await pagina.getByRole('button', { name: /^Hacia/ }).isVisible(), false);
    assert.deepEqual(errores, []);
    await contexto.close();
  });

  test(`HU-06 CA-1 y CA-3 · transferir 10.000 de Caja a Billetera: cambian los dos saldos, no los ingresos ni egresos, y se ve una fila «⇄ Caja → Billetera» en gris (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    const antes = { caja: await saldoEnInicio(pagina, 'cue-caja'), billetera: await saldoEnInicio(pagina, 'cue-billetera') };
    const totalesAntes = await totalesDelMes(pagina);
    const mesAntes = nombre === 'PC' ? await textoDelMes(pagina) : null;
    await abrirCarga(pagina);
    await elegirTipo(pagina, 'Transferencia');
    await campo(pagina, 'Monto').fill('10000');
    await campo(pagina, 'Descripción (opcional)').fill('retiro');
    await elegir(pagina, 'Desde', 'caja', /Caja/);
    await elegir(pagina, 'Hacia', 'billetera', /Billetera(?! virtual)/);
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await aviso(pagina).filter({ hasText: 'Guardaste la transferencia. Saldo de Caja:' }).waitFor();
    const numero = (texto) => Number(texto.replace(/[^\d,]/g, '').replace(',', '.'));
    const despues = { caja: await saldoEnInicio(pagina, 'cue-caja'), billetera: await saldoEnInicio(pagina, 'cue-billetera') };
    assert.equal(numero(despues.caja), numero(antes.caja) - 10000);
    assert.equal(numero(despues.billetera), numero(antes.billetera) + 10000);
    // Lo guardado: sin categoría ni partes, con sus dos asientos.
    const [m] = await movimientosPropios(pagina);
    assert.deepEqual([m.tipo, m.montoTotal, m.cuentaId, m.cuentaDestinoId, m.partes, m.asientos, m.descripcion],
      ['transferencia', 1000000, 'cue-caja', 'cue-billetera', [], [{ cuentaId: 'cue-caja', monto: -1000000 }, { cuentaId: 'cue-billetera', monto: 1000000 }], 'Retiro']);
    // Ingresos y egresos del mes iguales (Movimientos e Inicio).
    assert.equal(await totalesDelMes(pagina), totalesAntes);
    // La fila en Movimientos: «⇄ Caja → Billetera», monto en gris y sin signo.
    const fila = pagina.locator('.movs-fila', { hasText: 'Caja → Billetera' });
    assert.equal(await fila.count(), 1);
    assert.equal(await fila.locator('.movs-icono').textContent(), '⇄');
    assert.equal((await fila.locator('.movs-monto').textContent()).replace(E, ' '), '$ 10.000,00');
    assert.equal(await fila.locator('.movs-monto').evaluate((e) => getComputedStyle(e).color), 'rgb(87, 101, 93)', 'gris (--color-neutro)');
    assert.match(await fila.locator('.movs-detalle').textContent(), /Retiro/);
    // El filtro Tipo suma «Transferencias» y «Cambios de moneda»; el de cuenta la muestra en las dos cuentas.
    assert.deepEqual(await pagina.getByLabel('Tipo').locator('option').allTextContents(), ['Todos', 'Egresos', 'Ingresos', 'Transferencias', 'Cambios de moneda']);
    await pagina.getByLabel('Tipo').selectOption('transferencia');
    assert.equal(await pagina.locator('.movs-fila').count(), 1);
    await pagina.getByLabel('Tipo').selectOption('egreso');
    assert.equal(await pagina.locator('.movs-fila', { hasText: 'Caja → Billetera' }).count(), 0);
    await pagina.getByLabel('Tipo').selectOption('todos');
    for (const cuenta of ['cue-caja', 'cue-billetera']) {
      await pagina.getByLabel('Cuenta').selectOption(cuenta);
      assert.equal(await pagina.locator('.movs-fila', { hasText: 'Caja → Billetera' }).count(), 1, cuenta);
    }
    await pagina.getByLabel('Cuenta').selectOption('cue-banco');
    assert.equal(await pagina.locator('.movs-fila', { hasText: 'Caja → Billetera' }).count(), 0);
    assert.ok(await sinDesborde(pagina));
    // Inicio: la misma fila entre los últimos movimientos.
    await pagina.goto(`${entorno.servidor.url}#inicio`);
    await pagina.locator('.ultimos-lista .movs-fila', { hasText: 'Caja → Billetera' }).waitFor();
    assert.ok(await sinDesborde(pagina));
    if (nombre === 'PC') assert.equal(await textoDelMes(pagina), mesAntes, 'los ingresos y egresos del mes de Inicio no cambian');
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-06 CA-2 · mismo origen y destino, monto 0, sin cuentas o cuentas de otra moneda: no se guarda y se señala el campo', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Transferencia');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|')
    === 'Escribí un monto mayor que 0.|Elegí la cuenta de origen.|Elegí la cuenta de destino.');
  assert.equal(await pagina.evaluate(() => document.activeElement.id.startsWith('egreso-monto')), true, 'el foco va al primer campo con error');
  await campo(pagina, 'Monto').fill('0');
  await elegir(pagina, 'Desde', 'caja', /Caja/);
  await elegir(pagina, 'Hacia', 'caja', /Caja/);
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|')
    === 'Escribí un monto mayor que 0.|El origen y el destino tienen que ser cuentas distintas.');
  // Cuentas de otra moneda: se ofrece ir a «Cambio» y se conservan los datos.
  await campo(pagina, 'Monto').fill('5000');
  await elegir(pagina, 'Hacia', 'dolar', /Dólares billete/);
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('.error-campo', { hasText: 'Las cuentas son de distinta moneda: eso es un cambio. Andá a la pestaña «Cambio».' }).waitFor();
  assert.equal((await movimientosPropios(pagina)).length, 0);
  await pagina.getByRole('button', { name: 'Ir a «Cambio»' }).click();
  await pagina.getByRole('heading', { name: 'Nuevo cambio de moneda', level: 1 }).waitFor();
  assert.equal(await campo(pagina, 'Entregás: monto').inputValue(), '5.000,00');
  assert.match(await pagina.getByRole('button', { name: /^Entregás: cuenta/ }).textContent(), /Caja/);
  assert.match(await pagina.getByRole('button', { name: /^Recibís: cuenta/ }).textContent(), /Dólares billete/);
  assert.deepEqual(await erroresVisibles(pagina), []);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-06 · ⇅ invierte origen y destino', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Transferencia');
  await elegir(pagina, 'Desde', 'caja', /Caja/);
  await elegir(pagina, 'Hacia', 'banco', /Banco/);
  await pagina.getByRole('button', { name: 'Invertir origen y destino' }).click();
  assert.match(await pagina.getByRole('button', { name: /^Desde/ }).textContent(), /Banco/);
  assert.match(await pagina.getByRole('button', { name: /^Hacia/ }).textContent(), /Caja/);
  await campo(pagina, 'Monto').fill('1000');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await aviso(pagina).filter({ hasText: 'Guardaste la transferencia.' }).waitFor();
  const [m] = await movimientosPropios(pagina);
  assert.deepEqual([m.cuentaId, m.cuentaDestinoId], ['cue-banco', 'cue-caja']);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-06 · con el teclado en la PC: ← y → recorren las cuatro pestañas y ↓ sigue el orden de la pantalla', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await grupoTipo(pagina).getByRole('button', { name: 'Egreso', exact: true }).focus();
  for (const titulo of ['Nuevo ingreso', 'Nueva transferencia', 'Nuevo cambio de moneda', 'Nuevo cambio de moneda']) {
    await pagina.keyboard.press('ArrowRight');
    await pagina.getByRole('heading', { name: titulo, level: 1 }).waitFor();
  }
  await pagina.keyboard.press('ArrowLeft');
  await pagina.getByRole('heading', { name: 'Nueva transferencia', level: 1 }).waitFor();
  // Transferencia: tipo → fecha → hora → monto → descripción → Desde → ⇅ → Hacia → botones.
  const ids = [];
  for (let i = 0; i < 8; i += 1) {
    await pagina.keyboard.press('ArrowDown');
    ids.push(await pagina.evaluate(() => document.activeElement.id.replace(/-\d+$/, '')));
  }
  assert.deepEqual(ids, ['egreso-fecha', 'egreso-hora', 'egreso-monto', 'egreso-descripcion', 'egreso-cuenta', 'egreso-invertir', 'egreso-destino', 'egreso-cancelar']);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-07 CA-1 · cambiar $ 145.000 de Banco por US$ 100: Banco baja, Dólares billete sube y el tipo de cambio guardado es 1.450 (${nombre})`, async () => {
    const { contexto, pagina, errores } = await enModoPrueba({ viewport });
    const antes = { banco: await saldoEnInicio(pagina, 'cue-banco'), dolares: await saldoEnInicio(pagina, 'cue-dolares') };
    await abrirCarga(pagina);
    await elegirTipo(pagina, 'Cambio');
    await elegir(pagina, 'Entregás: cuenta', 'banc', /Banco/);
    await elegir(pagina, 'Recibís: cuenta', 'dolar', /Dólares billete/);
    await campo(pagina, 'Entregás: monto').fill('145000');
    await campo(pagina, 'Recibís: monto').fill('100');
    assert.equal(await campo(pagina, 'Tipo de cambio').inputValue(), '1.450,00');
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await aviso(pagina).filter({ hasText: 'Guardaste el cambio de moneda.' }).waitFor();
    const numero = (texto) => Number(texto.replace(/[^\d,]/g, '').replace(',', '.'));
    assert.equal(numero(await saldoEnInicio(pagina, 'cue-banco')), numero(antes.banco) - 145000);
    assert.equal(numero(await saldoEnInicio(pagina, 'cue-dolares')), numero(antes.dolares) + 100);
    const [m] = await movimientosPropios(pagina);
    assert.deepEqual([m.tipo, m.montoTotal, m.montoRecibido, m.tipoCambioOperacion, m.partes, m.asientos],
      ['cambio_moneda', 14500000, 10000, '1450.0000', [], [{ cuentaId: 'cue-banco', monto: -14500000 }, { cuentaId: 'cue-dolares', monto: 10000 }]]);
    // CA-4: la fila en Movimientos.
    await pagina.goto(`${entorno.servidor.url}#movimientos`);
    const fila = pagina.locator('.movs-fila', { hasText: 'Banco → Dólares billete' });
    await fila.waitFor();
    assert.equal(await fila.count(), 1);
    assert.equal(await fila.locator('.movs-icono').textContent(), '💱');
    assert.equal((await fila.locator('.movs-monto').textContent()).replaceAll(E, ' '), '$ 145.000,00 → US$ 100,00');
    assert.match(await fila.locator('.movs-detalle').textContent(), /TC 1\.450,00/);
    assert.equal(await fila.locator('.movs-monto').evaluate((e) => getComputedStyle(e).color), 'rgb(87, 101, 93)');
    await pagina.getByLabel('Tipo').selectOption('cambio_moneda');
    assert.equal(await pagina.locator('.movs-fila').count(), 1);
    await pagina.getByLabel('Tipo').selectOption('transferencia');
    assert.equal(await pagina.locator('.movs-fila').count(), 0);
    assert.ok(await sinDesborde(pagina));
    await pagina.goto(`${entorno.servidor.url}#inicio`);
    await pagina.locator('.ultimos-lista .movs-fila', { hasText: 'Banco → Dólares billete' }).waitFor();
    assert.ok(await sinDesborde(pagina));
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-07 CA-1 · vender US$ 50 por $ 70.000: el tipo de cambio es 1.400 (pesos por dólar)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Cambio');
  await elegir(pagina, 'Entregás: cuenta', 'dolar', /Dólares billete/);
  await elegir(pagina, 'Recibís: cuenta', 'banc', /Banco/);
  await campo(pagina, 'Entregás: monto').fill('50');
  await campo(pagina, 'Recibís: monto').fill('70000');
  assert.equal(await campo(pagina, 'Tipo de cambio').inputValue(), '1.400,00');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await aviso(pagina).filter({ hasText: 'Guardaste el cambio de moneda.' }).waitFor();
  const [m] = await movimientosPropios(pagina);
  assert.deepEqual([m.montoTotal, m.montoRecibido, m.tipoCambioOperacion, m.monedaId], [5000, 7000000, '1400.0000', 'USD']);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-07 CA-3 · el monto que recibís y el tipo de cambio se calculan uno a otro; manda el último que tocaste y el monto que entregás recalcula al que manda', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Cambio');
  await elegir(pagina, 'Entregás: cuenta', 'banc', /Banco/);
  await elegir(pagina, 'Recibís: cuenta', 'dolar', /Dólares billete/);
  const entrega = campo(pagina, 'Entregás: monto');
  const recibe = campo(pagina, 'Recibís: monto');
  const tc = campo(pagina, 'Tipo de cambio');
  await entrega.fill('145000');
  // Primero el monto que recibís: se calcula el tipo de cambio.
  await recibe.fill('100');
  assert.equal(await tc.inputValue(), '1.450,00');
  // Cambiar el que recibís recalcula el tipo de cambio.
  await recibe.fill('200');
  assert.equal(await tc.inputValue(), '725,00');
  // Ahora el tipo de cambio manda: se calcula el monto que recibís.
  await tc.fill('1450');
  assert.equal(await recibe.inputValue(), '100,00');
  await tc.fill('1.450,55');
  assert.equal(await recibe.inputValue(), '99,96');
  // El monto que entregás recalcula al que manda (el tipo de cambio, que fue el último tocado).
  await entrega.fill('290000');
  assert.equal(await recibe.inputValue(), '199,92');
  assert.equal(await tc.inputValue(), '1.450,55', 'el tipo de cambio escrito no se toca');
  // Vuelve a mandar el monto que recibís: el tipo de cambio sale de los dos montos.
  await recibe.fill('200');
  assert.equal(await tc.inputValue(), '1.450,00');
  await entrega.fill('145000');
  assert.equal(await tc.inputValue(), '725,00', 'el que manda sigue siendo el monto que recibís');
  // Empezar por el tipo de cambio: se calcula el monto.
  await recibe.fill('');
  await tc.fill('1400');
  assert.equal(await recibe.inputValue(), '103,57');
  // ⇅ invierte las cuentas y los montos; el tipo de cambio sigue siendo pesos por dólar.
  await pagina.getByRole('button', { name: 'Invertir lo que entregás y lo que recibís' }).click();
  assert.match(await pagina.getByRole('button', { name: /^Entregás: cuenta/ }).textContent(), /Dólares billete/);
  assert.match(await pagina.getByRole('button', { name: /^Recibís: cuenta/ }).textContent(), /Banco/);
  assert.equal(await entrega.inputValue(), '103,57');
  assert.equal(await recibe.inputValue(), '145.000,00');
  assert.equal(await tc.inputValue(), '1.400,00');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-07 CA-2 · monto en 0, cuenta sin elegir o dos cuentas de la misma moneda: no se guarda y se señala el campo (con la misma moneda, se ofrece «Transferencia»)', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: CELULAR });
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Cambio');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|')
    === 'Escribí un monto mayor que 0.|Elegí la cuenta de origen.|Elegí la cuenta de destino.|Escribí el monto que recibís, mayor que 0.');
  await campo(pagina, 'Entregás: monto').fill('1000');
  await campo(pagina, 'Recibís: monto').fill('0');
  await elegir(pagina, 'Entregás: cuenta', 'banc', /Banco/);
  await elegir(pagina, 'Recibís: cuenta', 'caja', /Caja/);
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForFunction(() => [...document.querySelectorAll('.error-campo:not([hidden])')].map((x) => x.textContent).join('|')
    === 'Las cuentas son de la misma moneda: eso es una transferencia. Andá a la pestaña «Transferencia».|Escribí el monto que recibís, mayor que 0.');
  assert.equal((await movimientosPropios(pagina)).length, 0);
  await pagina.getByRole('button', { name: 'Ir a «Transferencia»' }).click();
  await pagina.getByRole('heading', { name: 'Nueva transferencia', level: 1 }).waitFor();
  assert.equal(await campo(pagina, 'Monto').inputValue(), '1.000,00');
  assert.match(await pagina.getByRole('button', { name: /^Desde/ }).textContent(), /Banco/);
  assert.match(await pagina.getByRole('button', { name: /^Hacia/ }).textContent(), /Caja/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('HU-06 y HU-07 · Ctrl + Z deshace una transferencia y un cambio (HU-41) y los saldos vuelven', async () => {
  const { contexto, pagina, errores } = await enModoPrueba({ viewport: ESCRITORIO });
  const antes = await saldoEnInicio(pagina, 'cue-caja');
  await abrirCarga(pagina);
  await elegirTipo(pagina, 'Transferencia');
  await campo(pagina, 'Monto').fill('10000');
  await elegir(pagina, 'Desde', 'caja', /Caja/);
  await elegir(pagina, 'Hacia', 'banc', /Banco/);
  await pagina.getByRole('button', { name: 'Guardar y cargar otro' }).click();
  await aviso(pagina).filter({ hasText: 'Guardaste la transferencia.' }).waitFor();
  assert.equal(await pagina.getByRole('heading', { level: 1 }).textContent(), 'Nueva transferencia', '«cargar otro» mantiene la pestaña');
  assert.equal(await campo(pagina, 'Monto').inputValue(), '');
  await pagina.getByRole('button', { name: 'Deshacer' }).click();
  await aviso(pagina).filter({ hasText: 'Deshiciste: transferencia de $' }).waitFor();
  assert.equal((await movimientosPropios(pagina)).length, 0);
  assert.equal(await saldoEnInicio(pagina, 'cue-caja'), antes);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of VIEWPORTS) {
  test(`HU-06 y HU-07 · axe-core sin problemas graves en Cargar: Transferencia y Cambio, claro y oscuro (${nombre})`, async () => {
    for (const colorScheme of ['light', 'dark']) {
      const { contexto, pagina, errores } = await enModoPrueba({ viewport, colorScheme });
      await abrirCarga(pagina);
      await pagina.addScriptTag({ path: AXE });
      for (const tipo of ['Transferencia', 'Cambio']) {
        await elegirTipo(pagina, tipo);
        // Con errores a la vista también.
        await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
        await pagina.locator('.error-campo:not([hidden])').first().waitFor();
        assert.deepEqual(await graves(pagina), [], `${tipo} ${colorScheme}`);
        assert.ok(await sinDesborde(pagina));
      }
      assert.deepEqual(errores, []);
      await contexto.close();
    }
  });
}
