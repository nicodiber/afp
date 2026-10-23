// Configuración por defecto (modelo de datos §3.1, aep#9).
export const CONFIGURACION_POR_DEFECTO = Object.freeze({
  id: 'config',
  monedaBase: 'ARS',
  referenciaPorDefecto: 'ars_nominal',
  valorCotizacion: 'venta',
  pesosIndiceSalud: { ahorro: 25, colchon: 25, deuda: 25, presupuesto: 25 },
  diaArqueoSemanal: 0,
  denominaciones: {
    ARS: [2000000, 1000000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
    USD: [10000, 5000, 2000, 1000, 500, 200, 100],
  },
  mesesFondoEmergencia: 6,
  umbralAumentoRecurrente: '0.05',
  diasRecordatorioRespaldo: 30,
  ventanaPromedioDias: 90,
  horizontesProyeccionDias: [30, 90],
  avisoCalendar: { diasAntes: 1, hora: '09:00' },
  inicioCompletado: false,
});
