// Hook de Claude (PostToolUse en Edit/Write): corre ESLint sobre el archivo .js que se acaba de editar
// y le devuelve los errores al agente para que los corrija en el momento.
import { execFileSync } from 'node:child_process';

let entrada = '';
for await (const trozo of process.stdin) entrada += trozo;
const ruta = JSON.parse(entrada || '{}').tool_input?.file_path || '';
if (!/\.(m?js)$/.test(ruta) || ruta.includes('node_modules')) process.exit(0);
try {
  execFileSync('npx', ['eslint', '--no-warn-ignored', ruta], { stdio: 'pipe' });
} catch (e) {
  process.stderr.write(`ESLint encontró problemas en ${ruta}:\n${e.stdout || e.message}`);
  process.exit(2);
}
