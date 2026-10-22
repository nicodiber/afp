// Arranque de AFP: elige los adaptadores y une las capas (arquitectura §2).
import { VERSION } from './version.js';
import { crearPreferenciasLocales } from './adaptadores/preferencias-local.js';
import { registrarServiceWorker } from './adaptadores/actualizaciones.js';
import { crearInstalacionNavegador } from './adaptadores/instalacion-navegador.js';
import { crearCasosPreferencias } from './aplicacion/preferencias.js';
import { crearCasosInstalacion } from './aplicacion/instalacion.js';
import { iniciarInterfaz, avisarVersionNueva } from './ui/app.js';

const almacen = crearPreferenciasLocales();
const preferencias = crearCasosPreferencias(almacen);
const instalacion = crearCasosInstalacion({ instalacion: crearInstalacionNavegador(), preferencias: almacen });
iniciarInterfaz({ preferencias, instalacion, version: VERSION });
registrarServiceWorker({ alHaberVersionNueva: avisarVersionNueva });
