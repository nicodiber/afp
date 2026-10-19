"""Genera v3-prueba.esperado.json leyendo v3-prueba.xlsx con openpyxl.

Es un código distinto del lector que se prueba (factibilidad/xlsx/lector-xlsx.js), así los valores
esperados no salen del mismo código que se prueba (CLAUDE.md, ciclo de cada versión).
"""
import datetime as dt
import json
from pathlib import Path

import openpyxl

aqui = Path(__file__).parent
ws = openpyxl.load_workbook(aqui / 'v3-prueba.xlsx')['movimientos']
filas = []
for row in ws.iter_rows(values_only=True):
    f = []
    for v in row:
        if isinstance(v, dt.datetime):
            v = {'fecha': v.strftime('%Y-%m-%d'), 'hora': v.strftime('%H:%M:%S')}
        elif isinstance(v, float) and v.is_integer():
            v = int(v)
        f.append(v)
    while f and f[-1] is None:
        f.pop()
    filas.append(f)
(aqui / 'v3-prueba.esperado.json').write_text(
    json.dumps({'hoja': 'movimientos', 'filas': filas}, ensure_ascii=False, indent=0), encoding='utf-8')
print(len(filas), 'filas')
