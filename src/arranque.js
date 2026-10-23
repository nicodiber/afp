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
import { iniciarInterfaz, avisarVersionNueva } from './ui/app.js';

const almacen = crearPreferenciasLocales();
const preferencias = crearCasosPreferencias(almacen);
const instalacion = crearCasosInstalacion({ instalacion: crearInstalacionNavegador(), preferencias: almacen });
// El reloj de todo AFP: la fecha simulada en modo prueba, la del dispositivo fuera de él (aep#6 CA-5).
const modoPrueba = crearCasosModoPrueba({ preferencias: almacen, relojDelDispositivo: crearRelojDelDispositivo() });
// La base del dispositivo depende del canal y del modo prueba (aep#9, modelo de datos §6.1).
const basePara = () => crearCasosDatosDispositivo(crearAlmacenIndexedDB(nombreDeBase({ modoPrueba: modoPrueba.estado().activo, ruta: location.pathname })));
let datosDispositivo = basePara();
const datosParaInterfaz = { estado: () => datosDispositivo.estado() };
const interfaz = iniciarInterfaz({
  preferencias, instalacion, modoPrueba, datosDispositivo: datosParaInterfaz, version: VERSION,
  alCambiarModoPrueba: () => { datosDispositivo = basePara(); datosDispositivo.preparar().then(() => interfaz.refrescar()); },
});
datosDispositivo.preparar().then(() => interfaz.refrescar());
registrarServiceWorker({ alHaberVersionNueva: avisarVersionNueva });
