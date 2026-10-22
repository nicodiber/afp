/* global google */
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

// ID de cliente OAuth de Google (público, D-69). Vacío hasta que el usuario lo cree.
const ID_CLIENTE = '495538558633-svrbv6gqjo79t8ke1gvs1m9l9sa2cb40.apps.googleusercontent.com';
const PERMISO_DRIVE = 'https://www.googleapis.com/auth/drive.file';
const ARCHIVO_PRUEBA = 'afp-factibilidad.json';
const CARPETA = 'AFP';

const VERSION_PAGINA = 5;
const $ = (id) => document.getElementById(id);
const resultados = { entorno: [], fuentes: [], datos: [], google: [] };

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
    `AFP · Pruebas de factibilidad · ${ahora.toLocaleString('es-AR', { hour12: false })}`,
    '', '[Dispositivo]', ...resultados.entorno,
    '', '[Cotizaciones e índices]', ...resultados.fuentes,
    '', '[Datos y sin conexión]', ...resultados.datos,
    '', '[Google y Drive]', ...(resultados.google.length ? resultados.google : ['(sin probar)']),
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
  fila(lista, 'entorno', 'info', 'Versión de esta página', String(VERSION_PAGINA));
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
    const primera = new Date(v[0].fecha).toLocaleString('es-AR', { hour12: false });
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

// ---------- Google y Drive ----------
function cargarGoogle() {
  return new Promise((ok, mal) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = ok;
    s.onerror = () => mal(new Error('no se pudo cargar el inicio de sesión de Google (¿escudos de Brave?)'));
    document.head.append(s);
  });
}

// La cuenta usada la última vez se guarda solo en este dispositivo, para que Google la elija sola.
const CLAVE_CUENTA = 'afp-factibilidad-cuenta';
function cuentaGuardada() { try { return localStorage.getItem(CLAVE_CUENTA) || ''; } catch { return ''; } }

function pedirPermiso() {
  return new Promise((ok, mal) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: ID_CLIENTE,
      scope: PERMISO_DRIVE,
      hint: cuentaGuardada() || undefined,
      callback: (r) => (r.error ? mal(new Error(`Google respondió: ${r.error}`)) : ok(r.access_token)),
      error_callback: (e) => mal(new Error(`la ventana de Google se cerró o se bloqueó (${e.type})`)),
    });
    // prompt vacío: si ya diste permiso antes, Google no vuelve a preguntar.
    cliente.requestAccessToken({ prompt: '' });
  });
}

async function drive(permiso, url, opciones = {}) {
  let r;
  try {
    r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${permiso}`, ...(opciones.headers || {}) } });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'Drive no respondió en 20 segundos' : `no se pudo llegar a Drive (${e.message})`);
  }
  if (!r.ok) throw new Error(`Drive respondió ${r.status}`);
  return r.status === 204 ? null : r.json();
}

async function probarGoogle() {
  const lista = $('lista-google');
  lista.textContent = '';
  resultados.google = [];
  if (!ID_CLIENTE) {
    fila(lista, 'google', 'info', 'Falta el ID de cliente', 'Se completa cuando crees el proyecto de Google Cloud');
    return;
  }
  let permiso;
  try {
    await cargarGoogle();
    fila(lista, 'google', 'ok', 'Inicio de sesión de Google cargado');
    permiso = await pedirPermiso();
    const conPista = Boolean(cuentaGuardada());
    fila(lista, 'google', 'ok', 'Iniciaste sesión y diste permiso para los archivos de AFP',
      conPista ? 'Google ya sabía qué cuenta usar' : 'primera vez: Google te pidió la cuenta');
    try {
      const yo = await drive(permiso, 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
      localStorage.setItem(CLAVE_CUENTA, yo.user.emailAddress);
    } catch { /* si no se puede guardar, la próxima vez Google vuelve a preguntar */ }
  } catch (e) {
    fila(lista, 'google', 'mal', 'Inicio de sesión', e.message);
    return;
  }
  try {
    const qc = encodeURIComponent(`name='${CARPETA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const carpetas = await drive(permiso, `https://www.googleapis.com/drive/v3/files?q=${qc}&fields=files(id)`);
    let carpeta = carpetas.files.length ? carpetas.files[0].id : null;
    if (carpeta) {
      fila(lista, 'google', 'ok', 'Encontré la carpeta AFP en tu Drive');
    } else {
      const nueva = await drive(permiso, 'https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' }) });
      carpeta = nueva.id;
      fila(lista, 'google', 'ok', 'Creé la carpeta AFP en tu Drive');
    }
    const q = encodeURIComponent(`name='${ARCHIVO_PRUEBA}' and '${carpeta}' in parents and trashed=false`);
    const lista1 = await drive(permiso, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    let id = lista1.files.length ? lista1.files[0].id : null;
    let veces = 1;
    if (id) {
      const anterior = await drive(permiso, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
      veces = (Number(anterior.veces) || 0) + 1;
      fila(lista, 'google', 'ok', 'Leí el archivo de prueba de Drive', `lo probaste ${veces - 1} veces antes`);
    }
    const contenido = JSON.stringify({ prueba: 'AFP factibilidad', veces });
    if (id) {
      await drive(permiso, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: contenido });
      fila(lista, 'google', 'ok', 'Actualicé el archivo de prueba en Drive', `ahora dice ${veces} veces`);
    } else {
      const limite = 'afp' + Math.random().toString(36).slice(2);
      const cuerpo = `--${limite}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: ARCHIVO_PRUEBA, mimeType: 'application/json', parents: [carpeta] })}\r\n` +
        `--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`;
      const nuevo = await drive(permiso, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo });
      id = nuevo.id;
      fila(lista, 'google', 'ok', 'Creé el archivo de prueba en la carpeta AFP', ARCHIVO_PRUEBA);
    }
    const leido = await drive(permiso, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    fila(lista, 'google', leido.veces === veces ? 'ok' : 'mal', 'Volví a leerlo', `dice ${leido.veces} veces`);
  } catch (e) {
    fila(lista, 'google', 'mal', 'Drive', e.message);
  }
  // El permiso de acceso vence solo en una hora y no se guarda en ningún lado.
}

$('google').addEventListener('click', async () => {
  $('google').disabled = true;
  $('google').textContent = 'Probando… esperá a que termine';
  const inicio = performance.now();
  await probarGoogle();
  fila($('lista-google'), 'google', 'info', 'Prueba terminada', `${Math.round((performance.now() - inicio) / 1000)} segundos`);
  $('google').textContent = 'Probar Google y Drive otra vez';
  actualizarTexto();
  $('google').disabled = false;
});

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).then((r) => r.update()).catch(() => {});
}
entorno().then(() => datos(true)).then(actualizarTexto);
