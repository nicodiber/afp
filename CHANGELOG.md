# Cambios de AFP

Cada entrega a la versión a probar (`/prueba/`) sube el número dentro del hito (v0.1.0-1, v0.1.0-2…). Al completar un hito, la versión real (`main`) pasa a vX.Y.Z. Las specs se citan `aep#N` y las historias de usuario `HU-NN` (repo privado de documentación).

## v0.3.0 · Movimientos (en curso)

### v0.3.0-4 · HU-02 (segunda vuelta)

- Monto: mientras escribís, AFP pone los puntos de miles (1250 → 1.250) y la coma separa hasta 2 decimales; la tecla punto (también la del teclado numérico) escribe una coma, el cursor no se mueve de lugar y al pegar se entiende «12.500,50» o «12500.50».
- Ventana de categoría: muestra primero el primer nivel en el orden del árbol (familias y categorías sin familia, con su ícono); al tocar una familia aparecen sus subcategorías con «‹ Atrás». El buscador sigue buscando entre todas. La ventana de cuentas y el campo elegido muestran el ícono de la cuenta; si no tiene, uno según su tipo (efectivo 💵, banco 🏦, billetera virtual 📱, broker 📈, transporte 🚌, 🪙 para el resto).
- Flechas en la PC: ↓ y ↑ pasan por fecha, hora, monto, descripción, categoría, cuenta y los botones; entre los tres botones, ← y →. Tab y las flechas de las ventanas de selección siguen igual.
- Un egreso con fecha anterior al saldo inicial de la cuenta ya no da error: se guarda y la cuenta pasa a empezar en esa fecha, con el mismo monto («La cuenta X ahora empieza el DD/MM/AAAA.»). Reemplaza el error de INV-16 de la primera vuelta.
- Nuevo campo «Hora» entre fecha y monto: se completa con la hora actual (puerto Reloj; en modo prueba, la hora real), es editable y opcional. Se guarda con el egreso (`hora`, «HH:MM» o vacío); la lista de movimientos que viene después ordenará por fecha y hora.

### v0.3.0-3 · HU-31

- Árbol de categorías más claro: cada familia tiene a la izquierda una flecha circular (›) que gira al desplegar; cada categoría muestra su ícono en una pastilla de color, su nombre y la clasificación como etiquetas (Fijo/Variable, Necesidad/Deseo, Hormiga).
- Junto al nombre hay un ⓘ con la explicación de esas etiquetas: en la PC aparece al pasar el mouse o con el foco del teclado; en el celular, al tocarlo (se cierra al tocar afuera o con Esc). El formulario tiene el botón «ⓘ Qué significa» con las mismas explicaciones. «Agregar dentro» pasa a llamarse «Agregar subcategoría».
- El ícono (emoji) de una categoría es obligatorio y único entre todas (de ingresos y de egresos, activas y archivadas). Al crear una, AFP propone uno libre según el nombre (palabras clave genéricas, con respaldo en una lista de emojis) y se cambia desde una grilla donde los ya usados aparecen deshabilitados. Sin ícono o con uno repetido: «Elegí un ícono que no use otra categoría.».
- Datos existentes: al abrir la base, las categorías sin ícono o con íconos repetidos reciben uno libre (la primera de cada ícono, por orden, lo conserva). No hay migración de esquema. Los datos de ejemplo traen un ícono distinto por categoría.

### v0.3.0-2 · HU-23

- Barra lateral en la PC: Cuentas, Categorías y Monedas pasan a ser ítems propios (Inicio, Movimientos, Análisis, Cuentas, Categorías, Monedas; abajo Ajustes y «Cargar»), con un clic y marcados mientras estás en su pantalla o en una subpantalla. Sigue siendo la barra angosta que se abre con el mouse o el foco.
- En la PC, Ajustes ya no muestra las filas Cuentas, Categorías y Monedas. En el celular nada cambia: la barra de abajo es la misma y esas filas siguen en Ajustes. Al cambiar el ancho de la ventana la vista se adapta sin recargar.

### v0.3.0-1 · HU-02

- Registrar un egreso: «Cargar» (el + de la barra inferior en el celular, el botón de la barra lateral en la PC) abre la pantalla «Nuevo egreso» (`#cargar`) con fecha (hoy por defecto, nunca posterior), monto en formato argentino (12.500,50), descripción opcional, categoría y cuenta.
- Categoría y cuenta se eligen en una ventana con buscador que filtra mientras escribís: las categorías son las hojas activas de egresos agrupadas por familia; las cuentas, las activas con su saldo. Si no hay ninguna, la ventana lo dice y lleva a crearlas.
- «Guardar» vuelve a la pantalla anterior y «Guardar y cargar otro» deja la pantalla vacía; los dos avisan el saldo nuevo de la cuenta. Sin monto, categoría o cuenta no guarda y marca cada campo con su mensaje. Un doble toque no guarda dos veces.
- Todo se puede hacer con el teclado: Tab, Enter o Espacio para abrir las ventanas, ↑/↓ y Enter para elegir, Esc para cerrar, y en la PC Ctrl+Enter (guardar) y Ctrl+Mayús+Enter (guardar y cargar otro).
- El saldo de Inicio y de Cuentas pasa a ser el calculado: saldo inicial más y menos los movimientos.
- La base del dispositivo pasa al esquema 4 (almacén `movimientos`); una base del esquema 3 conserva sus datos. «Borrar datos de prueba» y «Restablecer datos de ejemplo» también vacían los movimientos del modo prueba.

## v0.2.0 · Cuentas y categorías (cerrado)

### v0.2.0-6 · HU-22

- Se quita la bienvenida con plantilla: AFP empieza vacía. Una base nueva (real o de prueba) abre directo en Inicio, con «Todavía no tenés cuentas.» y «Crear la primera». Las cuentas y categorías se cargan a mano; para probar, el modo prueba sigue con sus datos de ejemplo.
- Se conserva del cambio anterior la conexión compartida a la base y que el control «Spec» de los PR acepte «Resuelve HU-NN».

### v0.2.0-5 · HU-01

- Plantilla inicial: la primera vez que abrís AFP (con la base sin cuentas ni categorías) aparece una bienvenida con dos opciones: «Empezar con la plantilla» (4 cuentas y 37 categorías comunes, con saldo 0) o «Empezar vacío». Hay que elegir una; después no se vuelve a ofrecer.
- La plantilla se carga de una sola vez: si algo falla, no queda nada a medias. Son cuentas y categorías comunes: se editan, archivan o eliminan como cualquier otra.
- Modo prueba: la base de prueba vacía también ofrece la bienvenida; «Cargar» y «Restablecer datos de ejemplo» la dan por resuelta y «Borrar datos de prueba» la vuelve a ofrecer al reabrir.
- El control «Spec» de los PR acepta también una historia de usuario («Resuelve HU-01»).

### v0.2.0-4 · aep#15

- Categorías: Ajustes → «Categorías» muestra Ingresos y Egresos como un árbol con familias que se pliegan; crear, editar, mover (todo el historial o desde una fecha), ordenar, archivar, reactivar y eliminar.
- Clasificación de cada hoja (fijo o variable, necesidad o deseo, hormiga; o la naturaleza del ingreso), que una hoja nueva toma de su familia.
- Los datos de ejemplo suman las categorías.
- La base del dispositivo pasa al esquema 3.

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
