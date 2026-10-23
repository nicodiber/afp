"""Genera datos-ejemplo.json: los datos de ejemplo ficticios de 05-roadmap.md §5 (repo aep).

Las cuentas, las monedas y las categorías tienen el formato del modelo de datos (D-128, aep#15): AFP las carga tal cual con
«Cargar datos de ejemplo» en modo prueba (RF-DAT-07). Los movimientos y el resto pasan al formato del
modelo con la spec que los use (v0.3.0 en adelante). Montos en centavos (enteros).
Fecha simulada: 31/10/2026. Ninguna persona, cuenta ni monto es real.
"""
import json
from pathlib import Path

def c(pesos):  # pesos → centavos
    return round(pesos * 100)

SALDO_INICIAL_AL = '2026-09-01'
# Cuentas y monedas con los campos del modelo de datos (02-modelo-de-datos.md §3.3 y §3.4, D-128).
def cuenta(orden, id, nombre, tipo, moneda, saldo, rendimiento=False):
    return {'id': f'cue-{id}', 'nombre': nombre, 'tipo': tipo, 'monedaId': moneda, 'saldoInicial': c(saldo),
            'fechaSaldoInicial': SALDO_INICIAL_AL, 'tieneRendimiento': rendimiento, 'proposito': 'ninguno',
            'emoji': '', 'notas': '', 'orden': orden, 'estado': 'activa'}
CUENTAS = [
    cuenta(1, 'billetera', 'Billetera', 'efectivo', 'ARS', 50_000),
    cuenta(2, 'caja', 'Caja', 'efectivo', 'ARS', 200_000),
    cuenta(3, 'banco', 'Banco', 'banco', 'ARS', 800_000),
    cuenta(4, 'billetera-virtual', 'Billetera virtual', 'billetera_virtual', 'ARS', 300_000, rendimiento=True),
    cuenta(5, 'dolares', 'Dólares billete', 'efectivo', 'USD', 500),
    cuenta(6, 'tarjeta-transporte', 'Tarjeta transporte', 'transporte', 'ARS', 10_000),
]
MONEDAS = [
    {'id': 'ARS', 'nombre': 'Peso argentino', 'simbolo': '$', 'decimales': 2, 'clase': 'fiat', 'cotizacion': 'base', 'activa': True},
    {'id': 'USD', 'nombre': 'Dólar estadounidense', 'simbolo': 'US$', 'decimales': 2, 'clase': 'fiat', 'cotizacion': 'diaria', 'activa': True},
]

# Categorías con los campos del modelo de datos (§3.6) y su ubicación (§3.15), como D-128. Las familias no
# llevan clasificación propia; las hojas sí (RF-CAT-02).
import unicodedata
def _slug(nombre):
    base = unicodedata.normalize('NFKD', nombre).encode('ascii', 'ignore').decode().lower()
    return 'cat-' + '-'.join(base.split())
CATEGORIAS = []
def cat(tipo, nombre, padre=None, **clasif):
    campos = {'fijoVariable': None, 'necesidadDeseo': None, 'hormiga': None, 'naturaleza': None}
    campos.update({k: v for k, v in clasif.items()})
    CATEGORIAS.append({'id': _slug(nombre), 'nombre': nombre, 'tipo': tipo, 'padreId': _slug(padre) if padre else None,
                       'emoji': '', 'orden': len(CATEGORIAS) + 1, 'estado': 'activa', 'esSistema': False, 'esHistorica': False, **campos})
for hoja in ('Trabajo', 'Ventas', 'Rendimientos'):
    cat('ingreso', hoja, naturaleza='ganado')
cat('ingreso', 'Aporte familiar', naturaleza='aporte_terceros')
cat('ingreso', 'Regalos recibidos', naturaleza='otro')
egreso = lambda fv, nd, hormiga=False: {'fijoVariable': fv, 'necesidadDeseo': nd, 'hormiga': hormiga}
cat('egreso', 'Vivienda')
for hoja in ('Alquiler', 'Electricidad', 'Internet'):
    cat('egreso', hoja, 'Vivienda', **egreso('fijo', 'necesidad'))
cat('egreso', 'Limpieza', 'Vivienda', **egreso('variable', 'necesidad'))
cat('egreso', 'Alimentación')
for hoja in ('Supermercado', 'Verdulería'):
    cat('egreso', hoja, 'Alimentación', **egreso('variable', 'necesidad'))
cat('egreso', 'Kiosco', 'Alimentación', **egreso('variable', 'deseo', hormiga=True))
cat('egreso', 'Transporte')
cat('egreso', 'Transporte público', 'Transporte', **egreso('variable', 'necesidad'))
cat('egreso', 'Ocio')
for hoja in ('Juntada', 'Vacaciones'):
    cat('egreso', hoja, 'Ocio', **egreso('variable', 'deseo'))
cat('egreso', 'Salud', **egreso('variable', 'necesidad'))
UBICACIONES = [{'id': 'ubi-' + c['id'][4:], 'categoriaId': c['id'], 'padreId': c['padreId'], 'desde': None} for c in CATEGORIAS]

def mov(id, fecha, tipo, **k):
    m = {'id': id, 'fecha': fecha, 'tipo': tipo, 'estado': k.pop('estado', 'confirmado'), 'origen': 'datos_de_ejemplo'}
    m.update(k)
    return m
def egr(id, fecha, cuenta, categoria, monto, detalle=None, **k):
    return mov(id, fecha, 'egreso', cuenta=cuenta, partes=[{'categoria': categoria, 'monto': c(monto)}], detalle=detalle, **k)
def ing(id, fecha, cuenta, categoria, monto, detalle=None):
    return mov(id, fecha, 'ingreso', cuenta=cuenta, partes=[{'categoria': categoria, 'monto': c(monto)}], detalle=detalle)

VERDU = 'Verdulería del barrio'
MOVIMIENTOS = [
    ing('M01', '2026-09-01', 'cue-banco', 'Trabajo', 900_000, 'Sueldo septiembre'),
    ing('M02', '2026-09-02', 'cue-billetera-virtual', 'Aporte familiar', 150_000),
    egr('M03', '2026-09-05', 'cue-banco', 'Alquiler', 350_000),
    egr('M04', '2026-09-06', 'cue-billetera-virtual', 'Supermercado', 60_000, 'Compra del mes'),
    egr('M05', '2026-09-09', 'cue-billetera', 'Verdulería', 8_000, VERDU),
    egr('M06', '2026-09-10', 'cue-banco', 'Internet', 20_000),
    egr('M07', '2026-09-12', 'cue-billetera', 'Kiosco', 3_000),
    egr('M08', '2026-09-15', 'cue-banco', 'Electricidad', 25_000),
    egr('M09', '2026-09-16', 'cue-billetera', 'Verdulería', 7_000, VERDU),
    mov('M10', '2026-09-18', 'transferencia', cuentaOrigen='cue-billetera', cuentaDestino='cue-tarjeta-transporte', monto=c(20_000), detalle='Carga tarjeta'),
    egr('M11', '2026-09-20', 'cue-tarjeta-transporte', 'Transporte público', 15_000),
    ing('M12', '2026-10-01', 'cue-banco', 'Trabajo', 950_000, 'Sueldo octubre'),
    ing('M13', '2026-10-02', 'cue-billetera-virtual', 'Aporte familiar', 150_000),
    mov('M14', '2026-10-03', 'egreso', cuenta='cue-billetera-virtual', partes=[{'categoria': 'Supermercado', 'monto': c(7_000)}, {'categoria': 'Limpieza', 'monto': c(3_000)}]),
    egr('M15', '2026-10-05', 'cue-banco', 'Alquiler', 350_000),
    egr('M16', '2026-10-07', 'cue-billetera-virtual', 'Supermercado', 55_000, 'Compra del mes'),
    egr('M17', '2026-10-07', 'cue-billetera', 'Verdulería', 3_500, VERDU),
    mov('M18', '2026-10-08', 'transferencia', cuentaOrigen='cue-caja', cuentaDestino='cue-billetera', monto=c(10_000), detalle='Retiro de la caja'),
    mov('M19', '2026-10-09', 'cambio_de_moneda', cuentaOrigen='cue-banco', cuentaDestino='cue-dolares', montoOrigen=c(145_000), montoDestino=c(100), tipoDeCambio='1450.00'),
    egr('M20', '2026-10-10', 'cue-banco', 'Internet', 22_000),
    mov('M21', '2026-10-11', 'gasto_pagado_por_terceros', partes=[{'categoria': 'Vacaciones', 'monto': c(30_000)}], detalle='Escapada'),
    egr('M22', '2026-10-12', 'cue-billetera', 'Kiosco', 2_000),
    egr('M23', '2026-10-14', 'cue-billetera', 'Verdulería', 3_500, VERDU),
    egr('M24', '2026-10-15', 'cue-banco', 'Electricidad', 27_000),
    mov('M25', '2026-10-17', 'gasto_compartido', cuenta='cue-billetera-virtual', total=c(40_000),
        partes=[{'categoria': 'Juntada', 'monto': c(10_000)}],
        aCobrar=[{'persona': p, 'monto': c(10_000)} for p in ('Ana', 'Beto', 'Caro')], detalle='Cena de amigos'),
    egr('M26', '2026-10-18', 'cue-tarjeta-transporte', 'Transporte público', 12_000),
    egr('M27', '2026-10-19', 'cue-billetera', 'Kiosco', 2_500),
    mov('M28', '2026-10-20', 'prestamo_otorgado', cuenta='cue-caja', persona='Juan', monto=c(20_000)),
    egr('M29', '2026-10-21', 'cue-billetera', 'Verdulería', 3_500, VERDU),
    egr('M30', '2026-10-22', 'cue-banco', 'Salud', 18_000, 'Consulta médica'),
    mov('M31', '2026-10-25', 'cobro_de_prestamo', cuenta='cue-billetera', persona='Juan', monto=c(5_000)),
    ing('M32', '2026-10-26', 'cue-billetera', 'Ventas', 40_000, 'Venta de bicicleta'),
    egr('M33', '2026-10-28', 'cue-billetera', 'Verdulería', 3_500, VERDU),
    egr('M34', '2026-10-28', 'cue-billetera-virtual', 'Supermercado', 9_000, estado='pendiente_de_revision'),
    egr('M35', '2026-10-29', 'cue-billetera', 'Kiosco', 1_000, estado='en_papelera'),
]
RECURRENTES = [
    {'nombre': 'Trabajo', 'tipo': 'ingreso', 'cuenta': 'cue-banco', 'dia': 1, 'montoEstimado': c(950_000), 'registradas': ['M01', 'M12']},
    {'nombre': 'Aporte familiar', 'tipo': 'ingreso', 'cuenta': 'cue-billetera-virtual', 'dia': 2, 'montoEstimado': c(150_000), 'registradas': ['M02', 'M13']},
    {'nombre': 'Alquiler', 'tipo': 'egreso', 'cuenta': 'cue-banco', 'dia': 5, 'montoEstimado': c(350_000), 'registradas': ['M03', 'M15']},
    {'nombre': 'Internet', 'tipo': 'egreso', 'cuenta': 'cue-banco', 'dia': 10, 'montoEstimado': c(22_000), 'registradas': ['M06', 'M20']},
    {'nombre': 'Electricidad', 'tipo': 'egreso', 'cuenta': 'cue-banco', 'dia': 15, 'montoEstimado': c(27_000), 'registradas': ['M08', 'M24']},
]
COTIZACIONES = [
    {'desde': '2026-09-01', 'hasta': '2026-09-30', 'blue': '1400.00', 'oficial': '1350.00'},
    {'desde': '2026-10-01', 'hasta': '2026-10-31', 'blue': '1500.00', 'oficial': '1450.00'},
]
IPC = [{'mes': '2026-08', 'valor': '100.00'}, {'mes': '2026-09', 'valor': '102.00'}, {'mes': '2026-10', 'valor': '104.04'}]

datos = {
    'formato': 'afp-datos-de-ejemplo', 'version': 3, 'fechaSimulada': '2026-10-31',
    'nota': 'Datos ficticios (05-roadmap.md §5 del repo aep). Ninguna persona, cuenta ni monto es real.',
    'cuentas': CUENTAS, 'monedas': MONEDAS, 'categorias': CATEGORIAS, 'ubicacionesCategoria': UBICACIONES,
    'movimientos': MOVIMIENTOS, 'recurrentes': {'desde': '2026-09-01', 'lista': RECURRENTES},
    'cotizaciones': {'estado': 'corregida_a_mano', 'compraIgualVenta': True, 'periodos': COTIZACIONES},
    'indices': {'ipcGeneral': {'estado': 'corregida_a_mano', 'valores': IPC}},
}
destino = Path(__file__).with_name('datos-ejemplo.json')
destino.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
print(destino, len(MOVIMIENTOS), 'movimientos')
