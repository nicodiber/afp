// Adaptador del puerto de preferencias con localStorage. Si el navegador no deja guardar
// (modo privado, almacenamiento bloqueado), AFP sigue andando con «Como el sistema».
import { nombreConCanal } from './canal.js';

export function crearPreferenciasLocales(ruta) {
  const claveTema = nombreConCanal('tema', ruta);
  return {
    leerTema() {
      try { return localStorage.getItem(claveTema); } catch { return null; }
    },
    guardarTema(tema) {
      try { localStorage.setItem(claveTema, tema); } catch { /* sin almacenamiento: vale para esta sesión */ }
    },
  };
}
