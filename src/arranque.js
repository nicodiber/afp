// Arranque de AFP: elige los adaptadores y une las capas (arquitectura §2).
import { VERSION } from './version.js';
import { crearPreferenciasLocales } from './adaptadores/preferencias-local.js';
import { registrarServiceWorker } from './adaptadores/actualizaciones.js';
import { crearInstalacionNavegador } from './adaptadores/instalacion-navegador.js';
import { crearRelojDelDispositivo } from './adaptadores/reloj.js';
import { crearAlmacenIndexedDB } from './adaptadores/almacen-indexeddb.js';
import { nombreDeBase } from './adaptadores/canal.js';
import { crearCasosPreferencias } from './aplicacion/preferencias.js';
import { crearCasosInstalacion } from './aplicacion/instalacion.js';
import { crearCasosModoPrueba } from './aplicacion/modo-prueba.js';
import { crearCasosDatosDispositivo } from './aplicacion/datos-dispositivo.js';
import { crearCasosCuentas } from './aplicacion/cuentas.js';
import { crearCasosCategorias } from './aplicacion/categorias.js';
import { crearCasosMovimientos } from './aplicacion/movimientos.js';
import { crearCasosDatosEjemplo } from './aplicacion/datos-ejemplo.js';
import { leerDatosDeEjemplo } from './adaptadores/datos-ejemplo.js';
import { iniciarInterfaz, avisarVersionNueva } from './ui/app.js';

const almacen = crearPreferenciasLocales();
const preferencias = crearCasosPreferencias(almacen);
const instalacion = crearCasosInstalacion({ instalacion: crearInstalacionNavegador(), preferencias: almacen });
// El reloj de todo AFP: la fecha simulada en modo prueba, la del dispositivo fuera de él (aep#6 CA-5).
const modoPrueba = crearCasosModoPrueba({ preferencias: almacen, relojDelDispositivo: crearRelojDelDispositivo() });
// La base del dispositivo depende del canal y del modo prueba (aep#9, modelo de datos §6.1).
// Las cuentas (aep#12), las categorías (aep#15) y los movimientos (HU-02) usan la misma base; al cambiar el modo prueba se cambia todo.
const nuevoId = (prefijo = 'cue') => `${prefijo}-${crypto.randomUUID()}`;
const basePara = () => {
  const almacenDatos = crearAlmacenIndexedDB(nombreDeBase({ modoPrueba: modoPrueba.estado().activo, ruta: location.pathname }));
  // Los movimientos se crean después de las cuentas y categorías, que los consultan para saldos y para saber si se usan.
  const guardados = { lista: () => [] };
  const cuentas = crearCasosCuentas({ almacen: almacenDatos, reloj: modoPrueba.reloj, nuevoId: () => nuevoId('cue'), movimientos: async () => guardados.lista(), movimientosEnMemoria: () => guardados.lista() });
  const categorias = crearCasosCategorias({ almacen: almacenDatos, reloj: modoPrueba.reloj, nuevoId, movimientos: async () => guardados.lista() });
  const movimientos = crearCasosMovimientos({ almacen: almacenDatos, reloj: modoPrueba.reloj, nuevoId, cuentas, categorias });
  guardados.lista = movimientos.todos;
  const ejemplo = crearCasosDatosEjemplo({ almacen: almacenDatos, recargar: [cuentas.recargar, categorias.recargar, movimientos.recargar] });
  return { dispositivo: crearCasosDatosDispositivo(almacenDatos), cuentas, categorias, movimientos, ejemplo };
};
let base = basePara();
const datosParaInterfaz = { estado: () => base.dispositivo.estado() };
// La interfaz ve siempre las cuentas de la base actual.
const cuentasParaInterfaz = new Proxy({}, { get: (_, nombre) => base.cuentas[nombre] });
const categoriasParaInterfaz = new Proxy({}, { get: (_, nombre) => base.categorias[nombre] });
const movimientosParaInterfaz = new Proxy({}, { get: (_, nombre) => base.movimientos[nombre] });
const ejemploParaInterfaz = {
  leer: leerDatosDeEjemplo,
  cargar: (datos) => base.ejemplo.cargar(datos),
  borrar: () => base.ejemplo.borrar(),
  hayDatos: () => base.cuentas.hayCuentas() || base.categorias.hayCategorias() || base.movimientos.hay(),
};
// Se redibuja apenas se sabe el estado de la base y otra vez con las cuentas.
const preparar = async (alAvanzar) => {
  await base.dispositivo.preparar();
  alAvanzar();
  // Si la base no se puede abrir (por ejemplo, bloqueada por otra pestaña), AFP sigue sin cuentas.
  if (base.dispositivo.estado() !== 'sin-almacenamiento') await Promise.all([base.cuentas.preparar(), base.categorias.preparar(), base.movimientos.preparar()]).catch(() => {});
  alAvanzar();
};
const interfaz = iniciarInterfaz({
  preferencias, instalacion, modoPrueba, datosDispositivo: datosParaInterfaz, version: VERSION,
  cuentas: cuentasParaInterfaz, categorias: categoriasParaInterfaz, movimientos: movimientosParaInterfaz, ejemplo: ejemploParaInterfaz,
  alCambiarModoPrueba: () => { base = basePara(); preparar(() => interfaz.refrescar()); },
});
preparar(() => interfaz.refrescar());
registrarServiceWorker({ alHaberVersionNueva: avisarVersionNueva });
