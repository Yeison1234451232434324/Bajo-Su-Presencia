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

  // ── Referencias DOM principales ──────────────────────────────────────────
  const selectEvento     = document.getElementById('select-evento');
  const eventoInfo       = document.getElementById('evento-info');
  const tablaBody        = document.getElementById('voluntarios-tbody');
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
  function cargarSelectEventos() {
    const eventos = VoluntariosModel.getEventos();
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
    const id = parseInt(selectEvento.value);
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

  /** Renderiza la tabla de voluntarios del evento seleccionado */
  function renderTablaVoluntarios() {
    const evento = VoluntariosModel.getEventoById(eventoActualId);
    if (!evento) return;

    // Mostrar info del evento en el encabezado de la tabla
    eventoInfo.style.display = 'flex';
    document.getElementById('info-nombre').textContent = evento.nombre;
    document.getElementById('info-fecha').textContent  = evento.fecha;
    document.getElementById('info-lugar').textContent  = evento.lugar;
    document.getElementById('info-total').textContent  =
      `${evento.voluntarios.length} voluntario(s)`;

    sinEvento.style.display = 'none';
    tablaWrap.style.display = 'block';

    tablaBody.innerHTML = '';

    evento.voluntarios.forEach(vol => {
      // Verificar si ya tiene calificación en este evento
      const calif = VoluntariosModel.getCalifByEventoVoluntario(eventoActualId, vol.id);
      const yaCalificado = !!calif;

      // Mostrar estrellas si ya fue calificado
      const estrellasMostrar = yaCalificado
        ? renderEstrellasFijas(calif.estrellas)
        : '<span class="sin-calif">Sin calificar</span>';

      // Botón calificar (cambia ícono si ya fue calificado)
      const btnCalif = `
        <button class="btn-accion btn-calificar ${yaCalificado ? 'btn-editar-calif' : ''}"
          onclick="abrirModalCalif(${vol.id})"
          title="${yaCalificado ? 'Editar calificación' : 'Calificar voluntario'}">
          <i class="bx ${yaCalificado ? 'bx-edit' : 'bx-star'}"></i>
        </button>`;

      // Botón ver historial
      const btnHist = `
        <button class="btn-accion btn-historial"
          onclick="verHistorial(${vol.id}, '${vol.nombre}')"
          title="Ver historial completo">
          <i class="bx bx-history"></i>
        </button>`;

      // Botón ver resumen estadístico
      const btnResumen = `
        <button class="btn-accion btn-resumen"
          onclick="verResumen(${vol.id}, '${vol.nombre}')"
          title="Ver resumen estadístico">
          <i class="bx bx-bar-chart-alt-2"></i>
        </button>`;

      // Avatar con inicial del nombre
      const avatar = vol.nombre.charAt(0).toUpperCase();

      tablaBody.innerHTML += `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm" style="background:linear-gradient(135deg,#1E3A8A,#2D4FAF)">
                ${avatar}
              </div>
              <div>
                <p class="user-nombre">${vol.nombre}</p>
                <p class="user-username">${vol.rol}</p>
              </div>
            </div>
          </td>
          <td>${estrellasMostrar}</td>
          <td class="comentario-cell">
            ${yaCalificado && calif.comentario
              ? `<span class="comentario-preview" title="${calif.comentario}">${calif.comentario}</span>`
              : '<span class="sin-calif">—</span>'}
          </td>
          <td>
            <div class="acciones-cell">
              ${btnCalif}
              ${btnHist}
              ${btnResumen}
            </div>
          </td>
        </tr>`;
    });
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
  window.abrirModalCalif = function(voluntarioId) {
    if (!eventoActualId) return;

    const evento = VoluntariosModel.getEventoById(eventoActualId);
    const vol    = evento?.voluntarios.find(v => v.id === voluntarioId);
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
    const existente = VoluntariosModel.getCalifByEventoVoluntario(eventoActualId, voluntarioId);
    if (existente) {
      califEstrellas        = existente.estrellas;
      inputComentario.value = existente.comentario;
      charCount.textContent = `${existente.comentario.length} / 300`;
    }

    // Renderizar las estrellas interactivas del modal
    renderEstrellaModal(califEstrellas);

    modal.classList.add('visible');
    modalOverlay.classList.add('visible');
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
  formCalif.addEventListener('submit', (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    // Validar que se haya seleccionado al menos 1 estrella
    if (califEstrellas === 0) {
      modalError.textContent   = 'Debes seleccionar al menos 1 estrella.';
      modalError.style.display = 'block';
      return;
    }

    const resultado = VoluntariosModel.guardarCalificacion({
      eventoId:      eventoActualId,
      voluntarioId:  califVolId,
      estrellas:     califEstrellas,
      comentario:    inputComentario.value
    });

    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      return;
    }

    cerrarModal();
    renderTablaVoluntarios(); // actualizar tabla para mostrar las nuevas estrellas
    showToast('Calificación guardada', `La calificación fue registrada exitosamente.`);
  });

  /** Cierra el modal de calificación */
  function cerrarModal() {
    modal.classList.remove('visible');
    modalOverlay.classList.remove('visible');
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
  window.verHistorial = function(voluntarioId, nombre) {
    const historial = VoluntariosModel.getHistorialVoluntario(voluntarioId);

    historialNombre.textContent = nombre;
    historialLista.innerHTML    = '';

    if (historial.length === 0) {
      historialLista.innerHTML = `
        <div class="panel-vacio">
          <i class="bx bx-history" style="font-size:2.5rem;color:#d1d5db;"></i>
          <p>Este voluntario aún no tiene calificaciones registradas.</p>
        </div>`;
    } else {
      // Ordenar del más reciente al más antiguo
      [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach(c => {
        historialLista.innerHTML += `
          <div class="historial-item">
            <div class="historial-header">
              <span class="historial-evento">${c.eventoNombre}</span>
              <span class="historial-fecha">${c.fecha}</span>
            </div>
            <div class="historial-estrellas">${renderEstrellasFijas(c.estrellas)}</div>
            ${c.comentario
              ? `<p class="historial-comentario">"${c.comentario}"</p>`
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
  window.verResumen = function(voluntarioId, nombre) {
    const resumen = VoluntariosModel.getResumenVoluntario(voluntarioId);

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
          <span class="dist-label">${i} <i class="bx bxs-star star-on" style="font-size:0.85rem;"></i></span>
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

  /** Toast de error (rojo) */
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

  // ── Inicialización ───────────────────────────────────────────────────────
  cargarSelectEventos();
});
