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
  const vistaEventosVol   = document.getElementById('vista-eventos-vol');
  const vistaCalificarVol = document.getElementById('vista-calificar-vol');
  const gridEventosVol    = document.getElementById('grid-eventos-vol');
  const eventoInfo        = document.getElementById('evento-info');
  const tablaWrap         = document.getElementById('tabla-wrap');

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
  // 1. GRID DE EVENTOS (mismo patrón que "Subir Reporte" y "Actividades":
  //    tarjetas agrupadas por si ya se calificó a todos los voluntarios)
  // ════════════════════════════════════════════════════════════════

  async function renderGridEventosVol() {
    const eventos = await VoluntariosModel.getEventos();

    gridEventosVol.innerHTML = '';
    if (!eventos.length) {
      gridEventosVol.innerHTML = `<div class="act-empty"><i class="bx bx-calendar-x" aria-hidden="true"></i><p>No hay eventos publicados aún.</p></div>`;
      return;
    }

    let calificaciones = [];
    try { calificaciones = await VoluntariosModel.getCalificaciones(); }
    catch (e) { window.BSPLog?.error('voluntarios.calificaciones', e); }
    const califPorEvento = {};
    calificaciones.forEach(c => {
      const s = califPorEvento[c.eventoId] || (califPorEvento[c.eventoId] = new Set());
      s.add(c.voluntarioId);
    });

    function _crearCardEvento(ev) {
      const calificados = califPorEvento[ev.id] ? califPorEvento[ev.id].size : 0;
      const total        = ev.voluntarios.length;
      const fechaFmt      = _formatFecha(ev.fecha);

      const card = document.createElement('div');
      card.className = 'vol-evento-card';
      card.innerHTML = `
        <div class="act-ev-icon"><i class="bx bx-calendar-event" aria-hidden="true"></i></div>
        <div class="act-ev-body">
          <h3 class="act-ev-titulo">${esc(ev.nombre)}</h3>
          <p class="act-ev-meta"><i class="bx bx-calendar" aria-hidden="true"></i> ${fechaFmt}</p>
          ${ev.lugar ? `<p class="act-ev-meta"><i class="bx bx-map-pin u-icono-rojo" aria-hidden="true"></i> ${esc(ev.lugar)}</p>` : ''}
          <p class="act-ev-meta"><i class="bx bx-group" aria-hidden="true"></i> ${total} voluntario(s)</p>
          <p class="act-ev-meta act-ev-inscritos"><i class="bx bx-star" aria-hidden="true"></i> ${calificados} de ${total} calificado(s)</p>
        </div>`;
      card.addEventListener('click', () => seleccionarEventoVol(ev));
      return card;
    }

    function _crearSubgrupo(titulo, iconoClase, modificador, lista) {
      const wrap = document.createElement('div');
      wrap.className = 'vol-subgrupo';

      const label = document.createElement('p');
      label.className = `act-subgrupo-titulo${modificador ? ` ${modificador}` : ''}`;
      label.innerHTML = `<i class="bx ${iconoClase}" aria-hidden="true"></i> ${titulo} (${lista.length})`;
      wrap.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'vol-grid-eventos';
      lista.forEach(ev => grid.appendChild(_crearCardEvento(ev)));
      wrap.appendChild(grid);

      return wrap;
    }

    // Dos grupos: eventos con voluntarios aún sin calificar, y eventos donde
    // ya se calificó a todos (o que no tienen voluntarios asignados, así que
    // no hay nada pendiente por calificar).
    const pendientes  = [];
    const completados = [];
    for (const ev of eventos) {
      const calificados = califPorEvento[ev.id] ? califPorEvento[ev.id].size : 0;
      if (ev.voluntarios.length > 0 && calificados < ev.voluntarios.length) pendientes.push(ev);
      else completados.push(ev);
    }

    gridEventosVol.classList.add('vol-grid-eventos--agrupado');
    if (pendientes.length) {
      gridEventosVol.appendChild(_crearSubgrupo('Con voluntarios sin calificar', 'bx-time-five', null, pendientes));
    }
    if (completados.length) {
      gridEventosVol.appendChild(_crearSubgrupo('Todos calificados', 'bx-check-circle', 'act-subgrupo-titulo--ok', completados));
    }
  }

  /** Selecciona un evento desde el grid y pasa a la vista de calificación */
  function seleccionarEventoVol(ev) {
    eventoActualId = ev.id;
    vistaEventosVol.style.display   = 'none';
    vistaCalificarVol.style.display = 'block';
    ocultarPaneles();
    renderTablaVoluntarios();
  }

  /** Vuelve al grid de eventos desde la vista de calificación */
  function volverAEventosVol() {
    eventoActualId = null;
    vistaCalificarVol.style.display = 'none';
    vistaEventosVol.style.display   = 'block';
    ocultarPaneles();
    renderGridEventosVol();
  }
  document.querySelector('.btn-volver')?.addEventListener('click', volverAEventosVol);

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
          data-action="abrir-modal-calif" data-id="${vol.id}"
          title="${yaCalificado ? 'Editar calificación' : 'Calificar voluntario'}">
          <i class="bx ${yaCalificado ? 'bx-edit' : 'bx-star'}"></i>
        </button>`;
      const btnHist = `
        <button class="btn-accion btn-historial"
          data-action="ver-historial" data-id="${esc(vol.id)}" data-nombre="${esc(vol.nombre)}"
          title="Ver historial completo">
          <i class="bx bx-history" aria-hidden="true"></i>
        </button>`;
      const btnResumen = `
        <button class="btn-accion btn-resumen"
          data-action="ver-resumen" data-id="${esc(vol.id)}" data-nombre="${esc(vol.nombre)}"
          title="Ver resumen estadístico">
          <i class="bx bx-bar-chart-alt-2" aria-hidden="true"></i>
        </button>`;

      return `
        <div class="vol-row">
          <div class="user-cell">
            <div class="user-avatar-sm user-avatar-sm--vol">
              ${avatar}
            </div>
            <div>
              <p class="user-nombre">${esc(vol.nombre)}</p>
              <p class="user-username">${esc(vol.rol)}</p>
            </div>
          </div>
          <div class="vol-row-estrellas">${estrellasMostrar}</div>
          <div class="comentario-cell">
            ${yaCalificado && vol.califComentario
              ? `<span class="comentario-preview" title="${esc(vol.califComentario)}">${esc(vol.califComentario)}</span>`
              : '<span class="sin-calif">—</span>'}
          </div>
          <div class="acciones-cell">
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
      document.getElementById('dt-voluntarios-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'abrir-modal-calif') abrirModalCalif(id);
        else if (btn.dataset.action === 'ver-historial') verHistorial(id, btn.dataset.nombre);
        else if (btn.dataset.action === 'ver-resumen') verResumen(id, btn.dataset.nombre);
      });
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
  async function abrirModalCalif(voluntarioId) {
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
  }

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

  // Cerrojo anti-doble-submit (mismo patrón que auth.controller.js).
  let enviandoCalif = false;

  /** Submit del formulario de calificación */
  formCalif.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviandoCalif) return;
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
    const btnSubmitCalif = formCalif.querySelector('button[type="submit"]');
    enviandoCalif = true;
    if (btnSubmitCalif) { btnSubmitCalif.disabled = true; btnSubmitCalif.setAttribute('aria-busy', 'true'); }

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
      enviandoCalif = false;
      if (btnSubmitCalif) { btnSubmitCalif.disabled = false; btnSubmitCalif.removeAttribute('aria-busy'); }
      return;
    }
    if (!resultado.ok) {
      modalError.textContent   = resultado.error;
      modalError.style.display = 'block';
      enviandoCalif = false;
      if (btnSubmitCalif) { btnSubmitCalif.disabled = false; btnSubmitCalif.removeAttribute('aria-busy'); }
      return;
    }

    enviandoCalif = false;
    if (btnSubmitCalif) { btnSubmitCalif.disabled = false; btnSubmitCalif.removeAttribute('aria-busy'); }
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
  async function verHistorial(voluntarioId, nombre) {
    const historial = await VoluntariosModel.getHistorialVoluntario(voluntarioId);

    historialNombre.textContent = nombre;
    historialLista.innerHTML    = '';

    if (historial.length === 0) {
      historialLista.innerHTML = `
        <div class="panel-vacio">
          <i class="bx bx-history" aria-hidden="true"></i>
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
  }

  btnCerrarHist.addEventListener('click', () => {
    panelHistorial.style.display = 'none';
  });

  // ════════════════════════════════════════════════════════════════
  // 6. PANEL RESUMEN ESTADÍSTICO
  // ════════════════════════════════════════════════════════════════

  /** Muestra el panel con el resumen estadístico personal del voluntario */
  async function verResumen(voluntarioId, nombre) {
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
      ? `${renderEstrellasFijas(resumen.mejor.estrellas)} <small>${esc(resumen.mejor.eventoNombre)}</small>`
      : '<span class="sin-calif">—</span>';
    document.getElementById('res-peor').innerHTML = resumen.peor
      ? `${renderEstrellasFijas(resumen.peor.estrellas)} <small>${esc(resumen.peor.eventoNombre)}</small>`
      : '<span class="sin-calif">—</span>';

    // Barras de distribución de estrellas (1 a 5)
    // Antes: `distWrap.innerHTML += ...` dentro del loop reconstruía TODO el
    // contenido en cada vuelta, destruyendo las barras ya creadas y con ellas
    // el `style.width` que se les había asignado — por eso solo la última
    // barra procesada (1★) conservaba su ancho real y las demás se veían al
    // 100%. Se arma el HTML completo (con el ancho ya incluido) y se asigna
    // una sola vez.
    const distWrap = document.getElementById('res-distribucion');
    const maxVal = Math.max(...Object.values(resumen.distribucion), 1); // evitar división por 0

    let distHtml = '';
    for (let i = 5; i >= 1; i--) {
      const cant    = resumen.distribucion[i];
      const pct     = Math.round((cant / maxVal) * 100);
      distHtml += `
        <div class="dist-fila">
          <span class="dist-label">${i} <i class="bx bxs-star star-on" aria-hidden="true"></i></span>
          <div class="dist-barra-wrap">
            <div class="dist-barra" style="width:${pct}%"></div>
          </div>
          <span class="dist-cant">${cant}</span>
        </div>`;
    }
    distWrap.innerHTML = distHtml;

    // Ocultar historial si estaba abierto y mostrar resumen
    panelHistorial.style.display = 'none';
    panelResumen.style.display   = 'block';
  }

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
  function _formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]} ${parseInt(d)} ${meses[parseInt(m) - 1]}`;
    } catch (_) { return fechaStr; }
  }

  renderGridEventosVol();
});
