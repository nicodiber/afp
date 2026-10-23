// Ajustes → «Categorías» (aep#15, D-140): Ingresos y Egresos como un árbol con sangría; las familias se pliegan.
// Tocar una categoría la edita en una ventana (en el celular, pantalla completa); desde ahí se agrega dentro, se
// mueve, se archiva o se elimina. «Ordenar» muestra cada grupo de hermanas con asa y flechas.
import { crear } from '../dom.js';
import { abrirVentana, confirmar, avisar } from '../dialogo.js';
import { formularioCategoria, textoDonde } from '../formulario-categoria.js';
import { NOMBRE_DE_RAIZ, NOMBRES_DE_NATURALEZA, TIPOS } from '../../dominio/categorias.js';

export const estadoCategorias = { ordenar: false, plegadas: new Set() };
export const reiniciarCategorias = () => { estadoCategorias.ordenar = false; };

function detalle(categorias, c) {
  if (categorias.esFamilia(c.id)) {
    const n = categorias.hijas(c.id, c.tipo).length;
    return n === 1 ? '1 categoría' : `${n} categorías`;
  }
  if (c.tipo === 'ingreso') return NOMBRES_DE_NATURALEZA[c.naturaleza] ?? '';
  return [c.fijoVariable === 'fijo' ? 'Fijo' : 'Variable', c.necesidadDeseo === 'deseo' ? 'deseo' : 'necesidad', c.hormiga ? 'hormiga' : null].filter(Boolean).join(' · ');
}

export function pantallaCategorias({ categorias, esPC, redibujar }) {
  const ventana = (contenido, etiqueta, alCerrar) => abrirVentana({ etiqueta, contenido, clase: esPC ? 'ventana-formulario' : 'ventana-pantalla', alCerrar });

  // Crear (en una familia o en la raíz) y editar, en una ventana.
  const abrirFormulario = ({ id = null, padreId = null, tipo }) => {
    const categoria = id ? categorias.buscar(id) : null;
    const tipoFinal = categoria?.tipo ?? tipo;
    const padreFinal = categoria ? categoria.padreId ?? null : padreId;
    let v;
    const terminar = (foco) => { v.cerrar(); redibujar(foco); };
    const acciones = categoria ? [
      { texto: 'Agregar dentro', alTocar: () => { v.cerrar(); abrirFormulario({ padreId: id, tipo: tipoFinal }); } },
      { texto: 'Mover', alTocar: () => { v.cerrar(); abrirMover(id); } },
      { texto: 'Archivar', alTocar: async () => { if (await archivar(id)) terminar('titulo-categorias'); } },
      { texto: 'Eliminar', peligro: true, alTocar: async () => { if (await eliminar(id)) terminar('titulo-categorias'); } },
    ] : [];
    const { elemento, enfocar } = formularioCategoria({
      categoria, tipo: tipoFinal, dondeTexto: textoDonde(padreFinal ? categorias.buscar(padreFinal) : null, tipoFinal),
      esFamilia: categoria ? categorias.esFamilia(id) : false,
      clasificacion: categoria ?? categorias.clasificacionPorDefecto(padreFinal, tipoFinal),
      alCancelar: () => v.cerrar(),
      alGuardar: async (datos) => {
        const resultado = categoria ? await categorias.editar(id, datos) : await categorias.crear(datos, { padreId: padreFinal, tipo: tipoFinal });
        if (resultado.errores) return resultado;
        avisar(categoria ? 'Guardaste los cambios.' : `Creaste la categoría ${resultado.categoria.nombre}.`);
        if (padreFinal) estadoCategorias.plegadas.delete(padreFinal);
        terminar(`categoria-${resultado.categoria.id}`);
        return resultado;
      },
      acciones,
    });
    v = ventana(elemento, categoria ? 'Editar categoría' : 'Nueva categoría');
    enfocar();
  };

  const archivar = async (id) => {
    const c = categorias.buscar(id);
    const total = categorias.cuantasSeArchivan(id);
    if (total > 1) {
      const otras = total - 1;
      const ok = await confirmar({
        titulo: `¿Archivar ${c.nombre}?`,
        texto: `También se ${otras === 1 ? 'archiva 1 categoría' : `archivan sus ${otras} categorías`}. Van a dejar de aparecer en la carga y pasan a «Archivadas».`,
        aceptar: 'Archivar',
      });
      if (!ok) return false;
    }
    await categorias.archivar(id);
    avisar(`Archivaste ${c.nombre}.`);
    return true;
  };

  const eliminar = async (id) => {
    const c = categorias.buscar(id);
    const permiso = await categorias.puedeEliminar(id);
    if (!permiso.ok) {
      if (permiso.motivo.includes('archivarla') && await confirmar({ titulo: permiso.motivo, aceptar: 'Archivar' })) return archivar(id);
      if (!permiso.motivo.includes('archivarla')) avisar(permiso.motivo);
      return false;
    }
    if (!await confirmar({ titulo: `¿Eliminar ${c.nombre}?`, texto: 'No se puede deshacer.', aceptar: 'Eliminar' })) return false;
    await categorias.eliminar(id);
    avisar(`Eliminaste ${c.nombre}.`);
    return true;
  };

  // Mover: a dónde y desde cuándo (D-33), con un ejemplo de qué hace cada opción (D-140).
  const abrirMover = (id) => {
    const c = categorias.buscar(id);
    let v;
    const n = `mover-${id}`;
    const destino = crear('select', { id: `${n}-destino` }, categorias.destinosPara(id).map((d) => {
      const o = crear('option', { value: d.id ?? '', texto: `${'— '.repeat(d.nivel)}${d.nombre}` });
      if ((d.id ?? null) === (c.padreId ?? null)) o.selected = true;
      return o;
    }));
    const fecha = crear('input', { type: 'date', id: `${n}-dia`, max: categorias.hoy(), value: categorias.hoy() });
    const campoFecha = crear('div', { class: 'campo', hidden: '' }, [crear('label', { for: fecha.id, texto: 'Desde el día' }), fecha]);
    const error = crear('p', { class: 'error-campo', role: 'alert' });
    const opcion = (valor, texto, ejemplo, marcada) => {
      const radio = crear('input', { type: 'radio', name: `${n}-alcance`, value: valor, id: `${n}-${valor}` });
      radio.checked = marcada;
      radio.addEventListener('change', () => { campoFecha.hidden = valor !== 'fecha'; });
      return crear('div', { class: 'opcion-mover' }, [radio, crear('label', { for: radio.id }, [crear('strong', { texto }), crear('span', { class: 'apoyo', texto: ejemplo })])]);
    };
    const nombreDestino = () => destino.selectedOptions[0]?.textContent.replace(/^(— )+/, '') ?? '';
    const ejemplos = crear('fieldset', { class: 'alcance-mover' }, [
      crear('legend', { texto: '¿Desde cuándo?' }),
      opcion('todo', 'Todo el historial', `Todos sus movimientos, también los anteriores, se ven en el lugar nuevo. Ejemplo: tus gastos de septiembre en ${c.nombre} también pasan a contarse ahí.`, true),
      opcion('fecha', 'Desde una fecha', `Lo anterior a esa fecha sigue contándose donde estaba; lo de esa fecha en adelante, en el lugar nuevo. Ejemplo: septiembre sigue en ${c.padreId ? categorias.buscar(c.padreId).nombre : NOMBRE_DE_RAIZ[c.tipo]}.`, false),
    ]);
    const cancelar = crear('button', { type: 'button', class: 'boton-secundario', texto: 'Cancelar' });
    cancelar.addEventListener('click', () => v.cerrar());
    const titulo = crear('h2', { class: 'subtitulo', tabindex: '-1', texto: `Mover ${c.nombre}` });
    const formulario = crear('form', { class: 'formulario-cuenta', novalidate: '' }, [
      titulo,
      crear('div', { class: 'campo' }, [crear('label', { for: destino.id, texto: '¿A dónde?' }), destino]),
      ejemplos, campoFecha, error,
      crear('div', { class: 'acciones' }, [cancelar, crear('button', { type: 'submit', class: 'boton-principal', texto: 'Mover' })]),
    ]);
    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const alcance = formulario.querySelector(`input[name="${n}-alcance"]:checked`).value;
      try {
        await categorias.mover(id, { padreId: destino.value || null, alcance, fecha: fecha.value });
      } catch (e) {
        error.textContent = e.message;
        return;
      }
      if (destino.value) estadoCategorias.plegadas.delete(destino.value);
      avisar(alcance === 'todo' ? `Moviste ${c.nombre} a ${nombreDestino()} para todo el historial.` : `Moviste ${c.nombre} a ${nombreDestino()} desde el ${fecha.value.split('-').reverse().join('/')}.`);
      v.cerrar();
      redibujar(`categoria-${id}`);
    });
    v = ventana(formulario, `Mover ${c.nombre}`);
    titulo.focus();
  };

  const fila = (c, nivel) => {
    const familia = categorias.esFamilia(c.id);
    const plegada = estadoCategorias.plegadas.has(c.id);
    const hijos = [];
    if (familia) {
      const pliegue = crear('button', { type: 'button', class: 'pliegue', id: `pliegue-${c.id}`, 'aria-expanded': String(!plegada), 'aria-label': `${plegada ? 'Desplegar' : 'Plegar'} ${c.nombre}`, texto: plegada ? '▸' : '▾' });
      pliegue.addEventListener('click', () => {
        if (plegada) estadoCategorias.plegadas.delete(c.id); else estadoCategorias.plegadas.add(c.id);
        redibujar(`pliegue-${c.id}`);
      });
      hijos.push(pliegue);
    } else hijos.push(crear('span', { class: 'pliegue-vacio', 'aria-hidden': 'true' }));
    if (c.emoji) hijos.push(crear('span', { class: 'fila-emoji', 'aria-hidden': 'true', texto: c.emoji }));
    const datos = crear('button', { type: 'button', class: 'datos-categoria', id: `categoria-${c.id}` }, [
      crear('span', { class: `fila-nombre${familia ? ' familia' : ''}`, texto: c.nombre }),
      crear('span', { class: 'fila-detalle', texto: detalle(categorias, c) }),
    ]);
    datos.addEventListener('click', () => abrirFormulario({ id: c.id }));
    hijos.push(datos);
    const li = crear('li', { class: 'fila-cuenta fila-categoria' }, hijos);
    // La sangría va por CSSOM: la política de seguridad no deja estilos escritos en el HTML.
    li.style.setProperty('--nivel', String(nivel));
    return li;
  };

  const arbol = (tipo) => {
    const lista = crear('ul', { class: 'lista-cuentas arbol-categorias', 'aria-labelledby': `titulo-${tipo}` });
    const recorrer = (padreId, nivel) => {
      for (const c of categorias.hijas(padreId, tipo)) {
        lista.append(fila(c, nivel));
        if (categorias.esFamilia(c.id) && !estadoCategorias.plegadas.has(c.id)) recorrer(c.id, nivel + 1);
      }
    };
    recorrer(null, 0);
    return lista;
  };

  // Ordenar: cada grupo de hermanas en su lista, con asa (arrastrar) y flechas.
  const grupos = (tipo) => {
    const salida = [];
    const recorrer = (padreId) => {
      const hermanas = categorias.hijas(padreId, tipo);
      if (hermanas.length > 1) salida.push(grupoParaOrdenar(hermanas, padreId ? categorias.buscar(padreId).nombre : NOMBRE_DE_RAIZ[tipo]));
      for (const c of hermanas) recorrer(c.id);
    };
    recorrer(null);
    return salida;
  };
  const grupoParaOrdenar = (hermanas, titulo) => {
    const idTitulo = `grupo-${hermanas[0].id}`;
    const lista = crear('ul', { class: 'lista-cuentas ordenando', 'aria-labelledby': idTitulo });
    const mover = async (id, posicion, foco) => { await categorias.ordenar(id, posicion); redibujar(foco); };
    hermanas.forEach((c, i) => {
      const asa = crear('button', { type: 'button', class: 'asa', 'aria-label': `Arrastrar ${c.nombre}`, texto: '⠿' });
      const subir = crear('button', { type: 'button', class: 'flecha', id: `subir-${c.id}`, 'aria-label': `Subir ${c.nombre}`, texto: '↑' });
      const bajar = crear('button', { type: 'button', class: 'flecha', id: `bajar-${c.id}`, 'aria-label': `Bajar ${c.nombre}`, texto: '↓' });
      subir.disabled = i === 0;
      bajar.disabled = i === hermanas.length - 1;
      subir.addEventListener('click', () => mover(c.id, i - 1, i - 1 === 0 ? `bajar-${c.id}` : `subir-${c.id}`));
      bajar.addEventListener('click', () => mover(c.id, i + 1, i + 1 === hermanas.length - 1 ? `subir-${c.id}` : `bajar-${c.id}`));
      const li = crear('li', { class: 'fila-cuenta', 'data-id': c.id }, [asa, crear('span', { class: 'fila-datos' }, [crear('span', { class: 'fila-nombre', texto: c.nombre })]), crear('span', { class: 'flechas' }, [subir, bajar])]);
      asa.addEventListener('pointerdown', (evento) => arrastrar(evento, li, lista, (posicion) => mover(c.id, posicion, `subir-${c.id}`)));
      lista.append(li);
    });
    return crear('section', { class: 'grupo-orden' }, [crear('h3', { class: 'rotulo-grupo', id: idTitulo, texto: titulo }), lista]);
  };

  const { ordenar } = estadoCategorias;
  const botonOrdenar = crear('button', { type: 'button', class: 'boton-secundario boton-chico', id: 'boton-ordenar-categorias', 'aria-pressed': String(ordenar), texto: ordenar ? 'Listo' : 'Ordenar' });
  botonOrdenar.addEventListener('click', () => { estadoCategorias.ordenar = !ordenar; redibujar('boton-ordenar-categorias'); });

  const contenido = [
    crear('a', { class: 'volver', href: '#ajustes', texto: '‹ Ajustes' }),
    crear('div', { class: 'cabecera-lista' }, [crear('h1', { class: 'titulo', id: 'titulo-categorias', tabindex: '-1', texto: 'Categorías' }), botonOrdenar]),
  ];
  for (const tipo of TIPOS) {
    const raiz = categorias.hijas(null, tipo);
    const nueva = crear('button', { type: 'button', class: 'boton-principal boton-chico', id: `nueva-${tipo}`, texto: raiz.length ? '+ Nueva' : 'Crear la primera' });
    nueva.addEventListener('click', () => abrirFormulario({ padreId: null, tipo }));
    const cabecera = crear('div', { class: 'cabecera-lista' }, [crear('h2', { class: 'subtitulo', id: `titulo-${tipo}`, texto: NOMBRE_DE_RAIZ[tipo] }), ...(ordenar ? [] : [nueva])]);
    const cuerpo = raiz.length
      ? (ordenar ? grupos(tipo) : [arbol(tipo)])
      : [crear('p', { class: 'apoyo', texto: `Todavía no tenés categorías de ${tipo === 'ingreso' ? 'ingresos' : 'egresos'}.` })];
    contenido.push(crear('section', { class: 'seccion-categorias', 'aria-labelledby': `titulo-${tipo}` }, [cabecera, ...cuerpo]));
  }
  if (ordenar) contenido.push(crear('p', { class: 'apoyo', texto: 'Arrastrá cada categoría por ⠿, o usá ↑ y ↓. Se ordena dentro de su familia.' }));
  const archivadas = categorias.archivadas();
  if (archivadas.length && !ordenar) {
    contenido.push(crear('section', { class: 'seccion-archivadas', 'aria-labelledby': 'titulo-cat-archivadas' }, [
      crear('h2', { class: 'subtitulo', id: 'titulo-cat-archivadas', texto: 'Archivadas' }),
      crear('ul', { class: 'lista-cuentas' }, archivadas.map((c) => {
        const reactivar = crear('button', { type: 'button', class: 'boton-secundario boton-chico', id: `reactivar-${c.id}`, 'aria-label': `Reactivar ${c.nombre}`, texto: 'Reactivar' });
        reactivar.addEventListener('click', async () => {
          const r = await categorias.reactivar(c.id);
          if (!r.ok) { avisar(r.motivo); return; }
          avisar(`Reactivaste ${c.nombre}.`);
          redibujar(`categoria-${c.id}`);
        });
        return crear('li', { class: 'fila-cuenta fila-archivada' }, [
          crear('span', { class: 'fila-datos' }, [crear('span', { class: 'fila-nombre', texto: c.nombre }), crear('span', { class: 'fila-detalle', texto: NOMBRE_DE_RAIZ[c.tipo] })]),
          reactivar,
        ]);
      })),
    ]));
  }
  return contenido;
}

// Arrastrar con el mouse o el dedo dentro de un grupo de hermanas (FC-15: se escucha en la ventana).
function arrastrar(evento, fila, lista, alSoltar) {
  evento.preventDefault();
  fila.classList.add('arrastrando');
  const inicial = [...lista.children].indexOf(fila);
  const alMover = (e) => {
    const otras = [...lista.children].filter((x) => x !== fila);
    const antes = otras.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; }) ?? null;
    if (fila.nextElementSibling !== antes) lista.insertBefore(fila, antes);
  };
  const alTerminar = () => {
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alTerminar);
    window.removeEventListener('pointercancel', alTerminar);
    fila.classList.remove('arrastrando');
    const final = [...lista.children].indexOf(fila);
    if (final !== inicial) alSoltar(final);
  };
  window.addEventListener('pointermove', alMover);
  window.addEventListener('pointerup', alTerminar);
  window.addEventListener('pointercancel', alTerminar);
}
