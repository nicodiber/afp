// Servidor estático para las pruebas en navegador. Sirve el repo bajo /prueba/ y bajo /app/, como GitHub
// Pages sirve develop y main (D-118), y en la raíz la página que lleva a app/ (aep#11). Usa un puerto libre distinto en cada corrida (así el navegador no
// reutiliza JavaScript guardado de una corrida anterior).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv',
};

export function iniciarServidor() {
  // Sustituciones de contenido por ruta (por ejemplo, para simular la versión anterior de un archivo).
  const sustituciones = new Map();
  const servidor = createServer(async (pedido, respuesta) => {
    const ruta = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    const carpeta = ['/prueba/', '/app/'].find((c) => ruta.startsWith(c));
    const deLaRaiz = { '/': 'publicacion/raiz.html', '/desregistrar.js': 'publicacion/desregistrar.js', '/sw.js': 'publicacion/sw.js' }[ruta];
    if (!carpeta && !deLaRaiz) { respuesta.writeHead(404).end(); return; }
    let archivo = normalize(join(RAIZ, deLaRaiz ?? ruta.slice(carpeta.length)));
    if (!archivo.startsWith(RAIZ)) { respuesta.writeHead(403).end(); return; }
    if (!deLaRaiz && ruta.endsWith('/')) archivo = join(archivo, 'index.html');
    try {
      let contenido = await readFile(archivo);
      const sustituir = sustituciones.get(ruta);
      if (sustituir) contenido = Buffer.from(sustituir(contenido.toString('utf8')));
      respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      respuesta.end(contenido);
    } catch {
      respuesta.writeHead(404).end();
    }
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${servidor.address().port}/prueba/`,
    urlReal: `http://127.0.0.1:${servidor.address().port}/app/`,
    urlRaiz: `http://127.0.0.1:${servidor.address().port}/`,
    cerrar: () => new Promise((fin) => servidor.close(fin)),
    sustituir: (ruta, funcion) => sustituciones.set(ruta, funcion),
    restaurar: () => sustituciones.clear(),
  })));
}
