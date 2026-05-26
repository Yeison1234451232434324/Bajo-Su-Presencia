/**
 * ============================================================
 * CONTROLADOR: recursos.controller.js
 * ============================================================
 * Maneja toda la lógica de la vista de Gestión de Recursos.
 * Depende de: RecursosModel (recursos.model.js)
 *
 * Secciones:
 *   1. Tarjetas de estadísticas del inventario
 *   2. Barra de búsqueda y filtros (categoría, disponibilidad)
 *   3. Tabla de recursos con acciones (editar, toggle, eliminar)
 *   4. Modal crear / editar recurso
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
  const tablaBody       = document.getElementById('recursos-tbody');
  const inputBuscar     = document.getElementById('input-buscar');
  const filtroCategoria = document.getElementById('filtro-categoria');
  const filtroDisp      = document.getElementById('filtro-disp');
  const btnNuevo        = document.getElementById('btn-nuevo-recurso');

  // Modal crear/editar
  const modal          = document.getElementById('modal-recurso');
  const modalOverlay   = document.getElementById('modal-overlay-rec');
  const modalTitle     = document.getElementById('modal-title-rec');
  const formRecurso    = document.getElementById('form-recurso');
  const modalError     = document.getElementById('modal-error-rec');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal-rec');
  const btnCancelar    = document.getElementById('btn-cancelar-rec');

  // Estado interno
  let editandoId = null; // null = crear, número = editar

  // ════════════════════════════════════════════════════════════════
  // 1. ESTADÍSTICAS
  // ════════════════════════════════════════════════════════════════

  /** Actualiza las tarjetas de contadores en la parte superior */
  function actualizarEstadisticas() {
    const stats = RecursosModel.getEstadisticas();
    document.getElementById('stat-total').textContent         = stats.total;
    document.getElementById('stat-disponibles').textContent   = stats.disponibles;
    document.getElementById('stat-nodisponibles').textContent = stats.noDisponibles;
    document.getElementById('stat-sinstock').textContent      = stats.sinStock;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. TABLA DE RECURSOS
  // ════════════════════════════════════════════════════════════════

  /** Renderiza la tabla aplicando búsqueda y filtros activos */
  function renderTabla() {
    const buscar     = inputBuscar.value.toLowerCase().trim();
    const categoria  = filtroCategoria.value;
    const dispFiltro = filtroDisp.value;

    let recursos = RecursosModel.getAll();

    // Filtro de texto: busca en nombre, categoría y descripción
    if (buscar) {
      recursos = recursos.filter(r =>
        r.nombre.toLowerCase().includes(buscar)    ||
        r.categoria.toLowerCase().includes(buscar) ||
        r.descripcion.toLowerCase().includes(buscar)
      );
    }

    // Filtro por categoría
    if (categoria) recursos = recursos.filter(r => r.categoria === categoria);

    // Filtro por disponibilidad / stock
    if (dispFiltro === 'disponible')   recursos = recursos.filter(r => r.disponible);
    if (dispFiltro === 'nodisponible') recursos = recursos.filter(r => !r.disponible);
    if (dispFiltro === 'sinstock')     recursos = recursos.filter(r => r.cantidad === 0);

    actualizarEstadisticas();
    tablaBody.innerHTML = '';

    if (recursos.length === 0) {
      tablaBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:2.5rem;color:#9ca3af;">
            <i class="bx bx-package" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>
            No se encontraron recursos con esos criterios.
          </td>
        </tr>`;
      return;
    }

    recursos.forEach(r => {
      const badgeCat  = categoriaBadge(r.categoria);

      const badgeDisp = r.disponible
        ? '<span class="badge badge-green">Disponible</span>'
        : '<span class="badge badge-red">No disponible</span>';

      // Badge de stock: rojo si 0, amarillo si ≤5, verde si hay suficiente
      const badgeStock = r.cantidad === 0
        ? `<span class="badge badge-red">${r.cantidad} ${r.unidad}</span>`
        : r.cantidad <= 5
          ? `<span class="badge badge-amber">${r.cantidad} ${r.unidad}</span>`
          : `<span class="badge badge-green">${r.cantidad} ${r.unidad}</span>`;

      tablaBody.innerHTML += `
        <tr class="${!r.disponible ? 'fila-inactiva' : ''}">
          <td>
            <div class="recurso-cell">
              <div class="recurso-icon ${iconoCategoria(r.categoria)}">
                <i class="bx ${iconoBx(r.categoria)}"></i>
              </div>
              <div>
                <p class="recurso-nombre">${r.nombre}</p>
                <p class="recurso-desc">${r.descripcion || '—'}</p>
              </div>
            </div>
          </td>
          <td>${badgeCat}</td>
          <td>${badgeStock}</td>
          <td>${badgeDisp}</td>
          <td>${r.creado}</td>
          <td>
            <div class="acciones-cell">
              <!-- Editar recurso -->
              <button class="btn-accion btn-editar-rec"
                onclick="abrirEditar(${r.id})" title="Editar recurso">
                <i class="bx bx-edit"></i>
              </button>
              <!-- Activar / Desactivar disponibilidad -->
              <button class="btn-accion ${r.disponible ? 'btn-toggle-on' : 'btn-toggle-off'}"
                onclick="toggleRecurso(${r.id})"
                title="${r.disponible ? 'Desactivar' : 'Activar'} recurso">
                <i class="bx ${r.disponible ? 'bx-toggle-right' : 'bx-toggle-left'}"></i>
              </button>
              <!-- Eliminar recurso -->
              <button class="btn-accion btn-eliminar-rec"
                onclick="eliminarRecurso(${r.id})" title="Eliminar recurso">
                <i class="bx bx-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });
  }

  // ── Helpers de estilo por categoría ─────────────────────────────────────

  function categoriaBadge(cat) {
    const map = {
      'Mobiliario':    '<span class="badge cat-mobiliario">Mobiliario</span>',
      'Audio y Video': '<span class="badge cat-audio">Audio y Video</span>',
      'Iluminación':   '<span class="badge cat-iluminacion">Iluminación</span>',
      'Papelería':     '<span class="badge cat-papeleria">Papelería</span>',
      'Cocina':        '<span class="badge cat-cocina">Cocina</span>',
      'Otros':         '<span class="badge cat-otros">Otros</span>'
    };
    return map[cat] || `<span class="badge">${cat}</span>`;
  }

  function iconoCategoria(cat) {
    const map = {
      'Mobiliario':    'icon-mobiliario',
      'Audio y Video': 'icon-audio',
      'Iluminación':   'icon-iluminacion',
      'Papelería':     'icon-papeleria',
      'Cocina':        'icon-cocina',
      'Otros':         'icon-otros'
    };
    return map[cat] || 'icon-otros';
  }

  function iconoBx(cat) {
    const map = {
      'Mobiliario':    'bx-chair',
      'Audio y Video': 'bx-microphone',
      'Iluminación':   'bx-bulb',
      'Papelería':     'bx-file',
      'Cocina':        'bx-bowl-hot',
      'Otros':         'bx-package'
    };
    return map[cat] || 'bx-package';
  }

  // ════════════════════════════════════════════════════════════════
  // 3. MODAL CREAR / EDITAR
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal en modo CREAR */
  function abrirCrear() {
    editandoId = null;
    modalTitle.textContent   = 'Nuevo Recurso';
    formRecurso.reset();
    modalError.style.display = 'none';
    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
  }

  /** Abre el modal en modo EDITAR con los datos del recurso pre-llenados */
  window.abrirEditar = function(id) {
    const r = RecursosModel.getById(id);
    if (!r) return;

    editandoId             = id;
    modalTitle.textContent = 'Editar Recurso';

    document.getElementById('campo-nombre-rec').value      = r.nombre;
    document.getElementById('campo-categoria').value       = r.categoria;
    document.getElementById('campo-cantidad').value        = r.cantidad;
    document.getElementById('campo-unidad').value          = r.unidad;
    document.getElementById('campo-descripcion-rec').value = r.descripcion;

    modalError.style.display = 'none';
    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
  };

  /** Cierra el modal y limpia el formulario */
  function cerrarModal() {
    modal.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    formRecurso.reset();
    editandoId = null;
  }

  /** Submit del formulario de crear/editar */
  formRecurso.addEventListener('submit', (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    const data = {
      nombre:      document.getElementById('campo-nombre-rec').value,
      categoria:   document.getElementById('campo-categoria').value,
      cantidad:    document.getElementById('campo-cantidad').value,
      unidad:      document.getElementById('campo-unidad').value,
      descripcion: document.getElementById('campo-descripcion-rec').value
    };

    const resultado = editandoId === null
      ? RecursosModel.create(data)
      : RecursosModel.update(editandoId, data);

    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    renderTabla();
    showToast(
      editandoId === null ? 'Recurso creado' : 'Recurso actualizado',
      `"${data.nombre}" fue ${editandoId === null ? 'agregado al' : 'actualizado en el'} inventario.`
    );
  });

  btnNuevo.addEventListener('click', abrirCrear);
  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  // ════════════════════════════════════════════════════════════════
  // 4. TOGGLE DISPONIBILIDAD
  // ════════════════════════════════════════════════════════════════

  window.toggleRecurso = function(id) {
    const resultado = RecursosModel.toggleDisponible(id);
    if (!resultado.ok) {
      showToastError('No permitido', resultado.error);
      return;
    }
    renderTabla();
    showToast(
      resultado.disponible ? 'Recurso activado' : 'Recurso desactivado',
      resultado.disponible
        ? 'El recurso ya está disponible para asignar a eventos.'
        : 'El recurso fue marcado como no disponible.'
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. ELIMINAR RECURSO
  // ════════════════════════════════════════════════════════════════

  window.eliminarRecurso = function(id) {
    const r = RecursosModel.getById(id);
    if (!r) return;

    if (!confirm(`¿Eliminar "${r.nombre}" del inventario?`)) return;

    const resultado = RecursosModel.remove(id);
    if (!resultado.ok) {
      showToastError('Error', resultado.error);
      return;
    }
    renderTabla();
    showToast('Recurso eliminado', `"${r.nombre}" fue eliminado del inventario.`);
  };

  // ════════════════════════════════════════════════════════════════
  // FILTROS Y BÚSQUEDA
  // ════════════════════════════════════════════════════════════════

  inputBuscar.addEventListener('input', renderTabla);
  filtroCategoria.addEventListener('change', renderTabla);
  filtroDisp.addEventListener('change', renderTabla);

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
