/**
 * ============================================================
 * CONTROLADOR: oracion.controller.js
 * ============================================================
 * Maneja toda la lógica del módulo de Oración del Día.
 * Depende de: OracionModel (oracion.model.js)
 *
 * Funcionalidades:
 *   1. Vista previa en tiempo real mientras se escribe
 *   2. Publicar nueva oración (guarda en localStorage)
 *   3. Historial: lista de oraciones publicadas
 *   4. Editar oración existente (pre-llena el formulario)
 *   5. Eliminar oración con confirmación
 *   6. Modal de vista completa de una oración
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias DOM del formulario ──────────────────────────────────────
  const form        = document.getElementById('form-oracion');
  const txtTexto    = document.getElementById('prayerText');
  const txtVersiculo= document.getElementById('prayerVerse');
  const txtImagen   = document.getElementById('prayerImage');
  const spanCount   = document.getElementById('prayerCount');
  const preview     = document.getElementById('prayerPreview');
  const previewText = document.getElementById('previewText');
  const previewVerse= document.getElementById('previewVerse');
  const previewImgW = document.getElementById('previewImgWrap');
  const previewImg  = document.getElementById('previewImg');
  const btnSubmit   = document.getElementById('btn-submit-oracion');
  const btnCancelar = document.getElementById('btn-cancelar-edicion');

  // ID de la oración que se está editando (null = modo crear)
  let editandoId = null;

  // ════════════════════════════════════════════════════════════════
  // 1. VISTA PREVIA EN TIEMPO REAL
  // ════════════════════════════════════════════════════════════════

  /** Actualiza la vista previa cada vez que el usuario escribe */
  window.updatePrayerPreview = function () {
    const texto = txtTexto.value;
    const verso = txtVersiculo.value;
    const img   = txtImagen.value;

    // Contador de caracteres
    spanCount.textContent = texto.length;

    if (!texto) { preview.style.display = 'none'; return; }

    preview.style.display = 'block';
    previewText.textContent  = texto;
    previewVerse.textContent = verso;

    // Mostrar imagen si se proporcionó una URL
    if (img) {
      previewImg.src         = img;
      previewImgW.style.display = 'block';
    } else {
      previewImgW.style.display = 'none';
    }
  };

  // ════════════════════════════════════════════════════════════════
  // 2. PUBLICAR / ACTUALIZAR ORACIÓN
  // ════════════════════════════════════════════════════════════════

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
      texto:     txtTexto.value,
      versiculo: txtVersiculo.value,
      imagen:    txtImagen.value
    };

    let resultado;

    if (editandoId === null) {
      // Modo CREAR: guardar nueva oración
      resultado = OracionModel.crear(data);
    } else {
      // Modo EDITAR: actualizar oración existente
      resultado = OracionModel.actualizar(editandoId, data);
    }

    if (!resultado.ok) {
      showToast('Error', resultado.error);
      return;
    }

    // Limpiar formulario y volver a modo crear
    limpiarFormulario();
    renderHistorial();

    showToast(
      editandoId === null ? '¡Oración publicada!' : '¡Oración actualizada!',
      editandoId === null
        ? 'La oración fue guardada en el historial.'
        : 'Los cambios fueron guardados correctamente.'
    );

    editandoId = null;
  });

  // ════════════════════════════════════════════════════════════════
  // 3. EDITAR ORACIÓN
  // ════════════════════════════════════════════════════════════════

  /**
   * Pre-llena el formulario con los datos de la oración a editar
   * y hace scroll hacia arriba para que el usuario la vea.
   */
  window.editarOracion = function (id) {
    const oracion = OracionModel.getById(id);
    if (!oracion) return;

    editandoId = id;

    // Llenar campos del formulario
    txtTexto.value     = oracion.texto;
    txtVersiculo.value = oracion.versiculo;
    txtImagen.value    = oracion.imagen;

    // Actualizar vista previa con los datos cargados
    updatePrayerPreview();

    // Cambiar el botón a modo edición
    btnSubmit.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        style="width:1.15rem;height:1.15rem;">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Guardar Cambios
    `;
    btnCancelar.style.display = 'flex';

    // Scroll al formulario
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Cancela la edición y vuelve al modo crear */
  btnCancelar.addEventListener('click', () => {
    limpiarFormulario();
    editandoId = null;
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ELIMINAR ORACIÓN
  // ════════════════════════════════════════════════════════════════

  window.eliminarOracion = function (id) {
    const oracion = OracionModel.getById(id);
    if (!oracion) return;

    // Confirmación antes de eliminar
    if (!confirm(`¿Eliminar la oración del ${oracion.fecha}?\n\n"${oracion.texto.substring(0, 80)}..."`)) return;

    // Si se estaba editando esta misma oración, limpiar el formulario
    if (editandoId === id) {
      limpiarFormulario();
      editandoId = null;
    }

    OracionModel.eliminar(id);
    renderHistorial();
    showToast('Oración eliminada', 'La oración fue eliminada del historial.');
  };

  // ════════════════════════════════════════════════════════════════
  // 5. MODAL DE VISTA COMPLETA
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el texto completo de la oración */
  window.verOracion = function (id) {
    const oracion = OracionModel.getById(id);
    if (!oracion) return;

    document.getElementById('modal-oracion-fecha').textContent    = oracion.fecha;
    document.getElementById('modal-oracion-texto').textContent    = oracion.texto;
    document.getElementById('modal-oracion-versiculo').textContent = oracion.versiculo || '';

    const imgWrap = document.getElementById('modal-oracion-img-wrap');
    if (oracion.imagen) {
      document.getElementById('modal-oracion-img').src = oracion.imagen;
      imgWrap.style.display = 'block';
    } else {
      imgWrap.style.display = 'none';
    }

    document.getElementById('modal-overlay-oracion').classList.add('visible');
    document.getElementById('modal-ver-oracion').classList.add('visible');
  };

  // Cerrar modal de vista
  document.getElementById('btn-cerrar-modal-oracion').addEventListener('click', cerrarModalVer);
  document.getElementById('modal-overlay-oracion').addEventListener('click', cerrarModalVer);

  function cerrarModalVer() {
    document.getElementById('modal-overlay-oracion').classList.remove('visible');
    document.getElementById('modal-ver-oracion').classList.remove('visible');
  }

  // ════════════════════════════════════════════════════════════════
  // 6. RENDERIZAR HISTORIAL
  // ════════════════════════════════════════════════════════════════

  /** Renderiza la lista de oraciones publicadas */
  function renderHistorial() {
    const lista    = document.getElementById('lista-oraciones');
    const oraciones = OracionModel.getAll();

    if (oraciones.length === 0) {
      lista.innerHTML = `
        <div class="or-lista-vacia">
          <i class="bx bx-church"></i>
          <p>Aún no hay oraciones publicadas.</p>
          <small>Usa el formulario de arriba para publicar la primera.</small>
        </div>`;
      return;
    }

    lista.innerHTML = '';

    oraciones.forEach(oracion => {
      // Texto truncado para la tarjeta (máx 160 caracteres)
      const textoCorto = oracion.texto.length > 160
        ? oracion.texto.substring(0, 160) + '…'
        : oracion.texto;

      lista.innerHTML += `
        <div class="or-card" id="or-card-${oracion.id}">

          <!-- Imagen de portada si existe -->
          ${oracion.imagen
            ? `<div class="or-card-img-wrap">
                 <img src="${oracion.imagen}" alt="Imagen de la oración" class="or-card-img"
                   onerror="this.parentElement.style.display='none'" />
               </div>`
            : ''}

          <div class="or-card-body">

            <!-- Encabezado: fecha + botones de acción -->
            <div class="or-card-header">
              <span class="or-card-fecha">
                <i class="bx bx-calendar"></i> ${oracion.fecha}
              </span>
              <div class="or-card-acciones">
                <!-- Ver oración completa -->
                <button class="btn-accion-or btn-ver-or"
                  onclick="verOracion(${oracion.id})" title="Ver oración completa">
                  <i class="bx bx-show"></i>
                </button>
                <!-- Editar oración -->
                <button class="btn-accion-or btn-editar-or"
                  onclick="editarOracion(${oracion.id})" title="Editar oración">
                  <i class="bx bx-edit"></i>
                </button>
                <!-- Eliminar oración -->
                <button class="btn-accion-or btn-eliminar-or"
                  onclick="eliminarOracion(${oracion.id})" title="Eliminar oración">
                  <i class="bx bx-trash"></i>
                </button>
              </div>
            </div>

            <!-- Texto de la oración (truncado) -->
            <p class="or-card-texto">"${textoCorto}"</p>

            <!-- Versículo si existe -->
            ${oracion.versiculo
              ? `<p class="or-card-versiculo">
                   <i class="bx bx-book-open"></i> ${oracion.versiculo}
                 </p>`
              : ''}

          </div>
        </div>`;
    });
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  /** Limpia el formulario y restaura el botón al modo crear */
  function limpiarFormulario() {
    form.reset();
    preview.style.display    = 'none';
    spanCount.textContent    = '0';
    btnCancelar.style.display = 'none';
    btnSubmit.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        style="width:1.15rem;height:1.15rem;">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Publicar Oración
    `;
  }

  // ── Render inicial del historial ─────────────────────────────────────────
  renderHistorial();
});
