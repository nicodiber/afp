// Servidor estático para las pruebas en navegador. Sirve el repo bajo /prueba/, como GitHub Pages
// sirve la rama develop, y usa un puerto libre distinto en cada corrida (así el navegador no
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
  const servidor = createServer(async (pedido, respuesta) => {
    const ruta = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    if (!ruta.startsWith('/prueba/')) { respuesta.writeHead(404).end(); return; }
    let archivo = normalize(join(RAIZ, ruta.slice('/prueba/'.length)));
    if (!archivo.startsWith(RAIZ)) { respuesta.writeHead(403).end(); return; }
    if (ruta.endsWith('/')) archivo = join(archivo, 'index.html');
    try {
      const contenido = await readFile(archivo);
      respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      respuesta.end(contenido);
    } catch {
      respuesta.writeHead(404).end();
    }
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${servidor.address().port}/prueba/`,
    cerrar: () => new Promise((fin) => servidor.close(fin)),
  })));
}
