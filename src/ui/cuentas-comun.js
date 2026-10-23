// Acciones de cuentas que comparten Inicio y Cuentas (aep#12): abrir el formulario, archivar y eliminar
// con sus confirmaciones, y los avisos.
import { formularioCuenta } from './formulario-cuenta.js';
import { abrirVentana, confirmar, avisar } from './dialogo.js';
import { formatearMonto } from '../dominio/formato.js';

/** Monedas para el formulario: las activas y, al editar, también la de la cuenta. */
export function monedasParaFormulario(cuentas, cuenta) {
  return cuentas.monedas().filter((m) => m.activa || m.id === cuenta?.monedaId);
}

export async function archivarCuenta(cuentas, id) {
  const cuenta = cuentas.buscar(id);
  if (cuentas.necesitaConfirmarArchivo(id)) {
    const ok = await confirmar({
      titulo: `¿Archivar ${cuenta.nombre}?`,
      texto: `Todavía tiene ${formatearMonto(cuentas.saldoDe(cuenta), cuenta.monedaId)}. Va a dejar de aparecer en la carga y pasa a «Archivadas».`,
      aceptar: 'Archivar',
    });
    if (!ok) return false;
  }
  await cuentas.archivar(id);
  avisar(`Archivaste ${cuenta.nombre}.`);
  return true;
}

export async function eliminarCuenta(cuentas, id) {
  const cuenta = cuentas.buscar(id);
  const permiso = await cuentas.puedeEliminar(id);
  if (!permiso.ok) {
    if (await confirmar({ titulo: permiso.motivo, aceptar: 'Archivar' })) return archivarCuenta(cuentas, id);
    return false;
  }
  if (!await confirmar({ titulo: `¿Eliminar ${cuenta.nombre}?`, texto: 'No se puede deshacer.', aceptar: 'Eliminar' })) return false;
  await cuentas.eliminar(id);
  avisar(`Eliminaste ${cuenta.nombre}.`);
  return true;
}

/**
 * Abre el formulario en una ventana (en el celular ocupa toda la pantalla). `alTerminar` se llama después
 * de guardar, archivar o eliminar.
 */
export function abrirFormularioEnVentana({ cuentas, id = null, pantallaCompleta, alTerminar }) {
  const cuenta = id ? cuentas.buscar(id) : null;
  let ventana;
  const terminar = () => { ventana.cerrar(); alTerminar(); };
  const { elemento, enfocar } = formularioCuenta({
    cuenta, monedas: monedasParaFormulario(cuentas, cuenta), hoy: cuentas.hoy(),
    alCancelar: () => ventana.cerrar(),
    alGuardar: async (datos) => {
      const resultado = id ? await cuentas.editar(id, datos) : await cuentas.crear(datos);
      if (resultado.errores) return resultado;
      avisar(id ? 'Guardaste los cambios.' : `¡Listo! Creaste la cuenta ${resultado.cuenta.nombre}.`);
      terminar();
      return resultado;
    },
    alArchivar: cuenta?.estado === 'activa' ? async () => { if (await archivarCuenta(cuentas, id)) terminar(); } : undefined,
    alEliminar: cuenta ? async () => { if (await eliminarCuenta(cuentas, id)) terminar(); } : undefined,
  });
  ventana = abrirVentana({ etiqueta: cuenta ? 'Editar cuenta' : 'Nueva cuenta', contenido: elemento, clase: pantallaCompleta ? 'ventana-pantalla' : 'ventana-formulario' });
  enfocar();
}
