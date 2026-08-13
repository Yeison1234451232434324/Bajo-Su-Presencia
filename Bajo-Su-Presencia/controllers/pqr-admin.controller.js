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
  const modalLockNote    = document.getElementById('pqr-modal-resuelto-nota');

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
      const resuelto       = p.estado === 'Resuelto';

      return `
        <div class="pqr-row">
          <div class="pqr-row-top">
            ${badgeTipo}
            ${badgePrioridad}
            ${badgeEstado}
            <span class="pqr-row-asunto" title="${escapeHtml(p.asunto)}">
              ${escapeHtml(p.asunto)}
            </span>
            <span class="pqr-row-fecha">${fecha}</span>
            <div class="pqr-acciones-cell">
              <button class="pqr-btn-accion btn-ver-pqr" data-action="abrir-pqr" data-id="${p.id}" title="Ver detalle${resuelto ? '' : ' y responder'}">
                <i class="bx bx-show" aria-hidden="true"></i>
              </button>
              <button class="pqr-btn-accion btn-estado-pqr" data-action="ciclar-estado-pqr" data-id="${p.id}"
                ${resuelto ? 'disabled title="Resuelto: solo se puede eliminar"' : `title="Cambiar estado: ${siguienteEstado(p.estado)}"`}>
                <i class="bx bx-transfer-alt" aria-hidden="true"></i>
              </button>
              <button class="pqr-btn-accion btn-eliminar-pqr" data-action="eliminar-pqr" data-id="${p.id}" title="Eliminar PQR">
                <i class="bx bx-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="pqr-row-contacto">
            <i class="bx bx-user" aria-hidden="true"></i>
            ${escapeHtml(p.nombre)}
            &nbsp;·&nbsp;
            <i class="bx bx-envelope" aria-hidden="true"></i>
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
      document.getElementById('dt-pqr-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'abrir-pqr') abrirModal(id);
        else if (btn.dataset.action === 'ciclar-estado-pqr') ciclarEstado(id);
        else if (btn.dataset.action === 'eliminar-pqr') eliminarPQR(id);
      });
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

  /**
   * Busca un PQR ya cargado en memoria (dtPQR.allData, poblado por
   * renderTabla con la misma proyección de columnas que getById) en vez
   * de volver a pedirlo a Supabase en cada clic de fila. Si por algún
   * motivo no está en memoria (p. ej. la tabla aún no se ha cargado),
   * hace fallback a PQRModel.getById para no romper el flujo.
   */
  async function _obtenerPQR(id) {
    const enMemoria = dtPQR?.allData?.find(p => String(p.id) === String(id));
    if (enMemoria) return enMemoria;
    return await PQRModel.getById(id);
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
  async function abrirModal(id) {
    const p = await _obtenerPQR(id);
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

    // Una PQR "Resuelto" queda de solo lectura: no se puede responder ni
    // cambiar su estado (el backend también lo rechaza), solo eliminar.
    const resuelto = p.estado === 'Resuelto';
    document.getElementById('modal-campo-respuesta').disabled = resuelto;
    document.getElementById('modal-campo-estado').disabled    = resuelto;
    btnGuardar.disabled    = resuelto;
    btnGuardar.title       = resuelto ? 'Esta PQR ya fue resuelta y no se puede modificar.' : '';
    modalLockNote.style.display = resuelto ? 'block' : 'none';

    // Limpiar error
    modalError.style.display = 'none';
    modalError.textContent   = '';

    // Mostrar modal
    BSPModal.abrir({ overlay: modalOverlay, modal });
  }

  /** Cierra el modal */
  function cerrarModal() {
    BSPModal.cerrar({ overlay: modalOverlay, modal });
    pqrActualId = null;
  }

  modalClose.addEventListener('click', cerrarModal);
  btnCancelarModal.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  // ════════════════════════════════════════════════════════════════
  // 4. GUARDAR RESPUESTA
  // ════════════════════════════════════════════════════════════════

  // Cerrojo anti-doble-clic (mismo patrón que auth.controller.js).
  let enviandoRespuestaPQR = false;

  btnGuardar.addEventListener('click', async () => {
    if (!pqrActualId) return;
    if (enviandoRespuestaPQR) return;

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

    enviandoRespuestaPQR = true;
    btnGuardar.disabled = true;
    btnGuardar.setAttribute('aria-busy', 'true');

    const resultado = await PQRModel.responder(
      pqrActualId,
      respuesta,
      nuevoEstado,
      sesion.nombre || 'Administrador'
    );

    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      enviandoRespuestaPQR = false;
      btnGuardar.disabled = false;
      btnGuardar.removeAttribute('aria-busy');
      return;
    }

    enviandoRespuestaPQR = false;
    btnGuardar.disabled = false;
    btnGuardar.removeAttribute('aria-busy');
    cerrarModal();
    await renderTabla();
    showAlertSuccess('La respuesta ya fue enviada.');
  });

  // ════════════════════════════════════════════════════════════════
  // 5. CICLAR ESTADO
  // ════════════════════════════════════════════════════════════════

  /** Avanza el estado del PQR al siguiente en el ciclo */
  async function ciclarEstado(id) {
    const p = await _obtenerPQR(id);
    if (!p) return;

    if (p.estado === 'Resuelto') {
      showAlertError('Esta PQR ya fue resuelta y no se puede modificar. Solo puede eliminarse.');
      return;
    }

    const nuevo     = siguienteEstado(p.estado);
    const resultado = await PQRModel.cambiarEstado(id, nuevo);

    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    await renderTabla();
    showAlertSuccess(`El PQR pasó a estado "${nuevo}".`);
  }

  // ════════════════════════════════════════════════════════════════
  // 6. ELIMINAR PQR
  // ════════════════════════════════════════════════════════════════

  async function eliminarPQR(id) {
    const p = await _obtenerPQR(id);
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
  }

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
