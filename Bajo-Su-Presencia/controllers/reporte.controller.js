/**
 * ============================================================
 * CONTROLADOR: reporte.controller.js
 * ============================================================
 * Maneja la lógica de "Subir Reporte de Evento".
 * Depende de:
 *   - ReportesModel  (reportes.model.js)
 *   - EventosModel   (eventos.model.js)
 *
 * Flujo:
 *   1. Vista inicial: grid de eventos PASADOS (fecha < hoy)
 *      - Si ya tiene reporte → tarjeta verde con "Reporte cargado"
 *      - Si no → tarjeta normal
 *   2. Al seleccionar evento: formulario de reporte
 *      - Si ya existe reporte → pre-llena el formulario y muestra
 *        el reporte existente debajo
 *   3. Al guardar: muestra el reporte existente actualizado
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador','Colaborador']);
  if (!sesion) return;

  // ── Estado ───────────────────────────────────────────────────────────────
  let eventoActual = null;

  // Cerrojo anti-doble-submit (mismo patrón que auth.controller.js).
  let enviandoReporte = false;

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const vistaEventos  = document.getElementById('rep-vista-eventos');
  const vistaFormulario = document.getElementById('rep-vista-formulario');
  const gridEventos   = document.getElementById('rep-grid-eventos');
  const banner        = document.getElementById('rep-banner');
  const formReporte   = document.getElementById('form-reporte');
  const reporteExistente = document.getElementById('rep-existente');
  const btnGuardar    = document.getElementById('rep-btn-guardar');

  // ── Obtener usuario logueado ─────────────────────────────────────────────
  function _getNombreUsuario() {
    try {
      const u = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
      return u.nombre || 'Colaborador';
    } catch(_) { return 'Colaborador'; }
  }

  // ════════════════════════════════════════════════════════════════
  // 1. VISTA DE EVENTOS PASADOS
  // ════════════════════════════════════════════════════════════════

  async function renderEventos() {
    let eventos = [];
    try { eventos = await EventosModel.getAll(); }
    catch (e) { window.BSPLog?.error('reporte.eventos', e); }

    const hoy = new Date().toISOString().split('T')[0];
    // Solo eventos cuya fecha ya pasó
    const pasados = eventos.filter(ev => ev.fecha < hoy);

    gridEventos.innerHTML = '';

    if (!pasados.length) {
      gridEventos.innerHTML = `
        <div class="rep-empty">
          <i class="bx bx-calendar-x" aria-hidden="true"></i>
          <p>No hay eventos finalizados aún.</p>
        </div>`;
      return;
    }

    // Una sola consulta acotada a los eventos pasados (WHERE evento_id IN (...))
    // en vez de una por evento (antes: getByEvento(ev.id) dentro del bucle) y en
    // vez de traer toda la tabla de informes con getAll().
    let reportesPorEvento = {};
    try {
      const informesPasados = await ReportesModel.getByEventos(pasados.map(ev => ev.id));
      reportesPorEvento = Object.fromEntries(informesPasados.map(r => [String(r.eventoId), r]));
    } catch (e) { window.BSPLog?.error('reporte.informes', e); }

    // Separados en dos grupos: primero los pendientes (lo que hay que hacer),
    // luego los que ya tienen reporte — en vez de una sola lista mezclada.
    const sinReporte = pasados.filter(ev => !reportesPorEvento[String(ev.id)]);
    const conReporte = pasados.filter(ev => reportesPorEvento[String(ev.id)]);

    function _crearCard(ev, reporte) {
      const tieneRep = !!reporte;
      const fechaFmt = _formatFecha(ev.fecha);

      const card = document.createElement('div');
      card.className = `rep-evento-card${tieneRep ? ' rep-evento-card--con-reporte' : ''}`;

      card.innerHTML = `
        <div class="rep-ev-icon${tieneRep ? ' rep-ev-icon--done' : ''}">
          <i class="bx ${tieneRep ? 'bx-check' : 'bx-calendar-event'}"></i>
        </div>
        <div class="rep-ev-body">
          <h3 class="rep-ev-titulo">${esc(ev.titulo)}</h3>
          <p class="rep-ev-meta"><i class="bx bx-calendar" aria-hidden="true"></i> ${fechaFmt}</p>
          ${ev.horario   ? `<p class="rep-ev-meta"><i class="bx bx-time" aria-hidden="true"></i> ${esc(ev.horario)}</p>` : ''}
          ${ev.ubicacion ? `<p class="rep-ev-meta"><i class="bx bx-map-pin u-icono-rojo" aria-hidden="true"></i> ${esc(ev.ubicacion)}</p>` : ''}
          ${tieneRep
            ? `<p class="rep-ev-cargado"><i class="bx bx-check-circle" aria-hidden="true"></i> Reporte cargado</p>`
            : ''}
        </div>`;

      card.addEventListener('click', () => seleccionarEvento(ev));
      return card;
    }

    function _crearSubgrupo(titulo, iconoClase, modificador, lista) {
      const wrap = document.createElement('div');
      wrap.className = 'rep-subgrupo';

      const label = document.createElement('p');
      label.className = `rep-subgrupo-titulo${modificador ? ` ${modificador}` : ''}`;
      label.innerHTML = `<i class="bx ${iconoClase}" aria-hidden="true"></i> ${titulo} (${lista.length})`;
      wrap.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'rep-grid-eventos';
      lista.forEach(ev => grid.appendChild(_crearCard(ev, reportesPorEvento[String(ev.id)] || null)));
      wrap.appendChild(grid);

      return wrap;
    }

    gridEventos.classList.add('rep-grid-eventos--agrupado');
    if (sinReporte.length) {
      gridEventos.appendChild(_crearSubgrupo('Pendientes de reporte', 'bx-time-five', null, sinReporte));
    }
    if (conReporte.length) {
      gridEventos.appendChild(_crearSubgrupo('Reporte ya cargado', 'bx-check-circle', 'rep-subgrupo-titulo--ok', conReporte));
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIONAR EVENTO
  // ════════════════════════════════════════════════════════════════

  async function seleccionarEvento(ev) {
    eventoActual = ev;

    // Actualizar banner
    banner.querySelector('.rep-banner-titulo').textContent  = ev.titulo;
    banner.querySelector('.rep-banner-fecha').textContent   = _formatFecha(ev.fecha);
    banner.querySelector('.rep-banner-hora').textContent    = ev.horario || '';
    banner.querySelector('.rep-banner-lugar').textContent   = ev.ubicacion || '';

    // Pre-llenar formulario si ya existe reporte
    const reporte = await ReportesModel.getByEvento(ev.id);
    if (reporte) {
      document.getElementById('rep-ofrenda').value      = reporte.ofrenda;
      document.getElementById('rep-incidentes').value   = reporte.incidentes === 'Ninguno' ? '' : reporte.incidentes;
      document.getElementById('rep-observaciones').value= reporte.observaciones;
      btnGuardar.textContent = 'Actualizar Reporte';
    } else {
      formReporte.reset();
      btnGuardar.textContent = 'Cargar Reporte';
    }

    _renderReporteExistente(reporte);

    vistaEventos.style.display    = 'none';
    vistaFormulario.style.display = 'block';
  }

  function volverAEventosReporte() {
    eventoActual = null;
    vistaFormulario.style.display = 'none';
    vistaEventos.style.display    = 'block';
    renderEventos();
  }
  document.querySelector('.rep-btn-volver')?.addEventListener('click', volverAEventosReporte);

  // ════════════════════════════════════════════════════════════════
  // 3. GUARDAR REPORTE
  // ════════════════════════════════════════════════════════════════

  formReporte.addEventListener('submit', async e => {
    e.preventDefault();
    if (!eventoActual) return;
    if (enviandoReporte) return;

    const data = {
      eventoId:     eventoActual.id,
      eventoTitulo: eventoActual.titulo,
      ofrenda:      document.getElementById('rep-ofrenda').value,
      incidentes:   document.getElementById('rep-incidentes').value,
      observaciones:document.getElementById('rep-observaciones').value,
      creadoPor:    _getNombreUsuario()
    };

    enviandoReporte = true;
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.setAttribute('aria-busy', 'true'); }

    let resultado;
    try { resultado = await ReportesModel.guardar(data); }
    catch (ex) {
      showAlertError('Error de conexión. Intenta de nuevo.');
      enviandoReporte = false;
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.removeAttribute('aria-busy'); }
      return;
    }

    if (!resultado.ok) {
      showAlertError(resultado.error);
      enviandoReporte = false;
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.removeAttribute('aria-busy'); }
      return;
    }

    btnGuardar.textContent = 'Actualizar Reporte';
    enviandoReporte = false;
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.removeAttribute('aria-busy'); }
    _renderReporteExistente(resultado.reporte);
    showAlertSuccess(`El reporte de "${eventoActual.titulo}" fue guardado correctamente.`);
  });

  function cancelarReporte() {
    volverAEventosReporte();
  }
  document.querySelector('.rep-btn-cancelar')?.addEventListener('click', cancelarReporte);

  // ════════════════════════════════════════════════════════════════
  // 4. MOSTRAR REPORTE EXISTENTE
  // ════════════════════════════════════════════════════════════════

  function _renderReporteExistente(reporte) {
    if (!reporte) {
      reporteExistente.style.display = 'none';
      return;
    }

    reporteExistente.style.display = 'block';

    const ofrendaFmt = new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(reporte.ofrenda);

    const fechaFmt = _formatFechaLarga(reporte.creadoEn);

    reporteExistente.innerHTML = `
      <div class="rep-existente-header">
        <i class="bx bx-check-circle rep-existente-icon" aria-hidden="true"></i>
        <span class="rep-existente-titulo">Reporte Existente</span>
      </div>
      <div class="rep-existente-body">
        <p><strong>Ofrenda Recaudada:</strong> ${ofrendaFmt}</p>
        <p><strong>Incidentes:</strong> ${esc(reporte.incidentes || 'Ninguno')}</p>
        <p><strong>Observaciones:</strong> ${esc(reporte.observaciones)}</p>
        <p class="rep-existente-meta">Reportado el ${fechaFmt} por ${esc(reporte.creadoPor)}</p>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // 5. HELPERS DE FECHA
  // ════════════════════════════════════════════════════════════════

  function _formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]} ${parseInt(d)} ${meses[parseInt(m) - 1]}`;
    } catch(_) { return fechaStr; }
  }

  function _formatFechaLarga(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const meses = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]}, ${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
    } catch(_) { return fechaStr; }
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  renderEventos();
});
