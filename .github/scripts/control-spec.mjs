// Control «Spec» (aep#1 CA-4): el PR cita una spec o una historia de usuario (D-141) y cada CA de su tabla tiene evidencia.
import { readFile } from 'node:fs/promises';

const VACIO = /^(|-|—|…|\.\.\.|pendiente|tbd)$/i;

export function revisarCuerpo(cuerpo = '') {
  const errores = [];
  if (!/(Resuelve|Parte de)\s+(nicodiber\/aep#\d+|HU-\d+)\b/i.test(cuerpo)) {
    errores.push('El PR no cita su spec ni su historia: falta «Resuelve HU-NN», «Parte de HU-NN», «Resuelve nicodiber/aep#N» o «Parte de nicodiber/aep#N».');
  }
  const filas = [...cuerpo.matchAll(/^\|\s*(CA-\d+)\s*\|\s*(.*?)\s*\|\s*$/gm)];
  if (!/^\|\s*CA\s*\|\s*Evidencia\s*\|/im.test(cuerpo) || filas.length === 0) {
    errores.push('Falta la tabla de evidencia («| CA | Evidencia |») con al menos una fila CA-n.');
  }
  for (const [, ca, evidencia] of filas) {
    if (VACIO.test(evidencia.trim())) errores.push(`${ca} no tiene evidencia.`);
  }
  return errores;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const evento = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const errores = revisarCuerpo(evento.pull_request?.body || '');
  for (const e of errores) console.log(`::error title=Control Spec::${e}`);
  console.log(errores.length ? `Control Spec: ${errores.length} problema(s).` : 'Control Spec: la spec y la evidencia están completas.');
  process.exit(errores.length ? 1 : 0);
}
