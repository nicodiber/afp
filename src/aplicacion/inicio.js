// Primer uso de AFP (RF-CAT-03, aep HU-01): ofrece empezar con la plantilla o vacío y recuerda la respuesta en
// `Configuracion.inicioCompletado`. Usa el puerto Almacen y el Reloj; las reglas están en el dominio.
import { CONFIGURACION_POR_DEFECTO } from '../dominio/configuracion.js';
import { MONEDAS_POR_DEFECTO } from '../dominio/monedas.js';
import { debeOfrecerse, armarPlantilla } from '../dominio/plantilla.js';

export function crearCasosInicio({ almacen, reloj, nuevoId, leerPlantilla, recargar = [] }) {
  // 'comprobando' (todavía no se miró la base), 'ofrecer' (hay que responder) o 'resuelto'.
  let estado = 'comprobando';
  let enCurso = null;
  const configuracion = async () => (await almacen.leerConfiguracion()) ?? { ...CONFIGURACION_POR_DEFECTO };
  const terminado = async () => ({ ...await configuracion(), inicioCompletado: true });

  return {
    estado: () => estado,

    /** Al abrir AFP (o cambiar de base): decide si se ofrece. Una base con datos y sin la marca la recibe. */
    async preparar() {
      try {
        const [config, cuentas, categorias] = await Promise.all([configuracion(), almacen.listar('cuentas'), almacen.listar('categorias')]);
        if (debeOfrecerse({ configuracion: config, cuentas, categorias })) { estado = 'ofrecer'; return estado; }
        if (!config.inicioCompletado) await almacen.guardarConfiguracion({ ...config, inicioCompletado: true });
      } catch { /* sin base no hay nada que ofrecer */ }
      estado = 'resuelto';
      return estado;
    },

    async empezarVacio() {
      if (estado !== 'ofrecer') return { ok: false };
      try {
        await almacen.guardarConfiguracion(await terminado());
        estado = 'resuelto';
        return { ok: true };
      } catch { return { ok: false }; }
    },

    /** Todo o nada: cuentas, categorías, ubicaciones y la marca se guardan en una sola transacción. Un doble toque no la repite. */
    usarPlantilla() {
      if (estado !== 'ofrecer') return Promise.resolve({ ok: false });
      enCurso ??= (async () => {
        try {
          const guardadas = await almacen.listar('monedas');
          const monedas = (guardadas.length ? guardadas : MONEDAS_POR_DEFECTO).map((m) => ({ ...m }));
          const armado = armarPlantilla(await leerPlantilla(), {
            hoy: reloj.hoy(), nuevoId, monedasActivas: monedas.map((m) => m.id),
          });
          if (armado.errores.length) throw new Error(armado.errores.join(' '));
          // Las monedas que usa la plantilla quedan activas (una base sin cuentas pudo haber desactivado alguna).
          for (const m of monedas) if (armado.cuentas.some((c) => c.monedaId === m.id)) m.activa = true;
          await almacen.guardarTodo({
            monedas, cuentas: armado.cuentas, categorias: armado.categorias, ubicacionesCategoria: armado.ubicaciones,
            configuracion: [await terminado()],
          });
          await Promise.all(recargar.map((f) => f()));
          estado = 'resuelto';
          return { ok: true, cuentas: armado.cuentas.length, categorias: armado.categorias.length };
        } catch {
          return { ok: false };
        } finally {
          enCurso = null;
        }
      })();
      return enCurso;
    },
  };
}
