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

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador','Colaborador']);
  if (!sesion) return;

  // ── Rol del usuario activo ────────────────────────────────────────────────
  const _esColaborador = ((JSON.parse(localStorage.getItem('usuarioLogueado') || '{}')).rol || '') === 'Colaborador';

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

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Leer y limpiar todos los valores */
    const texto    = BSPVal.cleanText(txtTexto.value);
    const versiculo= BSPVal.cleanText(txtVersiculo.value);
    const imagenUrl= txtImagen.value.trim();

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('prayerText','prayerVerse','prayerImage');
    let valido = true;
    let err;

    /* Texto de oración: mínimo 10, máximo 2000, no puede ser solo números */
    err = BSPVal.txt(texto, { min: 10, max: 2000, label: 'La oración' });
    if (err) { _err('prayerText', err); valido = false; }
    else if (/^\d[\d\s]*$/.test(texto)) {
      _err('prayerText', 'La oración no puede ser solo números.'); valido = false;
    }

    /* Versículo: opcional, pero si se escribe máximo 200 chars */
    if (versiculo.length > 0) {
      err = BSPVal.txt(versiculo, { min: 2, max: 200, label: 'El versículo de referencia' });
      if (err) { _err('prayerVerse', err); valido = false; }
    }

    /* Imagen: URL válida si se proporciona (campo opcional) */
    err = BSPVal.url(imagenUrl, { required: false, label: 'La URL de imagen' });
    if (err) { _err('prayerImage', err); valido = false; }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Datos limpios al modelo */
    const data = { texto, versiculo, imagen: imagenUrl };

    /* Llamada async al modelo (Supabase) */
    let resultado;
    try {
      resultado = editandoId === null
        ? await OracionModel.crear(data)
        : await OracionModel.actualizar(editandoId, data);
    } catch (ex) {
      showAlertError('Error de conexión. Revisa tu internet e intenta de nuevo.');
      return;
    }
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    // Limpiar formulario y volver a modo crear
    limpiarFormulario();
    await renderHistorial();

    showAlertSuccess(
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
  window.editarOracion = async function (id) {
    const oracion = await OracionModel.getById(id);
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

  window.eliminarOracion = async function (id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar oraciones.'); return; }
    const oracion = await OracionModel.getById(id);
    if (!oracion) return;

    // Confirmación antes de eliminar
    showAlertConfirm(
      'Eliminar oración',
      `¿Eliminar la oración del ${oracion.fecha}?\n\n"${oracion.texto.substring(0, 80)}..."`,
      async function() {
        // Si se estaba editando esta misma oración, limpiar el formulario
        if (editandoId === id) {
          limpiarFormulario();
          editandoId = null;
        }

        const res = await OracionModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await renderHistorial();
        showAlertSuccess('La oración fue eliminada del historial.');
      }
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. MODAL DE VISTA COMPLETA
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el texto completo de la oración */
  window.verOracion = async function (id) {
    const oracion = await OracionModel.getById(id);
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

    BSPModal.abrir({
      overlay: document.getElementById('modal-overlay-oracion'),
      modal:   document.getElementById('modal-ver-oracion')
    });
  };

  // Cerrar modal de vista
  document.getElementById('btn-cerrar-modal-oracion').addEventListener('click', cerrarModalVer);
  document.getElementById('modal-overlay-oracion').addEventListener('click', cerrarModalVer);

  function cerrarModalVer() {
    BSPModal.cerrar({
      overlay: document.getElementById('modal-overlay-oracion'),
      modal:   document.getElementById('modal-ver-oracion')
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 6. RENDERIZAR HISTORIAL — DataTable v3 con filtros
  // ════════════════════════════════════════════════════════════════

  let dtOraciones = null;

  async function renderHistorial() {
    const oraciones = await OracionModel.getAll();

    function renderCard(oracion) {
      const textoCorto = oracion.texto.length > 160
        ? oracion.texto.substring(0, 160) + '…'
        : oracion.texto;

      return `
        <div class="or-card" id="or-card-${oracion.id}">
          ${oracion.imagen
            ? `<div class="or-card-img-wrap">
                 <img src="${esc(oracion.imagen)}" alt="Imagen de la oración" class="or-card-img"
                   onerror="this.parentElement.style.display='none'" />
               </div>`
            : ''}
          <div class="or-card-body">
            <div class="or-card-header">
              <span class="or-card-fecha">
                <i class="bx bx-calendar" aria-hidden="true"></i> ${esc(oracion.fecha)}
              </span>
              <div class="or-card-acciones">
                <button class="btn-accion-or btn-ver-or"
                  onclick="verOracion('${oracion.id}')" title="Ver oración completa">
                  <i class="bx bx-show" aria-hidden="true"></i>
                </button>
                <button class="btn-accion-or btn-editar-or"
                  onclick="editarOracion('${oracion.id}')" title="Editar oración">
                  <i class="bx bx-edit" aria-hidden="true"></i>
                </button>
                ${!_esColaborador ? `
                <button class="btn-accion-or btn-eliminar-or"
                  onclick="eliminarOracion('${oracion.id}')" title="Eliminar oración">
                  <i class="bx bx-trash" aria-hidden="true"></i>
                </button>` : ''}
              </div>
            </div>
            <p class="or-card-texto">"${esc(textoCorto)}"</p>
            ${oracion.versiculo
              ? `<p class="or-card-versiculo">
                   <i class="bx bx-book-open" aria-hidden="true"></i> ${oracion.versiculo}
                 </p>`
              : ''}
          </div>
        </div>`;
    }

    if (!dtOraciones) {
      dtOraciones = new BSPDataTable({
        containerId:  'lista-oraciones',
        data:         oraciones,
        pageSize:     6,
        searchFields: ['texto', 'versiculo', 'fecha'],
        filters: [
          { key: 'fechaISO', label: 'Desde', type: 'date-from' },
          { key: 'fechaISO', label: 'Hasta', type: 'date-to' },
        ],
        renderRow:    renderCard,
        exportable:   true,
        exportName:   'oraciones',
        exportFields: ['fecha', 'texto', 'versiculo'],
        exportLabels: ['Fecha', 'Texto', 'Versículo'],
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-church" aria-hidden="true"></i><p>Aún no hay oraciones publicadas.</p></div>`
      });
      window.__bspDT['lista-oraciones'] = dtOraciones;
      dtOraciones.init();
    } else {
      dtOraciones.refresh(oraciones);
    }
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
