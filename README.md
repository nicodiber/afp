# AFP

Administración Financiera Personal: una app web instalable (PWA) para registrar, controlar, analizar y proyectar finanzas personales.

- `/prueba/`: versión a probar (rama `develop`).
- Raíz: versión real (rama `main`).

El sitio se publica con GitHub Pages mediante `.github/workflows/publicar.yml`.

Este repo no contiene datos personales. Todos los derechos reservados: el código se puede ver, pero no copiar ni reutilizar sin permiso.

## Pruebas

Un solo comando corre todas las pruebas (unitarias y en navegador): `npm test`. La acción «Pruebas» las corre en cada envío.

- `datos-demo/`: datos ficticios. `datos-ejemplo.json` son los datos de ejemplo del modo prueba; `v3-prueba.xlsx` y `v3-prueba-respuestas.csv` imitan la planilla de AEP v3. Se regeneran con los scripts `generar_*.py` (Python con openpyxl).
