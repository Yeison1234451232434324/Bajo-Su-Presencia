/**
 * ============================================================
 * CONTROLADOR: voluntario.actividades.controller.js  (Supabase)
 * ============================================================
 * El voluntario logueado ve sus actividades asignadas, agrupadas
 * por evento, y puede marcarlas completadas.
 * Depende de: ActividadesModel, EventosModel, window.miUsuarioId.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Voluntario']);
  if (!sesion) return;

  const contenedor  = document.getElementById('mact-contenedor');
  const barraFill   = document.getElementById('mact-barra-fill');
  const barraPct    = document.getElementById('mact-barra-pct');
  const progresoNum = document.getElementById('mact-progreso-num');

  let _volId = null;   // id (usuarios) del voluntario logueado

  function _agruparPorEvento(actividades) {
    const mapa = {};
    actividades.forEach(a => {
      if (!mapa[a.eventoId]) mapa[a.eventoId] = [];
      mapa[a.eventoId].push(a);
    });
    return mapa;
  }

  // ── Render principal ───────────────────────────────────────────────────────
  async function render() {
    let todas = [];
    try { todas = await ActividadesModel.getAll(); }
    catch (e) { window.BSPLog?.error('voluntarioActividades.getAll', e); }
    const acts = _volId ? todas.filter(a => String(a.voluntarioId) === String(_volId)) : todas;

    contenedor.innerHTML = '';
    if (!acts.length) {
      contenedor.innerHTML = `<div class="mact-empty"><i class="bx bx-task-x" aria-hidden="true"></i><p>No tienes actividades asignadas por el momento.</p></div>`;
      _actualizarBarraGlobal(0, 0);
      return;
    }

    _actualizarBarraGlobal(acts.filter(a => a.completada).length, acts.length);

    const grupos = _agruparPorEvento(acts);
    for (const [eventoId, actsEvento] of Object.entries(grupos)) {
      let info = { titulo: 'Evento', fecha: '', horario: '', ubicacion: '' };
      try {
        const ev = await EventosModel.getById(eventoId);
        if (ev) info = { titulo: ev.titulo, fecha: _formatFecha(ev.fecha), horario: ev.horario || '', ubicacion: ev.ubicacion || '' };
      } catch (e) { window.BSPLog?.error('voluntarioActividades.evento', e); }
      contenedor.appendChild(_crearSeccionEvento(eventoId, actsEvento, info));
    }
  }

  function _actualizarBarraGlobal(completadas, total) {
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
    progresoNum.textContent = `${completadas}/${total}`;
    barraPct.textContent    = `${pct}%`;
    barraFill.style.width   = `${pct}%`;
    if (pct === 100 && total > 0) { barraFill.classList.add('mact-barra-fill--completa'); barraPct.style.color = '#16a34a'; }
    else { barraFill.classList.remove('mact-barra-fill--completa'); barraPct.style.color = ''; }
  }

  function _crearSeccionEvento(eventoId, acts, info) {
    const completadas = acts.filter(a => a.completada).length;
    const total = acts.length;
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
    const completa = pct === 100 && total > 0;

    const seccion = document.createElement('div');
    seccion.className = 'mact-evento-section';
    seccion.id = `mact-ev-${eventoId}`;
    seccion.innerHTML = `
      <div class="mact-evento-header">
        <div class="mact-evento-titulo-row">
          <span class="mact-evento-titulo">${info.titulo}</span>
          <span class="mact-evento-completadas${completa ? ' mact-evento-completadas--verde' : ''}" id="mact-ev-label-${eventoId}">${completadas}/${total} completadas</span>
        </div>
        <div class="mact-evento-meta">
          ${info.fecha    ? `<span><i class="bx bx-calendar" aria-hidden="true"></i> ${info.fecha}</span>` : ''}
          ${info.horario  ? `<span><i class="bx bx-time" aria-hidden="true"></i> ${info.horario}</span>` : ''}
          ${info.ubicacion? `<span><i class="bx bx-map-pin" style="color:#f87171;" aria-hidden="true"></i> ${info.ubicacion}</span>` : ''}
        </div>
      </div>
      <div class="mact-mini-barra-track">
        <div class="mact-mini-barra-fill${completa ? ' mact-mini-barra-fill--completa' : ''}" id="mact-mini-barra-${eventoId}" style="width:${pct}%"></div>
      </div>
      <div class="mact-lista" id="mact-lista-${eventoId}"></div>`;
    const lista = seccion.querySelector(`#mact-lista-${eventoId}`);
    acts.forEach(act => lista.appendChild(_crearItemActividad(act)));
    return seccion;
  }

  function _crearItemActividad(act) {
    const prioLabel = { alta:'Prioridad Alta', media:'Prioridad Media', baja:'Prioridad Baja' }[act.prioridad] || act.prioridad;
    const prioClass = { alta:'mact-prio--alta', media:'mact-prio--media', baja:'mact-prio--baja' }[act.prioridad] || '';
    const item = document.createElement('div');
    item.className = `mact-item${act.completada ? ' mact-item--completada' : ''}`;
    item.id = `mact-item-${act.id}`;
    item.innerHTML = `
      <button class="mact-check-btn" onclick="toggleActividadVoluntario('${act.id}')"
        title="${act.completada ? 'Marcar como pendiente' : 'Marcar como completada'}"
        aria-label="${act.completada ? 'Desmarcar' : 'Completar'} actividad">
        ${act.completada ? '<i class="bx bx-check-circle mact-check-icon mact-check-icon--done" aria-hidden="true"></i>' : '<i class="bx bx-circle mact-check-icon" aria-hidden="true"></i>'}
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

  window.toggleActividadVoluntario = async function(id) {
    const act = await ActividadesModel.getById(id);
    if (!act) return;
    const res = await ActividadesModel.toggleCompletada(id, !act.completada);
    if (!res.ok) { showToast('Error', res.error || 'No se pudo actualizar.'); return; }
    await render();
    showToast(
      act.completada ? 'Actividad pendiente' : '¡Actividad completada!',
      act.completada ? `"${act.titulo}" marcada como pendiente.` : `"${act.titulo}" marcada como completada.`
    );
  };

  function _formatFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]}, ${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
    } catch (_) { return fechaStr; }
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  (async () => {
    try { _volId = await window.miUsuarioId(); } catch (_) { _volId = null; }
    await render();
  })();
});
