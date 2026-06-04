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
  let autorActual = '';
  if (_sesion.nombre) {
    // Buscar nombre completo en UsuariosModel (si está cargado)
    if (typeof UsuariosModel !== 'undefined') {
      const _usr = UsuariosModel.getAll().find(u => u.username === _sesion.nombre);
      autorActual = (_usr && _usr.nombre) ? _usr.nombre : _sesion.nombre;
    } else {
      autorActual = _sesion.nombre;
    }
  }
  // Auto-llenar el campo Autor al cargar la página
  if (inpAutor && autorActual) inpAutor.value = autorActual;

  // ── Helpers de validación DOM ────────────────────────────────────────────
  function _err(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('campo-invalido');
    const box = el.closest('.form-group') || el.parentElement;
    let s = box.querySelector('.campo-error');
    if (!s) { s = document.createElement('span'); s.className = 'campo-error'; box.appendChild(s); }
    s.textContent = msg;
  }
  function _ok(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('campo-invalido');
      const box = el.closest('.form-group') || el.parentElement;
      const s = box.querySelector('.campo-error');
      if (s) s.remove();
    });
  }

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

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // ── Validación DOM ────────────────────────────────────────────────────
    const RX_NOMBRE     = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
    const RX_INI_LETRA  = /^[a-zA-ZÀ-ÿñÑ]/;
    const titulo  = inpTitulo.value.trim();
    const resumen = inpResumen.value.trim();
    const autor   = inpAutor.value.trim();

    _ok('news-titulo','news-resumen','news-autor','news-fecha','news-imagen');
    let valido = true;

    if (!titulo || titulo.length < 3) {
      _err('news-titulo', 'El título debe tener al menos 3 caracteres.');              valido = false;
    } else if (!RX_INI_LETRA.test(titulo)) {
      _err('news-titulo', 'El título debe comenzar con una letra, no con un número.'); valido = false;
    } else if (titulo.length > 150) {
      _err('news-titulo', 'El título no puede superar 150 caracteres.');               valido = false;
    }
    if (!resumen || resumen.length < 10) {
      _err('news-resumen', 'El resumen debe tener al menos 10 caracteres.');           valido = false;
    } else if (resumen.length > 400) {
      _err('news-resumen', 'El resumen no puede superar 400 caracteres.');             valido = false;
    }
    if (!autor || autor.length < 2) {
      _err('news-autor', 'El autor es obligatorio (mínimo 2 caracteres).');            valido = false;
    } else if (!RX_NOMBRE.test(autor)) {
      _err('news-autor', 'El nombre del autor solo puede contener letras y espacios.'); valido = false;
    }
    const _hoyNews = new Date().toISOString().split('T')[0];
    if (!inpFecha.value) {
      _err('news-fecha', 'La fecha de publicación es obligatoria.');                   valido = false;
    } else if (inpFecha.value < _hoyNews) {
      _err('news-fecha', 'No se puede publicar con una fecha anterior a hoy.');        valido = false;
    }
    if (inpImagen.value && !/^https?:\/\/.+/.test(inpImagen.value.trim())) {
      _err('news-imagen', 'La URL de imagen debe comenzar con http:// o https://');   valido = false;
    }
    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    const data = {
      titulo:    inpTitulo.value,
      resumen:   inpResumen.value,
      contenido: inpContenido.value,
      autor:     inpAutor.value,
      fechaISO:  inpFecha.value,
      imagen:    inpImagen.value
    };

    let resultado;

    if (editandoId === null) {
      resultado = NoticiasModel.crear(data);
    } else {
      resultado = NoticiasModel.actualizar(editandoId, data);
    }

    if (!resultado.ok) {
      showAlertError(resultado.error);
      return;
    }

    const accion = editandoId === null ? 'publicada' : 'actualizada';
    limpiarFormulario();
    renderHistorial();

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
  window.editarNoticia = function (id) {
    const noticia = NoticiasModel.getById(id);
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

  window.eliminarNoticia = function (id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar noticias.'); return; }
    const noticia = NoticiasModel.getById(id);
    if (!noticia) return;

    showAlertConfirm(
      'Eliminar noticia',
      `¿Eliminar la noticia "${noticia.titulo}"? Esta acción no se puede deshacer.`,
      function() {
        // Si se estaba editando esta noticia, limpiar el formulario
        if (editandoId === id) {
          limpiarFormulario();
          editandoId = null;
        }

        NoticiasModel.eliminar(id);
        renderHistorial();
        showAlertSuccess(`"${noticia.titulo}" fue eliminada del historial.`);
      }
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 5. MODAL DE LECTURA COMPLETA
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el contenido completo de la noticia */
  window.verNoticia = function (id) {
    const noticia = NoticiasModel.getById(id);
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

  function renderHistorial() {
    const noticias = NoticiasModel.getAll();

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
                 <img src="${noticia.imagen}" alt="${noticia.titulo}" class="nt-card-img"
                   onerror="this.parentElement.style.display='none'" />
                 <div class="nt-card-img-fade"></div>
               </div>`
            : `<div class="nt-card-img-placeholder"><i class="bx bx-news"></i></div>`}
          <div class="nt-card-body">
            <div class="nt-card-header">
              <h4 class="nt-card-titulo">${noticia.titulo}</h4>
              <div class="nt-card-acciones">
                <button class="btn-accion-nt btn-ver-nt"
                  onclick="verNoticia(${noticia.id})" title="Leer noticia completa">
                  <i class="bx bx-show"></i>
                </button>
                <button class="btn-accion-nt btn-editar-nt"
                  onclick="editarNoticia(${noticia.id})" title="Editar noticia">
                  <i class="bx bx-edit"></i>
                </button>
                ${!_esColaborador ? `
                <button class="btn-accion-nt btn-eliminar-nt"
                  onclick="eliminarNoticia(${noticia.id})" title="Eliminar noticia">
                  <i class="bx bx-trash"></i>
                </button>` : ''}
              </div>
            </div>
            <p class="nt-card-resumen">${resumenCorto}</p>
            <div class="nt-card-meta">
              <span><i class="bx bx-calendar"></i> ${noticia.fecha}</span>
              <span><i class="bx bx-user"></i> ${noticia.autor}</span>
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
