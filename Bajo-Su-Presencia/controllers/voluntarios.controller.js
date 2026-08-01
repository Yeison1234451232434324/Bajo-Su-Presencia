/**
 * ============================================================
 * CONTROLADOR: voluntarios.controller.js
 * ============================================================
 * Maneja toda la lógica de la vista de calificación de voluntarios.
 * Depende de: VoluntariosModel (voluntarios.model.js)
 *
 * Secciones que controla:
 *   1. Selector de evento → carga la lista de voluntarios
 *   2. Tabla de voluntarios con botón calificar
 *   3. Modal de calificación (estrellas + comentario)
 *   4. Panel de historial de un voluntario seleccionado
 *   5. Panel de resumen estadístico personal
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Verificar que sea admin ──────────────────────────────────────────────
  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  // ── Referencias DOM principales ──────────────────────────────────────────
  const selectEvento     = document.getElementById('select-evento');
  const eventoInfo       = document.getElementById('evento-info');
  const sinEvento        = document.getElementById('sin-evento');
  const tablaWrap        = document.getElementById('tabla-wrap');

  // Modal de calificación
  const modal            = document.getElementById('modal-calif');
  const modalOverlay     = document.getElementById('modal-overlay-vol');
  const modalVolNombre   = document.getElementById('modal-vol-nombre');
  const modalEventoNombre= document.getElementById('modal-evento-nombre');
  const modalError       = document.getElementById('modal-error-vol');
  const formCalif        = document.getElementById('form-calificacion');
  const btnCerrarModal   = document.getElementById('btn-cerrar-modal-vol');
  const btnCancelarModal = document.getElementById('btn-cancelar-vol');
  const inputComentario  = document.getElementById('campo-comentario');
  const charCount        = document.getElementById('char-count');

  // Panel historial
  const panelHistorial   = document.getElementById('panel-historial');
  const historialNombre  = document.getElementById('historial-nombre');
  const historialLista   = document.getElementById('historial-lista');
  const btnCerrarHist    = document.getElementById('btn-cerrar-historial');

  // Panel resumen estadístico
  const panelResumen     = document.getElementById('panel-resumen');
  const resumenNombre    = document.getElementById('resumen-nombre');
  const btnCerrarResumen = document.getElementById('btn-cerrar-resumen');

  // Estado interno del controlador
  let eventoActualId    = null; // ID del evento seleccionado
  let califVolId        = null; // ID del voluntario que se está calificando
  let califEstrellas    = 0;    // Estrellas seleccionadas en el modal

  // ════════════════════════════════════════════════════════════════
  // 1. SELECTOR DE EVENTO
  // ════════════════════════════════════════════════════════════════

  /** Llena el <select> con los eventos disponibles */
  async function cargarSelectEventos() {
    const eventos = await VoluntariosModel.getEventos();
    selectEvento.innerHTML = '<option value="">— Selecciona un evento —</option>';
    eventos.forEach(ev => {
      const opt = document.createElement('option');
      opt.value       = ev.id;
      opt.textContent = `${ev.nombre} (${ev.fecha})`;
      selectEvento.appendChild(opt);
    });
  }

  /** Al cambiar el evento seleccionado, actualiza la tabla */
  selectEvento.addEventListener('change', () => {
    const id = selectEvento.value;
    if (!id) {
      eventoActualId = null;
      sinEvento.style.display  = 'flex';
      tablaWrap.style.display  = 'none';
      eventoInfo.style.display = 'none';
      ocultarPaneles();
      return;
    }
    eventoActualId = id;
    renderTablaVoluntarios();
    ocultarPaneles();
  });

  // ════════════════════════════════════════════════════════════════
  // 2. TABLA DE VOLUNTARIOS
  // ════════════════════════════════════════════════════════════════

  // ── DataTable de voluntarios ─────────────────────────────────────────────
  let dtVoluntarios = null;

  /** Renderiza la tabla de voluntarios del evento seleccionado */
  async function renderTablaVoluntarios() {
    const evento = await VoluntariosModel.getEventoById(eventoActualId);
    if (!evento) return;

    // Pre-cargar calificaciones del evento (para que renderRow sea síncrono)
    const califsEvento = (await VoluntariosModel.getCalificaciones()).filter(c => c.eventoId === eventoActualId);
    const califMap = {};
    califsEvento.forEach(c => { califMap[c.voluntarioId] = c; });

    // Mostrar info del evento en el encabezado
    eventoInfo.style.display = 'flex';
    document.getElementById('info-nombre').textContent = evento.nombre;
    document.getElementById('info-fecha').textContent  = evento.fecha;
    document.getElementById('info-lugar').textContent  = evento.lugar;
    document.getElementById('info-total').textContent  = `${evento.voluntarios.length} voluntario(s)`;

    sinEvento.style.display = 'none';
    tablaWrap.style.display = 'block';

    const data = evento.voluntarios.map(vol => {
      const calif        = califMap[vol.id] || null;
      const yaCalificado = !!calif;
      return {
        ...vol,
        yaCalificado,
        califEstrellas: yaCalificado ? calif.estrellas : 0,
        califComentario: yaCalificado ? (calif.comentario || '') : '',
        estadoCalif: yaCalificado ? 'Calificado' : 'Sin calificar'
      };
    });

    function renderRow(vol) {
      const yaCalificado = vol.yaCalificado;
      const avatar       = esc(String(vol.nombre ?? '').charAt(0).toUpperCase());

      const estrellasMostrar = yaCalificado
        ? renderEstrellasFijas(vol.califEstrellas)
        : '<span class="sin-calif">Sin calificar</span>';

      const btnCalif = `
        <button class="btn-accion btn-calificar ${yaCalificado ? 'btn-editar-calif' : ''}"
          onclick="abrirModalCalif('${vol.id}')"
          title="${yaCalificado ? 'Editar calificación' : 'Calificar voluntario'}">
          <i class="bx ${yaCalificado ? 'bx-edit' : 'bx-star'}"></i>
        </button>`;
      const btnHist = `
        <button class="btn-accion btn-historial"
          onclick="verHistorial('${escJs(vol.id)}', '${escJs(vol.nombre)}')"
          title="Ver historial completo">
          <i class="bx bx-history" aria-hidden="true"></i>
        </button>`;
      const btnResumen = `
        <button class="btn-accion btn-resumen"
          onclick="verResumen('${escJs(vol.id)}', '${escJs(vol.nombre)}')"
          title="Ver resumen estadístico">
          <i class="bx bx-bar-chart-alt-2" aria-hidden="true"></i>
        </button>`;

      return `
        <div class="vol-row">
          <div class="user-cell" style="flex:2;min-width:160px;">
            <div class="user-avatar-sm user-avatar-sm--vol">
              ${avatar}
            </div>
            <div>
              <p class="user-nombre">${esc(vol.nombre)}</p>
              <p class="user-username">${esc(vol.rol)}</p>
            </div>
          </div>
          <div style="flex:1;min-width:100px;">${estrellasMostrar}</div>
          <div class="comentario-cell" style="flex:1.5;min-width:120px;">
            ${yaCalificado && vol.califComentario
              ? `<span class="comentario-preview" title="${vol.califComentario}">${vol.califComentario}</span>`
              : '<span class="sin-calif">—</span>'}
          </div>
          <div class="acciones-cell" style="flex-shrink:0;margin-left:auto;">
            ${btnCalif}${btnHist}${btnResumen}
          </div>
        </div>`;
    }

    if (!dtVoluntarios) {
      dtVoluntarios = new BSPDataTable({
        containerId:  'dt-voluntarios',
        data,
        pageSize:     8,
        searchFields: ['nombre', 'rol'],
        filters: [
          { key: 'estadoCalif', label: 'Calificación', type: 'select', options: ['Calificado', 'Sin calificar'] }
        ],
        renderRow,
        exportable:   true,
        exportName:   'voluntarios',
        exportFields: ['nombre', 'rol', 'estadoCalif', 'califEstrellas', 'califComentario'],
        exportLabels: ['Nombre', 'Rol', 'Calificado', 'Estrellas', 'Comentario'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-user-x" aria-hidden="true"></i><p>No hay voluntarios en este evento.</p></div>`
      });
      window.__bspDT['dt-voluntarios'] = dtVoluntarios;
      dtVoluntarios.init();
    } else {
      dtVoluntarios.refresh(data);
    }
  }

  /** Genera HTML de estrellas fijas (solo lectura) */
  function renderEstrellasFijas(n) {
    let html = '<div class="estrellas-fijas">';
    for (let i = 1; i <= 5; i++) {
      html += `<i class="bx bxs-star ${i <= n ? 'star-on' : 'star-off'}"></i>`;
    }
    html += `<span class="estrella-num">${n}/5</span></div>`;
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  // 3. MODAL DE CALIFICACIÓN
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal para calificar a un voluntario */
  window.abrirModalCalif = async function(voluntarioId) {
    if (!eventoActualId) return;

    const evento = await VoluntariosModel.getEventoById(eventoActualId);
    const vol    = evento?.voluntarios.find(v => String(v.id) === String(voluntarioId));
    if (!vol) return;

    califVolId = voluntarioId;
    califEstrellas = 0;

    // Llenar datos del modal
    modalVolNombre.textContent    = vol.nombre;
    modalEventoNombre.textContent = evento.nombre;
    modalError.style.display      = 'none';
    inputComentario.value         = '';
    charCount.textContent         = '0 / 300';

    // Si ya existe calificación, pre-llenar el formulario
    const existente = await VoluntariosModel.getCalifByEventoVoluntario(eventoActualId, voluntarioId);
    if (existente) {
      califEstrellas        = existente.estrellas;
      inputComentario.value = existente.comentario;
      charCount.textContent = `${existente.comentario.length} / 300`;
    }

    // Renderizar las estrellas interactivas del modal
    renderEstrellaModal(califEstrellas);

    BSPModal.abrir({ overlay: modalOverlay, modal });
  };

  /**
   * Renderiza las 5 estrellas interactivas dentro del modal.
   * Marca las primeras `n` estrellas como activas.
   */
  function renderEstrellaModal(n) {
    const contenedor = document.getElementById('estrellas-modal');
    contenedor.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('i');
      star.className = `bx bxs-star estrella-modal ${i <= n ? 'star-on' : 'star-off'}`;
      star.dataset.valor = i;

      // Al pasar el mouse, iluminar hasta esa estrella (hover preview)
      star.addEventListener('mouseenter', () => resaltarEstrellas(i));
      star.addEventListener('mouseleave', () => resaltarEstrellas(califEstrellas));

      // Al hacer clic, fijar la calificación
      star.addEventListener('click', () => {
        califEstrellas = i;
        resaltarEstrellas(i);
      });

      contenedor.appendChild(star);
    }

    // Texto descriptivo de la calificación actual
    actualizarTextoEstrellas(n);
  }

  /** Ilumina las primeras `n` estrellas del modal */
  function resaltarEstrellas(n) {
    document.querySelectorAll('.estrella-modal').forEach((s, idx) => {
      s.classList.toggle('star-on',  idx < n);
      s.classList.toggle('star-off', idx >= n);
    });
    actualizarTextoEstrellas(n);
  }

  /** Actualiza el texto descriptivo debajo de las estrellas */
  function actualizarTextoEstrellas(n) {
    const textos = {
      0: 'Selecciona una calificación',
      1: '⭐ Deficiente',
      2: '⭐⭐ Regular',
      3: '⭐⭐⭐ Bueno',
      4: '⭐⭐⭐⭐ Muy bueno',
      5: '⭐⭐⭐⭐⭐ Excelente'
    };
    document.getElementById('texto-estrellas').textContent = textos[n] || '';
  }

  /** Contador de caracteres del comentario */
  inputComentario.addEventListener('input', () => {
    const len = inputComentario.value.length;
    charCount.textContent = `${len} / 300`;
    if (len > 300) inputComentario.value = inputComentario.value.substring(0, 300);
  });

  /** Submit del formulario de calificación */
  formCalif.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    /* Leer y limpiar valores */
    const comentario = BSPVal.cleanText(inputComentario.value);

    /* Validar estrellas: entero entre 1 y 5 */
    if (!califEstrellas || califEstrellas < 1 || califEstrellas > 5 || !Number.isInteger(califEstrellas)) {
      modalError.textContent   = 'Debes seleccionar una calificación de 1 a 5 estrellas.';
      modalError.style.display = 'block';
      return;
    }

    /* Comentario: opcional, pero si se escribe mínimo 3 chars */
    if (comentario.length > 0 && comentario.length < 3) {
      modalError.textContent   = 'El comentario debe tener al menos 3 caracteres o dejarse vacío.';
      modalError.style.display = 'block';
      return;
    }
    if (comentario.length > 300) {
      modalError.textContent   = 'El comentario no puede superar 300 caracteres.';
      modalError.style.display = 'block';
      return;
    }

    /* Llamada async al modelo */
    let resultado;
    try {
      resultado = await VoluntariosModel.guardarCalificacion({
        eventoId:     eventoActualId,
        voluntarioId: califVolId,
        estrellas:    califEstrellas,
        comentario
      });
    } catch (ex) {
      modalError.textContent = 'Error de conexión. Intenta de nuevo.';
      modalError.style.display = 'block';
      return;
    }
    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    await renderTablaVoluntarios();
    showToast('Calificación guardada', `La calificación fue registrada exitosamente.`);
  });

  /** Cierra el modal de calificación */
  function cerrarModal() {
    BSPModal.cerrar({ overlay: modalOverlay, modal });
    califVolId     = null;
    califEstrellas = 0;
  }

  btnCerrarModal.addEventListener('click', cerrarModal);
  btnCancelarModal.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', cerrarModal);

  // ════════════════════════════════════════════════════════════════
  // 5. PANEL HISTORIAL
  // ════════════════════════════════════════════════════════════════

  /** Muestra el panel lateral con el historial de calificaciones del voluntario */
  window.verHistorial = async function(voluntarioId, nombre) {
    const historial = await VoluntariosModel.getHistorialVoluntario(voluntarioId);

    historialNombre.textContent = nombre;
    historialLista.innerHTML    = '';

    if (historial.length === 0) {
      historialLista.innerHTML = `
        <div class="panel-vacio">
          <i class="bx bx-history" style="font-size:2.5rem;color:var(--border-light);" aria-hidden="true"></i>
          <p>Este voluntario aún no tiene calificaciones registradas.</p>
        </div>`;
    } else {
      // Ordenar del más reciente al más antiguo
      [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach(c => {
        historialLista.innerHTML += `
          <div class="historial-item">
            <div class="historial-header">
              <span class="historial-evento">${esc(c.eventoNombre)}</span>
              <span class="historial-fecha">${esc(c.fecha)}</span>
            </div>
            <div class="historial-estrellas">${renderEstrellasFijas(c.estrellas)}</div>
            ${c.comentario
              ? `<p class="historial-comentario">"${esc(c.comentario)}"</p>`
              : '<p class="historial-comentario sin-calif">Sin comentario.</p>'}
          </div>`;
      });
    }

    // Ocultar resumen si estaba abierto y mostrar historial
    panelResumen.style.display  = 'none';
    panelHistorial.style.display = 'block';
  };

  btnCerrarHist.addEventListener('click', () => {
    panelHistorial.style.display = 'none';
  });

  // ════════════════════════════════════════════════════════════════
  // 6. PANEL RESUMEN ESTADÍSTICO
  // ════════════════════════════════════════════════════════════════

  /** Muestra el panel con el resumen estadístico personal del voluntario */
  window.verResumen = async function(voluntarioId, nombre) {
    const resumen = await VoluntariosModel.getResumenVoluntario(voluntarioId);

    resumenNombre.textContent = nombre;

    // Promedio con estrellas visuales
    const promedioRedondeado = Math.round(resumen.promedio);
    document.getElementById('res-promedio-num').textContent  = resumen.promedio || '—';
    document.getElementById('res-promedio-stars').innerHTML  =
      resumen.total > 0 ? renderEstrellasFijas(promedioRedondeado) : '<span class="sin-calif">Sin datos</span>';
    document.getElementById('res-total').textContent         = resumen.total;

    // Mejor y peor calificación
    document.getElementById('res-mejor').innerHTML = resumen.mejor
      ? `${renderEstrellasFijas(resumen.mejor.estrellas)} <small>${resumen.mejor.eventoNombre}</small>`
      : '<span class="sin-calif">—</span>';
    document.getElementById('res-peor').innerHTML = resumen.peor
      ? `${renderEstrellasFijas(resumen.peor.estrellas)} <small>${resumen.peor.eventoNombre}</small>`
      : '<span class="sin-calif">—</span>';

    // Barras de distribución de estrellas (1 a 5)
    const distWrap = document.getElementById('res-distribucion');
    distWrap.innerHTML = '';
    const maxVal = Math.max(...Object.values(resumen.distribucion), 1); // evitar división por 0

    for (let i = 5; i >= 1; i--) {
      const cant    = resumen.distribucion[i];
      const pct     = Math.round((cant / maxVal) * 100);
      distWrap.innerHTML += `
        <div class="dist-fila">
          <span class="dist-label">${i} <i class="bx bxs-star star-on" style="font-size:0.85rem;" aria-hidden="true"></i></span>
          <div class="dist-barra-wrap">
            <div class="dist-barra" style="width:${pct}%"></div>
          </div>
          <span class="dist-cant">${cant}</span>
        </div>`;
    }

    // Ocultar historial si estaba abierto y mostrar resumen
    panelHistorial.style.display = 'none';
    panelResumen.style.display   = 'block';
  };

  btnCerrarResumen.addEventListener('click', () => {
    panelResumen.style.display = 'none';
  });

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  /** Oculta ambos paneles laterales */
  function ocultarPaneles() {
    panelHistorial.style.display = 'none';
    panelResumen.style.display   = 'none';
  }

  // La notificación de error usa la API central showToastError/showAlertError de
  // alertify.helper.js. La función local que había aquí construía su propio toast
  // y no llegó a llamarse desde ninguna parte del controlador (código muerto).

  // ── Inicialización ───────────────────────────────────────────────────────
  cargarSelectEventos();
});
