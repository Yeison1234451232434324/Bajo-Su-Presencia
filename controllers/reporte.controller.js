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

document.addEventListener('DOMContentLoaded', () => {

  // ── Estado ───────────────────────────────────────────────────────────────
  let eventoActual = null;

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

  function renderEventos() {
    let eventos = [];
    try { eventos = EventosModel.getAll(); } catch(_) {}

    const hoy = new Date().toISOString().split('T')[0];
    // Solo eventos cuya fecha ya pasó
    const pasados = eventos.filter(ev => ev.fecha < hoy);

    gridEventos.innerHTML = '';

    if (!pasados.length) {
      gridEventos.innerHTML = `
        <div class="rep-empty">
          <i class="bx bx-calendar-x"></i>
          <p>No hay eventos finalizados aún.</p>
        </div>`;
      return;
    }

    pasados.forEach(ev => {
      const reporte    = ReportesModel.getByEvento(ev.id);
      const tieneRep   = !!reporte;
      const fechaFmt   = _formatFecha(ev.fecha);

      const card = document.createElement('div');
      card.className = `rep-evento-card${tieneRep ? ' rep-evento-card--con-reporte' : ''}`;

      card.innerHTML = `
        <div class="rep-ev-icon${tieneRep ? ' rep-ev-icon--done' : ''}">
          <i class="bx ${tieneRep ? 'bx-check' : 'bx-calendar-event'}"></i>
        </div>
        <div class="rep-ev-body">
          <h3 class="rep-ev-titulo">${ev.titulo}</h3>
          <p class="rep-ev-meta"><i class="bx bx-calendar"></i> ${fechaFmt}</p>
          ${ev.horario   ? `<p class="rep-ev-meta"><i class="bx bx-time"></i> ${ev.horario}</p>` : ''}
          ${ev.ubicacion ? `<p class="rep-ev-meta"><i class="bx bx-map-pin" style="color:#f87171;"></i> ${ev.ubicacion}</p>` : ''}
          ${tieneRep
            ? `<p class="rep-ev-cargado"><i class="bx bx-check-circle"></i> Reporte cargado</p>`
            : ''}
        </div>`;

      card.addEventListener('click', () => seleccionarEvento(ev));
      gridEventos.appendChild(card);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIONAR EVENTO
  // ════════════════════════════════════════════════════════════════

  function seleccionarEvento(ev) {
    eventoActual = ev;

    // Actualizar banner
    banner.querySelector('.rep-banner-titulo').textContent  = ev.titulo;
    banner.querySelector('.rep-banner-fecha').textContent   = _formatFecha(ev.fecha);
    banner.querySelector('.rep-banner-hora').textContent    = ev.horario || '';
    banner.querySelector('.rep-banner-lugar').textContent   = ev.ubicacion || '';

    // Pre-llenar formulario si ya existe reporte
    const reporte = ReportesModel.getByEvento(ev.id);
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

  window.volverAEventosReporte = function() {
    eventoActual = null;
    vistaFormulario.style.display = 'none';
    vistaEventos.style.display    = 'block';
    renderEventos();
  };

  // ════════════════════════════════════════════════════════════════
  // 3. GUARDAR REPORTE
  // ════════════════════════════════════════════════════════════════

  formReporte.addEventListener('submit', e => {
    e.preventDefault();
    if (!eventoActual) return;

    const data = {
      eventoId:     eventoActual.id,
      eventoTitulo: eventoActual.titulo,
      ofrenda:      document.getElementById('rep-ofrenda').value,
      incidentes:   document.getElementById('rep-incidentes').value,
      observaciones:document.getElementById('rep-observaciones').value,
      creadoPor:    _getNombreUsuario()
    };

    const resultado = ReportesModel.guardar(data);

    if (!resultado.ok) {
      showToast('Error', resultado.error);
      return;
    }

    btnGuardar.textContent = 'Actualizar Reporte';
    _renderReporteExistente(resultado.reporte);
    showToast('Reporte guardado', `El reporte de "${eventoActual.titulo}" fue guardado correctamente.`);
  });

  window.cancelarReporte = function() {
    volverAEventosReporte();
  };

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
        <i class="bx bx-check-circle rep-existente-icon"></i>
        <span class="rep-existente-titulo">Reporte Existente</span>
      </div>
      <div class="rep-existente-body">
        <p><strong>Ofrenda Recaudada:</strong> ${ofrendaFmt}</p>
        <p><strong>Incidentes:</strong> ${reporte.incidentes || 'Ninguno'}</p>
        <p><strong>Observaciones:</strong> ${reporte.observaciones}</p>
        <p class="rep-existente-meta">Reportado el ${fechaFmt} por ${reporte.creadoPor}</p>
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
