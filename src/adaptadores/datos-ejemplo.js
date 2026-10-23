// Lee los datos de ejemplo publicados con la app (datos-demo/, RF-DAT-07, aep#12). Los guarda el service
// worker, así que también se cargan sin conexión.
export async function leerDatosDeEjemplo() {
  const respuesta = await fetch('datos-demo/datos-ejemplo.json', { cache: 'no-cache' });
  if (!respuesta.ok) throw new Error(`No se pudieron leer los datos de ejemplo (${respuesta.status}).`);
  const datos = await respuesta.json();
  if (datos.formato !== 'afp-datos-de-ejemplo' || datos.version < 2) throw new Error('Los datos de ejemplo tienen un formato anterior.');
  return datos;
}
