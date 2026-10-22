// Franja fija del modo prueba (aep#6, D-110).
import { formatearFecha } from '../dominio/fecha.js';

export function actualizarFranja(estado) {
  const franja = document.querySelector('.franja-prueba');
  if (estado.activo) {
    document.documentElement.setAttribute('data-modo-prueba', '');
    franja.textContent = `MODO PRUEBA · fecha simulada ${formatearFecha(estado.fechaSimulada)}`;
    franja.hidden = false;
  } else {
    document.documentElement.removeAttribute('data-modo-prueba');
    franja.hidden = true;
  }
}
