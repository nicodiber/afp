// Lint de AFP (control «Lint», D-86). Reglas de harness/docs/implementacion-tecnica/03-convenciones.md.
import js from '@eslint/js';
import globals from 'globals';

const SIN_HTML = [
  { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
    message: 'El texto entra al DOM con textContent, nunca como HTML (RNF-SEG-06).' },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'El texto entra al DOM con textContent, nunca como HTML (RNF-SEG-06).' },
];

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-restricted-syntax': ['error', ...SIN_HTML],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // tema-temprano.js es un script clásico (no módulo), cargado antes de dibujar.
    files: ['src/adaptadores/tema-temprano.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['factibilidad/sw.js', 'sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ['pruebas/**', '.github/scripts/**', 'eslint.config.js', '.claude/hooks/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Recorridos en navegador: el código dentro de page.evaluate corre en el navegador.
    files: ['pruebas/navegador/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
