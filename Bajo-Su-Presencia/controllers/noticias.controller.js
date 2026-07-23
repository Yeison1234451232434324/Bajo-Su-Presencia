/**
 * ============================================================
 * CONTROLADOR: noticias.controller.js
 * ============================================================
 * Maneja toda la lógica del módulo de Noticias.
 * Depende de: NoticiasModel (noticias.model.js)
 *
 * Funcionalidades:
 *   1. Vista previa en tiempo real de la tarjeta de noticia
 *   2. Publicar nueva noticia (guarda en localStorage)
 *   3. Historial: lista de noticias publicadas como tarjetas
 *   4. Editar noticia existente (pre-llena el formulario)
 *   5. Eliminar noticia con confirmación
 *   6. Modal de lectura completa de una noticia
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias DOM del formulario ──────────────────────────────────────
  const form         = document.getElementById('form-noticia');
  const inpTitulo    = document.getElementById('news-titulo');
  const inpResumen   = document.getElementById('news-resumen');
  const inpContenido = document.getElementById('news-contenido');
  const inpAutor     = document.getElementById('news-autor');
  const inpFecha     = document.getElementById('news-fecha');
  const inpImagen    = document.getElementById('news-imagen');
  const btnSubmit    = document.getElementById('btn-submit-noticia');
  const btnCancelar  = document.getElementById('btn-cancelar-noticia');

  // Referencias DOM de la vista previa
  const previewBox      = document.getElementById('news-preview-box');
  const prevImg         = document.getElementById('prev-img');
  const prevImgWrap     = document.getElementById('prev-img-wrap');
  const prevTitulo      = document.getElementById('prev-titulo');
  const prevResumen     = document.getElementById('prev-resumen');
  const prevAutor       = document.getElementById('prev-autor');
  const prevFecha       = document.getElementById('prev-fecha');

  // ID de la noticia que se está editando (null = modo crear)
  let editandoId = null;

  // ── Rol del usuario activo ────────────────────────────────────────────────
  const _sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  const _esColaborador = (_sesion.rol || '') === 'Colaborador';

  // ── Nombre del usuario logueado (para pre-llenar el campo Autor) ──────────
  // La sesión ya guarda el nombre completo (auth.controller lo toma del perfil).
  let autorActual = _sesion.nombre || '';
  // Auto-llenar el campo Autor al cargar la página
  if (inpAutor && autorActual) inpAutor.value = autorActual;

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  // ════════════════════════════════════════════════════════════════
  // 1. VISTA PREVIA EN TIEMPO REAL
  // ════════════════════════════════════════════════════════════════

  /**
   * Actualiza la tarjeta de vista previa cada vez que el usuario
   * escribe en cualquier campo del formulario.
   */
  function actualizarPreview() {
    const titulo  = inpTitulo.value.trim();
    const resumen = inpResumen.value.trim();
    const autor   = inpAutor.value.trim();
    const fechaV  = inpFecha.value;
    const imagen  = inpImagen.value.trim();

    // Mostrar la vista previa solo si hay al menos título o resumen
    if (!titulo && !resumen) {
      previewBox.style.display = 'none';
      return;
    }
    previewBox.style.display = 'block';

    // Título
    prevTitulo.textContent = titulo || 'Título de la noticia';

    // Resumen (truncado a 120 caracteres en la preview)
    prevResumen.textContent = resumen
      ? (resumen.length > 120 ? resumen.substring(0, 120) + '…' : resumen)
      : 'El resumen aparecerá aquí…';

    // Autor
    prevAutor.textContent = autor ? `👤 ${autor}` : '👤 Autor';

    // Fecha formateada
    if (fechaV) {
      const d = new Date(fechaV + 'T00:00:00');
      prevFecha.textContent = `📅 ${d.toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric'
      })}`;
    } else {
      prevFecha.textContent = '📅 Fecha';
    }

    // Imagen
    if (imagen) {
      prevImg.src               = imagen;
      prevImgWrap.style.display = 'block';
      // Si la imagen falla, ocultarla
      prevImg.onerror = () => { prevImgWrap.style.display = 'none'; };
    } else {
      prevImgWrap.style.display = 'none';
    }
  }

  // Escuchar cambios en todos los campos del formulario
  [inpTitulo, inpResumen, inpContenido, inpAutor, inpFecha, inpImagen]
    .forEach(el => el.addEventListener('input', actualizarPreview));

  // ════════════════════════════════════════════════════════════════
  // 2. PUBLICAR / ACTUALIZAR NOTICIA
  // ════════════════════════════════════════════════════════════════

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Leer y limpiar todos los valores antes de validar */
    const titulo    = BSPVal.cleanText(inpTitulo.value);
    const resumen   = BSPVal.cleanText(inpResumen.value);
    const contenido = inpContenido.value.trim();
    const autor     = BSPVal.cleanText(inpAutor.value);
    const fechaVal  = inpFecha.value;
    const imagenUrl = inpImagen.value.trim();

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('news-titulo','news-resumen','news-contenido','news-autor','news-fecha','news-imagen');
    let valido = true;
    let err;

    /* Título: mínimo 3, máximo 150, debe iniciar con letra */
    err = BSPVal.txt(titulo, { min: 3, max: 150, label: 'El título', iniciaLetra: true });
    if (err) { _err('news-titulo', err); valido = false; }

    /* Resumen: mínimo 10, máximo 400 */
    err = BSPVal.txt(resumen, { min: 10, max: 400, label: 'El resumen' });
    if (err) { _err('news-resumen', err); valido = false; }

    /* Contenido: opcional pero si se escribe mínimo 20, máximo 10000 */
    if (contenido && contenido.length > 0) {
      err = BSPVal.txt(contenido, { min: 20, max: 10000, label: 'El contenido' });
      if (err) { _err('news-contenido', err); valido = false; }
    }

    /* Autor: solo letras, mínimo 2, máximo 100 */
    err = BSPVal.txt(autor, { min: 2, max: 100, label: 'El autor' });
    if (!err) err = BSPVal.soloLetras(autor, { label: 'El autor' });
    if (err) { _err('news-autor', err); valido = false; }

    /* Fecha: no puede ser anterior a hoy (noticia con fecha pasada no tiene sentido) */
    const _hoyNews = new Date().toISOString().split('T')[0];
    err = BSPVal.fecha(fechaVal, { minDate: _hoyNews, label: 'La fecha de publicación' });
    if (err) { _err('news-fecha', err); valido = false; }

    /* Imagen: URL válida si se proporciona (campo opcional) */
    err = BSPVal.url(imagenUrl, { required: false, label: 'La URL de imagen' });
    if (err) { _err('news-imagen', err); valido = false; }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Datos limpios — nunca usar .value directamente aquí */
    const data = { titulo, resumen, contenido, autor, fechaISO: fechaVal, imagen: imagenUrl };

    /* Llamada async al modelo (Supabase) */
    let resultado;
    try {
      resultado = editandoId === null
        ? await NoticiasModel.crear(data)
        : await NoticiasModel.actualizar(editandoId, data);
    } catch (ex) {
      showAlertError('Error de conexión. Revisa tu internet e intenta de nuevo.');
      return;
    }
    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    const accion = editandoId === null ? 'publicada' : 'actualizada';
    limpiarFormulario();
    await renderHistorial();

    showAlertSuccess(
      `"${resultado.noticia.titulo}" fue ${accion} correctamente.`
    );

    editandoId = null;
  });

  // ════════════════════════════════════════════════════════════════
  // 3. EDITAR NOTICIA
  // ════════════════════════════════════════════════════════════════

  /**
   * Pre-llena el formulario con los datos de la noticia a editar
   * y hace scroll al formulario.
   */
  window.editarNoticia = async function (id) {
    const noticia = await NoticiasModel.getById(id);
    if (!noticia) return;

    editandoId = id;

    inpTitulo.value    = noticia.titulo;
    inpResumen.value   = noticia.resumen;
    inpContenido.value = noticia.contenido;
    inpAutor.value     = noticia.autor;
    inpFecha.value     = noticia.fechaISO;
    inpImagen.value    = noticia.imagen;

    // Actualizar vista previa con los datos cargados
    actualizarPreview();

    // Cambiar botón a modo edición
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
  // 4. ELIMINAR NOTICIA
  // ════════════════════════════════════════════════════════════════

  window.eliminarNoticia = async function (id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar noticias.'); return; }
    const noticia = await NoticiasModel.getById(id);
    if (!noticia) return;

    showAlertConfirm(
      'Eliminar noticia',
      `¿Eliminar la noticia "${noticia.titulo}"? Esta acción no se puede deshacer.`,
      async function() {
        // Si se estaba editando esta noticia, limpiar el formulario
        if (editandoId === id) {
          limpiarFormulario();
          editandoId = null;
        }

        const res = await NoticiasModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await renderHistorial();
        showAlertSuccess(`"${noticia.titulo}" fue eliminada del historial.`);
      }
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. MODAL DE LECTURA COMPLETA
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el contenido completo de la noticia */
  window.verNoticia = async function (id) {
    const noticia = await NoticiasModel.getById(id);
    if (!noticia) return;

    // Imagen del modal
    const modalImgWrap = document.getElementById('modal-noticia-img-wrap');
    if (noticia.imagen) {
      document.getElementById('modal-noticia-img').src = noticia.imagen;
      modalImgWrap.style.display = 'block';
    } else {
      modalImgWrap.style.display = 'none';
    }

    document.getElementById('modal-noticia-titulo').textContent   = noticia.titulo;
    document.getElementById('modal-noticia-meta').innerHTML       =
      `📅 ${noticia.fecha} &nbsp;·&nbsp; 👤 ${noticia.autor}`;
    document.getElementById('modal-noticia-resumen').textContent  = noticia.resumen;
    document.getElementById('modal-noticia-contenido').textContent =
      noticia.contenido || 'Sin contenido adicional.';

    document.getElementById('modal-overlay-noticia').classList.add('visible');
    document.getElementById('modal-ver-noticia').classList.add('visible');
  };

  // Cerrar modal
  document.getElementById('btn-cerrar-modal-noticia').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay-noticia').addEventListener('click', cerrarModal);

  function cerrarModal() {
    document.getElementById('modal-overlay-noticia').classList.remove('visible');
    document.getElementById('modal-ver-noticia').classList.remove('visible');
  }

  // ════════════════════════════════════════════════════════════════
  // 6. RENDERIZAR HISTORIAL — DataTable v3 con filtros
  // ════════════════════════════════════════════════════════════════

  let dtNoticias = null;

  async function renderHistorial() {
    const noticias = await NoticiasModel.getAll();

    // Extraer autores únicos para el filtro
    const autores = [...new Set(noticias.map(n => n.autor).filter(Boolean))].sort();

    function renderCard(noticia) {
      const resumenCorto = noticia.resumen.length > 110
        ? noticia.resumen.substring(0, 110) + '…'
        : noticia.resumen;

      return `
        <div class="nt-card" id="nt-card-${noticia.id}">
          ${noticia.imagen
            ? `<div class="nt-card-img-wrap">
                 <img src="${esc(noticia.imagen)}" alt="${esc(noticia.titulo)}" class="nt-card-img"
                   onerror="this.parentElement.style.display='none'" />
                 <div class="nt-card-img-fade"></div>
               </div>`
            : `<div class="nt-card-img-placeholder"><i class="bx bx-news"></i></div>`}
          <div class="nt-card-body">
            <div class="nt-card-header">
              <h4 class="nt-card-titulo">${esc(noticia.titulo)}</h4>
              <div class="nt-card-acciones">
                <button class="btn-accion-nt btn-ver-nt"
                  onclick="verNoticia('${noticia.id}')" title="Leer noticia completa">
                  <i class="bx bx-show"></i>
                </button>
                <button class="btn-accion-nt btn-editar-nt"
                  onclick="editarNoticia('${noticia.id}')" title="Editar noticia">
                  <i class="bx bx-edit"></i>
                </button>
                ${!_esColaborador ? `
                <button class="btn-accion-nt btn-eliminar-nt"
                  onclick="eliminarNoticia('${noticia.id}')" title="Eliminar noticia">
                  <i class="bx bx-trash"></i>
                </button>` : ''}
              </div>
            </div>
            <p class="nt-card-resumen">${esc(resumenCorto)}</p>
            <div class="nt-card-meta">
              <span><i class="bx bx-calendar"></i> ${esc(noticia.fecha)}</span>
              <span><i class="bx bx-user"></i> ${esc(noticia.autor)}</span>
            </div>
          </div>
        </div>`;
    }

    if (!dtNoticias) {
      dtNoticias = new BSPDataTable({
        containerId:  'lista-noticias',
        data:         noticias,
        pageSize:     6,
        searchFields: ['titulo', 'resumen', 'autor', 'fecha'],
        filters: [
          { key: 'autor',    label: 'Autor',   type: 'select', options: autores },
          { key: 'fechaISO', label: 'Desde',   type: 'date-from' },
          { key: 'fechaISO', label: 'Hasta',   type: 'date-to' },
        ],
        renderRow:    renderCard,
        exportable:   true,
        exportName:   'noticias',
        exportFields: ['titulo', 'autor', 'fecha', 'resumen'],
        exportLabels: ['Título', 'Autor', 'Fecha', 'Resumen'],
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-news"></i><p>Aún no hay noticias publicadas.</p></div>`
      });
      window.__bspDT['lista-noticias'] = dtNoticias;
      dtNoticias.init();
    } else {
      dtNoticias.refresh(noticias);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  /** Limpia el formulario y restaura el botón al modo crear */
  function limpiarFormulario() {
    form.reset();
    // Restaurar el autor del usuario logueado tras resetear el formulario
    if (inpAutor && autorActual) inpAutor.value = autorActual;
    previewBox.style.display  = 'none';
    btnCancelar.style.display = 'none';
    btnSubmit.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        style="width:1.15rem;height:1.15rem;">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Publicar Noticia
    `;
  }

  // Bloquear fechas anteriores a hoy en el selector
  if (inpFecha) inpFecha.min = new Date().toISOString().split('T')[0];

  // ── Render inicial del historial ─────────────────────────────────────────
  renderHistorial();
});
