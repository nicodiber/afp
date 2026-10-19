// Pruebas de factibilidad de AFP (E3: F-01, F-03, F-06).
// Página de prueba, no es código de la app: no guarda ni manda datos personales.

const FUENTES = [
  { id: 'dolarapi-hoy', nombre: 'DolarApi · dólar oficial de hoy', url: 'https://dolarapi.com/v1/dolares/oficial',
    leer: (d) => `venta ${d.venta} · actualizado ${String(d.fechaActualizacion).slice(0, 10)}` },
  { id: 'dolarapi-casas', nombre: 'DolarApi · todas las cotizaciones de hoy', url: 'https://dolarapi.com/v1/dolares',
    leer: (d) => `${d.length} cotizaciones (${d.map((x) => x.casa).join(', ')})` },
  { id: 'ad-oficial', nombre: 'ArgentinaDatos · historia del dólar oficial', url: 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial',
    leer: historia },
  { id: 'ad-blue', nombre: 'ArgentinaDatos · historia del dólar blue', url: 'https://api.argentinadatos.com/v1/cotizaciones/dolares/blue',
    leer: historia },
  { id: 'ad-inflacion', nombre: 'ArgentinaDatos · inflación mensual', url: 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion',
    leer: (d) => { const u = d[d.length - 1]; return `${d.length} meses · último ${u.fecha.slice(0, 7)}: ${u.valor} %`; } },
  { id: 'datosgob-ipc', nombre: 'datos.gob.ar · IPC nacional (se usa desde la v1.3.0)', url: 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=3&sort=desc&format=json',
    leer: (d) => `último dato ${d.data[0][0]}` },
];

function historia(d) {
  const fechas = d.map((x) => x.fecha).sort();
  const desde2025 = fechas.filter((f) => f >= '2025-01-01').length;
  const cubre = fechas[0] <= '2025-01-02' ? 'cubre desde el 01/01/2025' : 'NO cubre desde el 01/01/2025';
  return `${d.length} días, del ${fechas[0]} al ${fechas[fechas.length - 1]} · ${desde2025} desde 2025 · ${cubre}`;
}

const $ = (id) => document.getElementById(id);
const resultados = { entorno: [], fuentes: [], datos: [] };

function fila(lista, clave, estado, titulo, detalle) {
  const simbolos = { ok: '✓', mal: '✗', info: 'i', espera: '…' };
  const li = document.createElement('li');
  const s = document.createElement('span');
  s.className = 'estado ' + estado;
  s.textContent = simbolos[estado];
  s.setAttribute('aria-label', { ok: 'Funciona', mal: 'No funciona', info: 'Dato', espera: 'Probando' }[estado]);
  const t = document.createElement('span');
  t.textContent = titulo;
  if (detalle) {
    const d = document.createElement('span');
    d.className = 'detalle';
    d.textContent = detalle;
    t.append(d);
  }
  li.append(s, t);
  lista.append(li);
  resultados[clave].push(`${simbolos[estado]} ${titulo}${detalle ? ' — ' + detalle : ''}`);
  return li;
}

function actualizarTexto() {
  const ahora = new Date();
  $('resultados').value = [
    `AFP · Pruebas de factibilidad · ${ahora.toLocaleString('es-AR')}`,
    '', '[Dispositivo]', ...resultados.entorno,
    '', '[Cotizaciones e índices]', ...resultados.fuentes,
    '', '[Datos y sin conexión]', ...resultados.datos,
  ].join('\n');
}

// ---------- Dispositivo ----------
async function entorno() {
  const lista = $('lista-entorno');
  lista.textContent = '';
  resultados.entorno = [];
  let navegador = 'No es Brave';
  try { if (navigator.brave && await navigator.brave.isBrave()) navegador = 'Brave'; } catch { /* sin dato */ }
  let sistema = navigator.platform || 'desconocido';
  try {
    if (navigator.userAgentData) {
      const v = await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion']);
      sistema = `${v.platform} ${v.platformVersion}`;
      const marca = navigator.userAgentData.brands.find((b) => /Chromium/.test(b.brand));
      if (marca) navegador += ` (motor Chromium ${marca.version})`;
    }
  } catch { /* sin dato */ }
  fila(lista, 'entorno', 'info', 'Navegador', navegador);
  fila(lista, 'entorno', 'info', 'Sistema', sistema);
  const app = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches;
  fila(lista, 'entorno', app ? 'ok' : 'info', 'Cómo está abierta', app ? 'App instalada (sin la barra del navegador)' : 'En el navegador (pestaña)');
  fila(lista, 'entorno', 'info', 'Conexión', navigator.onLine ? 'Con conexión' : 'Sin conexión');
}

// ---------- Cotizaciones ----------
async function probarFuente(f) {
  const inicio = performance.now();
  try {
    const r = await fetch(f.url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`respuesta ${r.status}`);
    const d = await r.json();
    return { estado: 'ok', detalle: `${f.leer(d)} · ${Math.round(performance.now() - inicio)} ms` };
  } catch (e) {
    const motivo = e instanceof TypeError ? 'el navegador no pudo leerla (bloqueo CORS, escudos o sin conexión)' : e.message;
    return { estado: 'mal', detalle: motivo };
  }
}

async function fuentes() {
  const lista = $('lista-fuentes');
  lista.textContent = '';
  resultados.fuentes = [];
  for (const f of FUENTES) {
    const r = await probarFuente(f);
    fila(lista, 'fuentes', r.estado, f.nombre, r.detalle);
  }
}

// ---------- Datos guardados ----------
function abrirBase() {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open('afp-factibilidad', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('visitas', { autoIncrement: true });
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

async function visitas(agregar) {
  const base = await abrirBase();
  if (agregar) await new Promise((ok, mal) => {
    const tx = base.transaction('visitas', 'readwrite');
    tx.objectStore('visitas').add({ fecha: new Date().toISOString() });
    tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
  });
  const todas = await new Promise((ok, mal) => {
    const p = base.transaction('visitas').objectStore('visitas').getAll();
    p.onsuccess = () => ok(p.result); p.onerror = () => mal(p.error);
  });
  base.close();
  return todas;
}

async function datos(agregar = false) {
  const lista = $('lista-datos');
  lista.textContent = '';
  resultados.datos = [];
  try {
    const v = await visitas(agregar);
    const primera = new Date(v[0].fecha).toLocaleString('es-AR');
    fila(lista, 'datos', 'ok', 'Base local (IndexedDB)', `abriste esta página ${v.length} veces en este dispositivo · primera vez: ${primera}`);
  } catch (e) {
    fila(lista, 'datos', 'mal', 'Base local (IndexedDB)', e.message || String(e));
  }
  if (navigator.storage && navigator.storage.persisted) {
    const ya = await navigator.storage.persisted();
    let pedido = ya;
    if (!ya && navigator.storage.persist) pedido = await navigator.storage.persist();
    fila(lista, 'datos', pedido ? 'ok' : 'info', 'Almacenamiento persistente',
      pedido ? 'Concedido: el navegador no borra estos datos por falta de espacio' : 'No concedido todavía (suele concederse al instalar la app)');
    const est = await navigator.storage.estimate();
    fila(lista, 'datos', 'info', 'Espacio disponible', `${Math.round(est.quota / 1048576)} MB`);
  } else {
    fila(lista, 'datos', 'mal', 'Almacenamiento persistente', 'El navegador no lo permite');
  }
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  fila(lista, 'datos', sw ? 'ok' : 'info', 'Funciona sin conexión',
    sw ? 'Sí: la página quedó guardada para abrir sin internet' : 'Todavía no: volvé a cargar la página una vez');
}

// ---------- Instalación ----------
let pedidoInstalar = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoInstalar = e;
  $('instalar').hidden = false;
});
$('instalar').addEventListener('click', async () => {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice;
  pedidoInstalar = null;
  $('instalar').hidden = true;
});

// ---------- Inicio ----------
$('probar').addEventListener('click', async () => {
  $('probar').disabled = true;
  $('probar').textContent = 'Probando…';
  await entorno();
  await datos();
  await fuentes();
  actualizarTexto();
  $('probar').disabled = false;
  $('probar').textContent = 'Probar de nuevo';
});

$('copiar').addEventListener('click', async () => {
  actualizarTexto();
  try {
    await navigator.clipboard.writeText($('resultados').value);
    $('copiar').textContent = 'Copiado';
  } catch {
    $('resultados').select();
    $('copiar').textContent = 'Seleccioné el texto: copialo a mano';
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' });
entorno().then(() => datos(true)).then(actualizarTexto);
