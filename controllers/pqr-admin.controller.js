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

document.addEventListener('DOMContentLoaded', () => {

  // ── Verificar que sea admin ──────────────────────────────────────────────
  const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  if (sesion.rol !== 'Administrador') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:serif;flex-direction:column;gap:1rem;">
        <h2 style="color:#1E3A8A;font-size:2rem;">Acceso Denegado</h2>
        <p style="color:#6b7280;">Solo el administrador puede acceder a esta sección.</p>
        <a href="../../public/login/login.html" style="color:#1E3A8A;font-weight:600;">Volver al inicio</a>
      </div>`;
    return;
  }

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const tablaBody        = document.getElementById('pqr-tbody');
  const inputBuscar      = document.getElementById('pqr-input-buscar');
  const filtroTipo       = document.getElementById('pqr-filtro-tipo');
  const filtroEstado     = document.getElementById('pqr-filtro-estado');
  const filtroPrioridad  = document.getElementById('pqr-filtro-prioridad');

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

  /** Actualiza las tarjetas de contadores */
  function actualizarContadores() {
    const stats = PQRModel.getEstadisticas();
    document.getElementById('stat-pqr-total').textContent      = stats.total;
    document.getElementById('stat-pqr-pendientes').textContent = stats.pendientes;
    document.getElementById('stat-pqr-enproceso').textContent  = stats.enProceso;
    document.getElementById('stat-pqr-resueltos').textContent  = stats.resueltos;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. TABLA DE PQR
  // ════════════════════════════════════════════════════════════════

  /** Renderiza la tabla aplicando búsqueda y filtros activos */
  function renderTabla() {
    const buscar    = inputBuscar.value.toLowerCase().trim();
    const tipo      = filtroTipo.value;
    const estado    = filtroEstado.value;
    const prioridad = filtroPrioridad.value;

    let lista = PQRModel.getAll();

    // Ordenar: primero los más recientes
    lista.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

    // Filtro de texto: busca en nombre, email, asunto y descripción
    if (buscar) {
      lista = lista.filter(p =>
        p.nombre.toLowerCase().includes(buscar)      ||
        p.email.toLowerCase().includes(buscar)       ||
        p.asunto.toLowerCase().includes(buscar)      ||
        p.descripcion.toLowerCase().includes(buscar)
      );
    }

    // Filtros de selección
    if (tipo)      lista = lista.filter(p => p.tipo === tipo);
    if (estado)    lista = lista.filter(p => p.estado === estado);
    if (prioridad) lista = lista.filter(p => p.prioridad === prioridad);

    actualizarContadores();
    tablaBody.innerHTML = '';

    if (lista.length === 0) {
      tablaBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:2.5rem;color:#9ca3af;">
            <i class="bx bx-message-detail" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>
            No se encontraron PQR con esos criterios.
          </td>
        </tr>`;
      return;
    }

    lista.forEach(p => {
      const badgeTipo      = tipoBadge(p.tipo);
      const badgeEstado    = estadoBadge(p.estado);
      const badgePrioridad = prioridadBadge(p.prioridad);
      const fecha          = formatFecha(p.creadoEn);

      tablaBody.innerHTML += `
        <tr>
          <td>${badgeTipo}</td>
          <td>
            <div class="pqr-nombre-cell">
              <span class="pqr-nombre">${escapeHtml(p.nombre)}</span>
              <span class="pqr-email">${escapeHtml(p.email)}</span>
            </div>
          </td>
          <td>
            <span class="pqr-asunto-text" title="${escapeHtml(p.asunto)}">
              ${escapeHtml(p.asunto)}
            </span>
          </td>
          <td>${badgePrioridad}</td>
          <td>${badgeEstado}</td>
          <td style="white-space:nowrap;font-size:0.9rem;color:var(--muted);">${fecha}</td>
          <td>
            <div class="pqr-acciones-cell">
              <!-- Ver / Responder -->
              <button class="pqr-btn-accion btn-ver-pqr"
                onclick="abrirModal(${p.id})"
                title="Ver detalle y responder">
                <i class="bx bx-show"></i>
              </button>
              <!-- Cambiar estado (ciclo) -->
              <button class="pqr-btn-accion btn-estado-pqr"
                onclick="ciclarEstado(${p.id})"
                title="Cambiar estado: ${siguienteEstado(p.estado)}">
                <i class="bx bx-transfer-alt"></i>
              </button>
              <!-- Eliminar -->
              <button class="pqr-btn-accion btn-eliminar-pqr"
                onclick="eliminarPQR(${p.id})"
                title="Eliminar PQR">
                <i class="bx bx-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });
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
  window.abrirModal = function(id) {
    const p = PQRModel.getById(id);
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

  btnGuardar.addEventListener('click', () => {
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

    const resultado = PQRModel.responder(
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
    renderTabla();
    showToast('Respuesta guardada', 'La respuesta fue registrada exitosamente.');
  });

  // ════════════════════════════════════════════════════════════════
  // 5. CICLAR ESTADO
  // ════════════════════════════════════════════════════════════════

  /** Avanza el estado del PQR al siguiente en el ciclo */
  window.ciclarEstado = function(id) {
    const p = PQRModel.getById(id);
    if (!p) return;

    const nuevo     = siguienteEstado(p.estado);
    const resultado = PQRModel.cambiarEstado(id, nuevo);

    if (!resultado.ok) {
      showToastError('Error', resultado.error);
      return;
    }

    renderTabla();
    showToast('Estado actualizado', `El PQR pasó a estado "${nuevo}".`);
  };

  // ════════════════════════════════════════════════════════════════
  // 6. ELIMINAR PQR
  // ════════════════════════════════════════════════════════════════

  window.eliminarPQR = function(id) {
    const p = PQRModel.getById(id);
    if (!p) return;

    if (!confirm(`¿Eliminar el PQR de "${p.nombre}" sobre "${p.asunto}"?\nEsta acción no se puede deshacer.`)) return;

    const resultado = PQRModel.eliminar(id);
    if (!resultado.ok) {
      showToastError('Error', resultado.error);
      return;
    }

    renderTabla();
    showToast('PQR eliminado', `El PQR de "${p.nombre}" fue eliminado.`);
  };

  // ════════════════════════════════════════════════════════════════
  // FILTROS Y BÚSQUEDA
  // ════════════════════════════════════════════════════════════════

  inputBuscar.addEventListener('input', renderTabla);
  filtroTipo.addEventListener('change', renderTabla);
  filtroEstado.addEventListener('change', renderTabla);
  filtroPrioridad.addEventListener('change', renderTabla);

  // ── Toast de error ───────────────────────────────────────────────────────
  function showToastError(title, desc) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id        = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `<div class="toast-title">❌ ${title}</div><div class="toast-desc">${desc}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
