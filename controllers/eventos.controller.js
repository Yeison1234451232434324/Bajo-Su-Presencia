/**
 * ============================================================
 * CONTROLADOR: eventos.controller.js
 * ============================================================
 * Maneja la lógica del formulario de publicación de eventos.
 * Depende de:
 *   - EventosModel  (eventos.model.js)   → guardar el evento
 *   - RecursosModel (recursos.model.js)  → leer el inventario disponible
 *
 * Flujo:
 *   1. Al cargar la página, lee los recursos disponibles del inventario
 *      y los muestra como tarjetas seleccionables.
 *   2. El usuario selecciona recursos y define la cantidad a usar.
 *   3. Al publicar, el evento se guarda con los recursos seleccionados
 *      y también se sincroniza con bsp_eventos_vol (voluntarios).
 *   4. Se muestra la lista de eventos publicados debajo del formulario.
 *   5. En edición, los recursos del evento pueden modificarse.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const form             = document.getElementById('form-evento');
  const recursosGrid     = document.getElementById('recursos-grid');
  const sinRecursos      = document.getElementById('sin-recursos-msg');
  const listaEventos     = document.getElementById('lista-eventos-publicados');
  const contadorRecursos = document.getElementById('contador-recursos');

  // Rol del usuario activo (los colaboradores no pueden eliminar)
  const _rolActual = (JSON.parse(localStorage.getItem('usuarioLogueado') || '{}')).rol || '';
  const _esColaborador = _rolActual === 'Colaborador';

  // Mapa de recursos seleccionados en el formulario de creación
  const seleccionados = {};
  // Mapa de recursos seleccionados en el modal de edición
  const seleccionadosEdicion = {};

  // Rango permitido para horas de eventos
  const H_MIN = '06:00', H_MAX = '21:00';

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  // Bloquear caracteres peligrosos en todos los inputs numéricos del formulario
  ['ev-voluntarios', 'ev-asistentes'].forEach(id =>
    BSPVal.blockNumericChars(document.getElementById(id))
  );

  // ── Restricción dinámica hora de fin ────────────────────────────────────
  // Cada vez que el usuario cambia la hora de inicio, el input de hora de fin
  // actualiza su atributo [min] para que el navegador bloquee opciones inválidas
  // ANTES del submit — prevención proactiva, no solo en validación del form.

  function _sincronizarHoraFin(idInicio, idFin) {
    const inpInicio = document.getElementById(idInicio);
    const inpFin    = document.getElementById(idFin);
    if (!inpInicio || !inpFin) return;

    inpInicio.addEventListener('change', () => {
      const valorInicio = inpInicio.value;

      if (valorInicio) {
        // El mínimo de la hora fin pasa a ser la hora de inicio + 1 minuto
        const [h, m] = valorInicio.split(':').map(Number);
        const totalMin = h * 60 + m + 1;
        const hNew = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mNew = String(totalMin % 60).padStart(2, '0');
        const nuevoMin = `${hNew}:${mNew}`;

        // Respetar también el límite máximo global
        inpFin.min = nuevoMin <= H_MAX ? nuevoMin : H_MAX;
      } else {
        inpFin.min = H_MIN;
      }

      // Si la hora de fin ya seleccionada quedó menor o igual a la de inicio,
      // limpiarla y mostrar el error inline de forma inmediata
      if (inpFin.value && valorInicio && inpFin.value <= valorInicio) {
        inpFin.value = '';
        _err(idFin, 'La hora de fin debe ser posterior a la hora de inicio.');
      } else {
        _ok(idFin);
      }
    });
  }

  // Aplicar para el formulario de creación y para el modal de edición
  _sincronizarHoraFin('ev-hora-inicio',   'ev-hora-fin');
  _sincronizarHoraFin('edit-hora-inicio', 'edit-hora-fin');

  // Mapa de íconos por categoría (compartido entre creación y edición)
  const ICON_MAP = {
    'Mobiliario':    'bx-chair',
    'Audio y Video': 'bx-microphone',
    'Iluminación':   'bx-bulb',
    'Papelería':     'bx-file',
    'Cocina':        'bx-bowl-hot',
    'Otros':         'bx-package'
  };

  // ════════════════════════════════════════════════════════════════
  // HELPERS DE TIEMPO
  // ════════════════════════════════════════════════════════════════

  /** Convierte "10:00 AM" o "10:00" → "10:00" (formato 24h para <input type="time">) */
  function convertTo24h(str) {
    if (!str) return '';
    str = str.trim();
    // Ya está en formato HH:MM
    if (/^\d{1,2}:\d{2}$/.test(str)) {
      const [h, m] = str.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    // Tiene AM/PM
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1]);
      const min = match[2], mer = match[3].toUpperCase();
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${min}`;
    }
    return str;
  }

  /** Separa un horario almacenado ("10:00 - 12:00" o "10:00 AM - 12:00 PM") en inicio y fin */
  function parseHorario(horario) {
    if (!horario) return { inicio: '', fin: '' };
    const parts = horario.split(' - ');
    if (parts.length >= 2) {
      return {
        inicio: convertTo24h(parts[0].trim()),
        fin:    convertTo24h(parts[1].trim())
      };
    }
    return { inicio: convertTo24h(parts[0].trim()), fin: '' };
  }

  /** Une los dos tiempos en la cadena de horario para guardar */
  function combinarHorario(inicio, fin) {
    if (!inicio && !fin) return '';
    if (!fin)    return inicio;
    if (!inicio) return fin;
    return `${inicio} - ${fin}`;
  }

  // ════════════════════════════════════════════════════════════════
  // 1. CARGAR RECURSOS DEL INVENTARIO (formulario de creación)
  // ════════════════════════════════════════════════════════════════

  function cargarRecursos() {
    if (!recursosGrid) return;

    const todos = (typeof RecursosModel !== 'undefined')
      ? RecursosModel.getAll().filter(r => r.disponible && r.cantidad > 0)
      : [];

    recursosGrid.innerHTML = '';

    if (todos.length === 0) {
      if (sinRecursos) sinRecursos.style.display = 'block';
      return;
    }
    if (sinRecursos) sinRecursos.style.display = 'none';

    todos.forEach(r => {
      const icono = ICON_MAP[r.categoria] || 'bx-package';
      const card  = document.createElement('div');
      card.className  = 'ev-recurso-card';
      card.id         = `ev-rec-${r.id}`;
      card.dataset.id = r.id;

      card.innerHTML = `
        <div class="ev-rec-check">
          <input type="checkbox" id="chk-rec-${r.id}"
            onchange="toggleRecursoEvento(${r.id})" />
        </div>
        <div class="ev-rec-body">
          <div class="ev-rec-header">
            <i class="bx ${icono} ev-rec-icon"></i>
            <label for="chk-rec-${r.id}" class="ev-rec-nombre">${r.nombre}</label>
            <span class="badge badge-green ev-rec-stock">${r.cantidad} ${r.unidad}</span>
          </div>
          <p class="ev-rec-cat">${r.categoria}</p>
          <div class="ev-rec-qty" id="ev-qty-${r.id}" style="display:none;">
            <label for="qty-rec-${r.id}">Cantidad a usar:</label>
            <input type="number" id="qty-rec-${r.id}" class="ev-qty-input"
              min="1" max="${r.cantidad}" value="1"
              onchange="actualizarCantidad(${r.id}, this.value, ${r.cantidad})"
              oninput="actualizarCantidad(${r.id}, this.value, ${r.cantidad})" />
            <span class="ev-qty-max">máx. ${r.cantidad}</span>
          </div>
        </div>`;

      recursosGrid.appendChild(card);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIÓN DE RECURSOS (creación)
  // ════════════════════════════════════════════════════════════════

  window.toggleRecursoEvento = function(id) {
    const card     = document.getElementById(`ev-rec-${id}`);
    const chk      = document.getElementById(`chk-rec-${id}`);
    const qtyDiv   = document.getElementById(`ev-qty-${id}`);
    const qtyInput = document.getElementById(`qty-rec-${id}`);

    if (chk.checked) {
      card.classList.add('ev-rec-selected');
      qtyDiv.style.display = 'flex';
      seleccionados[id] = parseInt(qtyInput.value) || 1;
    } else {
      card.classList.remove('ev-rec-selected');
      qtyDiv.style.display = 'none';
      delete seleccionados[id];
    }
    actualizarContador();
  };

  window.actualizarCantidad = function(id, valor, max) {
    let cant = parseInt(valor) || 1;
    if (cant < 1)   cant = 1;
    if (cant > max) cant = max;
    const input = document.getElementById(`qty-rec-${id}`);
    if (input) input.value = cant;
    seleccionados[id] = cant;
  };

  function actualizarContador() {
    if (!contadorRecursos) return;
    const total = Object.keys(seleccionados).length;
    contadorRecursos.textContent = total > 0
      ? `${total} recurso(s) seleccionado(s)`
      : 'Ningún recurso seleccionado (opcional)';
    contadorRecursos.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 3. RECURSOS DEL MODAL DE EDICIÓN
  // ════════════════════════════════════════════════════════════════

  /** Carga la grilla de recursos en el modal de edición, marcando los ya asignados */
  function cargarRecursosEdicion(eventoRecursos) {
    const grid    = document.getElementById('edit-recursos-grid');
    const sinMsg  = document.getElementById('edit-sin-recursos-msg');
    if (!grid) return;

    // Limpiar selección previa
    Object.keys(seleccionadosEdicion).forEach(k => delete seleccionadosEdicion[k]);

    const todos = (typeof RecursosModel !== 'undefined')
      ? RecursosModel.getAll().filter(r => r.disponible && r.cantidad > 0)
      : [];

    grid.innerHTML = '';

    if (todos.length === 0) {
      if (sinMsg) sinMsg.style.display = 'block';
      actualizarContadorEdicion();
      return;
    }
    if (sinMsg) sinMsg.style.display = 'none';

    // Lookup de recursos ya asignados al evento
    const asignados = {};
    if (eventoRecursos) {
      eventoRecursos.forEach(r => { asignados[r.recursoId] = r.cantidad; });
    }

    todos.forEach(r => {
      const icono       = ICON_MAP[r.categoria] || 'bx-package';
      const cantPre     = asignados[r.id];
      const seleccionado = cantPre !== undefined;

      if (seleccionado) seleccionadosEdicion[r.id] = cantPre;

      const card = document.createElement('div');
      card.className  = `ev-recurso-card${seleccionado ? ' ev-rec-selected' : ''}`;
      card.id         = `edit-ev-rec-${r.id}`;
      card.dataset.id = r.id;

      card.innerHTML = `
        <div class="ev-rec-check">
          <input type="checkbox" id="edit-chk-rec-${r.id}"
            ${seleccionado ? 'checked' : ''}
            onchange="toggleRecursoEdicion(${r.id})" />
        </div>
        <div class="ev-rec-body">
          <div class="ev-rec-header">
            <i class="bx ${icono} ev-rec-icon"></i>
            <label for="edit-chk-rec-${r.id}" class="ev-rec-nombre">${r.nombre}</label>
            <span class="badge badge-green ev-rec-stock">${r.cantidad} ${r.unidad}</span>
          </div>
          <p class="ev-rec-cat">${r.categoria}</p>
          <div class="ev-rec-qty" id="edit-ev-qty-${r.id}"
            style="display:${seleccionado ? 'flex' : 'none'};">
            <label for="edit-qty-rec-${r.id}">Cantidad a usar:</label>
            <input type="number" id="edit-qty-rec-${r.id}" class="ev-qty-input"
              min="1" max="${r.cantidad}" value="${seleccionado ? cantPre : 1}"
              onchange="actualizarCantidadEdicion(${r.id}, this.value, ${r.cantidad})"
              oninput="actualizarCantidadEdicion(${r.id}, this.value, ${r.cantidad})" />
            <span class="ev-qty-max">máx. ${r.cantidad}</span>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    actualizarContadorEdicion();
  }

  window.toggleRecursoEdicion = function(id) {
    const card     = document.getElementById(`edit-ev-rec-${id}`);
    const chk      = document.getElementById(`edit-chk-rec-${id}`);
    const qtyDiv   = document.getElementById(`edit-ev-qty-${id}`);
    const qtyInput = document.getElementById(`edit-qty-rec-${id}`);

    if (chk.checked) {
      card.classList.add('ev-rec-selected');
      qtyDiv.style.display = 'flex';
      seleccionadosEdicion[id] = parseInt(qtyInput.value) || 1;
    } else {
      card.classList.remove('ev-rec-selected');
      qtyDiv.style.display = 'none';
      delete seleccionadosEdicion[id];
    }
    actualizarContadorEdicion();
  };

  window.actualizarCantidadEdicion = function(id, valor, max) {
    let cant = parseInt(valor) || 1;
    if (cant < 1)   cant = 1;
    if (cant > max) cant = max;
    const input = document.getElementById(`edit-qty-rec-${id}`);
    if (input) input.value = cant;
    seleccionadosEdicion[id] = cant;
  };

  function actualizarContadorEdicion() {
    const counter = document.getElementById('edit-contador-recursos');
    if (!counter) return;
    const total = Object.keys(seleccionadosEdicion).length;
    counter.textContent = total > 0
      ? `${total} recurso(s) seleccionado(s)`
      : 'Ningún recurso seleccionado (opcional)';
    counter.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 4. PUBLICAR EVENTO
  // ════════════════════════════════════════════════════════════════

  window.submitEvent = function(e) {
    e.preventDefault();

    /* Leer y limpiar todos los valores */
    const titulo        = BSPVal.cleanText(document.getElementById('ev-titulo')?.value || '');
    const fechaVal      = document.getElementById('ev-fecha')?.value              || '';
    const horaInicio    = document.getElementById('ev-hora-inicio')?.value        || '';
    const horaFin       = document.getElementById('ev-hora-fin')?.value           || '';
    const ubicacion     = BSPVal.cleanText(document.getElementById('ev-ubicacion')?.value || '');
    const descripcion   = BSPVal.cleanText(document.getElementById('ev-descripcion')?.value || '');
    const voluntariosRaw= document.getElementById('ev-voluntarios')?.value        || '';
    const asistentesRaw = document.getElementById('ev-asistentes')?.value         || '';

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('ev-titulo','ev-fecha','ev-hora-inicio','ev-hora-fin','ev-ubicacion','ev-voluntarios','ev-asistentes','ev-descripcion');
    let valido = true;
    let err;

    const hoy = new Date().toISOString().split('T')[0];

    /* Título: mínimo 3, máximo 150, debe iniciar con letra */
    err = BSPVal.txt(titulo, { min: 3, max: 150, label: 'El título', iniciaLetra: true });
    if (err) { _err('ev-titulo', err); valido = false; }

    /* Fecha: no puede ser en el pasado (los eventos son a futuro) */
    err = BSPVal.fecha(fechaVal, { minDate: hoy, label: 'La fecha del evento' });
    if (err) { _err('ev-fecha', err); valido = false; }

    /* Hora de inicio: obligatoria, dentro del rango permitido */
    if (!horaInicio) {
      _err('ev-hora-inicio', 'La hora de inicio es obligatoria.'); valido = false;
    } else if (horaInicio < H_MIN || horaInicio > H_MAX) {
      _err('ev-hora-inicio', 'La hora debe estar entre 6:00 AM (06:00) y 9:00 PM (21:00).'); valido = false;
    }

    /* Hora de fin: opcional, pero si se pone debe ser > hora inicio y dentro del rango */
    if (horaFin) {
      if (horaFin < H_MIN || horaFin > H_MAX) {
        _err('ev-hora-fin', 'La hora debe estar entre 6:00 AM (06:00) y 9:00 PM (21:00).'); valido = false;
      } else if (horaInicio && horaFin <= horaInicio) {
        _err('ev-hora-fin', 'La hora de fin debe ser posterior a la hora de inicio.'); valido = false;
      }
    }

    /* Ubicación / sede: obligatoria, mínimo 2 chars */
    err = BSPVal.txt(ubicacion, { min: 2, max: 200, label: 'La sede / ubicación' });
    if (err) { _err('ev-ubicacion', err); valido = false; }

    /* Voluntarios necesarios: entero >= 1 — bloquea 'e', '+', '-' */
    err = BSPVal.num(voluntariosRaw, { min: 1, max: 9999, entero: true, label: 'El número de voluntarios' });
    if (err) { _err('ev-voluntarios', err); valido = false; }

    /* Asistentes esperados: opcional, entero >= 0 si se provee */
    if (asistentesRaw.trim() !== '') {
      err = BSPVal.num(asistentesRaw, { min: 0, max: 999999, entero: true, label: 'Las personas esperadas' });
      if (err) { _err('ev-asistentes', err); valido = false; }
    }

    /* Descripción: opcional, máximo 1000 chars */
    if (descripcion.length > 0) {
      err = BSPVal.txt(descripcion, { min: 5, max: 1000, label: 'La descripción' });
      if (err) { _err('ev-descripcion', err); valido = false; }
    }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    const recursosSeleccionados = Object.entries(seleccionados).map(([id, cantidad]) => {
      const r = (typeof RecursosModel !== 'undefined') ? RecursosModel.getById(parseInt(id, 10)) : null;
      return {
        recursoId:     parseInt(id, 10),
        recursoNombre: r ? r.nombre : 'Recurso',
        cantidad:      parseInt(cantidad, 10),
        unidad:        r ? r.unidad : 'unidades'
      };
    });

    /* Datos limpios al modelo */
    const data = {
      titulo,
      fecha:                 fechaVal,
      horario:               combinarHorario(horaInicio, horaFin),
      ubicacion,
      asistentes:            asistentesRaw.trim() !== '' ? parseInt(asistentesRaw, 10) : '',
      voluntariosNecesarios: parseInt(voluntariosRaw, 10),
      descripcion,
      recursos:              recursosSeleccionados
    };

    /* Llamada al modelo con try-catch */
    const resultado = BSPVal.safeCall(() => EventosModel.publicar(data));
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    // Limpiar formulario y selección
    e.target.reset();
    Object.keys(seleccionados).forEach(k => delete seleccionados[k]);
    document.querySelectorAll('.ev-recurso-card').forEach(c => c.classList.remove('ev-rec-selected'));
    document.querySelectorAll('[id^="ev-qty-"]').forEach(d => d.style.display = 'none');
    document.querySelectorAll('[id^="chk-rec-"]').forEach(c => c.checked = false);
    actualizarContador();
    actualizarPreview();
    renderEventosPublicados();

    const nRec = recursosSeleccionados.length;
    showAlertSuccess(
      `"${data.titulo}" fue publicado${nRec > 0 ? ` con ${nRec} recurso(s) asignado(s)` : ''}.`
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. HISTORIAL DE EVENTOS PUBLICADOS — DataTable v3 con filtros
  // ════════════════════════════════════════════════════════════════

  let dtEventos = null;

  function renderEventosPublicados() {
    if (!listaEventos) return;

    const eventos = EventosModel.getAll();

    const ubicaciones = [...new Set(eventos.map(e => e.ubicacion).filter(Boolean))].sort();

    function renderCard(ev) {
      const chipsRecursos = ev.recursos && ev.recursos.length > 0
        ? ev.recursos.map(r =>
            `<span class="ev-chip-recurso">
               <i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad}
             </span>`
          ).join('')
        : '<span class="ev-sin-recursos">Sin recursos asignados</span>';

      const hoy   = new Date().toISOString().split('T')[0];
      const badge = ev.fecha >= hoy
        ? '<span class="ev-badge ev-badge--activo">Próximo</span>'
        : '<span class="ev-badge ev-badge--pasado">Realizado</span>';

      return `
        <div class="ev-publicado-card" id="ev-card-${ev.id}">
          <div class="ev-pub-header">
            <div class="ev-pub-header-info">
              <div class="ev-pub-titulo-row">
                <h4 class="ev-pub-titulo">${ev.titulo}</h4>
                ${badge}
              </div>
              <p class="ev-pub-meta">
                <i class="bx bx-calendar"></i> ${ev.fecha}
                &nbsp;·&nbsp;
                <i class="bx bx-time"></i> ${ev.horario}
                &nbsp;·&nbsp;
                <i class="bx bx-map-pin"></i> ${ev.ubicacion}
                &nbsp;·&nbsp;
                <i class="bx bx-group"></i> ${ev.voluntariosNecesarios || 0} voluntario(s)
              </p>
            </div>
            <div class="ev-pub-acciones">
              <button class="btn-ev-accion btn-ev-ver"
                onclick="verEvento(${ev.id})" title="Ver detalle">
                <i class="bx bx-show"></i>
              </button>
              <button class="btn-ev-accion btn-ev-editar"
                onclick="abrirEditar(${ev.id})" title="Editar evento">
                <i class="bx bx-edit"></i>
              </button>
              ${!_esColaborador ? `
              <button class="btn-ev-accion btn-ev-eliminar"
                onclick="eliminarEvento(${ev.id})" title="Eliminar evento">
                <i class="bx bx-trash"></i>
              </button>` : ''}
            </div>
          </div>
          ${ev.descripcion ? `<p class="ev-pub-desc">${ev.descripcion}</p>` : ''}
          <div class="ev-pub-recursos">
            <span class="ev-pub-recursos-label">
              <i class="bx bx-package"></i> Recursos:
            </span>
            <div class="ev-chips-wrap">${chipsRecursos}</div>
          </div>
          ${ev.publicado ? `<p class="ev-pub-fecha-pub">Publicado el ${ev.publicado}</p>` : ''}
        </div>`;
    }

    const ordenados = [...eventos].reverse();

    if (!dtEventos) {
      dtEventos = new BSPDataTable({
        containerId:  'lista-eventos-publicados',
        data:         ordenados,
        pageSize:     5,
        searchFields: ['titulo', 'fecha', 'horario', 'ubicacion', 'descripcion'],
        filters: [
          { key: 'ubicacion', label: 'Ubicación', type: 'select', options: ubicaciones },
          { key: 'fecha',     label: 'Desde',     type: 'date-from' },
          { key: 'fecha',     label: 'Hasta',     type: 'date-to' },
        ],
        renderRow:    renderCard,
        exportable:   true,
        exportName:   'eventos',
        exportFields: ['titulo', 'fecha', 'horario', 'ubicacion', 'asistentes', 'descripcion', 'publicado'],
        exportLabels: ['Título', 'Fecha', 'Horario', 'Ubicación', 'Asistentes', 'Descripción', 'Publicado'],
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-calendar-x"></i><p>Aún no hay eventos publicados.</p></div>`
      });
      window.__bspDT['lista-eventos-publicados'] = dtEventos;
      dtEventos.init();
    } else {
      dtEventos.refresh(ordenados);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 6. VER DETALLE
  // ════════════════════════════════════════════════════════════════

  window.verEvento = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;

    document.getElementById('modal-ver-titulo').textContent = ev.titulo;

    const chipsRecursos = ev.recursos && ev.recursos.length > 0
      ? ev.recursos.map(r =>
          `<span class="ev-chip-recurso">
             <i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad} ${r.unidad || ''}
           </span>`
        ).join('')
      : '<span class="ev-sin-recursos">Sin recursos asignados</span>';

    document.getElementById('modal-ver-body').innerHTML = `
      <div class="ev-detalle-grid">
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-calendar"></i> Fecha</span>
          <span class="ev-detalle-valor">${ev.fecha}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-time"></i> Horario</span>
          <span class="ev-detalle-valor">${ev.horario}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-map-pin"></i> Ubicación</span>
          <span class="ev-detalle-valor">${ev.ubicacion}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-user"></i> Asistentes</span>
          <span class="ev-detalle-valor">${ev.asistentes || '—'}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-group"></i> Voluntarios necesarios</span>
          <span class="ev-detalle-valor">${ev.voluntariosNecesarios || 0}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-calendar-plus"></i> Publicado</span>
          <span class="ev-detalle-valor">${ev.publicado || '—'}</span>
        </div>
      </div>
      ${ev.descripcion ? `
        <div class="ev-detalle-desc">
          <span class="ev-detalle-label"><i class="bx bx-note"></i> Descripción</span>
          <p>${ev.descripcion}</p>
        </div>` : ''}
      <div class="ev-detalle-recursos">
        <span class="ev-detalle-label"><i class="bx bx-package"></i> Recursos asignados</span>
        <div class="ev-chips-wrap" style="margin-top:0.5rem;">${chipsRecursos}</div>
      </div>`;

    document.getElementById('modal-ver-evento').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.cerrarModalVer = function(e) {
    if (e && e.target !== document.getElementById('modal-ver-evento')) return;
    document.getElementById('modal-ver-evento').style.display = 'none';
    document.body.style.overflow = '';
  };

  // ════════════════════════════════════════════════════════════════
  // 7. EDITAR EVENTO
  // ════════════════════════════════════════════════════════════════

  window.abrirEditar = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;

    document.getElementById('edit-id').value          = ev.id;
    document.getElementById('edit-titulo').value      = ev.titulo;
    document.getElementById('edit-fecha').value       = ev.fecha;
    document.getElementById('edit-ubicacion').value   = ev.ubicacion;
    document.getElementById('edit-asistentes').value  = ev.asistentes !== '—' ? ev.asistentes : '';
    document.getElementById('edit-voluntarios').value = ev.voluntariosNecesarios || 1;
    document.getElementById('edit-descripcion').value = ev.descripcion || '';

    // Parsear horario en dos inputs de tiempo
    const { inicio, fin } = parseHorario(ev.horario);
    document.getElementById('edit-hora-inicio').value = inicio;
    document.getElementById('edit-hora-fin').value    = fin;

    // Cargar recursos del evento en la grilla de edición
    cargarRecursosEdicion(ev.recursos || []);

    // Recargar datalist de sedes en el modal de edición
    cargarSedes();

    document.getElementById('modal-editar-evento').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.guardarEdicion = function(e) {
    e.preventDefault();

    const id       = parseInt(document.getElementById('edit-id').value);
    const titulo   = document.getElementById('edit-titulo')?.value.trim()    || '';
    const fecha    = document.getElementById('edit-fecha')?.value            || '';
    const horaIni  = document.getElementById('edit-hora-inicio')?.value      || '';
    const horaFin  = document.getElementById('edit-hora-fin')?.value         || '';
    const ubicacion = document.getElementById('edit-ubicacion')?.value.trim() || '';
    const voluntarios = parseInt(document.getElementById('edit-voluntarios')?.value) || 0;

    // ── Validación DOM ────────────────────────────────────────────────────
    const RX_INI_LETRA_EDIT = /^[a-zA-ZÀ-ÿñÑ]/;
    _ok('edit-titulo','edit-fecha','edit-hora-inicio','edit-hora-fin','edit-ubicacion','edit-voluntarios');
    let valido = true;

    if (!titulo || titulo.length < 3) {
      _err('edit-titulo', 'El título debe tener al menos 3 caracteres.');           valido = false;
    } else if (!RX_INI_LETRA_EDIT.test(titulo)) {
      _err('edit-titulo', 'El título debe comenzar con una letra.');                valido = false;
    } else if (titulo.length > 150) {
      _err('edit-titulo', 'El título no puede superar 150 caracteres.');            valido = false;
    }
    if (!fecha)    { _err('edit-fecha',  'Selecciona una fecha.');                 valido = false; }
    if (!horaIni)  {
      _err('edit-hora-inicio', 'La hora de inicio es obligatoria.');               valido = false;
    } else if (horaIni < H_MIN || horaIni > H_MAX) {
      _err('edit-hora-inicio', 'Debe estar entre 6:00 AM y 9:00 PM.');            valido = false;
    }
    if (horaFin) {
      if (horaFin < H_MIN || horaFin > H_MAX) {
        _err('edit-hora-fin', 'Debe estar entre 6:00 AM y 9:00 PM.');             valido = false;
      } else if (horaIni && horaFin <= horaIni) {
        _err('edit-hora-fin', 'Debe ser posterior a la hora de inicio.');          valido = false;
      }
    }
    const editAsistentes = document.getElementById('edit-asistentes')?.value;
    if (!ubicacion) { _err('edit-ubicacion', 'La sede / ubicación es obligatoria.'); valido = false; }
    if (editAsistentes !== '' && editAsistentes !== null && parseInt(editAsistentes) < 0) {
      _err('edit-asistentes', 'Las personas esperadas no pueden ser negativas.');    valido = false;
    }
    if (voluntarios < 1) { _err('edit-voluntarios','Mínimo 1 voluntario.');         valido = false; }
    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    // Construir array de recursos desde el modal de edición
    const recursosSeleccionados = Object.entries(seleccionadosEdicion).map(([rid, cantidad]) => {
      const r = (typeof RecursosModel !== 'undefined') ? RecursosModel.getById(parseInt(rid)) : null;
      return {
        recursoId:     parseInt(rid),
        recursoNombre: r ? r.nombre : 'Recurso',
        cantidad,
        unidad:        r ? r.unidad : 'unidades'
      };
    });

    const data = {
      titulo,
      fecha,
      horario:               combinarHorario(horaIni, horaFin),
      ubicacion,
      asistentes:            document.getElementById('edit-asistentes')?.value   || '',
      voluntariosNecesarios: voluntarios,
      descripcion:           document.getElementById('edit-descripcion')?.value  || '',
      recursos:              recursosSeleccionados
    };

    const resultado = EventosModel.actualizar(id, data);

    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    cerrarModalEditar();
    renderEventosPublicados();
    showAlertSuccess(`"${data.titulo}" fue actualizado correctamente.`);
  };

  window.cerrarModalEditar = function(e) {
    if (e && e.target !== document.getElementById('modal-editar-evento')) return;
    document.getElementById('modal-editar-evento').style.display = 'none';
    document.body.style.overflow = '';
  };

  // ════════════════════════════════════════════════════════════════
  // 8. ELIMINAR EVENTO
  // ════════════════════════════════════════════════════════════════

  window.eliminarEvento = function(id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar eventos.'); return; }
    const ev = EventosModel.getById(id);
    if (!ev) return;
    showAlertConfirm(
      'Eliminar evento',
      `¿Eliminar el evento "${ev.titulo}"? Esta acción no se puede deshacer.`,
      function() {
        EventosModel.eliminar(id);
        renderEventosPublicados();
        showAlertSuccess(`"${ev.titulo}" fue eliminado.`);
      }
    );
  };

  // ════════════════════════════════════════════════════════════════
  // SEDE — Selector y autocompletado de ubicación
  // ════════════════════════════════════════════════════════════════

  /** Puebla los datalists de sede/ubicación con las sedes registradas */
  function cargarSedes() {
    const datalistIds = ['ev-sedes-lista', 'edit-sedes-lista'];
    datalistIds.forEach(id => {
      const dl = document.getElementById(id);
      if (!dl) return;
      dl.innerHTML = '';
      if (typeof SedesModel === 'undefined') return;
      SedesModel.getAll().forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.nombre} — ${s.direccion}, ${s.ciudad}`;
        dl.appendChild(opt);
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PLANTILLAS DE EVENTOS — Autocompletar título y horario
  // ════════════════════════════════════════════════════════════════

  /** Aplica una plantilla al formulario de creación */
  window.aplicarPlantilla = function(btnEl, titulo, horaInicio, horaFin) {
    // Quitar estado activo de todos los botones de plantilla
    document.querySelectorAll('.ev-plantilla-btn').forEach(b => b.classList.remove('activa'));
    btnEl.classList.add('activa');

    const tituloInput = document.getElementById('ev-titulo');
    const iniInput    = document.getElementById('ev-hora-inicio');
    const finInput    = document.getElementById('ev-hora-fin');

    if (tituloInput) tituloInput.value = titulo;
    if (iniInput)    iniInput.value    = horaInicio || '';
    if (finInput)    finInput.value    = horaFin    || '';

    actualizarPreview();
  };

  // ── Inicialización ───────────────────────────────────────────────────────
  // Establecer fecha mínima = hoy (no se pueden crear eventos en el pasado)
  const _hoy = new Date().toISOString().split('T')[0];
  const _fechaInput = document.getElementById('ev-fecha');
  if (_fechaInput) _fechaInput.min = _hoy;

  // Limitar longitud máxima en campos de texto
  [['ev-titulo', 150], ['ev-ubicacion', 150], ['ev-asistentes', 50]].forEach(([id, max]) => {
    const el = document.getElementById(id);
    if (el) el.maxLength = max;
  });

  cargarRecursos();
  cargarSedes();
  actualizarContador();
  renderEventosPublicados();

  // ════════════════════════════════════════════════════════════════
  // 9. PREVISUALIZACIÓN EN TIEMPO REAL (solo admin)
  // ════════════════════════════════════════════════════════════════

  window.actualizarPreview = function() {
    const previewCol = document.getElementById('ev-preview-col');
    if (!previewCol) return; // Página sin previsualización (colaborador)

    const titulo      = document.getElementById('ev-titulo')?.value.trim()     || '';
    const fecha       = document.getElementById('ev-fecha')?.value             || '';
    const horaInicio  = document.getElementById('ev-hora-inicio')?.value       || '';
    const horaFin     = document.getElementById('ev-hora-fin')?.value          || '';
    const ubicacion   = document.getElementById('ev-ubicacion')?.value.trim()  || '';
    const asistentes  = document.getElementById('ev-asistentes')?.value.trim() || '';
    const voluntarios = document.getElementById('ev-voluntarios')?.value       || '';
    const descripcion = document.getElementById('ev-descripcion')?.value.trim()|| '';

    const horario  = combinarHorario(horaInicio, horaFin);
    const empty    = document.getElementById('ev-preview-empty');
    const content  = document.getElementById('ev-preview-content');
    const hayDatos = titulo || fecha || horario || ubicacion;

    if (hayDatos) {
      previewCol.classList.add('ev-preview-col--visible');
    } else {
      previewCol.classList.remove('ev-preview-col--visible');
      return;
    }

    empty.style.display   = 'none';
    content.style.display = 'block';

    document.getElementById('prev-ev-titulo').textContent = titulo || 'Sin título';

    if (fecha) {
      const [y, m, d] = fecha.split('-');
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      document.getElementById('prev-ev-fecha').textContent = `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
      document.getElementById('prev-row-fecha').style.display = 'flex';
    } else {
      document.getElementById('prev-row-fecha').style.display = 'none';
    }

    if (horario) {
      document.getElementById('prev-ev-horario').textContent = horario;
      document.getElementById('prev-row-horario').style.display = 'flex';
    } else {
      document.getElementById('prev-row-horario').style.display = 'none';
    }

    if (ubicacion) {
      document.getElementById('prev-ev-ubicacion').textContent = ubicacion;
      document.getElementById('prev-row-ubicacion').style.display = 'flex';
    } else {
      document.getElementById('prev-row-ubicacion').style.display = 'none';
    }

    if (asistentes) {
      document.getElementById('prev-ev-asistentes').textContent = `${asistentes} asistentes esperados`;
      document.getElementById('prev-row-asistentes').style.display = 'flex';
    } else {
      document.getElementById('prev-row-asistentes').style.display = 'none';
    }

    if (voluntarios && parseInt(voluntarios) > 0) {
      document.getElementById('prev-ev-voluntarios').textContent = `${voluntarios} voluntario(s) necesario(s)`;
      document.getElementById('prev-row-voluntarios').style.display = 'flex';
    } else {
      document.getElementById('prev-row-voluntarios').style.display = 'none';
    }

    const descEl = document.getElementById('prev-ev-desc');
    if (descripcion) {
      descEl.textContent   = descripcion;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  };

  actualizarPreview();
});
