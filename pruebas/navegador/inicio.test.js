// HU-01: bienvenida del primer uso (plantilla o vacío) en el navegador, en celular y PC. Valores esperados de la
// spec 16, escritos a mano. `abrir(..., { bienvenida: true })` deja la oferta en pantalla en vez de saltarla.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { prepararEntorno, abrir, CELULAR, ESCRITORIO, textoPrincipal } from './comun.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const E = ' ';
let entorno;
before(async () => { entorno = await prepararEntorno(); });
after(async () => { await entorno.cerrar(); });

const aviso = (pagina) => pagina.locator('#aviso-breve');
const leer = (pagina, base, almacen) => pagina.evaluate(([b, a]) => new Promise((ok, mal) => {
  const p = indexedDB.open(b);
  p.onerror = () => mal(p.error);
  p.onsuccess = () => {
    const bd = p.result;
    if (!bd.objectStoreNames.contains(a)) { bd.close(); ok([]); return; }
    const g = bd.transaction(a).objectStore(a).getAll();
    g.onsuccess = () => { bd.close(); ok(g.result); };
  };
}), [base, almacen]);
const marca = async (pagina, base) => (await leer(pagina, base, 'configuracion'))[0]?.inicioCompletado;
const cantidad = async (pagina, base) => (await Promise.all(['cuentas', 'categorias', 'ubicacionesCategoria'].map((a) => leer(pagina, base, a)))).map((x) => x.length);
const arbol = (pagina, tipo) => pagina.locator(`ul[aria-labelledby="titulo-${tipo}"] > li`).evaluateAll((li) => li.map((x) => [x.querySelector('.fila-nombre').textContent, Number(x.style.getPropertyValue('--nivel'))]));
const tarjetas = (pagina) => pagina.locator('.tarjetas-cuentas .tarjeta-cuenta:not(.tarjeta-nueva)').evaluateAll((t) => t.map((x) => [x.querySelector('.tarjeta-cuenta-nombre').textContent, x.querySelector('.tarjeta-cuenta-monto').textContent]));

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-01 CA-1 · una base sin datos ofrece la bienvenida antes de Inicio, sin la navegación, y vuelve a ofrecerla si se cierra (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport, bienvenida: true });
    assert.equal(await pagina.locator('main h1').textContent(), 'Te damos la bienvenida a AFP');
    assert.equal(await pagina.getByRole('heading', { name: '¿Cómo querés empezar?' }).count(), 1);
    const plantilla = pagina.getByRole('button', { name: /Empezar con la plantilla/ });
    const vacio = pagina.getByRole('button', { name: /Empezar vacío/ });
    assert.match(await plantilla.innerText(), /4 cuentas y un árbol de categorías comunes, con saldo 0\. Podés cambiarlas o borrarlas cuando quieras\./);
    assert.match(await vacio.innerText(), /Sin cuentas ni categorías: las creás vos\./);
    assert.equal(await pagina.locator('.navegacion').isVisible(), false, 'sin la navegación');
    assert.equal(await pagina.title(), 'Bienvenida · AFP');
    // «Ver qué trae la plantilla» despliega la lista.
    const ver = pagina.getByRole('button', { name: 'Ver qué trae la plantilla' });
    assert.equal(await ver.getAttribute('aria-expanded'), 'false');
    await ver.click();
    const lista = pagina.locator('#contenido-plantilla');
    await lista.getByText('Kiosco').waitFor();
    const texto = await lista.innerText();
    for (const esperado of ['Efectivo · Efectivo · ARS', 'Dólares · Efectivo · USD', 'Sueldo', 'Otros ingresos', '🏠 Vivienda', 'Calzado', 'Otros gastos']) assert.ok(texto.includes(esperado), esperado);
    assert.equal(await lista.locator('li').count(), 4 + 37, 'las 4 cuentas y las 37 categorías');
    // Mientras no se elige, no se guarda nada.
    assert.deepEqual(await cantidad(pagina, 'afp-dev'), [0, 0, 0]);
    assert.notEqual(await marca(pagina, 'afp-dev'), true);
    // Se cierra sin elegir y se vuelve a abrir: se ofrece de nuevo.
    const otra = await contexto.newPage();
    await pagina.close();
    await otra.goto(entorno.servidor.url);
    await otra.locator('#empezar-plantilla').waitFor();
    assert.deepEqual(await cantidad(otra, 'afp-dev'), [0, 0, 0]);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-01 CA-1 · una base con datos y sin la marca no ve la oferta y queda con inicioCompletado verdadero', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { bienvenida: true });
  await pagina.locator('#empezar-plantilla').waitFor();
  // Una base de v0.2.0-4: una cuenta creada, sin la marca.
  await pagina.evaluate(() => new Promise((ok) => {
    const p = indexedDB.open('afp-dev');
    p.onsuccess = () => {
      const tx = p.result.transaction('cuentas', 'readwrite');
      tx.objectStore('cuentas').put({ id: 'cue-previa', nombre: 'Previa', tipo: 'efectivo', monedaId: 'ARS', saldoInicial: 0, fechaSaldoInicial: '2026-10-01', tieneRendimiento: false, proposito: 'ninguno', emoji: '', notas: '', orden: 1, estado: 'activa' });
      tx.oncomplete = () => { p.result.close(); ok(); };
    };
  }));
  await pagina.reload();
  await pagina.locator('#tarjeta-cue-previa').waitFor();
  assert.equal(await pagina.locator('#empezar-plantilla').count(), 0);
  assert.equal(await pagina.locator('.navegacion').isVisible(), true);
  await pagina.waitForFunction(() => indexedDB.databases().then(() => true));
  assert.equal(await marca(pagina, 'afp-dev'), true);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-01 CA-2 · empezar con la plantilla crea 4 cuentas y 37 categorías, avisa y lleva a Inicio (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport, bienvenida: true }, '#ajustes/categorias');
    // Un doble toque no la carga dos veces.
    await pagina.locator('#empezar-plantilla').dblclick();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.equal((await aviso(pagina).textContent()), '¡Listo! Empezaste con 4 cuentas y 37 categorías. Podés cambiarlas cuando quieras.');
    assert.equal(await pagina.evaluate(() => location.hash), '#inicio');
    assert.equal(await pagina.locator('.navegacion').isVisible(), true);
    assert.deepEqual(await tarjetas(pagina), [['Efectivo', `$${E}0,00`], ['Banco', `$${E}0,00`], ['Billetera virtual', `$${E}0,00`], ['Dólares', `US$${E}0,00`]]);
    assert.deepEqual(await cantidad(pagina, 'afp-dev'), [4, 37, 37]);
    assert.equal(await marca(pagina, 'afp-dev'), true);
    const cuentas = await leer(pagina, 'afp-dev', 'cuentas');
    assert.ok(cuentas.every((c) => c.fechaSaldoInicial === new Date().toLocaleDateString('en-CA') && c.saldoInicial === 0 && !c.tieneRendimiento && c.proposito === 'ninguno'));
    assert.ok((await leer(pagina, 'afp-dev', 'ubicacionesCategoria')).every((u) => u.desde === null));
    await pagina.goto(entorno.servidor.url + '#ajustes/categorias');
    await pagina.locator('#titulo-egreso').waitFor();
    const ingresos = await arbol(pagina, 'ingreso');
    assert.deepEqual(ingresos, [['Sueldo', 0], ['Trabajos independientes', 0], ['Ventas', 0], ['Ayuda familiar', 0], ['Otros ingresos', 0]]);
    const egresos = await arbol(pagina, 'egreso');
    assert.equal(egresos.length, 32);
    assert.deepEqual(egresos.filter(([, n]) => n === 0).map(([x]) => x), ['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Vestimenta', 'Educación', 'Ocio', 'Impuestos y comisiones', 'Regalos', 'Otros gastos']);
    // Ya no se vuelve a ofrecer.
    await pagina.reload();
    await pagina.locator('#titulo-egreso').waitFor();
    assert.equal(await pagina.locator('#empezar-plantilla').count(), 0);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-01 CA-2 · si no se puede cargar la plantilla se avisa, no queda nada y se puede probar de nuevo', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { bienvenida: true });
  await pagina.route('**/plantilla/plantilla-inicial.json', (ruta) => ruta.abort());
  await pagina.locator('#empezar-plantilla').click();
  await pagina.locator('#error-bienvenida').filter({ hasText: 'No se pudo cargar la plantilla. Probá de nuevo.' }).waitFor();
  assert.equal(await pagina.locator('#empezar-plantilla').isEnabled(), true);
  assert.equal(await pagina.locator('main h1').textContent(), 'Te damos la bienvenida a AFP');
  assert.deepEqual(await cantidad(pagina, 'afp-dev'), [0, 0, 0]);
  assert.notEqual(await marca(pagina, 'afp-dev'), true);
  await pagina.unroute('**/plantilla/plantilla-inicial.json');
  await pagina.locator('#empezar-plantilla').click();
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  assert.deepEqual(await cantidad(pagina, 'afp-dev'), [4, 37, 37]);
  assert.deepEqual(errores.filter((e) => !/ERR_FAILED|plantilla/.test(e)), []);
  await contexto.close();
});

test('HU-01 CA-2 · la escritura de la plantilla es todo o nada: un registro inválido no deja nada guardado', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { bienvenida: true });
  const resultado = await pagina.evaluate(async (url) => {
    const { crearAlmacenIndexedDB } = await import(`${url}src/adaptadores/almacen-indexeddb.js`);
    const almacen = crearAlmacenIndexedDB('afp-atomico');
    let fallo = false;
    try {
      await almacen.guardarTodo({ cuentas: [{ id: 'a' }], categorias: [{ id: 'b' }, { sinId: true }], configuracion: [{ id: 'config', inicioCompletado: true }] });
    } catch { fallo = true; }
    return { fallo, cuentas: (await almacen.listar('cuentas')).length, categorias: (await almacen.listar('categorias')).length, configuracion: await almacen.leerConfiguracion() };
  }, entorno.servidor.url);
  assert.deepEqual(resultado, { fallo: true, cuentas: 0, categorias: 0, configuracion: null });
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  test(`HU-01 CA-3 · empezar vacío lleva a Inicio sin cuentas, con solo las raíces de categorías, y no se vuelve a ofrecer (${nombre})`, async () => {
    const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport, bienvenida: true });
    await pagina.getByRole('button', { name: /Empezar vacío/ }).click();
    await pagina.locator('#titulo-tus-cuentas').waitFor();
    assert.match(await textoPrincipal(pagina), /Todavía no tenés cuentas\./);
    assert.equal(await pagina.getByRole('button', { name: 'Crear la primera' }).count(), 1);
    assert.equal(await pagina.locator('.navegacion').isVisible(), true);
    assert.deepEqual(await cantidad(pagina, 'afp-dev'), [0, 0, 0]);
    assert.equal(await marca(pagina, 'afp-dev'), true);
    await pagina.goto(entorno.servidor.url + '#ajustes/categorias');
    await pagina.locator('#titulo-egreso').waitFor();
    assert.deepEqual(await arbol(pagina, 'ingreso'), []);
    assert.deepEqual(await arbol(pagina, 'egreso'), []);
    assert.equal(await pagina.getByRole('heading', { name: 'Ingresos' }).count() + await pagina.getByRole('heading', { name: 'Egresos' }).count(), 2);
    await pagina.reload();
    await pagina.locator('#titulo-egreso').waitFor();
    assert.equal(await pagina.locator('#empezar-vacio').count(), 0);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('HU-01 CA-4 · en modo prueba la oferta aparece en la base de prueba y la base real no se toca; los datos de ejemplo la dan por resuelta y borrarlos la vuelve a ofrecer', async () => {
  const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, {}, '#ajustes');
  assert.equal(await marca(pagina, 'afp-dev'), true);
  // Modo prueba: la base de prueba está vacía y ofrece la bienvenida.
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.locator('#empezar-plantilla').waitFor();
  await pagina.locator('#empezar-plantilla').click();
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  assert.deepEqual(await cantidad(pagina, 'afp-dev-prueba'), [4, 37, 37]);
  assert.equal((await leer(pagina, 'afp-dev-prueba', 'cuentas'))[0].fechaSaldoInicial, '2026-10-31', 'hoy es la fecha simulada');
  // Se sale del modo prueba: la base real sigue igual que antes.
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.locator('.franja-prueba').waitFor({ state: 'hidden' });
  assert.deepEqual(await cantidad(pagina, 'afp-dev'), [0, 0, 0]);
  assert.equal(await marca(pagina, 'afp-dev'), true);
  assert.equal(await pagina.locator('#empezar-plantilla').count(), 0);
  // De vuelta en el modo prueba: «Borrar datos de prueba» deja la marca falsa y se vuelve a ofrecer al reabrir.
  await pagina.getByRole('switch', { name: 'Modo prueba' }).click();
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await pagina.locator('dialog[open]').getByRole('button', { name: 'Borrar', exact: true }).click();
  await aviso(pagina).filter({ hasText: 'Borraste los datos de prueba.' }).waitFor();
  assert.equal(await marca(pagina, 'afp-dev-prueba'), false);
  assert.deepEqual(await cantidad(pagina, 'afp-dev-prueba'), [0, 0, 0]);
  assert.equal(await pagina.locator('#empezar-plantilla').count(), 0, 'no salta en medio de Ajustes');
  await pagina.reload();
  await pagina.locator('#empezar-plantilla').waitFor();
  // Elegir vacío y cargar los datos de ejemplo: la marca queda verdadera y no se vuelve a ofrecer.
  await pagina.locator('#empezar-vacio').click();
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  await pagina.goto(entorno.servidor.url + '#ajustes');
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  assert.equal(await marca(pagina, 'afp-dev-prueba'), true);
  await pagina.getByRole('button', { name: 'Borrar datos de prueba' }).click();
  await pagina.locator('dialog[open]').getByRole('button', { name: 'Borrar', exact: true }).click();
  await aviso(pagina).filter({ hasText: 'Borraste los datos de prueba.' }).waitFor();
  await pagina.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await pagina.getByRole('button', { name: 'Restablecer datos de ejemplo' }).waitFor();
  await pagina.reload();
  await pagina.waitForSelector('main h1');
  assert.equal(await pagina.locator('#empezar-plantilla').count(), 0);
  await pagina.goto(entorno.servidor.url + '#inicio');
  await pagina.locator('#titulo-tus-cuentas').waitFor();
  assert.equal((await tarjetas(pagina)).length, 6);
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, viewport] of [['celular', CELULAR], ['PC', ESCRITORIO]]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`HU-01 CA-1 · la bienvenida es accesible: axe-core, objetivos de 44 px, sin desplazamiento lateral y con teclado (${nombre}, ${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async () => {
      const { contexto, pagina, errores } = await abrir(entorno.navegador, entorno.servidor, { viewport, colorScheme, bypassCSP: true, bienvenida: true });
      await pagina.addScriptTag({ path: AXE });
      const graves = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(graves, []);
      // Con la lista desplegada también.
      await pagina.getByRole('button', { name: 'Ver qué trae la plantilla' }).click();
      await pagina.locator('#contenido-plantilla').getByText('Kiosco').waitFor();
      const gravesLista = await pagina.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`));
      assert.deepEqual(gravesLista, [], 'con la lista abierta');
      assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sin desplazamiento lateral');
      for (const id of ['empezar-plantilla', 'empezar-vacio', 'ver-plantilla']) {
        const caja = await pagina.locator(`#${id}`).boundingBox();
        assert.ok(caja.width >= 44 && caja.height >= 44, `${id} mide ${caja.width} × ${caja.height}`);
      }
      // Con Tab se llega a las dos opciones y el foco se ve; Enter elige.
      let enfocado = '';
      for (let i = 0; i < 8 && enfocado !== 'empezar-vacio'; i += 1) {
        await pagina.keyboard.press('Tab');
        enfocado = await pagina.evaluate(() => document.activeElement.id);
        if (['empezar-plantilla', 'empezar-vacio'].includes(enfocado)) {
          const anillo = await pagina.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, parseFloat(s.outlineWidth)]; });
          assert.ok(anillo[0] !== 'none' && anillo[1] >= 2, `foco visible en ${enfocado}`);
        }
      }
      assert.equal(enfocado, 'empezar-vacio');
      await pagina.keyboard.press('Enter');
      await pagina.locator('#titulo-tus-cuentas').waitFor();
      assert.deepEqual(errores, []);
      await contexto.close();
    });
  }
}
