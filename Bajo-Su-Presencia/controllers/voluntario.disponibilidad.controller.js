/**
 * ============================================================
 * CONTROLADOR: voluntario.disponibilidad.controller.js  (Supabase)
 * ============================================================
 * El voluntario logueado ve todos los eventos, puede unirse y
 * marcar su disponibilidad. Usa voluntarios_eventos.
 * Depende de: VoluntariosModel, window.miUsuarioId.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Voluntario']);
  if (!sesion) return;

  document.getElementById('vol-nombre-disp').textContent = sesion.nombre || 'Voluntario';

  let _miId  = null;
  let dtDisp = null;

  async function renderEventos() {
    const eventos = await VoluntariosModel.getEventos();

    let total = eventos.length, conmigo = 0, disponible = 0;
    eventos.forEach(ev => {
      const mio = ev.voluntarios.find(v => String(v.id) === String(_miId));
      if (mio) { conmigo++; if (mio.disponible) disponible++; }
    });
    actualizarContadores(total, conmigo, disponible);

    const lugares = [...new Set(eventos.map(e => e.lugar).filter(Boolean))].sort();

    function renderCard(ev) {
      const mio = ev.voluntarios.find(v => String(v.id) === String(_miId));
      const estaRegistrado = !!mio;
      const estaDisponible = mio?.disponible ?? false;

      let estadoClass = '', estadoBadge = '', btnTexto = '', btnClass = '', btnIcono = '';
      if (!estaRegistrado) {
        estadoBadge = '<span class="badge badge-muted">No inscrito</span>';
        btnTexto = 'Unirme como voluntario'; btnClass = 'btn-unirse'; btnIcono = 'bx-user-plus';
      } else if (estaDisponible) {
        estadoClass = 'card-disponible';
        estadoBadge = '<span class="badge badge-green">Disponible</span>';
        btnTexto = 'Marcar no disponible'; btnClass = 'btn-no-disponible'; btnIcono = 'bx-x-circle';
      } else {
        estadoClass = 'card-no-disponible';
        estadoBadge = '<span class="badge badge-red">No disponible</span>';
        btnTexto = 'Marcar disponible'; btnClass = 'btn-disponible'; btnIcono = 'bx-check-circle';
      }

      const fechaObj = ev.fecha ? new Date(ev.fecha + 'T00:00:00') : null;
      const fechaStr = fechaObj ? fechaObj.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '—';
      const rolEnEvento = mio?.rol || '—';
      const inscritos   = ev.voluntarios.length;
      const necesarios  = ev.voluntariosNecesarios || 0;
      const faltan      = Math.max(necesarios - inscritos, 0);
      const badgeCupo   = necesarios > 0
        ? (faltan === 0 ? `<span class="badge badge-red">Cupo completo</span>` : `<span class="badge badge-amber">Necesitan ${necesarios} · Faltan ${faltan}</span>`)
        : `<span class="badge badge-muted">Sin cupo definido</span>`;

      return `
        <div class="disp-card ${estadoClass}" id="card-ev-${ev.id}">
          <div class="disp-card-header">
            <div class="disp-card-info">
              <h4 class="disp-evento-nombre">${esc(ev.nombre)}</h4>
              <p class="disp-evento-meta"><i class="bx bx-calendar"></i> ${esc(fechaStr)}</p>
              <p class="disp-evento-meta"><i class="bx bx-map-pin"></i> ${esc(ev.lugar || '—')}</p>
              <p class="disp-evento-meta"><i class="bx bx-group"></i>
                ${necesarios > 0 ? `Se necesitan <strong>${necesarios}</strong> · Faltan <strong>${faltan}</strong>` : 'Sin cupo de voluntarios definido'}</p>
              ${estaRegistrado ? `<p class="disp-evento-meta"><i class="bx bx-briefcase"></i> Rol: <strong>${esc(rolEnEvento)}</strong></p>` : ''}
            </div>
            <div class="disp-card-estado" style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end;">
              ${estadoBadge}${badgeCupo}
            </div>
          </div>
          <button class="btn-disp-accion ${btnClass}" onclick="accionEvento('${ev.id}', '${estaRegistrado ? 'toggle' : 'unirse'}')">
            <i class="bx ${btnIcono}"></i> ${btnTexto}
          </button>
        </div>`;
    }

    const conEstado = eventos.map(ev => {
      const mio = ev.voluntarios.find(v => String(v.id) === String(_miId));
      return { ...ev, _estado: !mio ? 'No inscrito' : mio.disponible ? 'Disponible' : 'No disponible' };
    });

    if (!dtDisp) {
      dtDisp = new BSPDataTable({
        containerId: 'eventos-grid', data: conEstado, pageSize: 6,
        searchFields: ['nombre','fecha','lugar'],
        filters: [
          { key:'lugar',   label:'Lugar',      type:'select', options: lugares },
          { key:'_estado', label:'Mi estado',  type:'select', options:['No inscrito','Disponible','No disponible'] },
          { key:'fecha',   label:'Desde',      type:'date-from' },
          { key:'fecha',   label:'Hasta',      type:'date-to' },
        ],
        renderRow: renderCard, exportable: true, exportName: 'mis_eventos',
        exportFields: ['nombre','fecha','lugar','_estado'],
        exportLabels: ['Evento','Fecha','Lugar','Mi Estado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-calendar-x"></i><p>No hay eventos publicados por el momento.</p></div>`
      });
      window.__bspDT['eventos-grid'] = dtDisp;
      dtDisp.init();
    } else {
      dtDisp.refresh(conEstado);
    }
  }

  function actualizarContadores(total, conmigo, disponible) {
    document.getElementById('cnt-total').textContent      = total;
    document.getElementById('cnt-conmigo').textContent    = conmigo;
    document.getElementById('cnt-disponible').textContent = disponible;
  }

  window.accionEvento = async function(eventoId, accion) {
    if (!_miId) { showToast('Error', 'No se pudo identificar tu usuario.'); return; }

    if (accion === 'unirse') {
      const r = await VoluntariosModel.unirseEvento(eventoId, _miId, 'Voluntario General');
      if (!r.ok) { showToast('Error', r.error || 'No se pudo unir.'); return; }
      await renderEventos();
      showToast('¡Te uniste al evento!', 'Ahora estás registrado como voluntario disponible.');
    } else {
      const insc = await VoluntariosModel.estaInscrito(eventoId, _miId);
      if (!insc) return;
      const nueva = !insc.disponible;
      const r = await VoluntariosModel.setDisponibilidad(eventoId, _miId, nueva);
      if (!r.ok) { showToast('Error', r.error || 'No se pudo actualizar.'); return; }
      await renderEventos();
      showToast(
        nueva ? 'Marcado como disponible' : 'Marcado como no disponible',
        nueva ? 'El administrador podrá verte como disponible para este evento.' : 'Has indicado que no estarás disponible para este evento.'
      );
    }
  };

  (async () => {
    try { _miId = await window.miUsuarioId(); } catch (_) { _miId = null; }
    await renderEventos();
  })();
});
