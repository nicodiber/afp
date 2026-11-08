// Interfaz de AFP (aep#2): rutas por «#destino», navegación, tema y aviso de versión nueva.
import { pantallaInicio } from './pantallas/inicio.js';
import { abreCarga } from '../dominio/atajos.js';
import { actualizarFranja } from './franja-prueba.js';
import { crear } from './dom.js';

const DESTINOS = { inicio: 'Inicio', movimientos: 'Movimientos', cargar: 'Cargar', analisis: 'Análisis', ajustes: 'Ajustes' };
// Pantallas dentro de Ajustes (aep#12): «#ajustes/cuentas» y «#ajustes/monedas».
const SUBPANTALLAS = { 'ajustes/cuentas': 'Cuentas', 'ajustes/categorias': 'Categorías', 'ajustes/monedas': 'Monedas' };
// Las pantallas que no son Inicio se cargan recién cuando se abren, para que Inicio se dibuje antes (LCP, aep#15, FC-19).
const PROXIMAMENTE = () => import('./pantallas/proximamente.js');
const CARGAR_SUBPANTALLA = {
  movimientos: PROXIMAMENTE,
  analisis: PROXIMAMENTE,
  ajustes: () => import('./pantallas/ajustes.js'),
  cargar: () => import('./pantallas/cargar.js'),
  'ajustes/cuentas': () => import('./pantallas/cuentas.js'),
  'ajustes/categorias': () => import('./pantallas/categorias.js'),
  'ajustes/monedas': () => import('./pantallas/monedas.js'),
};
// Título de pantallas que no se llaman como su destino del menú: «Cargar» abre «Nuevo egreso» (HU-02).
const TITULOS_PROPIOS = { cargar: 'Nuevo egreso' };
// Pantallas que usan las categorías, que se cargan después de dibujar Inicio (FC-19).
const NECESITAN_CATEGORIAS = new Set(['cargar', 'ajustes', 'ajustes/categorias']);
const subpantallas = {};
const PC = '(min-width: 720px)';
const SISTEMA_OSCURO = '(prefers-color-scheme: dark)';

export function iniciarInterfaz({ preferencias, instalacion, modoPrueba, datosDispositivo, cuentas, categorias, movimientos, ejemplo, alCambiarModoPrueba = () => {}, version }) {
  const principal = document.getElementById('contenido');
  const enlaces = [...document.querySelectorAll('.nav-lista a[data-destino]')];
  const cargar = document.querySelector('.nav-item-cargar');
  const lista = cargar.parentElement;

  const aplicarTema = () => {
    const eleccion = preferencias.temaElegido();
    if (eleccion === 'sistema') delete document.documentElement.dataset.tema;
    else document.documentElement.dataset.tema = eleccion;
    const fondo = getComputedStyle(document.documentElement).getPropertyValue('--color-fondo').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fondo);
  };

  const rutaActual = () => {
    const ruta = location.hash.slice(1);
    return Object.hasOwn(DESTINOS, ruta) || Object.hasOwn(SUBPANTALLAS, ruta) ? ruta : 'inicio';
  };
  const destinoActual = () => rutaActual().split('/')[0];
  const esPC = () => matchMedia(PC).matches;
  // Marca el ítem de la barra de la pantalla actual. En la PC, Cuentas, Categorías y Monedas son ítems propios y
  // Ajustes solo se marca en su pantalla; en el celular esas tres siguen dentro de Ajustes (HU-23).
  const marcarNavegacion = () => {
    const ruta = rutaActual();
    for (const enlace of enlaces) {
      const d = enlace.dataset.destino;
      let actual;
      if (d.includes('/')) actual = ruta === d || ruta.startsWith(`${d}/`);
      else if (d === 'ajustes' && esPC()) actual = ruta === 'ajustes';
      else actual = d === destinoActual();
      if (actual) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    }
  };
  // Vuelve a dibujar la pantalla y pone el foco en el control indicado (si sigue existiendo).
  const redibujar = (foco) => {
    const anterior = document.activeElement?.id;
    mostrar(false);
    const destino = (foco && document.getElementById(foco)) || (anterior && document.getElementById(anterior));
    if (destino) destino.focus(); else if (foco !== undefined) principal.querySelector('h1')?.focus({ preventScroll: true });
  };
  let rutaAnterior = null;
  // Cuántas veces se cambió de pantalla dentro de AFP: «Cancelar» y «Guardar» vuelven atrás si hay a dónde (HU-02).
  let cambiosDePantalla = 0;
  const volver = () => {
    if (cambiosDePantalla > 0) history.back(); else location.replace('#inicio');
  };

  const acciones = {
    alInstalar: () => instalacion.instalar().then(() => mostrar(false)),
    alDescartar: () => {
      instalacion.descartar();
      mostrar(false);
      principal.querySelector('h1')?.focus({ preventScroll: true });
    },
  };

  const mostrar = (moverFoco) => {
    const ruta = rutaActual();
    const destino = destinoActual();
    // Cargar ya está en pantalla: no se vuelve a dibujar para no perder lo que se está escribiendo (los datos se leen al elegir).
    if (ruta === 'cargar' && rutaAnterior === 'cargar' && !moverFoco && principal.querySelector('.formulario-egreso')) return;
    document.body.dataset.ruta = destino;
    if (ruta !== rutaAnterior && rutaAnterior === 'ajustes/cuentas') subpantallas[rutaAnterior]?.reiniciarCuentas();
    if (ruta !== rutaAnterior && rutaAnterior === 'ajustes/categorias') subpantallas[rutaAnterior]?.reiniciarCategorias();
    const faltanCategorias = NECESITAN_CATEGORIAS.has(ruta) && typeof categorias.todas !== 'function';
    if (CARGAR_SUBPANTALLA[ruta] && (!subpantallas[ruta] || faltanCategorias)) {
      // Primera vez: se carga el módulo (y las categorías, si la pantalla las usa) y se vuelve a dibujar (sin conexión, lo sirve el service worker).
      Promise.all([CARGAR_SUBPANTALLA[ruta](), faltanCategorias ? categorias.listas() : null]).then(([modulo]) => { subpantallas[ruta] = modulo; if (rutaActual() === ruta) { rutaAnterior = null; mostrar(moverFoco); } });
      const titulo = TITULOS_PROPIOS[ruta] ?? SUBPANTALLAS[ruta] ?? DESTINOS[destino];
      principal.replaceChildren(crear('h1', { class: 'titulo', tabindex: '-1', texto: titulo }));
      document.title = `${titulo} · AFP`;
      marcarNavegacion();
      return;
    }
    rutaAnterior = ruta;
    let pantalla;
    if (ruta === 'ajustes/cuentas') pantalla = subpantallas[ruta].pantallaCuentas({ cuentas, esPC: esPC(), redibujar });
    else if (ruta === 'ajustes/monedas') pantalla = subpantallas[ruta].pantallaMonedas({ cuentas, redibujar });
    else if (ruta === 'ajustes/categorias') pantalla = subpantallas[ruta].pantallaCategorias({ categorias, esPC: esPC(), redibujar });
    else if (ruta === 'cargar') pantalla = subpantallas[ruta].pantallaCargar({ movimientos, cuentas, categorias, esPC: esPC(), volver });
    else if (destino === 'inicio') pantalla = pantallaInicio({ instalacion, ...acciones, cuentas, movimientos, esPC: esPC(), redibujar });
    else if (destino === 'ajustes') {
      pantalla = subpantallas.ajustes.pantallaAjustes({
        preferencias, version, instalacion, alInstalar: acciones.alInstalar, modoPrueba, datosDispositivo, cuentas, ejemplo, redibujar, esPC: esPC(),
        alCambiarModoPrueba: () => {
          actualizarFranja(modoPrueba.estado());
          alCambiarModoPrueba();
          const foco = document.activeElement?.id;
          mostrar(false);
          if (foco) document.getElementById(foco)?.focus();
        },
        alElegirTema: (tema) => { preferencias.elegirTema(tema); aplicarTema(); },
      });
    } else pantalla = subpantallas[ruta].pantallaProximamente(DESTINOS[destino]);
    principal.replaceChildren(...pantalla);
    document.title = `${TITULOS_PROPIOS[ruta] ?? SUBPANTALLAS[ruta] ?? DESTINOS[destino]} · AFP`;
    marcarNavegacion();
    if (moverFoco) principal.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };

  // En el celular «Cargar» va en el centro; en la PC, al final (abajo), y el orden del teclado sigue al visual.
  const ordenarNavegacion = () => {
    marcarNavegacion();
    // Ajustes muestra los accesos a Cuentas, Categorías y Monedas solo en el celular.
    if (rutaAnterior === 'ajustes') mostrar(false);
    if (matchMedia(PC).matches) lista.append(cargar);
    else lista.insertBefore(cargar, lista.children[2] === cargar ? cargar : lista.children[2]);
  };

  aplicarTema();
  actualizarFranja(modoPrueba.estado());
  ordenarNavegacion();
  mostrar(false);
  // Al cambiar de pantalla (por ejemplo, con «Atrás» del celular), se cierra cualquier ventana abierta.
  window.addEventListener('hashchange', () => {
    cambiosDePantalla += 1;
    for (const ventana of document.querySelectorAll('dialog[open]')) ventana.close();
    mostrar(true);
  });
  // Si el navegador pasa a ofrecer instalar con un toque (o termina de instalar), se actualiza la pantalla.
  instalacion.alCambiar(() => { if (['inicio', 'ajustes'].includes(destinoActual())) mostrar(false); });
  matchMedia(PC).addEventListener('change', ordenarNavegacion);
  // Atajo «c» en Inicio: abre Cargar (HU-34, D-165).
  document.addEventListener('keydown', (evento) => {
    const objetivo = evento.target instanceof Element ? evento.target : null;
    const enCampo = Boolean(objetivo?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
    const abre = abreCarga({
      tecla: evento.key, ctrl: evento.ctrlKey, alt: evento.altKey, meta: evento.metaKey, enCampo,
      hayVentana: Boolean(document.querySelector('dialog[open]')), esPC: esPC(), ruta: rutaActual(),
    });
    if (!abre || evento.defaultPrevented) return;
    evento.preventDefault();
    location.hash = '#cargar';
  });
  matchMedia(SISTEMA_OSCURO).addEventListener('change', aplicarTema);
  return {
    // Vuelve a dibujar la pantalla cuando cambian los datos del dispositivo (base preparada, cuentas), sin perder el foco.
    refrescar() {
      const foco = document.activeElement?.id;
      mostrar(false);
      if (foco) document.getElementById(foco)?.focus();
    },
  };
}

/** Muestra «Hay una versión nueva · Actualizar» (FC-01). */
export function avisarVersionNueva(actualizar) {
  const aviso = document.querySelector('.aviso-version');
  aviso.hidden = false;
  document.getElementById('actualizar').addEventListener('click', actualizar, { once: true });
}
