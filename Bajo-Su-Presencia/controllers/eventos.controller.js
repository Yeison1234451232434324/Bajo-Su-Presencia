/**
 * ============================================================
 * CONTROLADOR: eventos.controller.js  (Supabase)
 * ============================================================
 * Publicación y gestión de eventos. Async (Supabase).
 * Depende de: EventosModel, RecursosModel, UsuariosModel, SedesModel.
 *
 * Notas de migración:
 *   - IDs son UUID (string): los onclick van entre comillas, sin parseInt.
 *   - Recursos y especialistas se cachean al cargar para que los onchange
 *     (toggle/cantidad) no necesiten ser async.
 *   - Especialistas se persisten en voluntarios_eventos (rol_en_evento = especialidad).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  const form             = document.getElementById('form-evento');
  const recursosGrid     = document.getElementById('recursos-grid');
  const sinRecursos      = document.getElementById('sin-recursos-msg');
  const listaEventos     = document.getElementById('lista-eventos-publicados');
  const contadorRecursos = document.getElementById('contador-recursos');

  const _rolActual = (JSON.parse(localStorage.getItem('usuarioLogueado') || '{}')).rol || '';
  const _esColaborador = _rolActual === 'Colaborador';

  const seleccionados        = {};   // creación: { [recursoId]: cantidad }
  const seleccionadosEdicion = {};   // edición
  const especialistasSel        = {}; // { [usuarioId]: {usuarioId, nombre, especialidad} }
  const especialistasSelEdicion = {};

  // Cachés (poblados al cargar; permiten que los onchange sean síncronos)
  let _recursosCache     = [];
  let _especialistasCache = [];

  const H_MIN = '06:00', H_MAX = '21:00';

  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  ['ev-voluntarios', 'ev-asistentes'].forEach(id =>
    BSPVal.blockNumericChars(document.getElementById(id))
  );

  // ── Restricción dinámica hora de fin ────────────────────────────────────
  function _sincronizarHoraFin(idInicio, idFin) {
    const inpInicio = document.getElementById(idInicio);
    const inpFin    = document.getElementById(idFin);
    if (!inpInicio || !inpFin) return;
    inpInicio.addEventListener('change', () => {
      const valorInicio = inpInicio.value;
      if (valorInicio) {
        const [h, m] = valorInicio.split(':').map(Number);
        const totalMin = h * 60 + m + 1;
        const hNew = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mNew = String(totalMin % 60).padStart(2, '0');
        const nuevoMin = `${hNew}:${mNew}`;
        inpFin.min = nuevoMin <= H_MAX ? nuevoMin : H_MAX;
      } else {
        inpFin.min = H_MIN;
      }
      if (inpFin.value && valorInicio && inpFin.value <= valorInicio) {
        inpFin.value = '';
        _err(idFin, 'La hora de fin debe ser posterior a la hora de inicio.');
      } else {
        _ok(idFin);
      }
    });
  }
  _sincronizarHoraFin('ev-hora-inicio',   'ev-hora-fin');
  _sincronizarHoraFin('edit-hora-inicio', 'edit-hora-fin');

  const ICON_MAP = {
    'Mobiliario':'bx-chair','Audio y Video':'bx-microphone','Iluminación':'bx-bulb',
    'Papelería':'bx-file','Cocina':'bx-bowl-hot','Otros':'bx-package'
  };

  function combinarHorario(inicio, fin) {
    if (!inicio && !fin) return '';
    if (!fin)    return inicio;
    if (!inicio) return fin;
    return `${inicio} - ${fin}`;
  }

  function convertTo24h(str) {
    if (!str) return '';
    str = str.trim();
    if (/^\d{1,2}:\d{2}$/.test(str)) { const [h, m] = str.split(':'); return `${h.padStart(2,'0')}:${m}`; }
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1]); const min = match[2], mer = match[3].toUpperCase();
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${min}`;
    }
    return str;
  }

  function parseHorario(horario) {
    if (!horario) return { inicio: '', fin: '' };
    const parts = horario.split(' - ');
    if (parts.length >= 2) return { inicio: convertTo24h(parts[0].trim()), fin: convertTo24h(parts[1].trim()) };
    return { inicio: convertTo24h(parts[0].trim()), fin: '' };
  }

  // ════════════════════════════════════════════════════════════════
  // 1. RECURSOS DEL INVENTARIO (creación)
  // ════════════════════════════════════════════════════════════════
  async function cargarRecursos() {
    if (!recursosGrid) return;
    _recursosCache = (typeof RecursosModel !== 'undefined') ? await RecursosModel.getAll() : [];
    const todos = _recursosCache.filter(r => r.disponible && r.cantidad > 0);

    recursosGrid.innerHTML = '';
    if (todos.length === 0) { if (sinRecursos) sinRecursos.style.display = 'block'; return; }
    if (sinRecursos) sinRecursos.style.display = 'none';

    todos.forEach(r => {
      const icono = ICON_MAP[r.categoria] || 'bx-package';
      const card  = document.createElement('div');
      card.className = 'ev-recurso-card';
      card.id = `ev-rec-${r.id}`;
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="ev-rec-check">
          <input type="checkbox" id="chk-rec-${r.id}" onchange="toggleRecursoEvento('${r.id}')" />
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
              onchange="actualizarCantidad('${r.id}', this.value, ${r.cantidad})"
              oninput="actualizarCantidad('${r.id}', this.value, ${r.cantidad})" />
            <span class="ev-qty-max">máx. ${r.cantidad}</span>
          </div>
        </div>`;
      recursosGrid.appendChild(card);
    });
  }

  window.toggleRecursoEvento = function(id) {
    const card = document.getElementById(`ev-rec-${id}`);
    const chk  = document.getElementById(`chk-rec-${id}`);
    const qtyDiv = document.getElementById(`ev-qty-${id}`);
    const qtyInput = document.getElementById(`qty-rec-${id}`);
    if (chk.checked) {
      card.classList.add('ev-rec-selected'); qtyDiv.style.display = 'flex';
      seleccionados[id] = parseInt(qtyInput.value) || 1;
    } else {
      card.classList.remove('ev-rec-selected'); qtyDiv.style.display = 'none';
      delete seleccionados[id];
    }
    actualizarContador();
  };

  window.actualizarCantidad = function(id, valor, max) {
    let cant = parseInt(valor) || 1;
    if (cant < 1) cant = 1; if (cant > max) cant = max;
    const input = document.getElementById(`qty-rec-${id}`);
    if (input) input.value = cant;
    seleccionados[id] = cant;
  };

  function actualizarContador() {
    if (!contadorRecursos) return;
    const total = Object.keys(seleccionados).length;
    contadorRecursos.textContent = total > 0 ? `${total} recurso(s) seleccionado(s)` : 'Ningún recurso seleccionado (opcional)';
    contadorRecursos.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 3. RECURSOS DEL MODAL DE EDICIÓN
  // ════════════════════════════════════════════════════════════════
  async function cargarRecursosEdicion(eventoRecursos) {
    const grid   = document.getElementById('edit-recursos-grid');
    const sinMsg = document.getElementById('edit-sin-recursos-msg');
    if (!grid) return;

    Object.keys(seleccionadosEdicion).forEach(k => delete seleccionadosEdicion[k]);
    _recursosCache = (typeof RecursosModel !== 'undefined') ? await RecursosModel.getAll() : [];
    const todos = _recursosCache.filter(r => r.disponible && r.cantidad > 0);

    grid.innerHTML = '';
    if (todos.length === 0) { if (sinMsg) sinMsg.style.display = 'block'; actualizarContadorEdicion(); return; }
    if (sinMsg) sinMsg.style.display = 'none';

    const asignados = {};
    (eventoRecursos || []).forEach(r => { asignados[r.recursoId] = r.cantidad; });

    todos.forEach(r => {
      const icono = ICON_MAP[r.categoria] || 'bx-package';
      const cantPre = asignados[r.id];
      const seleccionado = cantPre !== undefined;
      if (seleccionado) seleccionadosEdicion[r.id] = cantPre;

      const card = document.createElement('div');
      card.className = `ev-recurso-card${seleccionado ? ' ev-rec-selected' : ''}`;
      card.id = `edit-ev-rec-${r.id}`;
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="ev-rec-check">
          <input type="checkbox" id="edit-chk-rec-${r.id}" ${seleccionado ? 'checked' : ''}
            onchange="toggleRecursoEdicion('${r.id}')" />
        </div>
        <div class="ev-rec-body">
          <div class="ev-rec-header">
            <i class="bx ${icono} ev-rec-icon"></i>
            <label for="edit-chk-rec-${r.id}" class="ev-rec-nombre">${r.nombre}</label>
            <span class="badge badge-green ev-rec-stock">${r.cantidad} ${r.unidad}</span>
          </div>
          <p class="ev-rec-cat">${r.categoria}</p>
          <div class="ev-rec-qty" id="edit-ev-qty-${r.id}" style="display:${seleccionado ? 'flex' : 'none'};">
            <label for="edit-qty-rec-${r.id}">Cantidad a usar:</label>
            <input type="number" id="edit-qty-rec-${r.id}" class="ev-qty-input"
              min="1" max="${r.cantidad}" value="${seleccionado ? cantPre : 1}"
              onchange="actualizarCantidadEdicion('${r.id}', this.value, ${r.cantidad})"
              oninput="actualizarCantidadEdicion('${r.id}', this.value, ${r.cantidad})" />
            <span class="ev-qty-max">máx. ${r.cantidad}</span>
          </div>
        </div>`;
      grid.appendChild(card);
    });
    actualizarContadorEdicion();
  }

  window.toggleRecursoEdicion = function(id) {
    const card = document.getElementById(`edit-ev-rec-${id}`);
    const chk  = document.getElementById(`edit-chk-rec-${id}`);
    const qtyDiv = document.getElementById(`edit-ev-qty-${id}`);
    const qtyInput = document.getElementById(`edit-qty-rec-${id}`);
    if (chk.checked) {
      card.classList.add('ev-rec-selected'); qtyDiv.style.display = 'flex';
      seleccionadosEdicion[id] = parseInt(qtyInput.value) || 1;
    } else {
      card.classList.remove('ev-rec-selected'); qtyDiv.style.display = 'none';
      delete seleccionadosEdicion[id];
    }
    actualizarContadorEdicion();
  };

  window.actualizarCantidadEdicion = function(id, valor, max) {
    let cant = parseInt(valor) || 1;
    if (cant < 1) cant = 1; if (cant > max) cant = max;
    const input = document.getElementById(`edit-qty-rec-${id}`);
    if (input) input.value = cant;
    seleccionadosEdicion[id] = cant;
  };

  function actualizarContadorEdicion() {
    const counter = document.getElementById('edit-contador-recursos');
    if (!counter) return;
    const total = Object.keys(seleccionadosEdicion).length;
    counter.textContent = total > 0 ? `${total} recurso(s) seleccionado(s)` : 'Ningún recurso seleccionado (opcional)';
    counter.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 3b. ESPECIALISTAS
  // ════════════════════════════════════════════════════════════════
  async function _cargarEspecialistasCache() {
    _especialistasCache = (typeof UsuariosModel !== 'undefined' && UsuariosModel.getEspecialistas)
      ? await UsuariosModel.getEspecialistas() : [];
    return _especialistasCache;
  }

  function _cardEspecialista(u, { prefix, checked }) {
    const card = document.createElement('div');
    card.className = `ev-recurso-card${checked ? ' ev-rec-selected' : ''}`;
    card.id = `${prefix}-esp-${u.id}`;
    card.dataset.id = u.id;
    const toggleFn = prefix === 'edit' ? 'toggleEspecialistaEdicion' : 'toggleEspecialista';
    const detalle = u.ocupacion || u.rol || '';
    card.innerHTML = `
      <div class="ev-rec-check">
        <input type="checkbox" id="${prefix}-chk-esp-${u.id}" ${checked ? 'checked' : ''}
          onchange="${toggleFn}('${u.id}')" />
      </div>
      <div class="ev-rec-body">
        <div class="ev-rec-header">
          <i class="bx bx-user ev-rec-icon"></i>
          <label for="${prefix}-chk-esp-${u.id}" class="ev-rec-nombre">${u.nombre}</label>
          <span class="badge ev-badge-especialidad ev-rec-stock">${u.especialidad}</span>
        </div>
        ${detalle ? `<p class="ev-rec-cat">${detalle}</p>` : ''}
      </div>`;
    return card;
  }

  async function cargarEspecialistas() {
    const grid = document.getElementById('especialistas-grid');
    const sinMsg = document.getElementById('sin-especialistas-msg');
    if (!grid) return;
    Object.keys(especialistasSel).forEach(k => delete especialistasSel[k]);
    const todos = await _cargarEspecialistasCache();
    grid.innerHTML = '';
    if (todos.length === 0) { if (sinMsg) sinMsg.style.display = 'block'; actualizarContadorEspecialistas(); return; }
    if (sinMsg) sinMsg.style.display = 'none';
    todos.forEach(u => grid.appendChild(_cardEspecialista(u, { prefix: 'ev', checked: false })));
    actualizarContadorEspecialistas();
  }

  async function cargarEspecialistasEdicion(eventoEspecialistas) {
    const grid = document.getElementById('edit-especialistas-grid');
    const sinMsg = document.getElementById('edit-sin-especialistas-msg');
    if (!grid) return;
    Object.keys(especialistasSelEdicion).forEach(k => delete especialistasSelEdicion[k]);
    const todos = await _cargarEspecialistasCache();
    grid.innerHTML = '';
    if (todos.length === 0) { if (sinMsg) sinMsg.style.display = 'block'; actualizarContadorEspecialistasEdicion(); return; }
    if (sinMsg) sinMsg.style.display = 'none';

    const asignados = new Set((eventoEspecialistas || []).map(e => e.usuarioId));
    todos.forEach(u => {
      const checked = asignados.has(u.id);
      if (checked) especialistasSelEdicion[u.id] = { usuarioId: u.id, nombre: u.nombre, especialidad: u.especialidad };
      grid.appendChild(_cardEspecialista(u, { prefix: 'edit', checked }));
    });
    actualizarContadorEspecialistasEdicion();
  }

  window.toggleEspecialista = function(id) {
    const u = _especialistasCache.find(x => String(x.id) === String(id));
    const card = document.getElementById(`ev-esp-${id}`);
    const chk  = document.getElementById(`ev-chk-esp-${id}`);
    if (chk.checked && u) {
      card.classList.add('ev-rec-selected');
      especialistasSel[id] = { usuarioId: u.id, nombre: u.nombre, especialidad: u.especialidad };
    } else {
      card.classList.remove('ev-rec-selected');
      delete especialistasSel[id];
    }
    actualizarContadorEspecialistas();
  };

  window.toggleEspecialistaEdicion = function(id) {
    const u = _especialistasCache.find(x => String(x.id) === String(id));
    const card = document.getElementById(`edit-esp-${id}`);
    const chk  = document.getElementById(`edit-chk-esp-${id}`);
    if (chk.checked && u) {
      card.classList.add('ev-rec-selected');
      especialistasSelEdicion[id] = { usuarioId: u.id, nombre: u.nombre, especialidad: u.especialidad };
    } else {
      card.classList.remove('ev-rec-selected');
      delete especialistasSelEdicion[id];
    }
    actualizarContadorEspecialistasEdicion();
  };

  function actualizarContadorEspecialistas() {
    const c = document.getElementById('contador-especialistas');
    if (!c) return;
    const total = Object.keys(especialistasSel).length;
    c.textContent = total > 0 ? `${total} especialista(s) seleccionado(s)` : 'Ningún especialista seleccionado (opcional)';
    c.style.color = total > 0 ? '#059669' : '#9ca3af';
  }
  function actualizarContadorEspecialistasEdicion() {
    const c = document.getElementById('edit-contador-especialistas');
    if (!c) return;
    const total = Object.keys(especialistasSelEdicion).length;
    c.textContent = total > 0 ? `${total} especialista(s) seleccionado(s)` : 'Ningún especialista seleccionado (opcional)';
    c.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 4. PUBLICAR EVENTO
  // ════════════════════════════════════════════════════════════════
  window.submitEvent = async function(e) {
    e.preventDefault();

    const titulo        = BSPVal.cleanText(document.getElementById('ev-titulo')?.value || '');
    const fechaVal      = document.getElementById('ev-fecha')?.value || '';
    const horaInicio    = document.getElementById('ev-hora-inicio')?.value || '';
    const horaFin       = document.getElementById('ev-hora-fin')?.value || '';
    const ubicacion     = BSPVal.cleanText(document.getElementById('ev-ubicacion')?.value || '');
    const descripcion   = BSPVal.cleanText(document.getElementById('ev-descripcion')?.value || '');
    const voluntariosRaw= document.getElementById('ev-voluntarios')?.value || '';
    const asistentesRaw = document.getElementById('ev-asistentes')?.value || '';

    _ok('ev-titulo','ev-fecha','ev-hora-inicio','ev-hora-fin','ev-ubicacion','ev-voluntarios','ev-asistentes','ev-descripcion');
    let valido = true, err;
    const hoy = new Date().toISOString().split('T')[0];

    err = BSPVal.txt(titulo, { min: 3, max: 150, label: 'El título', iniciaLetra: true });
    if (err) { _err('ev-titulo', err); valido = false; }

    const estadoCrear = document.getElementById('ev-estado')?.value || 'Publicado';
    err = BSPVal.fecha(fechaVal, estadoCrear === 'Publicado' ? { minDate: hoy, label: 'La fecha del evento' } : { label: 'La fecha del evento' });
    if (err) { _err('ev-fecha', err); valido = false; }

    if (!horaInicio) { _err('ev-hora-inicio', 'La hora de inicio es obligatoria.'); valido = false; }
    else if (horaInicio < H_MIN || horaInicio > H_MAX) { _err('ev-hora-inicio', 'La hora debe estar entre 6:00 AM (06:00) y 9:00 PM (21:00).'); valido = false; }

    if (horaFin) {
      if (horaFin < H_MIN || horaFin > H_MAX) { _err('ev-hora-fin', 'La hora debe estar entre 6:00 AM (06:00) y 9:00 PM (21:00).'); valido = false; }
      else if (horaInicio && horaFin <= horaInicio) { _err('ev-hora-fin', 'La hora de fin debe ser posterior a la hora de inicio.'); valido = false; }
    }

    err = BSPVal.txt(ubicacion, { min: 2, max: 200, label: 'La sede / ubicación' });
    if (err) { _err('ev-ubicacion', err); valido = false; }

    err = BSPVal.num(voluntariosRaw, { min: 1, max: 9999, entero: true, label: 'El número de voluntarios' });
    if (err) { _err('ev-voluntarios', err); valido = false; }

    if (asistentesRaw.trim() !== '') {
      err = BSPVal.num(asistentesRaw, { min: 0, max: 999999, entero: true, label: 'Las personas esperadas' });
      if (err) { _err('ev-asistentes', err); valido = false; }
    }
    if (descripcion.length > 0) {
      err = BSPVal.txt(descripcion, { min: 5, max: 1000, label: 'La descripción' });
      if (err) { _err('ev-descripcion', err); valido = false; }
    }
    if (!valido) return;

    const recursosSeleccionados = Object.entries(seleccionados).map(([id, cantidad]) => {
      const r = _recursosCache.find(x => String(x.id) === String(id));
      return { recursoId: id, recursoNombre: r ? r.nombre : 'Recurso', cantidad: parseInt(cantidad, 10), unidad: r ? r.unidad : 'unidades' };
    });

    const data = {
      titulo, fecha: fechaVal, horario: combinarHorario(horaInicio, horaFin), ubicacion,
      asistentes: asistentesRaw.trim() !== '' ? parseInt(asistentesRaw, 10) : '',
      voluntariosNecesarios: parseInt(voluntariosRaw, 10), descripcion,
      estado: estadoCrear, recursos: recursosSeleccionados,
      especialistas: Object.values(especialistasSel)
    };

    let resultado;
    try { resultado = await EventosModel.publicar(data); }
    catch (ex) { showAlertError('Error de conexión. Intenta de nuevo.'); return; }
    if (!resultado.ok) { showAlertError(resultado.error); return; }

    e.target.reset();
    Object.keys(seleccionados).forEach(k => delete seleccionados[k]);
    Object.keys(especialistasSel).forEach(k => delete especialistasSel[k]);
    document.querySelectorAll('.ev-recurso-card').forEach(c => c.classList.remove('ev-rec-selected'));
    document.querySelectorAll('[id^="ev-qty-"]').forEach(d => d.style.display = 'none');
    document.querySelectorAll('[id^="chk-rec-"]').forEach(c => c.checked = false);
    document.querySelectorAll('[id^="ev-chk-esp-"]').forEach(c => c.checked = false);
    actualizarContador(); actualizarContadorEspecialistas(); actualizarPreview();
    await renderEventosPublicados();

    const nRec = recursosSeleccionados.length;
    showAlertSuccess(`"${data.titulo}" fue publicado${nRec > 0 ? ` con ${nRec} recurso(s) asignado(s)` : ''}.`);
  };

  // ════════════════════════════════════════════════════════════════
  // 5. HISTORIAL DE EVENTOS
  // ════════════════════════════════════════════════════════════════
  const ESTADO_CLASE = { 'Publicado':'ev-badge--publicado','En ejecución':'ev-badge--ejecucion','Finalizado':'ev-badge--finalizado' };
  function badgeEstado(estado) {
    const est = estado || 'Publicado';
    return `<span class="ev-badge ${ESTADO_CLASE[est] || 'ev-badge--publicado'}">${est}</span>`;
  }

  let dtEventos = null;
  async function renderEventosPublicados() {
    if (!listaEventos) return;
    const eventos = await EventosModel.getAll();
    const ubicaciones = [...new Set(eventos.map(e => e.ubicacion).filter(Boolean))].sort();

    function renderCard(ev) {
      const chipsRecursos = ev.recursos && ev.recursos.length > 0
        ? ev.recursos.map(r => `<span class="ev-chip-recurso"><i class="bx bx-package"></i> ${esc(r.recursoNombre)} × ${esc(r.cantidad)}</span>`).join('')
        : '<span class="ev-sin-recursos">Sin recursos asignados</span>';
      return `
        <div class="ev-publicado-card" id="ev-card-${ev.id}">
          <div class="ev-pub-header">
            <div class="ev-pub-header-info">
              <div class="ev-pub-titulo-row"><h4 class="ev-pub-titulo">${esc(ev.titulo)}</h4>${badgeEstado(ev.estado)}</div>
              <p class="ev-pub-meta">
                <i class="bx bx-calendar"></i> ${esc(ev.fecha)} &nbsp;·&nbsp;
                <i class="bx bx-time"></i> ${esc(ev.horario)} &nbsp;·&nbsp;
                <i class="bx bx-map-pin"></i> ${esc(ev.ubicacion)} &nbsp;·&nbsp;
                <i class="bx bx-group"></i> ${esc(ev.voluntariosNecesarios || 0)} voluntario(s)
              </p>
            </div>
            <div class="ev-pub-acciones">
              <button class="btn-ev-accion btn-ev-ver" onclick="verEvento('${ev.id}')" title="Ver detalle"><i class="bx bx-show"></i></button>
              <button class="btn-ev-accion btn-ev-editar" onclick="abrirEditar('${ev.id}')" title="Editar evento"><i class="bx bx-edit"></i></button>
              ${!_esColaborador ? `<button class="btn-ev-accion btn-ev-eliminar" onclick="eliminarEvento('${ev.id}')" title="Eliminar evento"><i class="bx bx-trash"></i></button>` : ''}
            </div>
          </div>
          ${ev.descripcion ? `<p class="ev-pub-desc">${esc(ev.descripcion)}</p>` : ''}
          <div class="ev-pub-recursos">
            <span class="ev-pub-recursos-label"><i class="bx bx-package"></i> Recursos:</span>
            <div class="ev-chips-wrap">${chipsRecursos}</div>
          </div>
          ${ev.especialistas && ev.especialistas.length > 0 ? `
          <div class="ev-pub-recursos">
            <span class="ev-pub-recursos-label"><i class="bx bx-user-voice"></i> Especialistas:</span>
            <div class="ev-chips-wrap">${ev.especialistas.map(e => `<span class="ev-chip-recurso"><i class="bx bx-user"></i> ${esc(e.nombre)} — ${esc(e.especialidad)}</span>`).join('')}</div>
          </div>` : ''}
          ${ev.publicado ? `<p class="ev-pub-fecha-pub">Publicado el ${esc(ev.publicado)}</p>` : ''}
        </div>`;
    }

    const ordenados = [...eventos].reverse();
    if (!dtEventos) {
      dtEventos = new BSPDataTable({
        containerId: 'lista-eventos-publicados', data: ordenados, pageSize: 5,
        searchFields: ['titulo','fecha','horario','ubicacion','descripcion','estado'],
        filters: [
          { key:'estado', label:'Estado', type:'select', options: EventosModel.ESTADOS },
          { key:'ubicacion', label:'Ubicación', type:'select', options: ubicaciones },
          { key:'fecha', label:'Desde', type:'date-from' },
          { key:'fecha', label:'Hasta', type:'date-to' },
        ],
        renderRow: renderCard, exportable: true, exportName: 'eventos',
        exportFields: ['titulo','fecha','horario','ubicacion','estado','asistentes','descripcion','publicado'],
        exportLabels: ['Título','Fecha','Horario','Ubicación','Estado','Asistentes','Descripción','Publicado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-calendar-x"></i><p>Aún no hay eventos publicados.</p></div>`
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
  window.verEvento = async function(id) {
    const ev = await EventosModel.getById(id);
    if (!ev) return;
    document.getElementById('modal-ver-titulo').innerHTML = `${esc(ev.titulo)} ${badgeEstado(ev.estado)}`;
    const chipsRecursos = ev.recursos && ev.recursos.length > 0
      ? ev.recursos.map(r => `<span class="ev-chip-recurso"><i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad} ${r.unidad || ''}</span>`).join('')
      : '<span class="ev-sin-recursos">Sin recursos asignados</span>';
    document.getElementById('modal-ver-body').innerHTML = `
      <div class="ev-detalle-grid">
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-calendar"></i> Fecha</span><span class="ev-detalle-valor">${ev.fecha}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-time"></i> Horario</span><span class="ev-detalle-valor">${ev.horario}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-map-pin"></i> Ubicación</span><span class="ev-detalle-valor">${ev.ubicacion}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-user"></i> Asistentes</span><span class="ev-detalle-valor">${ev.asistentes || '—'}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-group"></i> Voluntarios necesarios</span><span class="ev-detalle-valor">${ev.voluntariosNecesarios || 0}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-calendar-plus"></i> Publicado</span><span class="ev-detalle-valor">${ev.publicado || '—'}</span></div>
        <div class="ev-detalle-item"><span class="ev-detalle-label"><i class="bx bx-flag"></i> Estado</span><span class="ev-detalle-valor">${badgeEstado(ev.estado)}</span></div>
      </div>
      ${ev.descripcion ? `<div class="ev-detalle-desc"><span class="ev-detalle-label"><i class="bx bx-note"></i> Descripción</span><p>${ev.descripcion}</p></div>` : ''}
      <div class="ev-detalle-recursos"><span class="ev-detalle-label"><i class="bx bx-package"></i> Recursos asignados</span><div class="ev-chips-wrap" style="margin-top:0.5rem;">${chipsRecursos}</div></div>
      <div class="ev-detalle-recursos"><span class="ev-detalle-label"><i class="bx bx-user-voice"></i> Especialistas requeridos</span><div class="ev-chips-wrap" style="margin-top:0.5rem;">${
        ev.especialistas && ev.especialistas.length > 0
          ? ev.especialistas.map(e => `<span class="ev-chip-recurso"><i class="bx bx-user"></i> ${e.nombre} — ${e.especialidad}</span>`).join('')
          : '<span class="ev-sin-recursos">Sin especialistas asignados</span>'
      }</div></div>`;
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
  window.abrirEditar = async function(id) {
    const ev = await EventosModel.getById(id);
    if (!ev) return;
    document.getElementById('edit-id').value     = ev.id;
    document.getElementById('edit-titulo').value = ev.titulo;
    const _editFecha = document.getElementById('edit-fecha');
    if ((ev.estado || 'Publicado') === 'Publicado') _editFecha.min = new Date().toISOString().split('T')[0];
    else _editFecha.removeAttribute('min');
    _editFecha.value = ev.fecha;
    document.getElementById('edit-ubicacion').value   = ev.ubicacion;
    document.getElementById('edit-asistentes').value  = ev.asistentes !== '—' ? ev.asistentes : '';
    document.getElementById('edit-voluntarios').value = ev.voluntariosNecesarios || 1;
    document.getElementById('edit-descripcion').value = ev.descripcion || '';
    const _editEstado = document.getElementById('edit-estado');
    if (_editEstado) _editEstado.value = ev.estado || 'Publicado';

    const { inicio, fin } = parseHorario(ev.horario);
    document.getElementById('edit-hora-inicio').value = inicio;
    document.getElementById('edit-hora-fin').value    = fin;

    await cargarRecursosEdicion(ev.recursos || []);
    await cargarEspecialistasEdicion(ev.especialistas || []);
    await cargarSedes();

    document.getElementById('modal-editar-evento').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.guardarEdicion = async function(e) {
    e.preventDefault();
    const id        = document.getElementById('edit-id').value;   // UUID (string)
    const titulo    = document.getElementById('edit-titulo')?.value.trim() || '';
    const fecha     = document.getElementById('edit-fecha')?.value || '';
    const horaIni   = document.getElementById('edit-hora-inicio')?.value || '';
    const horaFin   = document.getElementById('edit-hora-fin')?.value || '';
    const ubicacion = document.getElementById('edit-ubicacion')?.value.trim() || '';
    const voluntarios = parseInt(document.getElementById('edit-voluntarios')?.value) || 0;

    const RX_INI_LETRA_EDIT = /^[a-zA-ZÀ-ÿñÑ]/;
    _ok('edit-titulo','edit-fecha','edit-hora-inicio','edit-hora-fin','edit-ubicacion','edit-voluntarios');
    let valido = true;

    if (!titulo || titulo.length < 3) { _err('edit-titulo', 'El título debe tener al menos 3 caracteres.'); valido = false; }
    else if (!RX_INI_LETRA_EDIT.test(titulo)) { _err('edit-titulo', 'El título debe comenzar con una letra.'); valido = false; }
    else if (titulo.length > 150) { _err('edit-titulo', 'El título no puede superar 150 caracteres.'); valido = false; }

    const hoy = new Date().toISOString().split('T')[0];
    const estadoEditar = document.getElementById('edit-estado')?.value || 'Publicado';
    const errFecha = BSPVal.fecha(fecha, estadoEditar === 'Publicado' ? { minDate: hoy, label: 'La fecha del evento' } : { label: 'La fecha del evento' });
    if (errFecha) { _err('edit-fecha', errFecha); valido = false; }
    if (!horaIni) { _err('edit-hora-inicio', 'La hora de inicio es obligatoria.'); valido = false; }
    else if (horaIni < H_MIN || horaIni > H_MAX) { _err('edit-hora-inicio', 'Debe estar entre 6:00 AM y 9:00 PM.'); valido = false; }
    if (horaFin) {
      if (horaFin < H_MIN || horaFin > H_MAX) { _err('edit-hora-fin', 'Debe estar entre 6:00 AM y 9:00 PM.'); valido = false; }
      else if (horaIni && horaFin <= horaIni) { _err('edit-hora-fin', 'Debe ser posterior a la hora de inicio.'); valido = false; }
    }
    const editAsistentes = document.getElementById('edit-asistentes')?.value;
    if (!ubicacion) { _err('edit-ubicacion', 'La sede / ubicación es obligatoria.'); valido = false; }
    if (editAsistentes !== '' && editAsistentes !== null && parseInt(editAsistentes) < 0) { _err('edit-asistentes', 'Las personas esperadas no pueden ser negativas.'); valido = false; }
    if (voluntarios < 1) { _err('edit-voluntarios','Mínimo 1 voluntario.'); valido = false; }
    if (!valido) return;

    const recursosSeleccionados = Object.entries(seleccionadosEdicion).map(([rid, cantidad]) => {
      const r = _recursosCache.find(x => String(x.id) === String(rid));
      return { recursoId: rid, recursoNombre: r ? r.nombre : 'Recurso', cantidad, unidad: r ? r.unidad : 'unidades' };
    });

    const data = {
      titulo, fecha, horario: combinarHorario(horaIni, horaFin), ubicacion,
      asistentes: document.getElementById('edit-asistentes')?.value || '',
      voluntariosNecesarios: voluntarios,
      descripcion: document.getElementById('edit-descripcion')?.value || '',
      estado: estadoEditar,
      recursos: recursosSeleccionados,
      especialistas: Object.values(especialistasSelEdicion)
    };

    let resultado;
    try { resultado = await EventosModel.actualizar(id, data); }
    catch (ex) { showAlertError('Error de conexión. Intenta de nuevo.'); return; }
    if (!resultado.ok) { showAlertError(resultado.error); return; }

    cerrarModalEditar();
    await renderEventosPublicados();
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
  window.eliminarEvento = async function(id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar eventos.'); return; }
    const ev = await EventosModel.getById(id);
    if (!ev) return;
    showAlertConfirm(
      'Eliminar evento',
      `¿Eliminar el evento "${ev.titulo}"? Esta acción no se puede deshacer.`,
      async function() {
        const res = await EventosModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await renderEventosPublicados();
        showAlertSuccess(`"${ev.titulo}" fue eliminado.`);
      }
    );
  };

  // ════════════════════════════════════════════════════════════════
  // SEDE — datalist de ubicación
  // ════════════════════════════════════════════════════════════════
  async function cargarSedes() {
    const datalistIds = ['ev-sedes-lista', 'edit-sedes-lista'];
    if (typeof SedesModel === 'undefined') return;
    const sedes = await SedesModel.getAll();
    datalistIds.forEach(id => {
      const dl = document.getElementById(id);
      if (!dl) return;
      dl.innerHTML = '';
      sedes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.nombre} — ${s.direccion}, ${s.ciudad}`;
        dl.appendChild(opt);
      });
    });
  }

  // ── Plantillas ───────────────────────────────────────────────────────────
  window.aplicarPlantilla = function(btnEl, titulo, horaInicio, horaFin) {
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
  const _hoy = new Date().toISOString().split('T')[0];
  const _fechaInput = document.getElementById('ev-fecha');
  if (_fechaInput) _fechaInput.min = _hoy;

  function _sincronizarMinFecha(idEstado, idFecha) {
    const selEstado = document.getElementById(idEstado);
    const inpFecha  = document.getElementById(idFecha);
    if (!selEstado || !inpFecha) return;
    selEstado.addEventListener('change', () => {
      if (selEstado.value === 'Publicado') inpFecha.min = new Date().toISOString().split('T')[0];
      else inpFecha.removeAttribute('min');
    });
  }
  _sincronizarMinFecha('ev-estado',   'ev-fecha');
  _sincronizarMinFecha('edit-estado', 'edit-fecha');

  [['ev-titulo', 150], ['ev-ubicacion', 150], ['ev-asistentes', 50]].forEach(([id, max]) => {
    const el = document.getElementById(id); if (el) el.maxLength = max;
  });

  (async () => {
    await cargarRecursos();
    await cargarEspecialistas();
    await cargarSedes();
    actualizarContador();
    actualizarContadorEspecialistas();
    await renderEventosPublicados();
  })();

  // ════════════════════════════════════════════════════════════════
  // 9. PREVISUALIZACIÓN EN TIEMPO REAL
  // ════════════════════════════════════════════════════════════════
  window.actualizarPreview = function() {
    const previewCol = document.getElementById('ev-preview-col');
    if (!previewCol) return;
    const titulo      = document.getElementById('ev-titulo')?.value.trim() || '';
    const fecha       = document.getElementById('ev-fecha')?.value || '';
    const horaInicio  = document.getElementById('ev-hora-inicio')?.value || '';
    const horaFin     = document.getElementById('ev-hora-fin')?.value || '';
    const ubicacion   = document.getElementById('ev-ubicacion')?.value.trim() || '';
    const asistentes  = document.getElementById('ev-asistentes')?.value.trim() || '';
    const voluntarios = document.getElementById('ev-voluntarios')?.value || '';
    const descripcion = document.getElementById('ev-descripcion')?.value.trim() || '';

    const horario  = combinarHorario(horaInicio, horaFin);
    const empty    = document.getElementById('ev-preview-empty');
    const content  = document.getElementById('ev-preview-content');
    const hayDatos = titulo || fecha || horario || ubicacion;

    if (hayDatos) previewCol.classList.add('ev-preview-col--visible');
    else { previewCol.classList.remove('ev-preview-col--visible'); return; }

    empty.style.display = 'none'; content.style.display = 'block';
    document.getElementById('prev-ev-titulo').textContent = titulo || 'Sin título';

    if (fecha) {
      const [y, m, d] = fecha.split('-');
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      document.getElementById('prev-ev-fecha').textContent = `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
      document.getElementById('prev-row-fecha').style.display = 'flex';
    } else { document.getElementById('prev-row-fecha').style.display = 'none'; }

    if (horario) { document.getElementById('prev-ev-horario').textContent = horario; document.getElementById('prev-row-horario').style.display = 'flex'; }
    else { document.getElementById('prev-row-horario').style.display = 'none'; }

    if (ubicacion) { document.getElementById('prev-ev-ubicacion').textContent = ubicacion; document.getElementById('prev-row-ubicacion').style.display = 'flex'; }
    else { document.getElementById('prev-row-ubicacion').style.display = 'none'; }

    if (asistentes) { document.getElementById('prev-ev-asistentes').textContent = `${asistentes} asistentes esperados`; document.getElementById('prev-row-asistentes').style.display = 'flex'; }
    else { document.getElementById('prev-row-asistentes').style.display = 'none'; }

    if (voluntarios && parseInt(voluntarios) > 0) { document.getElementById('prev-ev-voluntarios').textContent = `${voluntarios} voluntario(s) necesario(s)`; document.getElementById('prev-row-voluntarios').style.display = 'flex'; }
    else { document.getElementById('prev-row-voluntarios').style.display = 'none'; }

    const descEl = document.getElementById('prev-ev-desc');
    if (descripcion) { descEl.textContent = descripcion; descEl.style.display = 'block'; }
    else { descEl.style.display = 'none'; }
  };

  actualizarPreview();
});
