# Cambios de AFP

Cada entrega a la versión a probar (`/prueba/`) sube el número dentro del hito (v0.1.0-1, v0.1.0-2…). Al completar un hito, la versión real (`main`) pasa a vX.Y.Z. Las specs se citan `aep#N` (repo privado de documentación).

## v0.2.0 · Cuentas y categorías (en curso)

### v0.2.0-3 · aep#14

- Al abrir una cuenta ya creada, el formulario no pone el cursor en el nombre: en el celular, el teclado no se abre hasta que tocás un campo.

### v0.2.0-2 · aep#13

- En la PC, editar una cuenta se abre en una ventana, como «Nueva cuenta».
- Detrás de una ventana, la pantalla se oscurece también en tema oscuro.
- Los nombres empiezan con mayúscula mientras los escribís.
- El saldo inicial de una cuenta nueva empieza vacío; vacío es 0.

### v0.2.0-1 · aep#12

- Cuentas: Inicio las muestra como tarjetas con su saldo; Ajustes → «Cuentas» permite crear, editar, ordenar (arrastrando o con ↑ y ↓), archivar, reactivar y eliminar.
- Formulario de cuenta con nombre, tipo, moneda, saldo inicial (también negativo) y su fecha, «tiene rendimiento», emoji, notas y propósito.
- Ajustes → «Monedas»: ARS y USD; USD no se desactiva mientras la use una cuenta.
- Modo prueba: «Cargar datos de ejemplo», «Restablecer» y «Borrar», con las 6 cuentas de ejemplo.
- La base del dispositivo pasa al esquema 2 sin perder la configuración.

## v0.1.1 · Dos apps separadas · 22/10/2026 · aep#11

- La versión real pasa a `nicodiber.github.io/afp/app/`. `nicodiber.github.io/afp/` lleva sola ahí y quita el service worker de la v0.1.0. Así la versión a probar ya no queda dentro de la real y Brave ofrece instalar las dos en la PC.
- La versión a probar se instala como «AFP prueba», con el ícono con una franja ámbar abajo (también en la pestaña).
- Los ajustes guardados (tema, modo prueba, configuración) se conservan.

## v0.1.0 · Base instalable · 22/10/2026

Primera versión real (`nicodiber.github.io/afp/`): AFP se instala en el celular y en la PC, abre sin conexión, tiene tema claro y oscuro, sugiere instalarse, tiene modo prueba con fecha simulada y guarda su configuración en el dispositivo. Por dentro: formatos y núcleo de partida doble listos para las próximas versiones. Specs aep#2 a aep#10.

### v0.1.0 · aep#10

- La versión real no publica archivos de prueba, y su service worker no toca la versión a probar.

### v0.1.0-5 · 22/10/2026 · aep#7, aep#8 y aep#9

- Formatos de montos, decimales (redondeo comercial), porcentajes, fechas y horas, listos para las pantallas.
- Núcleo de partida doble: asientos de los 11 tipos de movimiento, control de que cuadren y saldos; con los datos de ejemplo da los saldos esperados.
- Base de datos del dispositivo con la configuración, separada por canal y modo prueba; Ajustes → «Datos de este dispositivo».

### v0.1.0-4 · 22/10/2026 · aep#5 y aep#6

- Modo prueba en Ajustes: franja fija «MODO PRUEBA · fecha simulada DD/MM/AAAA», fecha simulada editable (31/10/2026 por defecto) y datos aparte de los reales.
- «Hoy» sale del puerto Reloj: la fecha simulada en modo prueba y la del dispositivo fuera de él.
- Tarjeta de instalación: «Ahora no» a la izquierda e «Instalar» a la derecha.

### v0.1.0-3 · 22/10/2026 · aep#4

- Al entrar desde el navegador, una tarjeta arriba en Inicio sugiere instalar AFP («Instalar» y «Ahora no»), hasta instalarla o descartarla.
- Ajustes → «Instalación»: instalar con un toque, los pasos a mano si el navegador no lo ofrece, o «AFP está instalada en este dispositivo».
- El aviso «Hay una versión nueva · Actualizar» va en una sola línea.

### v0.1.0-2 · 22/10/2026 · aep#3

- PC: la barra lateral, al abrirse, corre el contenido en vez de taparlo.
- PC: el contenido de cada pantalla va en una columna centrada.
- Android: la barra de gestos de la app instalada toma el color de la barra en oscuro.
- Quien tenga la v0.1.0-1 instalada ve «Hay una versión nueva · Actualizar».

### v0.1.0-1 · 22/10/2026 · aep#2

- Primera pantalla de AFP: logotipo, pantalla sin datos y navegación (barra inferior en el celular, lateral compacta en la PC).
- Movimientos, Cargar y Análisis muestran que llegan en una próxima entrega.
- Tema claro, oscuro o como el sistema, recordado en el dispositivo.
- Ajustes → «Acerca de» con el nombre completo y la versión.
- Se instala como app y abre sin conexión.
