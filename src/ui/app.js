// Interfaz de AFP (aep#2): rutas por «#destino», navegación, tema y aviso de versión nueva.
import { pantallaInicio } from './pantallas/inicio.js';
import { pantallaAjustes } from './pantallas/ajustes.js';
import { pantallaProximamente } from './pantallas/proximamente.js';
import { actualizarFranja } from './franja-prueba.js';
import { crear } from './dom.js';

const DESTINOS = { inicio: 'Inicio', movimientos: 'Movimientos', cargar: 'Cargar', analisis: 'Análisis', ajustes: 'Ajustes' };
// Pantallas dentro de Ajustes (aep#12): «#ajustes/cuentas» y «#ajustes/monedas».
const SUBPANTALLAS = { 'ajustes/cuentas': 'Cuentas', 'ajustes/categorias': 'Categorías', 'ajustes/monedas': 'Monedas' };
// Las pantallas de Ajustes se cargan recién cuando se abren, para que Inicio se dibuje antes (LCP, aep#15).
const CARGAR_SUBPANTALLA = {
  'ajustes/cuentas': () => import('./pantallas/cuentas.js'),
  'ajustes/categorias': () => import('./pantallas/categorias.js'),
  'ajustes/monedas': () => import('./pantallas/monedas.js'),
};
const subpantallas = {};
const PC = '(min-width: 720px)';
const SISTEMA_OSCURO = '(prefers-color-scheme: dark)';

export function iniciarInterfaz({ preferencias, instalacion, modoPrueba, datosDispositivo, cuentas, categorias, ejemplo, alCambiarModoPrueba = () => {}, version }) {
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
  // Vuelve a dibujar la pantalla y pone el foco en el control indicado (si sigue existiendo).
  const redibujar = (foco) => {
    const anterior = document.activeElement?.id;
    mostrar(false);
    const destino = (foco && document.getElementById(foco)) || (anterior && document.getElementById(anterior));
    if (destino) destino.focus(); else if (foco !== undefined) principal.querySelector('h1')?.focus({ preventScroll: true });
  };
  let rutaAnterior = null;

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
    if (ruta !== rutaAnterior && rutaAnterior === 'ajustes/cuentas') subpantallas[rutaAnterior]?.reiniciarCuentas();
    if (ruta !== rutaAnterior && rutaAnterior === 'ajustes/categorias') subpantallas[rutaAnterior]?.reiniciarCategorias();
    if (CARGAR_SUBPANTALLA[ruta] && !subpantallas[ruta]) {
      // Primera vez: se carga el módulo y se vuelve a dibujar (sin conexión, lo sirve el service worker).
      CARGAR_SUBPANTALLA[ruta]().then((modulo) => { subpantallas[ruta] = modulo; if (rutaActual() === ruta) { rutaAnterior = null; mostrar(moverFoco); } });
      principal.replaceChildren(crear('h1', { class: 'titulo', tabindex: '-1', texto: SUBPANTALLAS[ruta] }));
      document.title = `${SUBPANTALLAS[ruta]} · AFP`;
      return;
    }
    rutaAnterior = ruta;
    let pantalla;
    if (ruta === 'ajustes/cuentas') pantalla = subpantallas[ruta].pantallaCuentas({ cuentas, esPC: esPC(), redibujar });
    else if (ruta === 'ajustes/monedas') pantalla = subpantallas[ruta].pantallaMonedas({ cuentas, redibujar });
    else if (ruta === 'ajustes/categorias') pantalla = subpantallas[ruta].pantallaCategorias({ categorias, esPC: esPC(), redibujar });
    else if (destino === 'inicio') pantalla = pantallaInicio({ instalacion, ...acciones, cuentas, esPC: esPC(), redibujar });
    else if (destino === 'ajustes') {
      pantalla = pantallaAjustes({
        preferencias, version, instalacion, alInstalar: acciones.alInstalar, modoPrueba, datosDispositivo, cuentas, ejemplo, redibujar,
        alCambiarModoPrueba: () => {
          actualizarFranja(modoPrueba.estado());
          alCambiarModoPrueba();
          const foco = document.activeElement?.id;
          mostrar(false);
          if (foco) document.getElementById(foco)?.focus();
        },
        alElegirTema: (tema) => { preferencias.elegirTema(tema); aplicarTema(); },
      });
    } else pantalla = pantallaProximamente(DESTINOS[destino]);
    principal.replaceChildren(...pantalla);
    document.title = `${SUBPANTALLAS[ruta] ?? DESTINOS[destino]} · AFP`;
    for (const enlace of enlaces) {
      if (enlace.dataset.destino === destino) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    }
    if (moverFoco) principal.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };

  // En el celular «Cargar» va en el centro; en la PC, al final (abajo), y el orden del teclado sigue al visual.
  const ordenarNavegacion = () => {
    if (matchMedia(PC).matches) lista.append(cargar);
    else lista.insertBefore(cargar, lista.children[2] === cargar ? cargar : lista.children[2]);
  };

  aplicarTema();
  actualizarFranja(modoPrueba.estado());
  ordenarNavegacion();
  mostrar(false);
  // Al cambiar de pantalla (por ejemplo, con «Atrás» del celular), se cierra cualquier ventana abierta.
  window.addEventListener('hashchange', () => {
    for (const ventana of document.querySelectorAll('dialog[open]')) ventana.close();
    mostrar(true);
  });
  // Si el navegador pasa a ofrecer instalar con un toque (o termina de instalar), se actualiza la pantalla.
  instalacion.alCambiar(() => { if (['inicio', 'ajustes'].includes(destinoActual())) mostrar(false); });
  matchMedia(PC).addEventListener('change', ordenarNavegacion);
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
