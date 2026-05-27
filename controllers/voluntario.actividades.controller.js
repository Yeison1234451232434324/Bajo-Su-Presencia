/**
 * ============================================================
 * CONTROLADOR: voluntario.actividades.controller.js
 * ============================================================
 * Muestra al voluntario logueado sus actividades asignadas,
 * agrupadas por evento, con barra de progreso global y por
 * evento. El voluntario puede marcar/desmarcar completadas.
 *
 * Depende de:
 *   - ActividadesModel  (actividades.model.js)
 *   - VoluntariosModel  (voluntarios.model.js)
 *   - localStorage: 'usuarioLogueado'
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Obtener voluntario logueado ──────────────────────────────────────────
  let volId   = null;
  let volNombre = 'Voluntario';

  try {
    const userData = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
    volId     = userData.id   || null;
    volNombre = userData.nombre || 'Voluntario';
  } catch(_) {}

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const contenedor    = document.getElementById('mact-contenedor');
  const barraFill     = document.getElementById('mact-barra-fill');
  const barraPct      = document.getElementById('mact-barra-pct');
  const progresoNum   = document.getElementById('mact-progreso-num');

  // ════════════════════════════════════════════════════════════════
  // 1. OBTENER ACTIVIDADES DEL VOLUNTARIO
  // ════════════════════════════════════════════════════════════════

  /**
   * Devuelve todas las actividades asignadas al voluntario logueado,
   * agrupadas por eventoId.
   * Si no hay usuario logueado (demo), muestra todas las actividades.
   */
  function _getActividadesDelVoluntario() {
    const todas = ActividadesModel.getAll();

    // Si hay usuario logueado, filtrar por su id
    if (volId) {
      return todas.filter(a => a.voluntarioId === volId || a.voluntarioId === String(volId));
    }

    // Demo: mostrar todas
    return todas;
  }

  function _agruparPorEvento(actividades) {
    const mapa = {};
    actividades.forEach(a => {
      if (!mapa[a.eventoId]) mapa[a.eventoId] = [];
      mapa[a.eventoId].push(a);
    });
    return mapa;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════════

  function render() {
    const acts = _getActividadesDelVoluntario();
    contenedor.innerHTML = '';

    if (!acts.length) {
      contenedor.innerHTML = `
        <div class="mact-empty">
          <i class="bx bx-task-x"></i>
          <p>No tienes actividades asignadas por el momento.</p>
        </div>`;
      _actualizarBarraGlobal(0, 0);
      return;
    }

    // Actualizar barra global
    const totalGlobal     = acts.length;
    const completadasGlobal = acts.filter(a => a.completada).length;
    _actualizarBarraGlobal(completadasGlobal, totalGlobal);

    // Agrupar por evento y renderizar cada sección
    const grupos = _agruparPorEvento(acts);

    Object.entries(grupos).forEach(([eventoId, actsEvento]) => {
      const seccion = _crearSeccionEvento(parseInt(eventoId), actsEvento);
      contenedor.appendChild(seccion);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 3. BARRA DE PROGRESO GLOBAL
  // ════════════════════════════════════════════════════════════════

  function _actualizarBarraGlobal(completadas, total) {
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

    progresoNum.textContent = `${completadas}/${total}`;
    barraPct.textContent    = `${pct}%`;
    barraFill.style.width   = `${pct}%`;

    if (pct === 100 && total > 0) {
      barraFill.classList.add('mact-barra-fill--completa');
      barraPct.style.color = '#16a34a';
    } else {
      barraFill.classList.remove('mact-barra-fill--completa');
      barraPct.style.color = '';
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 4. SECCIÓN POR EVENTO
  // ════════════════════════════════════════════════════════════════

  function _crearSeccionEvento(eventoId, acts) {
    const completadas = acts.filter(a => a.completada).length;
    const total       = acts.length;
    const pct         = total > 0 ? Math.round((completadas / total) * 100) : 0;
    const completa    = pct === 100 && total > 0;

    // Obtener info del evento
    const infoEvento = _getInfoEvento(eventoId, acts[0]);

    const seccion = document.createElement('div');
    seccion.className = 'mact-evento-section';
    seccion.id = `mact-ev-${eventoId}`;

    seccion.innerHTML = `
      <div class="mact-evento-header">
        <div class="mact-evento-titulo-row">
          <span class="mact-evento-titulo">${infoEvento.titulo}</span>
          <span class="mact-evento-completadas${completa ? ' mact-evento-completadas--verde' : ''}"
                id="mact-ev-label-${eventoId}">
            ${completadas}/${total} completadas
          </span>
        </div>
        <div class="mact-evento-meta">
          ${infoEvento.fecha    ? `<span><i class="bx bx-calendar"></i> ${infoEvento.fecha}</span>` : ''}
          ${infoEvento.horario  ? `<span><i class="bx bx-time"></i> ${infoEvento.horario}</span>` : ''}
          ${infoEvento.ubicacion? `<span><i class="bx bx-map-pin" style="color:#f87171;"></i> ${infoEvento.ubicacion}</span>` : ''}
        </div>
      </div>
      <div class="mact-mini-barra-track">
        <div class="mact-mini-barra-fill${completa ? ' mact-mini-barra-fill--completa' : ''}"
             id="mact-mini-barra-${eventoId}"
             style="width:${pct}%"></div>
      </div>
      <div class="mact-lista" id="mact-lista-${eventoId}"></div>`;

    // Renderizar items de actividades
    const lista = seccion.querySelector(`#mact-lista-${eventoId}`);
    acts.forEach(act => {
      lista.appendChild(_crearItemActividad(act));
    });

    return seccion;
  }

  // ════════════════════════════════════════════════════════════════
  // 5. ITEM DE ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  function _crearItemActividad(act) {
    const prioLabel = { alta: 'Prioridad Alta', media: 'Prioridad Media', baja: 'Prioridad Baja' }[act.prioridad] || act.prioridad;
    const prioClass = { alta: 'mact-prio--alta', media: 'mact-prio--media', baja: 'mact-prio--baja' }[act.prioridad] || '';

    const item = document.createElement('div');
    item.className = `mact-item${act.completada ? ' mact-item--completada' : ''}`;
    item.id = `mact-item-${act.id}`;

    item.innerHTML = `
      <button class="mact-check-btn"
        onclick="toggleActividadVoluntario(${act.id})"
        title="${act.completada ? 'Marcar como pendiente' : 'Marcar como completada'}"
        aria-label="${act.completada ? 'Desmarcar' : 'Completar'} actividad">
        ${act.completada
          ? '<i class="bx bx-check-circle mact-check-icon mact-check-icon--done"></i>'
          : '<i class="bx bx-circle mact-check-icon"></i>'}
      </button>
      <div class="mact-item-body">
        <div class="mact-item-header">
          <span class="mact-item-titulo${act.completada ? ' mact-titulo--tachado' : ''}">${act.titulo}</span>
          <span class="mact-prio-badge ${prioClass}">${prioLabel}</span>
        </div>
        ${act.descripcion ? `<p class="mact-item-desc">${act.descripcion}</p>` : ''}
      </div>`;

    return item;
  }

  // ════════════════════════════════════════════════════════════════
  // 6. TOGGLE COMPLETADA
  // ════════════════════════════════════════════════════════════════

  window.toggleActividadVoluntario = function(id) {
    const act = ActividadesModel.getById(id);
    if (!act) return;

    ActividadesModel.toggleCompletada(id, !act.completada);

    // Re-renderizar todo para actualizar barras y contadores
    render();

    showToast(
      act.completada ? 'Actividad pendiente' : '¡Actividad completada!',
      act.completada ? `"${act.titulo}" marcada como pendiente.` : `"${act.titulo}" marcada como completada.`
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 7. HELPER: INFO DEL EVENTO
  // ════════════════════════════════════════════════════════════════

  function _getInfoEvento(eventoId, actFallback) {
    // Intentar desde EventosModel
    try {
      const ev = EventosModel.getById(eventoId);
      if (ev) return {
        titulo:    ev.titulo,
        fecha:     _formatFecha(ev.fecha),
        horario:   ev.horario || '',
        ubicacion: ev.ubicacion || ''
      };
    } catch(_) {}

    // Intentar desde VoluntariosModel
    try {
      const ev = VoluntariosModel.getEventoById(eventoId);
      if (ev) return {
        titulo:    ev.nombre,
        fecha:     _formatFecha(ev.fecha),
        horario:   '',
        ubicacion: ev.lugar || ''
      };
    } catch(_) {}

    // Fallback con datos de la actividad
    return {
      titulo:    `Evento #${eventoId}`,
      fecha:     actFallback?.creadaEn ? _formatFecha(actFallback.creadaEn) : '',
      horario:   '',
      ubicacion: ''
    };
  }

  function _formatFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const meses = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]}, ${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
    } catch(_) { return fechaStr; }
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  render();
});
