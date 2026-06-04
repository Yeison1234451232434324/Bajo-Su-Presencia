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

  // ── DataTable de recursos ────────────────────────────────────────────────
  let dtRecursos = null;

  function renderTabla() {
    actualizarEstadisticas();

    const data = RecursosModel.getAll().map(r => ({
      ...r,
      estadoDisp: r.disponible ? 'Disponible' : 'No disponible',
      stockEstado: r.cantidad === 0 ? 'Sin stock' : r.disponible ? 'Disponible' : 'No disponible'
    }));

    function renderRow(r) {
      const badgeCat  = categoriaBadge(r.categoria);
      const badgeDisp = r.disponible
        ? '<span class="badge badge-green">Disponible</span>'
        : '<span class="badge badge-red">No disponible</span>';
      const badgeStock = r.cantidad === 0
        ? `<span class="badge badge-red">${r.cantidad} ${r.unidad}</span>`
        : r.cantidad <= 5
          ? `<span class="badge badge-amber">${r.cantidad} ${r.unidad}</span>`
          : `<span class="badge badge-green">${r.cantidad} ${r.unidad}</span>`;

      return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.875rem 1.25rem;
          background:#fff;border:2px solid var(--border);border-radius:1rem;margin-bottom:0.5rem;
          flex-wrap:wrap;${!r.disponible ? 'opacity:0.65;background:#fafafa;' : ''}">
          <div class="recurso-cell" style="flex:2;min-width:180px;">
            <div class="recurso-icon ${iconoCategoria(r.categoria)}">
              <i class="bx ${iconoBx(r.categoria)}"></i>
            </div>
            <div>
              <p class="recurso-nombre">${r.nombre}</p>
              <p class="recurso-desc">${r.descripcion || '—'}</p>
            </div>
          </div>
          <span style="flex-shrink:0;">${badgeCat}</span>
          <span style="flex-shrink:0;">${badgeStock}</span>
          <span style="flex-shrink:0;">${badgeDisp}</span>
          <span style="flex-shrink:0;font-size:0.82rem;color:var(--muted);">${r.creado}</span>
          <div class="acciones-cell" style="flex-shrink:0;margin-left:auto;">
            <button class="btn-accion btn-editar-rec" onclick="abrirEditar(${r.id})" title="Editar recurso">
              <i class="bx bx-edit"></i>
            </button>
            <button class="btn-accion ${r.disponible ? 'btn-toggle-on' : 'btn-toggle-off'}"
              onclick="toggleRecurso(${r.id})" title="${r.disponible ? 'Desactivar' : 'Activar'} recurso">
              <i class="bx ${r.disponible ? 'bx-toggle-right' : 'bx-toggle-left'}"></i>
            </button>
            <button class="btn-accion btn-eliminar-rec" onclick="eliminarRecurso(${r.id})" title="Eliminar recurso">
              <i class="bx bx-trash"></i>
            </button>
          </div>
        </div>`;
    }

    if (!dtRecursos) {
      dtRecursos = new BSPDataTable({
        containerId:  'dt-recursos',
        data,
        pageSize:     10,
        searchFields: ['nombre', 'categoria', 'descripcion'],
        filters: [
          { key: 'categoria',  label: 'Categoría',     type: 'select',
            options: ['Mobiliario', 'Audio y Video', 'Iluminación', 'Papelería', 'Cocina', 'Otros'] },
          { key: 'estadoDisp', label: 'Disponibilidad', type: 'select',
            options: ['Disponible', 'No disponible'] },
          { key: 'stockEstado', label: 'Stock',         type: 'select',
            options: ['Disponible', 'No disponible', 'Sin stock'] },
        ],
        renderRow,
        exportable:   true,
        exportName:   'recursos',
        exportFields: ['nombre', 'categoria', 'cantidad', 'unidad', 'estadoDisp', 'creado'],
        exportLabels: ['Recurso', 'Categoría', 'Cantidad', 'Unidad', 'Estado', 'Registrado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-package"></i><p>No se encontraron recursos con esos criterios.</p></div>`
      });
      window.__bspDT['dt-recursos'] = dtRecursos;
      dtRecursos.init();
    } else {
      dtRecursos.refresh(data);
    }
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

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  const CATEGORIAS_VALIDAS = ['Mobiliario', 'Audio y Video', 'Iluminación', 'Papelería', 'Cocina', 'Otros'];

  // Bloquear caracteres peligrosos en el input numérico de cantidad
  BSPVal.blockNumericChars(document.getElementById('campo-cantidad'));

  /** Submit del formulario de crear/editar */
  formRecurso.addEventListener('submit', (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    /* Leer y limpiar todos los valores */
    const nombre      = BSPVal.cleanText(document.getElementById('campo-nombre-rec').value);
    const categoria   = document.getElementById('campo-categoria').value;
    const cantidadRaw = document.getElementById('campo-cantidad').value;
    const unidad      = BSPVal.cleanText(document.getElementById('campo-unidad').value);
    const descripcion = BSPVal.cleanText(document.getElementById('campo-descripcion-rec').value);

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('campo-nombre-rec','campo-categoria','campo-cantidad','campo-unidad','campo-descripcion-rec');
    let valido = true;
    let err;

    /* Nombre: mínimo 3, máximo 100, debe iniciar con letra */
    err = BSPVal.txt(nombre, { min: 3, max: 100, label: 'El nombre del recurso', iniciaLetra: true });
    if (err) { _err('campo-nombre-rec', err); valido = false; }

    /* Categoría: validada contra lista blanca */
    err = BSPVal.select(categoria, CATEGORIAS_VALIDAS, { label: 'La categoría' });
    if (err) { _err('campo-categoria', err); valido = false; }

    /* Cantidad: entero >= 0, máximo 99999 — bloquea 'e', '+', '-' */
    err = BSPVal.num(cantidadRaw, { min: 0, max: 99999, entero: true, label: 'La cantidad' });
    if (err) { _err('campo-cantidad', err); valido = false; }

    /* Unidad de medida: mínimo 1, máximo 30 */
    err = BSPVal.txt(unidad, { min: 1, max: 30, label: 'La unidad de medida' });
    if (err) { _err('campo-unidad', err); valido = false; }

    /* Descripción: opcional, pero si se escribe máximo 500 chars */
    if (descripcion.length > 0) {
      err = BSPVal.txt(descripcion, { min: 3, max: 500, label: 'La descripción' });
      if (err) { _err('campo-descripcion-rec', err); valido = false; }
    }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Datos limpios — cantidad como entero parseado, no como string */
    const data = {
      nombre,
      categoria,
      cantidad:    parseInt(cantidadRaw, 10), // número, no string
      unidad,
      descripcion
    };

    /* Llamada al modelo con try-catch */
    const resultado = BSPVal.safeCall(
      () => editandoId === null
        ? RecursosModel.create(data)
        : RecursosModel.update(editandoId, data),
      (msg) => { modalError.textContent = msg; modalError.style.display = 'block'; }
    );
    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    renderTabla();
    showAlertSuccess(
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
      showAlertError(resultado.error);
      return;
    }
    renderTabla();
    showAlertSuccess(
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

    showAlertConfirm(
      'Eliminar recurso',
      `¿Eliminar "${r.nombre}" del inventario?`,
      function() {
        const resultado = RecursosModel.remove(id);
        if (!resultado.ok) {
          showAlertError(resultado.error);
          return;
        }
        renderTabla();
        showAlertSuccess(`"${r.nombre}" fue eliminado del inventario.`);
      }
    );
  };

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
