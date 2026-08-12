/**
 * Auditoría Controller — listado, filtros y detalle de la bitácora.
 */
document.addEventListener('DOMContentLoaded', async () => {

  const esc = (v) => (window.BSPVal?.escapeHtml
    ? window.BSPVal.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"'`/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
      }[c])));

  const fmtFechaHora = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Control de acceso contra el SERVIDOR (mismo patrón que donaciones.controller.js).
  // AuditoriaModel además exige el rol Administrador en el propio backend
  // (AuditoriaController::index), así que esto es una segunda capa —
  // cosmética/UX— y no la única barrera.
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const modalOverlay     = document.getElementById('modal-overlay');
  const modalDetalle     = document.getElementById('modal-au-detalle');
  const btnCerrarDetalle = document.getElementById('btn-cerrar-au-detalle');
  const btnDetalleCerrar = document.getElementById('btn-au-detalle-cerrar');
  const detalleContenido = document.getElementById('au-detalle-contenido');

  const contTotal   = document.getElementById('cont-au-total');
  const contExitos  = document.getElementById('cont-au-exitos');
  const contErrores = document.getElementById('cont-au-errores');

  // ── Badges ────────────────────────────────────────────────────────────────
  function resultadoBadge(resultado) {
    return resultado === 'error'
      ? '<span class="badge badge-red">Error</span>'
      : '<span class="badge badge-green">Éxito</span>';
  }

  const ACCION_LABELS = {
    crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar',
    activar: 'Activar', desactivar: 'Desactivar',
    responder: 'Responder', cambiar_estado: 'Cambiar estado'
  };
  function accionBadge(accion) {
    const label = ACCION_LABELS[accion] || esc(accion);
    return `<span class="badge badge-accion">${label}</span>`;
  }

  // ── DataTable ─────────────────────────────────────────────────────────────
  let dtAuditoria = null;
  let cache = [];

  async function renderTabla() {
    cache = await AuditoriaModel.listar({ limite: 500 });

    contTotal.textContent   = String(cache.length);
    contExitos.textContent  = String(cache.filter(a => a.resultado !== 'error').length);
    contErrores.textContent = String(cache.filter(a => a.resultado === 'error').length);

    function renderRow(a) {
      return `
        <div class="dt-row-auditoria">
          <div class="au-cell-fecha">
            <p class="au-fecha">${esc(fmtFechaHora(a.creadoEn))}</p>
          </div>
          <div class="au-cell-usuario">
            <p class="au-usuario-correo">${esc(a.usuarioCorreo)}</p>
            <p class="au-usuario-rol">${esc(a.usuarioRol)}</p>
          </div>
          <span class="dt-c-modulo">${esc(a.modulo)}</span>
          <span class="dt-c-accion">${accionBadge(a.accion)}</span>
          <span class="au-cell-desc">${esc(a.descripcion)}</span>
          <span class="dt-c-resultado">${resultadoBadge(a.resultado)}</span>
          <div class="acciones-cell">
            <button class="btn-accion btn-ver" data-action="ver-detalle-auditoria" data-id="${a.id}" title="Ver detalle"><i class="bx bx-show" aria-hidden="true"></i></button>
          </div>
        </div>`;
    }

    if (!dtAuditoria) {
      dtAuditoria = new BSPDataTable({
        containerId:  'dt-auditoria',
        data:         cache,
        pageSize:     10,
        searchFields: ['usuarioCorreo', 'descripcion', 'modulo'],
        filters: [
          { key: 'modulo',    label: 'Módulo',    type: 'select', options: AuditoriaModel.MODULOS },
          { key: 'accion',    label: 'Acción',     type: 'select', options: AuditoriaModel.ACCIONES },
          { key: 'resultado', label: 'Resultado',  type: 'select', options: AuditoriaModel.RESULTADOS },
          { key: 'fecha',     label: 'Desde',      type: 'date-from' },
          { key: 'fecha',     label: 'Hasta',      type: 'date-to'   },
        ],
        renderRow,
        headerHTML: `
          <span>Fecha</span>
          <span>Usuario</span>
          <span>Módulo</span>
          <span>Acción</span>
          <span>Descripción</span>
          <span>Resultado</span>
          <span class="acciones-cell">Ver</span>
        `,
        exportable:   true,
        exportName:   'auditoria',
        exportFields: ['fecha', 'usuarioCorreo', 'usuarioRol', 'modulo', 'accion', 'descripcion', 'resultado'],
        exportLabels: ['Fecha', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Descripción', 'Resultado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-shield-quarter" aria-hidden="true"></i><p>Aún no hay registros de auditoría.</p></div>`
      });
      window.__bspDT['dt-auditoria'] = dtAuditoria;
      dtAuditoria.init();
      // Delegación: fila generada dinámicamente por BSPDataTable (antes
      // onclick="verDetalleAuditoria(...)" inline en el template).
      document.getElementById('dt-auditoria-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="ver-detalle-auditoria"]');
        if (btn) verDetalleAuditoria(btn.dataset.id);
      });
    } else {
      dtAuditoria.refresh(cache);
    }
  }

  // ── Detalle ───────────────────────────────────────────────────────────────
  function verDetalleAuditoria(id) {
    const a = cache.find(x => x.id === id);
    if (!a) return;

    detalleContenido.innerHTML = `
      <div class="au-detalle-grid">
        <div>
          <p class="au-detalle-label">Usuario</p>
          <p class="au-detalle-valor">${esc(a.usuarioCorreo)}</p>
        </div>
        <div>
          <p class="au-detalle-label">Rol</p>
          <p class="au-detalle-valor">${esc(a.usuarioRol)}</p>
        </div>
        <div>
          <p class="au-detalle-label">Módulo</p>
          <p class="au-detalle-valor">${esc(a.modulo)}</p>
        </div>
        <div>
          <p class="au-detalle-label">Acción</p>
          <p class="au-detalle-valor">${accionBadge(a.accion)}</p>
        </div>
        <div>
          <p class="au-detalle-label">Resultado</p>
          <p class="au-detalle-valor">${resultadoBadge(a.resultado)}</p>
        </div>
        <div>
          <p class="au-detalle-label">Fecha y hora</p>
          <p class="au-detalle-valor">${esc(fmtFechaHora(a.creadoEn))}</p>
        </div>
        ${a.registroId ? `
        <div>
          <p class="au-detalle-label">Registro afectado</p>
          <p class="au-detalle-valor au-detalle-mono">${esc(a.registroId)}</p>
        </div>` : ''}
      </div>
      <div class="au-detalle-desc-wrap">
        <p class="au-detalle-label">Descripción</p>
        <p class="au-detalle-desc">${esc(a.descripcion)}</p>
      </div>
    `;

    BSPModal.abrir({ overlay: modalOverlay, modal: modalDetalle });
  }

  function cerrarDetalle() {
    BSPModal.cerrar({ overlay: modalOverlay, modal: modalDetalle });
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  btnCerrarDetalle.addEventListener('click', cerrarDetalle);
  btnDetalleCerrar.addEventListener('click', cerrarDetalle);
  modalOverlay.addEventListener('click', cerrarDetalle);

  // ── Render inicial ────────────────────────────────────────────────────────
  renderTabla();
});
