/**
 * ============================================================
 * CONTROLADOR: pqr-admin.controller.js
 * ============================================================
 * Maneja toda la lógica del panel de gestión de PQR.
 * Depende de: PQRModel (pqr.model.js)
 *
 * Secciones:
 *   1. Verificación de rol Administrador
 *   2. Tarjetas de contadores
 *   3. Tabla con filtros de búsqueda, tipo, estado y prioridad
 *   4. Modal de detalle y respuesta
 *   5. Cambio de estado y eliminación
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Verificar que sea admin ──────────────────────────────────────────────
  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  // ── Referencias DOM ──────────────────────────────────────────────────────

  // Modal
  const modal            = document.getElementById('pqr-modal');
  const modalOverlay     = document.getElementById('pqr-modal-overlay');
  const modalClose       = document.getElementById('pqr-modal-close');
  const btnCancelarModal = document.getElementById('pqr-btn-cancelar-modal');
  const btnGuardar       = document.getElementById('pqr-btn-guardar-respuesta');
  const modalError       = document.getElementById('pqr-modal-error');

  // Estado interno
  let pqrActualId = null; // ID del PQR abierto en el modal

  // ════════════════════════════════════════════════════════════════
  // 1. CONTADORES
  // ════════════════════════════════════════════════════════════════

  /** Actualiza las tarjetas de contadores a partir de la lista ya cargada */
  function actualizarContadores(lista) {
    document.getElementById('stat-pqr-total').textContent      = lista.length;
    document.getElementById('stat-pqr-pendientes').textContent = lista.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('stat-pqr-enproceso').textContent  = lista.filter(p => p.estado === 'En proceso').length;
    document.getElementById('stat-pqr-resueltos').textContent  = lista.filter(p => p.estado === 'Resuelto').length;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. TABLA DE PQR
  // ════════════════════════════════════════════════════════════════

  // ── DataTable de PQR ─────────────────────────────────────────────────────
  let dtPQR = null;

  async function renderTabla() {
    const lista = await PQRModel.getAll();
    actualizarContadores(lista);

    const data = lista
      .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
      .map(p => ({
        ...p,
        creadoFecha: p.creadoEn ? p.creadoEn.split('T')[0] : ''
      }));

    function renderRow(p) {
      const badgeTipo      = tipoBadge(p.tipo);
      const badgeEstado    = estadoBadge(p.estado);
      const badgePrioridad = prioridadBadge(p.prioridad);
      const fecha          = formatFecha(p.creadoEn);

      return `
        <div style="padding:1rem 1.25rem;background:#fff;border:2px solid var(--border);
          border-radius:1rem;margin-bottom:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
            ${badgeTipo}
            ${badgePrioridad}
            ${badgeEstado}
            <span style="flex:1;min-width:120px;font-weight:700;font-size:0.95rem;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p.asunto)}">
              ${escapeHtml(p.asunto)}
            </span>
            <span style="flex-shrink:0;font-size:0.82rem;color:var(--muted);">${fecha}</span>
            <div class="pqr-acciones-cell" style="flex-shrink:0;">
              <button class="pqr-btn-accion btn-ver-pqr" onclick="abrirModal('${p.id}')" title="Ver detalle y responder">
                <i class="bx bx-show" aria-hidden="true"></i>
              </button>
              <button class="pqr-btn-accion btn-estado-pqr" onclick="ciclarEstado('${p.id}')"
                title="Cambiar estado: ${siguienteEstado(p.estado)}">
                <i class="bx bx-transfer-alt" aria-hidden="true"></i>
              </button>
              <button class="pqr-btn-accion btn-eliminar-pqr" onclick="eliminarPQR('${p.id}')" title="Eliminar PQR">
                <i class="bx bx-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div style="margin-top:0.5rem;font-size:0.875rem;color:var(--muted);">
            <i class="bx bx-user" style="font-size:0.9rem;" aria-hidden="true"></i>
            ${escapeHtml(p.nombre)}
            &nbsp;·&nbsp;
            <i class="bx bx-envelope" style="font-size:0.9rem;" aria-hidden="true"></i>
            ${escapeHtml(p.email)}
          </div>
        </div>`;
    }

    if (!dtPQR) {
      dtPQR = new BSPDataTable({
        containerId:  'dt-pqr',
        data,
        pageSize:     10,
        searchFields: ['nombre', 'email', 'asunto', 'descripcion'],
        filters: [
          { key: 'tipo',       label: 'Tipo',      type: 'select', options: ['Petición', 'Queja', 'Reclamo'] },
          { key: 'estado',     label: 'Estado',    type: 'select', options: ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'] },
          { key: 'prioridad',  label: 'Prioridad', type: 'select', options: ['Alta', 'Media', 'Baja'] },
          { key: 'creadoFecha', label: 'Desde', type: 'date-from' },
          { key: 'creadoFecha', label: 'Hasta', type: 'date-to'   },
        ],
        renderRow,
        exportable:   true,
        exportName:   'pqr',
        exportFields: ['tipo', 'nombre', 'email', 'asunto', 'prioridad', 'estado', 'creadoFecha'],
        exportLabels: ['Tipo', 'Nombre', 'Email', 'Asunto', 'Prioridad', 'Estado', 'Fecha'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-message-detail" aria-hidden="true"></i><p>No se encontraron PQR con esos criterios.</p></div>`
      });
      window.__bspDT['dt-pqr'] = dtPQR;
      dtPQR.init();
    } else {
      dtPQR.refresh(data);
    }
  }

  // ── Helpers de badges ────────────────────────────────────────────────────

  function tipoBadge(tipo) {
    const map = {
      'Petición': '<span class="badge badge-tipo-peticion">Petición</span>',
      'Queja':    '<span class="badge badge-tipo-queja">Queja</span>',
      'Reclamo':  '<span class="badge badge-tipo-reclamo">Reclamo</span>'
    };
    return map[tipo] || `<span class="badge">${tipo}</span>`;
  }

  function estadoBadge(estado) {
    const map = {
      'Pendiente':  '<span class="badge badge-estado-pendiente">Pendiente</span>',
      'En proceso': '<span class="badge badge-estado-enproceso">En proceso</span>',
      'Resuelto':   '<span class="badge badge-estado-resuelto">Resuelto</span>',
      'Cerrado':    '<span class="badge badge-estado-cerrado">Cerrado</span>'
    };
    return map[estado] || `<span class="badge">${estado}</span>`;
  }

  function prioridadBadge(prioridad) {
    const map = {
      'Alta':  '<span class="badge badge-prio-alta">Alta</span>',
      'Media': '<span class="badge badge-prio-media">Media</span>',
      'Baja':  '<span class="badge badge-prio-baja">Baja</span>'
    };
    return map[prioridad] || `<span class="badge">${prioridad}</span>`;
  }

  /** Devuelve el siguiente estado en el ciclo */
  function siguienteEstado(estadoActual) {
    const ciclo = ['Pendiente', 'En proceso', 'Resuelto', 'Cerrado'];
    const idx   = ciclo.indexOf(estadoActual);
    return ciclo[(idx + 1) % ciclo.length];
  }

  /** Formatea una fecha ISO a formato legible */
  function formatFecha(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-ES', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric'
    });
  }

  /** Escapa caracteres HTML para evitar XSS */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ════════════════════════════════════════════════════════════════
  // 3. MODAL DE DETALLE / RESPUESTA
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el detalle completo del PQR */
  window.abrirModal = async function(id) {
    const p = await PQRModel.getById(id);
    if (!p) return;

    pqrActualId = id;

    // Llenar metadatos
    document.getElementById('modal-tipo').innerHTML      = tipoBadge(p.tipo);
    document.getElementById('modal-estado').innerHTML    = estadoBadge(p.estado);
    document.getElementById('modal-nombre').textContent  = p.nombre;
    document.getElementById('modal-email').textContent   = p.email;
    document.getElementById('modal-telefono').textContent= p.telefono || '—';
    document.getElementById('modal-prioridad').innerHTML = prioridadBadge(p.prioridad);
    document.getElementById('modal-fecha').textContent   = formatFecha(p.creadoEn);
    document.getElementById('modal-asunto').textContent  = p.asunto;
    document.getElementById('modal-descripcion').textContent = p.descripcion;

    // Mostrar respuesta existente si la hay
    const respWrap = document.getElementById('modal-respuesta-existente-wrap');
    if (p.respuesta) {
      document.getElementById('modal-respuesta-texto').textContent = p.respuesta;
      document.getElementById('modal-respuesta-meta').textContent  =
        `Respondido el ${formatFecha(p.respondidoEn)} por ${p.respondidoPor || 'Administrador'}`;
      respWrap.style.display = 'block';
    } else {
      respWrap.style.display = 'none';
    }

    // Pre-llenar formulario de respuesta
    document.getElementById('modal-campo-respuesta').value = p.respuesta || '';
    document.getElementById('modal-campo-estado').value    = p.estado;

    // Limpiar error
    modalError.style.display = 'none';
    modalError.textContent   = '';

    // Mostrar modal
    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  };

  /** Cierra el modal */
  function cerrarModal() {
    modal.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    document.body.style.overflow = '';
    pqrActualId = null;
  }

  modalClose.addEventListener('click', cerrarModal);
  btnCancelarModal.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
  });

  // ════════════════════════════════════════════════════════════════
  // 4. GUARDAR RESPUESTA
  // ════════════════════════════════════════════════════════════════

  btnGuardar.addEventListener('click', async () => {
    if (!pqrActualId) return;

    const respuesta   = document.getElementById('modal-campo-respuesta').value;
    const nuevoEstado = document.getElementById('modal-campo-estado').value;

    // Limpiar error previo
    modalError.style.display = 'none';
    modalError.textContent   = '';

    // Validar que haya respuesta
    if (!respuesta || !respuesta.trim()) {
      modalError.textContent   = 'La respuesta no puede estar vacía.';
      modalError.style.display = 'block';
      return;
    }

    const resultado = await PQRModel.responder(
      pqrActualId,
      respuesta,
      nuevoEstado,
      sesion.nombre || 'Administrador'
    );

    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    await renderTabla();
    showAlertSuccess('La respuesta fue registrada exitosamente.');
  });

  // ════════════════════════════════════════════════════════════════
  // 5. CICLAR ESTADO
  // ════════════════════════════════════════════════════════════════

  /** Avanza el estado del PQR al siguiente en el ciclo */
  window.ciclarEstado = async function(id) {
    const p = await PQRModel.getById(id);
    if (!p) return;

    const nuevo     = siguienteEstado(p.estado);
    const resultado = await PQRModel.cambiarEstado(id, nuevo);

    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    await renderTabla();
    showAlertSuccess(`El PQR pasó a estado "${nuevo}".`);
  };

  // ════════════════════════════════════════════════════════════════
  // 6. ELIMINAR PQR
  // ════════════════════════════════════════════════════════════════

  window.eliminarPQR = async function(id) {
    const p = await PQRModel.getById(id);
    if (!p) return;

    showAlertConfirm(
      'Eliminar PQR',
      `¿Eliminar el PQR de "${p.nombre}" sobre "${p.asunto}"? Esta acción no se puede deshacer.`,
      async function() {
        const resultado = await PQRModel.eliminar(id);
        if (!resultado.ok) {
          showAlertError(resultado.error);
          return;
        }

        await renderTabla();
        showAlertSuccess(`El PQR de "${p.nombre}" fue eliminado.`);
      }
    );
  };

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
