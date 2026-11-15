// HU-41: la pila de deshacer y las reglas para revertir sin dejar datos huérfanos. Valores escritos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPilaDeshacer, sumarCambio, cambiosReales, operacionesDe, problemaAlAplicar, LIMITE_DESHACER } from '../../src/dominio/deshacer.js';
import { accionDeHistorial } from '../../src/dominio/atajos.js';

const entrada = (n) => ({ texto: `cambio ${n}`, cambios: [{ almacen: 'cuentas', id: `c${n}`, antes: null, despues: { id: `c${n}` } }] });

test('HU-41 CA-2 · se deshace en orden inverso y se rehace en el orden en que se había hecho', () => {
  const pila = crearPilaDeshacer();
  for (const n of [1, 2, 3]) pila.registrar(entrada(n));
  assert.equal(pila.proximoADeshacer().texto, 'cambio 3');
  assert.equal(pila.confirmarDeshecho().texto, 'cambio 3');
  assert.equal(pila.confirmarDeshecho().texto, 'cambio 2');
  assert.equal(pila.proximoARehacer().texto, 'cambio 2');
  assert.equal(pila.confirmarRehecho().texto, 'cambio 2');
  assert.equal(pila.proximoADeshacer().texto, 'cambio 2');
  assert.deepEqual([pila.cuantosSeDeshacen(), pila.cuantosSeRehacen()], [2, 1]);
});

test('HU-41 CA-2 · guarda hasta 20 cambios: el 21.º descarta el más viejo', () => {
  assert.equal(LIMITE_DESHACER, 20);
  const pila = crearPilaDeshacer();
  for (let n = 1; n <= 22; n++) pila.registrar(entrada(n));
  assert.equal(pila.cuantosSeDeshacen(), 20);
  let ultimo;
  for (let i = 0; i < 20; i++) ultimo = pila.confirmarDeshecho();
  assert.equal(ultimo.texto, 'cambio 3', 'el 1 y el 2 se perdieron');
  assert.equal(pila.proximoADeshacer(), null);
});

test('HU-41 CA-2 · un cambio nuevo borra lo que se podía rehacer; con la pila vacía no hay nada', () => {
  const pila = crearPilaDeshacer();
  assert.equal(pila.proximoADeshacer(), null);
  assert.equal(pila.proximoARehacer(), null);
  assert.equal(pila.confirmarDeshecho(), null);
  pila.registrar(entrada(1));
  pila.registrar(entrada(2));
  pila.confirmarDeshecho();
  assert.equal(pila.cuantosSeRehacen(), 1);
  pila.registrar(entrada(3));
  assert.equal(pila.cuantosSeRehacen(), 0);
  pila.vaciar();
  assert.deepEqual([pila.cuantosSeDeshacen(), pila.cuantosSeRehacen()], [0, 0]);
});

test('HU-41 CA-1 · las operaciones para deshacer vuelven al «antes» (borrar si no existía) y las de rehacer, al «después»', () => {
  const e = { texto: 'x', cambios: [
    { almacen: 'cuentas', id: 'a', antes: null, despues: { id: 'a', nombre: 'Nueva' } },
    { almacen: 'cuentas', id: 'b', antes: { id: 'b', nombre: 'Vieja' }, despues: { id: 'b', nombre: 'Editada' } },
    { almacen: 'categorias', id: 'k', antes: { id: 'k' }, despues: null },
  ] };
  assert.deepEqual(operacionesDe(e, 'deshacer'), [
    { tipo: 'guardar', almacen: 'categorias', registro: { id: 'k' } },
    { tipo: 'guardar', almacen: 'cuentas', registro: { id: 'b', nombre: 'Vieja' } },
    { tipo: 'borrar', almacen: 'cuentas', id: 'a' },
  ]);
  assert.deepEqual(operacionesDe(e, 'rehacer'), [
    { tipo: 'guardar', almacen: 'cuentas', registro: { id: 'a', nombre: 'Nueva' } },
    { tipo: 'guardar', almacen: 'cuentas', registro: { id: 'b', nombre: 'Editada' } },
    { tipo: 'borrar', almacen: 'categorias', id: 'k' },
  ]);
});

test('HU-41 CA-1 · si un registro cambia dos veces en el mismo cambio, vale el primer «antes» y el último «después»; lo que queda igual no cuenta', () => {
  let cambios = sumarCambio([], { almacen: 'cuentas', id: 'a', antes: { v: 1 }, despues: { v: 2 } });
  cambios = sumarCambio(cambios, { almacen: 'cuentas', id: 'a', antes: { v: 2 }, despues: { v: 3 } });
  cambios = sumarCambio(cambios, { almacen: 'cuentas', id: 'z', antes: { v: 9 }, despues: { v: 9 } });
  assert.deepEqual(cambios, [
    { almacen: 'cuentas', id: 'a', antes: { v: 1 }, despues: { v: 3 } },
    { almacen: 'cuentas', id: 'z', antes: { v: 9 }, despues: { v: 9 } },
  ]);
  assert.deepEqual(cambiosReales(cambios), [{ almacen: 'cuentas', id: 'a', antes: { v: 1 }, despues: { v: 3 } }]);
});

const estado = () => ({
  cuentas: [{ id: 'cue-mp', nombre: 'Mercado Pago' }],
  categorias: [{ id: 'cat-super', nombre: 'Supermercado', padreId: 'cat-comida' }, { id: 'cat-comida', nombre: 'Comida', padreId: null }],
  movimientos: [{ id: 'mov-1', cuentaId: 'cue-mp', partes: [{ categoriaId: 'cat-super' }] }],
});

test('HU-41 · no se borra una cuenta que ya tiene movimientos: «Mercado Pago ya tiene movimientos»', () => {
  assert.deepEqual(problemaAlAplicar([{ tipo: 'borrar', almacen: 'cuentas', id: 'cue-mp' }], estado()), { motivo: 'Mercado Pago ya tiene movimientos' });
});

test('HU-41 · no se borra una categoría con movimientos ni con subcategorías', () => {
  assert.deepEqual(problemaAlAplicar([{ tipo: 'borrar', almacen: 'categorias', id: 'cat-super' }], estado()), { motivo: 'Supermercado ya tiene movimientos' });
  assert.deepEqual(problemaAlAplicar([{ tipo: 'borrar', almacen: 'categorias', id: 'cat-comida' }], estado()), { motivo: 'Comida ya tiene subcategorías' });
});

test('HU-41 · se puede borrar junto con lo que la usa, y borrar algo sin uso', () => {
  const ops = [
    { tipo: 'borrar', almacen: 'movimientos', id: 'mov-1' },
    { tipo: 'borrar', almacen: 'cuentas', id: 'cue-mp' },
    { tipo: 'borrar', almacen: 'categorias', id: 'cat-super' },
    { tipo: 'borrar', almacen: 'categorias', id: 'cat-comida' },
  ];
  assert.equal(problemaAlAplicar(ops, estado()), null);
  assert.equal(problemaAlAplicar([{ tipo: 'borrar', almacen: 'cuentas', id: 'no-existe' }], estado()), null);
});

test('HU-41 · un movimiento que se vuelve a guardar necesita su cuenta y sus categorías', () => {
  const movimiento = { id: 'mov-2', cuentaId: 'cue-borrada', partes: [{ categoriaId: 'cat-super' }] };
  assert.deepEqual(problemaAlAplicar([{ tipo: 'guardar', almacen: 'movimientos', registro: movimiento }], estado()), { motivo: 'la cuenta o la categoría del movimiento ya no existe' });
  const conCuenta = [{ tipo: 'guardar', almacen: 'cuentas', registro: { id: 'cue-borrada', nombre: 'X' } }, { tipo: 'guardar', almacen: 'movimientos', registro: movimiento }];
  assert.equal(problemaAlAplicar(conCuenta, estado()), null);
});

const tecla = (o) => accionDeHistorial({ tecla: 'z', ctrl: true, alt: false, meta: false, shift: false, repetida: false, enCampoDeTexto: false, hayVentana: false, ...o });

test('HU-41 CA-1 y CA-2 · Ctrl + Z deshace; Ctrl + Y y Ctrl + Mayús + Z rehacen', () => {
  assert.equal(tecla({}), 'deshacer');
  assert.equal(tecla({ tecla: 'Z' }), 'deshacer');
  assert.equal(tecla({ tecla: 'y' }), 'rehacer');
  assert.equal(tecla({ tecla: 'Z', shift: true }), 'rehacer');
  assert.equal(tecla({ ctrl: false, meta: true }), 'deshacer', 'Cmd en Mac');
});

test('HU-41 CA-4 · con el foco en un campo de texto, con una ventana abierta, con Alt o sin Ctrl, AFP no hace nada', () => {
  assert.equal(tecla({ enCampoDeTexto: true }), 'ignorar');
  assert.equal(tecla({ enCampoDeTexto: true, tecla: 'y' }), 'ignorar');
  assert.equal(tecla({ hayVentana: true }), 'ignorar');
  assert.equal(tecla({ alt: true }), 'ignorar');
  assert.equal(tecla({ ctrl: false }), 'ignorar');
  assert.equal(tecla({ repetida: true }), 'ignorar');
  assert.equal(tecla({ tecla: 'y', shift: true }), 'ignorar');
  assert.equal(tecla({ tecla: 'x' }), 'ignorar');
});
