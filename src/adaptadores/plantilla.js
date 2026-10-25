// Lee la plantilla inicial publicada con la app (plantilla/, RF-CAT-03, aep HU-01). La guarda el service
// worker, así que también se lee sin conexión.
export async function leerPlantillaInicial() {
  const respuesta = await fetch('plantilla/plantilla-inicial.json', { cache: 'no-cache' });
  if (!respuesta.ok) throw new Error(`No se pudo leer la plantilla (${respuesta.status}).`);
  return respuesta.json();
}
