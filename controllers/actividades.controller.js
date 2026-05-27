/**
 * ============================================================
 * CONTROLADOR: actividades.controller.js
 * ============================================================
 * Maneja toda la lógica de Gestión de Actividades.
 * Depende de:
 *   - ActividadesModel (actividades.model.js)
 *   - EventosModel     (eventos.model.js)
 *   - VoluntariosModel (voluntarios.model.js)
 *
 * Flujo:
 *   1. Vista inicial: grid de eventos con resumen de actividades
 *   2. Al seleccionar evento: lista de actividades del evento
 *   3. Botón "Nueva Actividad": abre modal con formulario
 *   4. Editar / Eliminar / Completar actividad
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Estado interno ───────────────────────────────────────────────────────
  let eventoActual = null;   // objeto del evento seleccionado
  let modoEdicion  = false;  // true cuando el modal está en modo editar
  let actEditId    = null;   // id de la actividad que se está editando

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const vistaEventos     = document.getElementById('vista-eventos');
  const vistaActividades = document.getElementById('vista-actividades');
  const gridEventos      = document.getElementById('grid-eventos');
  const listaActividades = document.getElementById('lista-actividades');
  const contadorActs     = document.getElementById('contador-acts');
  const bannerEvento     = document.getElementById('banner-evento');
  const modal            = document.getElementById('modal-actividad');
  const modalOverlay     = document.getElementById('modal-overlay-act');
  const modalTitulo      = document.getElementById('modal-act-titulo');
  const formAct          = document.getElementById('form-actividad');
  const selectVol        = document.getElementById('act-voluntario');

  // ════════════════════════════════════════════════════════════════
  // 1. VISTA DE EVENTOS
  // ════════════════════════════════════════════════════════════════

  function renderEventos() {
    // Combinar eventos de EventosModel y VoluntariosModel
    let eventos = [];
    try { eventos = EventosModel.getAll(); } catch(_) {}
    if (!eventos.length) {
      try {
        eventos = VoluntariosModel.getEventos().map(e => ({
          id:       e.id,
          titulo:   e.nombre,
          fecha:    e.fecha,
          horario:  '',
          ubicacion: e.lugar,
          voluntariosNecesarios: e.voluntariosNecesarios || 0,
          voluntarios: e.voluntarios || []
        }));
      } catch(_) {}
    }

    gridEventos.innerHTML = '';

    if (!eventos.length) {
      gridEventos.innerHTML = `
        <div class="act-empty">
          <i class="bx bx-calendar-x"></i>
          <p>No hay eventos publicados aún.</p>
        </div>`;
      return;
    }

    eventos.forEach(ev => {
      const resumen = ActividadesModel.getResumenEvento(ev.id);
      const volDisp = _contarVoluntarios(ev);
      const fechaFmt = _formatFecha(ev.fecha);

      const card = document.createElement('div');
      card.className = 'act-evento-card';
      card.innerHTML = `
        <div class="act-ev-icon"><i class="bx bx-calendar-event"></i></div>
        <div class="act-ev-body">
          <h3 class="act-ev-titulo">${ev.titulo}</h3>
          <p class="act-ev-meta"><i class="bx bx-calendar"></i> ${fechaFmt}</p>
          ${ev.horario ? `<p class="act-ev-meta"><i class="bx bx-time"></i> ${ev.horario}</p>` : ''}
          <p class="act-ev-meta"><i class="bx bx-notepad"></i>
            ${resumen.total} actividad(es) - ${resumen.completadas} completada(s)
          </p>
          <p class="act-ev-meta act-ev-vol">
            <i class="bx bx-group"></i> ${volDisp} voluntario(s) disponible(s)
          </p>
        </div>`;
      card.addEventListener('click', () => seleccionarEvento(ev));
      gridEventos.appendChild(card);
    });
  }

  function _contarVoluntarios(ev) {
    // Intentar obtener voluntarios del VoluntariosModel
    try {
      const evVol = VoluntariosModel.getEventoById(ev.id);
      if (evVol && evVol.voluntarios) {
        return evVol.voluntarios.filter(v => v.disponible !== false).length;
      }
    } catch(_) {}
    return ev.voluntariosNecesarios || 0;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIONAR EVENTO → VISTA DE ACTIVIDADES
  // ════════════════════════════════════════════════════════════════

  function seleccionarEvento(ev) {
    eventoActual = ev;

    // Actualizar banner del evento
    bannerEvento.querySelector('.act-banner-titulo').textContent = ev.titulo;
    bannerEvento.querySelector('.act-banner-fecha').textContent  = _formatFecha(ev.fecha);
    bannerEvento.querySelector('.act-banner-hora').textContent   = ev.horario || '';
    bannerEvento.querySelector('.act-banner-lugar').textContent  = ev.ubicacion || ev.lugar || '';

    // Cambiar vistas
    vistaEventos.style.display     = 'none';
    vistaActividades.style.display = 'block';

    renderActividades();
  }

  window.volverAEventos = function() {
    eventoActual = null;
    vistaActividades.style.display = 'none';
    vistaEventos.style.display     = 'block';
    renderEventos();
  };

  // ════════════════════════════════════════════════════════════════
  // 3. LISTA DE ACTIVIDADES DEL EVENTO
  // ════════════════════════════════════════════════════════════════

  function renderActividades() {
    if (!eventoActual) return;

    const acts = ActividadesModel.getByEvento(eventoActual.id);
    const completadas = acts.filter(a => a.completada).length;

    contadorActs.textContent = `${completadas} de ${acts.length} completadas`;
    listaActividades.innerHTML = '';

    if (!acts.length) {
      listaActividades.innerHTML = `
        <div class="act-empty">
          <i class="bx bx-task"></i>
          <p>No hay actividades para este evento. Crea la primera.</p>
        </div>`;
      return;
    }

    acts.forEach(act => {
      const prioClass = { alta: 'act-prio--alta', media: 'act-prio--media', baja: 'act-prio--baja' }[act.prioridad] || '';
      const prioLabel = { alta: 'Alta', media: 'Media', baja: 'Baja' }[act.prioridad] || act.prioridad;

      const item = document.createElement('div');
      item.className = `act-item${act.completada ? ' act-item--completada' : ''}`;
      item.id = `act-item-${act.id}`;

      item.innerHTML = `
        <button class="act-check-btn act-check-btn--readonly" disabled
          title="Solo el voluntario asignado puede cambiar el estado"
          style="cursor:default;opacity:0.7;">
          ${act.completada
            ? '<i class="bx bx-check-circle act-check-icon act-check-icon--done"></i>'
            : '<i class="bx bx-circle act-check-icon"></i>'}
        </button>
        <div class="act-item-body">
          <div class="act-item-header">
            <span class="act-item-titulo${act.completada ? ' act-titulo--tachado' : ''}">${act.titulo}</span>
            <span class="act-prio-badge ${prioClass}">${prioLabel}</span>
          </div>
          ${act.descripcion ? `<p class="act-item-desc">${act.descripcion}</p>` : ''}
          <p class="act-item-asignado"><i class="bx bx-user"></i> Asignado a: ${act.voluntarioNombre}</p>
        </div>
        <div class="act-item-acciones">
          <button class="act-btn-accion act-btn-editar" onclick="abrirEditar(${act.id})" title="Editar">
            <i class="bx bx-edit"></i>
          </button>
          <button class="act-btn-accion act-btn-eliminar" onclick="eliminarActividad(${act.id})" title="Eliminar">
            <i class="bx bx-trash"></i>
          </button>
        </div>`;

      listaActividades.appendChild(item);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 4. COMPLETAR / DESCOMPLETAR — Solo voluntarios
  // ════════════════════════════════════════════════════════════════
  // El estado de completado solo lo puede cambiar el voluntario
  // asignado desde su propio panel (mis-actividades.html).
  // Admin y colaborador solo pueden ver el estado actual.

  // ════════════════════════════════════════════════════════════════
  // 5. MODAL — NUEVA ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  window.abrirNuevaActividad = function() {
    modoEdicion = false;
    actEditId   = null;
    modalTitulo.textContent = 'Nueva Actividad';
    formAct.reset();
    document.getElementById('act-prioridad').value = 'media';
    _cargarVoluntarios();
    _mostrarModal();
  };

  // ════════════════════════════════════════════════════════════════
  // 6. MODAL — EDITAR ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  window.abrirEditar = function(id) {
    const act = ActividadesModel.getById(id);
    if (!act) return;

    modoEdicion = true;
    actEditId   = id;
    modalTitulo.textContent = 'Editar Actividad';

    _cargarVoluntarios();

    document.getElementById('act-titulo-input').value = act.titulo;
    document.getElementById('act-descripcion').value  = act.descripcion || '';
    document.getElementById('act-prioridad').value    = act.prioridad;

    // Seleccionar el voluntario correcto en el select
    setTimeout(() => {
      selectVol.value = act.voluntarioId;
    }, 50);

    _mostrarModal();
  };

  // ════════════════════════════════════════════════════════════════
  // 7. CARGAR VOLUNTARIOS EN EL SELECT
  // ════════════════════════════════════════════════════════════════

  function _cargarVoluntarios() {
    selectVol.innerHTML = '<option value="">Selecciona un voluntario</option>';

    let voluntarios = [];

    // Intentar obtener voluntarios del evento actual desde VoluntariosModel
    try {
      const evVol = VoluntariosModel.getEventoById(eventoActual.id);
      if (evVol && evVol.voluntarios && evVol.voluntarios.length) {
        voluntarios = evVol.voluntarios;
      }
    } catch(_) {}

    // Si no hay voluntarios en el evento, usar lista general de usuarios
    if (!voluntarios.length) {
      try {
        const usuarios = JSON.parse(localStorage.getItem('bsp_usuarios') || '[]');
        voluntarios = usuarios
          .filter(u => u.rol === 'Voluntario' || u.rol === 'Colaborador')
          .map(u => ({ id: u.id, nombre: u.nombre }));
      } catch(_) {}
    }

    // Fallback: voluntarios de ejemplo
    if (!voluntarios.length) {
      voluntarios = [
        { id: 2, nombre: 'Juan Colaborador' },
        { id: 3, nombre: 'Pedro Voluntario' },
        { id: 4, nombre: 'María González' },
        { id: 5, nombre: 'Carlos López' },
        { id: 6, nombre: 'Ana Martínez' }
      ];
    }

    voluntarios.forEach(v => {
      const opt = document.createElement('option');
      opt.value       = v.id;
      opt.textContent = v.nombre;
      selectVol.appendChild(opt);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 8. GUARDAR ACTIVIDAD (crear o editar)
  // ════════════════════════════════════════════════════════════════

  formAct.addEventListener('submit', e => {
    e.preventDefault();

    const volId  = parseInt(selectVol.value);
    const volOpt = selectVol.options[selectVol.selectedIndex];
    const volNombre = volOpt ? volOpt.textContent : '';

    const data = {
      eventoId:         eventoActual.id,
      titulo:           document.getElementById('act-titulo-input').value,
      descripcion:      document.getElementById('act-descripcion').value,
      prioridad:        document.getElementById('act-prioridad').value,
      voluntarioId:     volId,
      voluntarioNombre: volNombre
    };

    let resultado;
    if (modoEdicion) {
      resultado = ActividadesModel.actualizar(actEditId, data);
    } else {
      resultado = ActividadesModel.crear(data);
    }

    if (!resultado.ok) {
      showToast('Error', resultado.error);
      return;
    }

    _cerrarModal();
    renderActividades();
    showToast(
      modoEdicion ? 'Actividad actualizada' : 'Actividad creada',
      `"${data.titulo}" fue ${modoEdicion ? 'actualizada' : 'creada'} correctamente.`
    );
  });

  // ════════════════════════════════════════════════════════════════
  // 9. ELIMINAR ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  window.eliminarActividad = function(id) {
    const act = ActividadesModel.getById(id);
    if (!act) return;
    if (!confirm(`¿Eliminar la actividad "${act.titulo}"?\nEsta acción no se puede deshacer.`)) return;
    ActividadesModel.eliminar(id);
    renderActividades();
    showToast('Actividad eliminada', `"${act.titulo}" fue eliminada.`);
  };

  // ════════════════════════════════════════════════════════════════
  // 10. HELPERS MODAL
  // ════════════════════════════════════════════════════════════════

  function _mostrarModal() {
    modal.style.display        = 'flex';
    modalOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function _cerrarModal() {
    modal.style.display        = 'none';
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
    formAct.reset();
  }

  window.cerrarModalActividad = function() { _cerrarModal(); };

  modalOverlay.addEventListener('click', _cerrarModal);

  // ════════════════════════════════════════════════════════════════
  // 11. HELPER FECHA
  // ════════════════════════════════════════════════════════════════

  function _formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]} ${parseInt(d)} ${meses[parseInt(m) - 1]}`;
    } catch(_) {
      return fechaStr;
    }
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  renderEventos();
});
