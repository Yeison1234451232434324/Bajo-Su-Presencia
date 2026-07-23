/**
 * ============================================================
 * CONTROLADOR: asistencias.controller.js
 * ============================================================
 * Renderiza el módulo de Asistencias del administrador,
 * DETALLADO POR EVENTO:
 *   - Selector de evento + tarjetas de resumen del evento elegido
 *   - Sección "Asistencia": todos los inscritos y quiénes
 *     confirmaron asistencia por QR (con fecha/hora del escaneo)
 *   - Sección "Calificaciones": SOLO las personas que ya
 *     calificaron (nombre, estrellas y comentario). Si alguien no
 *     ha calificado, únicamente aparece en Asistencia.
 *
 * Solo lectura: los datos provienen de la app móvil (AsistenciasModel).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Control de acceso: solo Administrador ────────────────────────────────
  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const selEvento = document.getElementById('sel-evento');
  const detalle   = document.getElementById('asist-detalle');

  // ── Helpers ──────────────────────────────────────────────────────────────
  const ESCALA_COLORES = ['#dc2626', '#f97316', '#f59e0b', '#84cc16', '#059669'];

  /** Estrellas (llenas/vacías) para una calificación 1-5 */
  function estrellasHTML(n) {
    const val = Math.round(n);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<i class="bx ${i <= val ? 'bxs-star asist-star-on' : 'bx-star asist-star-off'}"></i>`;
    }
    return `<span class="asist-stars">${out}</span>`;
  }

  const inicial = (nombre) => (nombre || '?').trim().charAt(0).toUpperCase();
  const tieneCalificacion = (a) => typeof a.calificacion === 'number' && a.calificacion > 0;

  // ── Poblar el selector de eventos ────────────────────────────────────────
  const eventos = await AsistenciasModel.getEventos();

  if (eventos.length === 0) {
    selEvento.innerHTML = '<option value="">— Sin eventos —</option>';
    detalle.innerHTML = `
      <div class="asist-empty">
        <i class="bx bx-calendar-x"></i>
        <p>No hay registros de asistencia.</p>
        <small>Los datos se sincronizan desde la app móvil.</small>
      </div>`;
    return;
  }

  selEvento.innerHTML = eventos.map(e =>
    `<option value="${e.id}">${e.nombre}${e.fecha ? ` — ${e.fecha}` : ''}</option>`
  ).join('');

  // ── Tarjetas de resumen del evento seleccionado ──────────────────────────
  async function renderResumen(eventoId) {
    const r = await AsistenciasModel.getResumen(eventoId);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('cont-inscritos',  r.inscritos);
    set('cont-asistieron', r.asistieron);
    set('cont-porcentaje', `${r.porcentaje}%`);
    set('cont-promedio',   r.promedio > 0 ? r.promedio.toFixed(1) : '—');

    const stars = document.getElementById('cont-promedio-stars');
    if (stars) stars.innerHTML = r.promedio > 0 ? estrellasHTML(r.promedio) : '';
  }

  // ── Fila de asistencia (para todos los inscritos) ────────────────────────
  function filaAsistencia(a) {
    const contacto = [a.email, a.telefono].filter(Boolean).map(esc).join('&nbsp;·&nbsp;');
    const badgeAsistencia = a.asistio
      ? `<span class="asist-badge asist-badge--asistio"><i class="bx bx-qr-scan"></i> Asistió por QR${a.fechaAsistencia ? ` · ${esc(a.fechaAsistencia)}` : ''}</span>`
      : `<span class="asist-badge asist-badge--falta"><i class="bx bx-x-circle"></i> No asistió</span>`;
    const califHint = tieneCalificacion(a)
      ? `<span class="asist-row-calif" title="Ya calificó"><i class="bx bxs-star"></i> ${esc(a.calificacion)}/5</span>`
      : '';

    return `
      <div class="asist-row ${a.asistio ? 'asist-row--asistio' : 'asist-row--falta'}">
        <div class="asist-avatar-sm">${esc(inicial(a.nombre))}</div>
        <div class="asist-row-info">
          <p class="asist-row-nombre">${esc(a.nombre)} ${califHint}</p>
          ${contacto ? `<p class="asist-row-sub">${contacto}</p>` : ''}
        </div>
        <div class="asist-row-estados">
          <span class="asist-badge asist-badge--inscrito"><i class="bx bx-user-plus"></i> Inscrito${a.fechaInscripcion ? ` · ${esc(a.fechaInscripcion)}` : ''}</span>
          ${badgeAsistencia}
        </div>
      </div>`;
  }

  // ── Tarjeta de calificación (solo para quienes calificaron) ──────────────
  function cardCalificacion(a) {
    const color = ESCALA_COLORES[a.calificacion - 1] || '#059669';
    return `
      <div class="asist-calif-card">
        <div class="asist-calif-top">
          <div class="asist-calif-persona">
            <div class="asist-avatar-sm">${inicial(a.nombre)}</div>
            <p class="asist-calif-nombre">${a.nombre}</p>
          </div>
          <div class="asist-calif-head">
            ${estrellasHTML(a.calificacion)}
            <span class="asist-calif-num" style="color:${color};">${a.calificacion}/5</span>
          </div>
        </div>
        ${a.comentario
          ? `<p class="asist-comentario"><i class="bx bxs-quote-alt-left"></i> ${a.comentario}</p>`
          : `<p class="asist-sin-comentario">Calificó sin dejar comentario.</p>`}
      </div>`;
  }

  // ── Render del detalle del evento ────────────────────────────────────────
  async function renderEvento(eventoId) {
    const ev        = eventos.find(e => String(e.id) === String(eventoId));
    const registros = await AsistenciasModel.getByEvento(eventoId);
    const califican = registros.filter(tieneCalificacion);

    await renderResumen(eventoId);

    // Las calificaciones SOLO se muestran cuando existen
    const calificacionesHTML = califican.length
      ? califican.map(cardCalificacion).join('')
      : `<div class="asist-empty asist-empty--sm">
           <i class="bx bx-message-square-x"></i>
           <p>Aún no hay calificaciones para este evento.</p>
           <small>Aparecerán aquí cuando los asistentes lo califiquen desde la app.</small>
         </div>`;

    // Esqueleto: la Asistencia se renderiza con un DataTable (paginación + filtros)
    detalle.innerHTML = `
      <div class="asist-evento-detalle">
        <div class="asist-evento-head">
          <h3 class="asist-evento-titulo"><i class="bx bx-calendar-event"></i> ${ev ? ev.nombre : 'Evento'}</h3>
          ${ev && ev.fecha ? `<span class="asist-evento-fecha"><i class="bx bx-time-five"></i> ${ev.fecha}</span>` : ''}
        </div>

        <section class="asist-bloque">
          <h4 class="asist-sec-title">
            <i class="bx bx-list-check"></i> Asistencia
            <span class="asist-sec-count">${registros.filter(r => r.asistio).length} de ${registros.length} confirmaron por QR</span>
          </h4>
          <div id="tabla-asistencias"></div>
        </section>

        <section class="asist-bloque">
          <h4 class="asist-sec-title">
            <i class="bx bxs-star"></i> Calificaciones del evento
            <span class="asist-sec-count">${califican.length} ${califican.length === 1 ? 'calificación' : 'calificaciones'}</span>
          </h4>
          <div class="asist-califs">${calificacionesHTML}</div>
        </section>
      </div>`;

    // ── DataTable de asistencia (cantidad de registros + filtros de fecha) ──
    const registrosDT = registros.map(a => ({
      ...a,
      estadoAsistencia:  a.asistio ? 'Asistió' : 'No asistió',
      calificacionTexto: tieneCalificacion(a) ? `${a.calificacion}/5` : 'Sin calificar'
    }));

    const dt = new BSPDataTable({
      containerId:  'tabla-asistencias',
      data:         registrosDT,
      pageSize:     10,
      searchFields: ['nombre', 'email'],
      filters: [
        { key: 'estadoAsistencia', label: 'Asistencia',     type: 'select',    options: ['Asistió', 'No asistió'] },
        { key: 'fechaInscripcion', label: 'Inscrito desde', type: 'date-from' },
        { key: 'fechaInscripcion', label: 'Inscrito hasta', type: 'date-to'   },
      ],
      renderRow:    filaAsistencia,
      exportable:   true,
      exportName:   `asistencia_${(ev ? ev.nombre : 'evento').replace(/\s+/g, '_').toLowerCase()}`,
      exportFields: ['nombre', 'email', 'telefono', 'estadoAsistencia', 'fechaInscripcion', 'fechaAsistencia', 'calificacionTexto', 'comentario'],
      exportLabels: ['Nombre', 'Correo', 'Teléfono', 'Asistencia', 'Inscrito', 'Hora escaneo QR', 'Calificación', 'Comentario'],
      emptyHTML:    `<div class="asist-empty asist-empty--sm"><i class="bx bx-user-x"></i><p>Nadie se ha inscrito a este evento todavía.</p></div>`
    });
    window.__bspDT = window.__bspDT || {};
    window.__bspDT['tabla-asistencias'] = dt;
    dt.init();
  }

  // ── Eventos de UI ────────────────────────────────────────────────────────
  selEvento.addEventListener('change', () => renderEvento(selEvento.value));

  // ── Render inicial (primer evento) ───────────────────────────────────────
  renderEvento(eventos[0].id);
});
