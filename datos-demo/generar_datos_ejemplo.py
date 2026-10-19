"""Genera datos-ejemplo.json: los datos de ejemplo ficticios de PLAN_DE_VERSIONES.md §5 (repo aep).

Formato neutro y legible (no es el esquema de la app): cada versión de AFP los convierte a sus
entidades al «Cargar datos de ejemplo» en modo prueba (RF-DAT-07). Montos en centavos (enteros).
Fecha simulada: 31/10/2026. Ninguna persona, cuenta ni monto es real.
"""
import json
from pathlib import Path

def c(pesos):  # pesos → centavos
    return round(pesos * 100)

CUENTAS = [
    {'id': 'billetera', 'nombre': 'Billetera', 'tipo': 'efectivo', 'moneda': 'ARS', 'saldoInicial': c(50_000), 'rendimiento': False},
    {'id': 'caja', 'nombre': 'Caja', 'tipo': 'efectivo', 'moneda': 'ARS', 'saldoInicial': c(200_000), 'rendimiento': False},
    {'id': 'banco', 'nombre': 'Banco', 'tipo': 'banco', 'moneda': 'ARS', 'saldoInicial': c(800_000), 'rendimiento': False},
    {'id': 'billetera-virtual', 'nombre': 'Billetera virtual', 'tipo': 'billetera_virtual', 'moneda': 'ARS', 'saldoInicial': c(300_000), 'rendimiento': True},
    {'id': 'dolares', 'nombre': 'Dólares billete', 'tipo': 'efectivo', 'moneda': 'USD', 'saldoInicial': c(500), 'rendimiento': False},
    {'id': 'tarjeta-transporte', 'nombre': 'Tarjeta transporte', 'tipo': 'transporte', 'moneda': 'ARS', 'saldoInicial': c(10_000), 'rendimiento': False},
]
SALDO_INICIAL_AL = '2026-09-01'

def cat(raiz, familia, hoja, **clasif):
    return {'raiz': raiz, 'familia': familia, 'hoja': hoja, **clasif}
CATEGORIAS = [
    cat('Ingresos', None, 'Trabajo', naturaleza='ganado'),
    cat('Ingresos', None, 'Ventas', naturaleza='ganado'),
    cat('Ingresos', None, 'Rendimientos', naturaleza='ganado'),
    cat('Ingresos', None, 'Aporte familiar', naturaleza='aporte_de_terceros'),
    cat('Ingresos', None, 'Regalos recibidos', naturaleza='otro'),
    *[cat('Egresos', 'Vivienda', h, frecuencia='fijo', necesidad='necesidad') for h in ('Alquiler', 'Electricidad', 'Internet')],
    cat('Egresos', 'Vivienda', 'Limpieza', frecuencia='variable', necesidad='necesidad'),
    *[cat('Egresos', 'Alimentación', h, frecuencia='variable', necesidad='necesidad') for h in ('Supermercado', 'Verdulería')],
    cat('Egresos', 'Alimentación', 'Kiosco', frecuencia='variable', necesidad='deseo', hormiga=True),
    cat('Egresos', 'Transporte', 'Transporte público', frecuencia='variable', necesidad='necesidad'),
    *[cat('Egresos', 'Ocio', h, frecuencia='variable', necesidad='deseo') for h in ('Juntada', 'Vacaciones')],
    cat('Egresos', None, 'Salud', frecuencia='variable', necesidad='necesidad'),
]

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
    ing('M01', '2026-09-01', 'banco', 'Trabajo', 900_000, 'Sueldo septiembre'),
    ing('M02', '2026-09-02', 'billetera-virtual', 'Aporte familiar', 150_000),
    egr('M03', '2026-09-05', 'banco', 'Alquiler', 350_000),
    egr('M04', '2026-09-06', 'billetera-virtual', 'Supermercado', 60_000, 'Compra del mes'),
    egr('M05', '2026-09-09', 'billetera', 'Verdulería', 8_000, VERDU),
    egr('M06', '2026-09-10', 'banco', 'Internet', 20_000),
    egr('M07', '2026-09-12', 'billetera', 'Kiosco', 3_000),
    egr('M08', '2026-09-15', 'banco', 'Electricidad', 25_000),
    egr('M09', '2026-09-16', 'billetera', 'Verdulería', 7_000, VERDU),
    mov('M10', '2026-09-18', 'transferencia', cuentaOrigen='billetera', cuentaDestino='tarjeta-transporte', monto=c(20_000), detalle='Carga tarjeta'),
    egr('M11', '2026-09-20', 'tarjeta-transporte', 'Transporte público', 15_000),
    ing('M12', '2026-10-01', 'banco', 'Trabajo', 950_000, 'Sueldo octubre'),
    ing('M13', '2026-10-02', 'billetera-virtual', 'Aporte familiar', 150_000),
    mov('M14', '2026-10-03', 'egreso', cuenta='billetera-virtual', partes=[{'categoria': 'Supermercado', 'monto': c(7_000)}, {'categoria': 'Limpieza', 'monto': c(3_000)}]),
    egr('M15', '2026-10-05', 'banco', 'Alquiler', 350_000),
    egr('M16', '2026-10-07', 'billetera-virtual', 'Supermercado', 55_000, 'Compra del mes'),
    egr('M17', '2026-10-07', 'billetera', 'Verdulería', 3_500, VERDU),
    mov('M18', '2026-10-08', 'transferencia', cuentaOrigen='caja', cuentaDestino='billetera', monto=c(10_000), detalle='Retiro de la caja'),
    mov('M19', '2026-10-09', 'cambio_de_moneda', cuentaOrigen='banco', cuentaDestino='dolares', montoOrigen=c(145_000), montoDestino=c(100), tipoDeCambio='1450.00'),
    egr('M20', '2026-10-10', 'banco', 'Internet', 22_000),
    mov('M21', '2026-10-11', 'gasto_pagado_por_terceros', partes=[{'categoria': 'Vacaciones', 'monto': c(30_000)}], detalle='Escapada'),
    egr('M22', '2026-10-12', 'billetera', 'Kiosco', 2_000),
    egr('M23', '2026-10-14', 'billetera', 'Verdulería', 3_500, VERDU),
    egr('M24', '2026-10-15', 'banco', 'Electricidad', 27_000),
    mov('M25', '2026-10-17', 'gasto_compartido', cuenta='billetera-virtual', total=c(40_000),
        partes=[{'categoria': 'Juntada', 'monto': c(10_000)}],
        aCobrar=[{'persona': p, 'monto': c(10_000)} for p in ('Ana', 'Beto', 'Caro')], detalle='Cena de amigos'),
    egr('M26', '2026-10-18', 'tarjeta-transporte', 'Transporte público', 12_000),
    egr('M27', '2026-10-19', 'billetera', 'Kiosco', 2_500),
    mov('M28', '2026-10-20', 'prestamo_otorgado', cuenta='caja', persona='Juan', monto=c(20_000)),
    egr('M29', '2026-10-21', 'billetera', 'Verdulería', 3_500, VERDU),
    egr('M30', '2026-10-22', 'banco', 'Salud', 18_000, 'Consulta médica'),
    mov('M31', '2026-10-25', 'cobro_de_prestamo', cuenta='billetera', persona='Juan', monto=c(5_000)),
    ing('M32', '2026-10-26', 'billetera', 'Ventas', 40_000, 'Venta de bicicleta'),
    egr('M33', '2026-10-28', 'billetera', 'Verdulería', 3_500, VERDU),
    egr('M34', '2026-10-28', 'billetera-virtual', 'Supermercado', 9_000, estado='pendiente_de_revision'),
    egr('M35', '2026-10-29', 'billetera', 'Kiosco', 1_000, estado='en_papelera'),
]
RECURRENTES = [
    {'nombre': 'Trabajo', 'tipo': 'ingreso', 'cuenta': 'banco', 'dia': 1, 'montoEstimado': c(950_000), 'registradas': ['M01', 'M12']},
    {'nombre': 'Aporte familiar', 'tipo': 'ingreso', 'cuenta': 'billetera-virtual', 'dia': 2, 'montoEstimado': c(150_000), 'registradas': ['M02', 'M13']},
    {'nombre': 'Alquiler', 'tipo': 'egreso', 'cuenta': 'banco', 'dia': 5, 'montoEstimado': c(350_000), 'registradas': ['M03', 'M15']},
    {'nombre': 'Internet', 'tipo': 'egreso', 'cuenta': 'banco', 'dia': 10, 'montoEstimado': c(22_000), 'registradas': ['M06', 'M20']},
    {'nombre': 'Electricidad', 'tipo': 'egreso', 'cuenta': 'banco', 'dia': 15, 'montoEstimado': c(27_000), 'registradas': ['M08', 'M24']},
]
COTIZACIONES = [
    {'desde': '2026-09-01', 'hasta': '2026-09-30', 'blue': '1400.00', 'oficial': '1350.00'},
    {'desde': '2026-10-01', 'hasta': '2026-10-31', 'blue': '1500.00', 'oficial': '1450.00'},
]
IPC = [{'mes': '2026-08', 'valor': '100.00'}, {'mes': '2026-09', 'valor': '102.00'}, {'mes': '2026-10', 'valor': '104.04'}]

datos = {
    'formato': 'afp-datos-de-ejemplo', 'version': 1, 'fechaSimulada': '2026-10-31',
    'nota': 'Datos ficticios (PLAN_DE_VERSIONES.md §5). Ninguna persona, cuenta ni monto es real.',
    'saldoInicialAl': SALDO_INICIAL_AL, 'cuentas': CUENTAS, 'categorias': CATEGORIAS,
    'movimientos': MOVIMIENTOS, 'recurrentes': {'desde': '2026-09-01', 'lista': RECURRENTES},
    'cotizaciones': {'estado': 'corregida_a_mano', 'compraIgualVenta': True, 'periodos': COTIZACIONES},
    'indices': {'ipcGeneral': {'estado': 'corregida_a_mano', 'valores': IPC}},
}
destino = Path(__file__).with_name('datos-ejemplo.json')
destino.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
print(destino, len(MOVIMIENTOS), 'movimientos')
