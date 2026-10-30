// Íconos de las categorías (HU-31): cada categoría tiene un emoji obligatorio y único (activas y archivadas, de
// ingresos y de egresos). Acá están la lista de emojis, las palabras clave para proponer uno según el nombre y la
// asignación a categorías que no lo tienen. Funciones puras; las palabras son genéricas, no nombres personales.

const LISTA = `
🛒 🥦 🥩 🥖 🍎 🥛 🍕 🍔 🍝 🍣 🍽 🍳 🥗 🍰 🍦 🍫 🍬 🍿 ☕ 🍺 🍷 🥤 🧃 🍞 🧀 🍗 🥐 🌮
🏠 🏢 🏡 🔑 🛋 🛏 🚿 🧹 🧺 🧽 💡 🔌 🔥 🚰 🌐 📶 📱 ☎ 📺 🖥 🔧 🔨 🪴 🪑 🧯 📦 🗑 🚪
🚌 🚆 🚇 🚗 🚕 🚲 🛵 ⛽ 🛣 🅿 ✈ 🚢 🚚 🏍 🛴 🚦 🧭 🗺 🧳 ⛵ 🚁 🚖 🚜 🛞
🩺 💊 🦷 🧠 🏥 🩹 👓 🏋 ⚽ 🏀 🎾 🏊 🧘 🚴 🏃 🥾 🧴 🩻 💉 🌡 🩸 🧬
🎉 🎬 🎵 🎮 🏖 🎟 🎨 📚 🎸 🎤 🎲 🧩 🎳 🎯 🎭 🎪 🏕 ⛺ 🎡 🎢 🏔 🌴 🍹 🎻 🎹 📷
🎓 ✏ 🎒 🔬 🧪 🗣 📐 📝 🏫 📖 💻 ⌨ 🖨 🖊 📎 📊 📅 🧮 🔭
👕 👟 👖 👗 🧥 🧣 🧢 👜 💄 ✂ 💍 ⌚ 🕶 🧦 👔 🎩 👒 💅 🪮 🛍
🐶 🐱 🐾 🦴 🐟 🐦 🐴 🌱 🌳 🌻 🎁 🧸 🍼 👶 👪 🎀 🎈 🎂 💐 🕯
🧾 🏦 🛡 💳 🤝 🐷 📈 🎗 💼 🏷 💹 💰 💵 💶 🪙 💸 🧧 📉 ⚖ 🏛 🪪 📜 ✉ 📮
⚡ ☀ 🌧 ❄ 🌙 ⭐ 🌈 🔔 🔒 🔖 🚩 ❤ 🧡 💛 💚 💙 💜 🖤 🤍 ♻ 🏆 🥇 🎖 🎯
🔄 ↩ ➕ ➖ ✅ ❓ ❗ ✨ 🌟 🔮 🧲 🪄 🧱 🪜 🪣 🧰 🪛 🔩 ⚙ 🔋 💾 📡 🎧 📻 🕹
`;

/** Sin el selector de variación (U+FE0F): «🏠» y «🏠️» son el mismo ícono. */
export const claveIcono = (emoji) => String(emoji ?? '').replaceAll('️', '').trim();

/** El emoji tal como se guarda y se muestra: los que el navegador dibujaría como texto llevan el selector U+FE0F. */
export const iconoVisible = (emoji) => {
  const clave = claveIcono(emoji);
  return /^\p{Emoji}$/u.test(clave) && !/^\p{Emoji_Presentation}$/u.test(clave) ? `${clave}\uFE0F` : clave;
};

/** Todos los emojis que ofrece la grilla, sin repetir, en orden. */
export const EMOJIS_DE_CATEGORIA = Object.freeze([...new Set(LISTA.split(/\s+/).filter(Boolean).map(claveIcono))].map(iconoVisible));

// Palabras clave genéricas → emoji. Se busca cada palabra dentro del nombre (sin tildes ni mayúsculas); gana la
// primera de la tabla cuyo emoji esté libre.
const PALABRAS = [
  [['supermercado', 'super', 'almacen', 'mercado', 'compras'], '🛒'],
  [['verduleria', 'verdura', 'fruta', 'frutas'], '🥦'],
  [['carniceria', 'carne'], '🥩'],
  [['panaderia', 'pan'], '🥖'],
  [['restaurante', 'resto', 'comida', 'almuerzo', 'cena', 'salida a comer'], '🍽'],
  [['delivery', 'pedidos'], '🛵'],
  [['cafe', 'cafeteria'], '☕'],
  [['kiosco', 'golosina', 'golosinas'], '🍬'],
  [['bebida', 'bebidas', 'gaseosa'], '🥤'],
  [['alquiler', 'vivienda', 'hogar', 'casa'], '🏠'],
  [['expensas', 'consorcio'], '🏢'],
  [['electricidad', 'luz'], '💡'],
  [['gas'], '🔥'],
  [['agua'], '🚰'],
  [['internet', 'wifi', 'conexion'], '🌐'],
  [['celular', 'telefono', 'linea'], '📱'],
  [['limpieza'], '🧹'],
  [['muebles', 'mueble', 'decoracion'], '🛋'],
  [['reparacion', 'reparaciones', 'arreglos', 'mantenimiento'], '🔧'],
  [['transporte', 'colectivo', 'bondi', 'omnibus'], '🚌'],
  [['subte', 'metro'], '🚇'],
  [['tren'], '🚆'],
  [['combustible', 'nafta', 'gasoil'], '⛽'],
  [['auto', 'vehiculo', 'coche'], '🚗'],
  [['taxi', 'remis', 'uber'], '🚕'],
  [['bicicleta', 'bici'], '🚲'],
  [['moto'], '🏍'],
  [['peaje', 'patente'], '🛣'],
  [['estacionamiento', 'cochera'], '🅿'],
  [['pasaje', 'vuelo', 'avion'], '✈'],
  [['salud', 'medico', 'medica', 'consulta', 'doctor'], '🩺'],
  [['farmacia', 'remedio', 'remedios', 'medicamento', 'medicamentos'], '💊'],
  [['dentista', 'odontologia'], '🦷'],
  [['psicologo', 'psicologa', 'terapia'], '🧠'],
  [['obra social', 'prepaga', 'sanatorio'], '🏥'],
  [['optica', 'anteojos', 'lentes'], '👓'],
  [['gimnasio', 'gym', 'entrenamiento'], '🏋'],
  [['deporte', 'deportes', 'futbol'], '⚽'],
  [['ocio', 'entretenimiento', 'juntada', 'juntadas', 'fiesta', 'salidas'], '🎉'],
  [['cine'], '🎬'],
  [['musica', 'recital', 'recitales'], '🎵'],
  [['juego', 'juegos', 'videojuego', 'videojuegos'], '🎮'],
  [['vacaciones', 'viaje', 'viajes', 'turismo'], '🏖'],
  [['streaming', 'suscripcion', 'suscripciones'], '📺'],
  [['libro', 'libros', 'lectura'], '📚'],
  [['educacion', 'curso', 'cursos', 'facultad', 'universidad', 'estudio', 'estudios'], '🎓'],
  [['utiles', 'libreria'], '✏'],
  [['ropa', 'indumentaria', 'vestimenta'], '👕'],
  [['calzado', 'zapatillas', 'zapatos'], '👟'],
  [['peluqueria', 'barberia'], '✂'],
  [['belleza', 'cosmetica', 'maquillaje'], '💄'],
  [['mascota', 'mascotas', 'veterinaria', 'perro'], '🐶'],
  [['gato'], '🐱'],
  [['regalo', 'regalos'], '🎁'],
  [['hijo', 'hijos', 'nino', 'ninos', 'bebe', 'guarderia'], '🧸'],
  [['impuesto', 'impuestos', 'monotributo', 'tasas', 'abl'], '🧾'],
  [['banco', 'comision', 'comisiones', 'cuenta bancaria'], '🏦'],
  [['seguro', 'seguros'], '🛡'],
  [['tarjeta', 'credito'], '💳'],
  [['prestamo', 'prestamos', 'cuota', 'cuotas', 'deuda'], '🤝'],
  [['ahorro', 'ahorros', 'alcancia'], '🐷'],
  [['inversion', 'inversiones', 'acciones'], '📈'],
  [['donacion', 'donaciones', 'solidaridad'], '🎗'],
  [['sueldo', 'salario', 'trabajo', 'empleo'], '💼'],
  [['venta', 'ventas'], '🏷'],
  [['rendimiento', 'rendimientos', 'interes', 'intereses', 'dividendos'], '💹'],
  [['aporte', 'familia', 'familiar'], '👪'],
  [['honorarios', 'freelance', 'servicios profesionales'], '💻'],
  [['aguinaldo', 'bono', 'premio', 'premios'], '💰'],
  [['reintegro', 'devolucion', 'reembolso'], '↩'],
  [['jardin', 'plantas'], '🪴'],
  [['herramientas'], '🧰'],
];

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
const coincide = (nombre, palabra) => new RegExp(`(^|[^a-z0-9])${palabra}($|[^a-z0-9])`).test(nombre);

/** Emojis de la tabla de palabras clave (para comprobar que todos están en la grilla). */
export const EMOJIS_DE_PALABRAS = Object.freeze([...new Set(PALABRAS.map(([, emoji]) => claveIcono(emoji)))]);

/** Claves de los íconos que usan las categorías (activas y archivadas), salvo la de `salvoId`. */
export function iconosUsados(categorias, salvoId) {
  return new Set(categorias.filter((c) => c.id !== salvoId && claveIcono(c.emoji)).map((c) => claveIcono(c.emoji)));
}

/**
 * Propone un ícono libre para `nombre`: el de la primera palabra clave que coincida y no esté usado o, si no hay,
 * el primero libre de la lista. Devuelve '' solo si ya se usaron todos.
 */
export function proponerIcono(nombre, usados) {
  const texto = normalizar(nombre);
  if (texto) {
    for (const [palabras, emoji] of PALABRAS) {
      if (!usados.has(claveIcono(emoji)) && palabras.some((p) => coincide(texto, p))) return iconoVisible(emoji);
    }
  }
  return EMOJIS_DE_CATEGORIA.find((e) => !usados.has(claveIcono(e))) ?? '';
}

/**
 * Para bases con categorías sin ícono o con íconos repetidos: la primera de cada ícono (por orden) lo conserva y
 * las demás reciben uno libre propuesto según su nombre. Devuelve solo las categorías que cambian.
 */
export function asignarIconosFaltantes(categorias) {
  const enOrden = [...categorias].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.id).localeCompare(String(b.id)));
  const usados = new Set();
  const pendientes = [];
  for (const c of enOrden) {
    const clave = claveIcono(c.emoji);
    if (clave && !usados.has(clave)) usados.add(clave); else pendientes.push(c);
  }
  return pendientes.map((c) => {
    const emoji = proponerIcono(c.nombre, usados);
    if (emoji) usados.add(claveIcono(emoji));
    return { ...c, emoji };
  }).filter((c) => c.emoji);
}
