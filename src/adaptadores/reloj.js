// Adaptador del puerto Reloj con la hora del dispositivo. Es el único archivo que lee la fecha del
// sistema (convenciones; lo revisa pruebas/reglas/arquitectura.test.js).
const FORMATO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });

const FORMATO_HORA = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function crearRelojDelDispositivo() {
  return { hoy: () => FORMATO.format(new Date()), ahora: () => FORMATO_HORA.format(new Date()) };
}
