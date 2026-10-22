// Adaptador del puerto de preferencias con localStorage. Si el navegador no deja guardar
// (modo privado, almacenamiento bloqueado), AFP sigue andando con «Como el sistema».
import { nombreConCanal } from './canal.js';

export function crearPreferenciasLocales(ruta) {
  const claveTema = nombreConCanal('tema', ruta);
  const claveSugerencia = nombreConCanal('sugerencia-instalacion', ruta);
  const claveModoPrueba = nombreConCanal('modo-prueba', ruta);
  const claveFecha = nombreConCanal('fecha-simulada', ruta);
  const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
  const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
  return {
    leerModoPrueba: () => leer(claveModoPrueba),
    guardarModoPrueba(valor) {
      if (valor == null) { try { localStorage.removeItem(claveModoPrueba); } catch { /* sin almacenamiento */ } } else guardar(claveModoPrueba, valor);
    },
    leerFechaSimulada: () => leer(claveFecha),
    guardarFechaSimulada: (valor) => guardar(claveFecha, valor),
    leerSugerenciaInstalacion: () => leer(claveSugerencia),
    guardarSugerenciaInstalacion: (valor) => guardar(claveSugerencia, valor),
    leerTema() {
      try { return localStorage.getItem(claveTema); } catch { return null; }
    },
    guardarTema(tema) {
      try { localStorage.setItem(claveTema, tema); } catch { /* sin almacenamiento: vale para esta sesión */ }
    },
  };
}
