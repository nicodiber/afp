// Lector de archivos .xlsx sin bibliotecas (F-04, D-70).
// Lee el archivo en el dispositivo: no hace ningún pedido de red.
// Funciona en el navegador y en Node.js 18+ (usa DecompressionStream, sin DOM).

/** Lee un .xlsx y devuelve { hojas: [{ nombre, filas }] }. Cada fila es un arreglo de valores:
 *  texto, número, booleano, fecha ({ fecha: 'AAAA-MM-DD', hora: 'HH:MM:SS' }) o null. */
export async function leerXlsx(contenido, { soloHojas } = {}) {
  const zip = leerZip(new Uint8Array(contenido));
  const texto = async (ruta) => (zip.has(ruta) ? new TextDecoder().decode(await extraer(zip, ruta)) : null);

  const libro = await texto('xl/workbook.xml');
  if (!libro) throw new Error('El archivo no es un .xlsx válido: falta xl/workbook.xml');
  const relaciones = new Map();
  for (const r of etiquetas(await texto('xl/_rels/workbook.xml.rels') || '', 'Relationship')) {
    relaciones.set(atributo(r, 'Id'), atributo(r, 'Target'));
  }
  const compartidos = leerCompartidos(await texto('xl/sharedStrings.xml'));
  const estilosFecha = leerEstilosFecha(await texto('xl/styles.xml'));
  const fecha1904 = /date1904="(1|true)"/.test(libro);

  const hojas = [];
  for (const h of etiquetas(libro, 'sheet')) {
    const nombre = desescapar(atributo(h, 'name'));
    if (soloHojas && !soloHojas.includes(nombre)) continue;
    let destino = relaciones.get(atributo(h, 'r:id')) || '';
    destino = destino.startsWith('/') ? destino.slice(1) : 'xl/' + destino.replace(/^\.\//, '');
    const xml = await texto(destino);
    hojas.push({ nombre, filas: xml ? leerHoja(xml, compartidos, estilosFecha, fecha1904) : [] });
  }
  return { hojas };
}

// ---------- ZIP ----------
function leerZip(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido: no es un ZIP');
  const cantidad = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const entradas = new Map();
  for (let i = 0; i < cantidad; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP dañado');
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + largoNombre));
    entradas.set(nombre, { metodo, comprimido, local });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  entradas.datos = b;
  entradas.vista = v;
  return entradas;
}

async function extraer(zip, ruta) {
  const e = zip.get(ruta);
  const v = zip.vista;
  const inicio = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
  const datos = zip.datos.subarray(inicio, inicio + e.comprimido);
  if (e.metodo === 0) return datos;
  if (e.metodo !== 8) throw new Error(`Compresión no soportada (${e.metodo}) en ${ruta}`);
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

// ---------- XML mínimo ----------
function* etiquetas(xml, nombre) {
  const re = new RegExp(`<(?:\\w+:)?${nombre}\\b[^>]*?(?:/>|>)`, 'g');
  let m;
  while ((m = re.exec(xml))) yield m[0];
}
function atributo(etiqueta, nombre) {
  const m = etiqueta.match(new RegExp(`\\s${nombre.replace(':', '\\:')}="([^"]*)"`));
  return m ? m[1] : null;
}
function desescapar(t) {
  return t == null ? t : t.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, x) => (
    { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[x]
      ?? String.fromCodePoint(x[1] === 'x' ? parseInt(x.slice(2), 16) : parseInt(x.slice(1), 10))));
}
function textoDe(xml) {
  // Junta los <t> de un texto con formato (<r><t>…</t></r>) y descarta la fonética (<rPh>).
  const sinFonetica = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
  let salida = '';
  for (const m of sinFonetica.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)) salida += m[1];
  return desescapar(salida);
}

function leerCompartidos(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textoDe(m[1]));
}

const FORMATOS_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function leerEstilosFecha(xml) {
  if (!xml) return [];
  const propios = new Map();
  for (const f of etiquetas(xml, 'numFmt')) {
    const codigo = desescapar(atributo(f, 'formatCode')).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    propios.set(Number(atributo(f, 'numFmtId')), /[dmyhs]/i.test(codigo));
  }
  const bloque = (xml.match(/<(?:\w+:)?cellXfs\b[\s\S]*?<\/(?:\w+:)?cellXfs>/) || [''])[0];
  return [...etiquetas(bloque, 'xf')].map((x) => {
    const id = Number(atributo(x, 'numFmtId') || 0);
    return FORMATOS_FECHA.has(id) || propios.get(id) === true;
  });
}

// ---------- Hoja ----------
function columnaDe(ref) {
  let n = 0;
  for (const c of ref) {
    const k = c.charCodeAt(0);
    if (k < 65 || k > 90) break;
    n = n * 26 + (k - 64);
  }
  return n - 1;
}

function leerHoja(xml, compartidos, estilosFecha, fecha1904) {
  const filas = [];
  const reFila = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
  const reCelda = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
  let m;
  let siguiente = 0;
  while ((m = reFila.exec(xml))) {
    const numero = Number(atributo(m[1], 'r')) || siguiente + 1;
    siguiente = numero;
    const fila = [];
    let col = -1;
    for (const c of (m[2] || '').matchAll(reCelda)) {
      const ref = atributo(c[1], 'r');
      col = ref ? columnaDe(ref) : col + 1;
      const tipo = atributo(c[1], 't');
      const estilo = Number(atributo(c[1], 's') || 0);
      const cuerpo = c[2] || '';
      const v = (cuerpo.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1];
      let valor = null;
      if (tipo === 's') valor = v == null ? null : compartidos[Number(v)] ?? null;
      else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
      else if (tipo === 'str' || tipo === 'e') valor = v == null ? null : desescapar(v);
      else if (tipo === 'b') valor = v === '1';
      else if (v != null && v !== '') {
        const n = Number(v);
        valor = estilosFecha[estilo] ? serialAFecha(n, fecha1904) : n;
      }
      if (valor !== null && valor !== '') fila[col] = valor;
    }
    for (let i = 0; i < fila.length; i++) if (fila[i] === undefined) fila[i] = null;
    filas[numero - 1] = fila;
  }
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
  return filas;
}

// Número de serie de Excel → fecha y hora, con aritmética de calendario (sin usar el reloj).
function serialAFecha(serial, fecha1904) {
  let dias = Math.floor(serial);
  // Los segundos se truncan (como openpyxl): las marcas temporales de Google Forms traen milisegundos.
  let segundos = Math.floor((serial - dias) * 86400 + 1e-6);
  if (segundos >= 86400) { dias += 1; segundos = 0; }
  // Días desde 1970-01-01. Excel cuenta el 29/02/1900 inexistente, por eso se resta 25569 (desde 1900).
  const desde1970 = fecha1904 ? dias + 24107 : dias - 25569;
  const z = desde1970 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp < 10 ? mp + 3 : mp - 9;
  const anio = yoe + era * 400 + (mes <= 2 ? 1 : 0);
  const dos = (x) => String(x).padStart(2, '0');
  const hora = `${dos(Math.floor(segundos / 3600))}:${dos(Math.floor(segundos / 60) % 60)}:${dos(segundos % 60)}`;
  return { fecha: `${anio}-${dos(mes)}-${dos(d)}`, hora };
}
