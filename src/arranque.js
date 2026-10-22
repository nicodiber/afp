// Arranque de AFP: elige los adaptadores y une las capas (arquitectura §2).
import { VERSION } from './version.js';
import { crearPreferenciasLocales } from './adaptadores/preferencias-local.js';
import { registrarServiceWorker } from './adaptadores/actualizaciones.js';
import { crearCasosPreferencias } from './aplicacion/preferencias.js';
import { iniciarInterfaz, avisarVersionNueva } from './ui/app.js';

const preferencias = crearCasosPreferencias(crearPreferenciasLocales());
iniciarInterfaz({ preferencias, version: VERSION });
registrarServiceWorker({ alHaberVersionNueva: avisarVersionNueva });
