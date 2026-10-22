// Control «Privacidad» (aep#1 CA-5, RNF-SEG-07): nada personal en el repo público.
// Los términos prohibidos llegan por el secreto NOMBRES_PROHIBIDOS (uno por línea) y nunca se muestran.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EMAILS_PERMITIDOS = /(noreply@anthropic\.com|@users\.noreply\.github\.com|@example\.(com|org)|@ejemplo\.com)$/i;
const EXTENSIONES_DE_DATOS = /\.(xlsx|xls|csv|ods)$/i;

export function revisar(archivos, terminos = []) {
  const errores = [];
  const lista = terminos.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 3);
  for (const { ruta, contenido } of archivos) {
    const enDemo = ruta.startsWith('datos-demo/');
    if (!enDemo && (EXTENSIONES_DE_DATOS.test(ruta) || /respaldo.*\.json$/i.test(ruta))) {
      errores.push(`${ruta}: archivo de datos fuera de datos-demo/.`);
    }
    if (contenido == null) continue;
    contenido.split('\n').forEach((linea, i) => {
      for (const email of linea.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []) {
        if (!EMAILS_PERMITIDOS.test(email)) errores.push(`${ruta}:${i + 1}: email personal.`);
      }
      const baja = linea.toLowerCase();
      if (lista.some((t) => baja.includes(t))) errores.push(`${ruta}:${i + 1}: aparece un término de la lista de nombres prohibidos.`);
    });
  }
  return errores;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rutas = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((r) => !r.startsWith('node_modules/') && r !== 'package-lock.json');
  const archivos = rutas.map((ruta) => {
    const binario = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|xlsx)$/i.test(ruta);
    return { ruta, contenido: binario ? null : readFileSync(ruta, 'utf8') };
  });
  const terminos = (process.env.NOMBRES_PROHIBIDOS || '').split(/\r?\n/);
  if (!process.env.NOMBRES_PROHIBIDOS) console.log('::warning title=Control Privacidad::Falta el secreto NOMBRES_PROHIBIDOS: solo se revisan emails y archivos de datos.');
  const errores = revisar(archivos, terminos);
  for (const e of errores) console.log(`::error title=Control Privacidad::${e}`);
  console.log(errores.length ? `Control Privacidad: ${errores.length} problema(s).` : `Control Privacidad: ${archivos.length} archivos sin datos personales.`);
  process.exit(errores.length ? 1 : 0);
}
