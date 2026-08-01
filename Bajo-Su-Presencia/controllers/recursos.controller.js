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

document.addEventListener('DOMContentLoaded', async () => {

  // ── Verificar que sea admin ──────────────────────────────────────────────
  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

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

  /** Actualiza las tarjetas de contadores a partir de la lista ya cargada */
  function actualizarEstadisticas(lista) {
    document.getElementById('stat-total').textContent         = lista.length;
    document.getElementById('stat-disponibles').textContent   = lista.filter(r => r.disponible).length;
    document.getElementById('stat-nodisponibles').textContent = lista.filter(r => !r.disponible).length;
    document.getElementById('stat-sinstock').textContent      = lista.filter(r => r.cantidad === 0).length;
  }

  // ════════════════════════════════════════════════════════════════
  // 2. TABLA DE RECURSOS
  // ════════════════════════════════════════════════════════════════

  // ── DataTable de recursos ────────────────────────────────────────────────
  let dtRecursos = null;

  async function renderTabla() {
    const lista = await RecursosModel.getAll();
    actualizarEstadisticas(lista);

    const data = lista.map(r => ({
      ...r,
      estadoDisp: r.disponible ? 'Disponible' : 'No disponible',
      stockEstado: r.cantidad === 0 ? 'Sin stock' : r.disponible ? 'Disponible' : 'No disponible'
    }));

    function renderRow(r) {
      const badgeCat  = categoriaBadge(r.categoria);
      const badgeDisp = r.disponible
        ? '<span class="badge badge-green">Disponible</span>'
        : '<span class="badge badge-red">No disponible</span>';
      return `
        <div class="recurso-row${!r.disponible ? ' recurso-row--inactivo' : ''}">
          <div class="recurso-cell">
            <div class="recurso-icon ${iconoCategoria(r.categoria)}">
              <i class="bx ${iconoBx(r.categoria)}" aria-hidden="true"></i>
            </div>
            <div>
              <p class="recurso-nombre">${esc(r.nombre)}</p>
              <p class="recurso-desc">${esc(r.descripcion || '—')}</p>
            </div>
          </div>
          <div class="recurso-col">${badgeCat}</div>
          <div class="recurso-col">${badgeDisp}</div>
          <div class="recurso-col recurso-fecha">${esc(r.creado)}</div>
          <div class="acciones-cell">
            <button class="btn-accion btn-editar-rec" onclick="abrirEditar('${r.id}')" title="Editar recurso">
              <i class="bx bx-edit" aria-hidden="true"></i>
            </button>
            <button class="btn-accion ${r.disponible ? 'btn-toggle-on' : 'btn-toggle-off'}"
              onclick="toggleRecurso('${r.id}')" title="${r.disponible ? 'Desactivar' : 'Activar'} recurso">
              <i class="bx ${r.disponible ? 'bx-toggle-right' : 'bx-toggle-left'}"></i>
            </button>
            <button class="btn-accion btn-eliminar-rec" onclick="eliminarRecurso('${r.id}')" title="Eliminar recurso">
              <i class="bx bx-trash" aria-hidden="true"></i>
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
        exportFields: ['nombre', 'categoria', 'cantidad', 'estadoDisp', 'creado'],
        exportLabels: ['Recurso', 'Categoría', 'Cantidad', 'Estado', 'Registrado'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-package" aria-hidden="true"></i><p>No se encontraron recursos con esos criterios.</p></div>`
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
    // trigger explícito: document.activeElement no es confiable en Safari/Firefox,
    // que no enfocan un <button> al hacer clic con mouse (sí lo hace Chrome/Edge).
    BSPModal.abrir({ overlay: modalOverlay, modal, trigger: btnNuevo });
  }

  /** Abre el modal en modo EDITAR con los datos del recurso pre-llenados */
  window.abrirEditar = async function(id) {
    const r = await RecursosModel.getById(id);
    if (!r) return;

    editandoId             = id;
    modalTitle.textContent = 'Editar Recurso';

    document.getElementById('campo-nombre-rec').value      = r.nombre;
    document.getElementById('campo-categoria').value       = r.categoria;
    document.getElementById('campo-cantidad').value        = r.cantidad;
    document.getElementById('campo-descripcion-rec').value = r.descripcion;

    modalError.style.display = 'none';
    BSPModal.abrir({ overlay: modalOverlay, modal });
  };

  /** Cierra el modal y limpia el formulario */
  function cerrarModal() {
    BSPModal.cerrar({ overlay: modalOverlay, modal });
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
  formRecurso.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    /* Leer y limpiar todos los valores */
    const nombre      = BSPVal.cleanText(document.getElementById('campo-nombre-rec').value);
    const categoria   = document.getElementById('campo-categoria').value;
    const cantidadRaw = document.getElementById('campo-cantidad').value;
    const descripcion = BSPVal.cleanText(document.getElementById('campo-descripcion-rec').value);

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('campo-nombre-rec','campo-categoria','campo-cantidad','campo-descripcion-rec');
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
      descripcion
    };

    /* Llamada async al modelo (Supabase) */
    let resultado;
    try {
      resultado = editandoId === null
        ? await RecursosModel.crear(data)
        : await RecursosModel.actualizar(editandoId, data);
    } catch (ex) {
      modalError.textContent = 'Error de conexión. Revisa tu internet e intenta de nuevo.';
      modalError.style.display = 'block';
      return;
    }
    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    await renderTabla();
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

  window.toggleRecurso = async function(id) {
    const resultado = await RecursosModel.toggleDisponible(id);
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }
    await renderTabla();
    showAlertSuccess(
      resultado.disponible
        ? 'El recurso ya está disponible para asignar a eventos.'
        : 'El recurso fue marcado como no disponible.'
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. ELIMINAR RECURSO
  // ════════════════════════════════════════════════════════════════

  window.eliminarRecurso = async function(id) {
    const r = await RecursosModel.getById(id);
    if (!r) return;

    showAlertConfirm(
      'Eliminar recurso',
      `¿Eliminar "${r.nombre}" del inventario?`,
      async function() {
        const resultado = await RecursosModel.eliminar(id);
        if (!resultado.ok) {
          showAlertError(resultado.error);
          return;
        }
        await renderTabla();
        showAlertSuccess(`"${r.nombre}" fue eliminado del inventario.`);
      }
    );
  };

  // ── Render inicial ───────────────────────────────────────────────────────
  renderTabla();
});
