# AFP — código de la app

Este repo (público) tiene el código de AFP, una app web instalable para administrar finanzas personales, sus pruebas y sus datos de ejemplo ficticios. **La verdad del proyecto no está acá**: está en el repo privado `nicodiber/aep`, en su [`AGENTS.md`](https://github.com/nicodiber/aep/blob/develop/AGENTS.md) y su carpeta `harness/` (qué hace AFP, cómo se construye, specs, decisiones). Leerla antes de tocar código.

**Este repo es público:** nada personal ni que permita deducir datos personales, patrones de uso o montos (RNF-SEG-07). Los datos reales nunca entran a un repo.

## Cómo entra un cambio

Todo cambio de comportamiento parte de una **spec aprobada**: una issue de `nicodiber/aep` con criterios `CA-n` y la etiqueta `spec:aprobada`, que solo pone el usuario. Se trabaja en la rama `spec/<N>-<nombre>` y entra a `develop` por PR, con la tabla de evidencia. Detalle en `aep/harness/docs/implementacion-tecnica/07-desarrollo-guiado-por-specs.md`.

```markdown
Resuelve nicodiber/aep#N

| CA | Evidencia |
|---|---|
| CA-1 | prueba `pruebas/…test.js` › «aep#N CA-1 …» |
```

## Definición de terminado

| Si el cambio toca… | Evidencia |
|---|---|
| Cualquier código | `npm run lint` y `npm test` en verde. |
| Lógica de dominio | Una prueba nueva que falla sin el cambio; valores esperados que no salen del código que se prueba. |
| Una pantalla | Recorrido en navegador en escritorio y 390 × 844, con y sin conexión; axe-core y Lighthouse si es nueva. |
| Una spec | Cada `CA-n` con evidencia en la tabla del PR. |

Controles en cada PR: **Pruebas**, **Lint**, **Spec** y **Privacidad**. Claude mezcla a `develop` solo con los cuatro en verde.

## Límites

- **Nunca a `main`** sin que el usuario confirme que probó: es la versión real (`nicodiber.github.io/afp/`). `develop` se publica en `/prueba/`.
- **Nunca `push --force`.**
- **No debilitar pruebas** para que pasen.
- **Credenciales:** el ID de cliente OAuth es público y puede ir en el código; nada más.

`.claude/settings.json` aplica parte de estos límites como permisos, y un hook corre ESLint sobre cada archivo `.js` que se edita.

## Reglas de código

- **Sin frameworks ni compilación:** módulos ES nativos. Una biblioteca nueva se justifica primero en `aep/harness/docs/implementacion-tecnica/09-dependencias.md` y se sirve desde el sitio (sin CDNs).
- **Arquitectura hexagonal:** `src/dominio/` no importa nada de fuera; solo `src/adaptadores/` usa `indexedDB`, `fetch`, `localStorage` o `google`. Lo comprueba `pruebas/reglas/arquitectura.test.js`.
- **Fecha:** «hoy» por el puerto `Reloj`; nunca `Date.now()` ni `new Date()` sueltos fuera del adaptador de reloj.
- **Texto del usuario:** siempre `textContent`; el lint rechaza `innerHTML`.
- **Dinero:** enteros en centavos; cotizaciones y tasas como `Decimal` en texto.
- **Navegador:** Brave, Chrome y Edge; bases y claves con prefijo `afp`.
- **Idioma:** español, con los términos del glosario de `aep`.

## Estructura

```
factibilidad/      página de pruebas de factibilidad (E3) y lector .xlsx propio
datos-demo/        datos de ejemplo y archivos ficticios de v3, con sus generadores
pruebas/           unitarias, recorridos en navegador, reglas de arquitectura y controles
css/tokens.css     tokens del manual de marca
.github/           acciones (Publicar, Pruebas, Spec, Privacidad) y sus scripts
.claude/           permisos y hook de lint de Claude
```

## Cómo levantarlo

```
npm ci             dependencias de prueba (ESLint, Playwright)
npm run lint       lint
npm test           todas las pruebas (unitarias y en navegador)
```
