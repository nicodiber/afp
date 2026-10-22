// aep#2 CA-8: Lighthouse con perfil móvil sobre la pantalla inicial (LCP ≤ 2,5 s y CLS ≤ 0,1).
// No corre con «npm test» (tarda y baja Lighthouse la primera vez): «npm run medir». El resultado va al PR.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { iniciarServidor } from './servidor.mjs';

const LIGHTHOUSE = 'lighthouse@13.5.0';
const servidor = await iniciarServidor();
let salida = 0;
try {
  const { stdout } = await promisify(execFile)('npx', ['--yes', LIGHTHOUSE, servidor.url,
    '--only-categories=performance,accessibility,best-practices', '--form-factor=mobile',
    '--output=json', '--output-path=stdout', '--quiet', '--chrome-flags=--headless=new --no-sandbox'],
  { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, maxBuffer: 64 * 1024 * 1024 });
  const informe = JSON.parse(stdout);
  const lcp = informe.audits['largest-contentful-paint'].numericValue;
  const cls = informe.audits['cumulative-layout-shift'].numericValue;
  const puntaje = (c) => Math.round(informe.categories[c].score * 100);
  console.log(`Lighthouse ${informe.lighthouseVersion} · móvil · ${servidor.url}`);
  console.log(`LCP ${(lcp / 1000).toFixed(2)} s (≤ 2,5) · CLS ${cls.toFixed(3)} (≤ 0,1)`);
  console.log(`Rendimiento ${puntaje('performance')} · Accesibilidad ${puntaje('accessibility')} · Buenas prácticas ${puntaje('best-practices')}`);
  if (lcp > 2500 || cls > 0.1) { console.log('✗ No cumple CA-8'); salida = 1; } else console.log('✓ Cumple CA-8 (parte de Lighthouse)');
} finally {
  await servidor.cerrar();
}
process.exit(salida);
