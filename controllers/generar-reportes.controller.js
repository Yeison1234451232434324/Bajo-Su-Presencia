/**
 * ============================================================
 * CONTROLADOR: generar-reportes.controller.js
 * ============================================================
 * Solo disponible para Administrador.
 * Genera previsualización PDF y permite descargarlo.
 *
 * Tipos de reporte:
 *   1. Reporte de Eventos       → eventos + reportes subidos
 *   2. Reporte de Voluntarios   → voluntarios y calificaciones
 *   3. Reporte de Ofrendas y Diezmo → ofrendas por evento
 *
 * Depende de:
 *   - EventosModel, ReportesModel, VoluntariosModel
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Estado ───────────────────────────────────────────────────────────────
  let tipoSeleccionado = 'eventos'; // 'eventos' | 'voluntarios' | 'ofrendas'

  // ── Historial de reportes generados (en memoria) ─────────────────────────
  const historial = JSON.parse(localStorage.getItem('bsp_historial_reportes') || '[]');

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const tipoBtns      = document.querySelectorAll('.gr-tipo-btn');
  const fechaDesde    = document.getElementById('gr-fecha-desde');
  const fechaHasta    = document.getElementById('gr-fecha-hasta');
  const listaRecientes = document.getElementById('gr-lista-recientes');
  const modal         = document.getElementById('gr-modal');
  const modalOverlay  = document.getElementById('gr-modal-overlay');
  const pdfContenido  = document.getElementById('gr-pdf-contenido');

  // ── Selección de tipo ────────────────────────────────────────────────────
  tipoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tipoBtns.forEach(b => b.classList.remove('gr-tipo-btn--activo'));
      btn.classList.add('gr-tipo-btn--activo');
      tipoSeleccionado = btn.dataset.tipo;
    });
  });

  // Activar el primero por defecto
  if (tipoBtns.length) tipoBtns[0].classList.add('gr-tipo-btn--activo');

  // ── Renderizar historial ─────────────────────────────────────────────────
  function renderHistorial() {
    listaRecientes.innerHTML = '';
    if (!historial.length) {
      listaRecientes.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">Aún no se han generado reportes.</p>`;
      return;
    }
    [...historial].reverse().slice(0, 5).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'gr-reciente-item';
      div.innerHTML = `
        <div class="gr-reciente-icon"><i class="bx bx-file"></i></div>
        <div class="gr-reciente-info">
          <div class="gr-reciente-nombre">${item.nombre}</div>
          <div class="gr-reciente-fecha">Generado: ${item.fecha}</div>
        </div>
        <button class="gr-reciente-dl" title="Descargar" onclick="descargarHistorial(${historial.length - 1 - idx})">
          <i class="bx bx-download"></i>
        </button>`;
      listaRecientes.appendChild(div);
    });
  }

  // ── Generar reporte ──────────────────────────────────────────────────────
  window.generarReporte = function() {
    const desde = fechaDesde.value;
    const hasta = fechaHasta.value;

    let html = '';
    let nombreReporte = '';

    if (tipoSeleccionado === 'eventos') {
      html = _generarReporteEventos(desde, hasta);
      nombreReporte = 'Reporte de Eventos';
    } else if (tipoSeleccionado === 'voluntarios') {
      html = _generarReporteVoluntarios(desde, hasta);
      nombreReporte = 'Reporte de Voluntarios';
    } else if (tipoSeleccionado === 'ofrendas') {
      html = _generarReporteOfrendas(desde, hasta);
      nombreReporte = 'Reporte de Ofrendas y Diezmo';
    }

    // Guardar en historial
    const hoy = new Date().toLocaleDateString('es-CO');
    const rangoLabel = desde && hasta ? ` (${desde} – ${hasta})` : '';
    historial.push({ nombre: `${nombreReporte}${rangoLabel}`, fecha: hoy, html });
    localStorage.setItem('bsp_historial_reportes', JSON.stringify(historial));
    renderHistorial();

    // Mostrar en modal
    pdfContenido.innerHTML = html;
    modal.style.display        = 'flex';
    modalOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  // ── Descargar (imprimir como PDF) ────────────────────────────────────────
  window.descargarPDF = function() {
    window.print();
  };

  window.descargarHistorial = function(idx) {
    const item = historial[idx];
    if (!item) return;
    pdfContenido.innerHTML = item.html;
    modal.style.display        = 'flex';
    modalOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  // ── Cerrar modal ─────────────────────────────────────────────────────────
  window.cerrarModalReporte = function() {
    modal.style.display        = 'none';
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  };
  modalOverlay.addEventListener('click', cerrarModalReporte);

  // ════════════════════════════════════════════════════════════════
  // GENERADORES DE CONTENIDO PDF
  // ════════════════════════════════════════════════════════════════

  function _cabeceraPDF(titulo, subtitulo) {
    const ahora = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    return `
      <div class="gr-pdf-page">
        <div class="gr-pdf-logo-row">
          <div>
            <div class="gr-pdf-org">Bajo Su Presencia</div>
            <div class="gr-pdf-org-sub">Sistema de Gestión Eclesiástica</div>
          </div>
          <div class="gr-pdf-fecha-gen">Generado el<br><strong>${ahora}</strong></div>
        </div>
        <div class="gr-pdf-titulo">${titulo}</div>
        <div class="gr-pdf-subtitulo">${subtitulo}</div>`;
  }

  function _piePDF() {
    return `
        <div class="gr-pdf-footer">
          Bajo Su Presencia · Documento generado automáticamente · Confidencial
        </div>
      </div>`;
  }

  function _filtrarPorFecha(items, desde, hasta, campoFecha) {
    if (!desde && !hasta) return items;
    return items.filter(item => {
      const f = item[campoFecha];
      if (!f) return true;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }

  // ── 1. Reporte de Eventos ────────────────────────────────────────────────
  function _generarReporteEventos(desde, hasta) {
    let eventos = [];
    try { eventos = EventosModel.getAll(); } catch(_) {}
    eventos = _filtrarPorFecha(eventos, desde, hasta, 'fecha');

    const totalEventos = eventos.length;
    const conReporte   = eventos.filter(ev => ReportesModel.getByEvento(ev.id)).length;

    let filas = '';
    if (!eventos.length) {
      filas = `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Sin eventos en el rango seleccionado</td></tr>`;
    } else {
      eventos.forEach(ev => {
        const rep = ReportesModel.getByEvento(ev.id);
        const ofrendaFmt = rep
          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(rep.ofrenda)
          : '—';
        filas += `
          <tr>
            <td>${ev.titulo}</td>
            <td>${ev.fecha || '—'}</td>
            <td>${ev.ubicacion || '—'}</td>
            <td>${rep ? '✅ Sí' : '⏳ No'}</td>
            <td>${ofrendaFmt}</td>
          </tr>`;
      });
    }

    const rangoLabel = desde || hasta
      ? `Período: ${desde || '—'} al ${hasta || '—'}`
      : 'Todos los eventos registrados';

    return _cabeceraPDF('Reporte de Eventos', rangoLabel) + `
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-stat-grid">
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${totalEventos}</div>
            <div class="gr-pdf-stat-lbl">Total Eventos</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${conReporte}</div>
            <div class="gr-pdf-stat-lbl">Con Reporte</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${totalEventos - conReporte}</div>
            <div class="gr-pdf-stat-lbl">Sin Reporte</div>
          </div>
        </div>
      </div>
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-seccion-titulo">Detalle de Eventos</div>
        <table class="gr-pdf-tabla">
          <thead>
            <tr>
              <th>Evento</th><th>Fecha</th><th>Ubicación</th><th>Reporte</th><th>Ofrenda</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>` + _piePDF();
  }

  // ── 2. Reporte de Voluntarios ────────────────────────────────────────────
  function _generarReporteVoluntarios(desde, hasta) {
    let eventos = [];
    try { eventos = VoluntariosModel.getEventos(); } catch(_) {}
    eventos = _filtrarPorFecha(eventos, desde, hasta, 'fecha');

    // Recopilar todos los voluntarios únicos
    const mapaVol = {};
    eventos.forEach(ev => {
      (ev.voluntarios || []).forEach(v => {
        if (!mapaVol[v.id]) mapaVol[v.id] = { nombre: v.nombre, rol: v.rol, eventos: 0, califs: [] };
        mapaVol[v.id].eventos++;
      });
    });

    // Agregar calificaciones
    let califs = [];
    try { califs = VoluntariosModel.getCalificaciones(); } catch(_) {}
    califs = _filtrarPorFecha(califs, desde, hasta, 'fecha');
    califs.forEach(c => {
      if (mapaVol[c.voluntarioId]) {
        mapaVol[c.voluntarioId].califs.push(c.estrellas);
      }
    });

    const voluntarios = Object.values(mapaVol);
    const totalVol    = voluntarios.length;
    const totalCalifs = califs.length;
    const promGlobal  = totalCalifs > 0
      ? (califs.reduce((s, c) => s + c.estrellas, 0) / totalCalifs).toFixed(1)
      : '—';

    let filas = '';
    if (!voluntarios.length) {
      filas = `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Sin datos en el rango seleccionado</td></tr>`;
    } else {
      voluntarios.forEach(v => {
        const prom = v.califs.length
          ? (v.califs.reduce((s, e) => s + e, 0) / v.califs.length).toFixed(1)
          : '—';
        const estrellas = prom !== '—' ? '★'.repeat(Math.round(Number(prom))) : '—';
        filas += `
          <tr>
            <td>${v.nombre}</td>
            <td>${v.rol || '—'}</td>
            <td>${v.eventos}</td>
            <td>${prom !== '—' ? `${prom} ${estrellas}` : '—'}</td>
          </tr>`;
      });
    }

    const rangoLabel = desde || hasta
      ? `Período: ${desde || '—'} al ${hasta || '—'}`
      : 'Todos los voluntarios registrados';

    return _cabeceraPDF('Reporte de Voluntarios', rangoLabel) + `
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-stat-grid">
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${totalVol}</div>
            <div class="gr-pdf-stat-lbl">Voluntarios</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${totalCalifs}</div>
            <div class="gr-pdf-stat-lbl">Calificaciones</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${promGlobal}</div>
            <div class="gr-pdf-stat-lbl">Promedio Global</div>
          </div>
        </div>
      </div>
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-seccion-titulo">Detalle de Voluntarios</div>
        <table class="gr-pdf-tabla">
          <thead>
            <tr><th>Nombre</th><th>Rol</th><th>Eventos</th><th>Calificación Prom.</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>` + _piePDF();
  }

  // ── 3. Reporte de Ofrendas y Diezmo ─────────────────────────────────────
  function _generarReporteOfrendas(desde, hasta) {
    let reportes = [];
    try { reportes = ReportesModel.getAll(); } catch(_) {}
    reportes = _filtrarPorFecha(reportes, desde, hasta, 'creadoEn');

    const totalOfrenda = reportes.reduce((s, r) => s + (r.ofrenda || 0), 0);
    const totalEventos = reportes.length;
    const promedio     = totalEventos > 0 ? Math.round(totalOfrenda / totalEventos) : 0;

    const fmt = n => new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(n);

    let filas = '';
    if (!reportes.length) {
      filas = `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Sin reportes en el rango seleccionado</td></tr>`;
    } else {
      reportes.forEach(r => {
        filas += `
          <tr>
            <td>${r.eventoTitulo || '—'}</td>
            <td>${r.creadoEn || '—'}</td>
            <td>${fmt(r.ofrenda)}</td>
            <td>${r.creadoPor || '—'}</td>
          </tr>`;
      });
      // Fila de total
      filas += `
        <tr style="font-weight:700;background:#f0f4ff;">
          <td colspan="2">TOTAL</td>
          <td>${fmt(totalOfrenda)}</td>
          <td></td>
        </tr>`;
    }

    const rangoLabel = desde || hasta
      ? `Período: ${desde || '—'} al ${hasta || '—'}`
      : 'Todos los reportes registrados';

    return _cabeceraPDF('Reporte de Ofrendas y Diezmo', rangoLabel) + `
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-stat-grid">
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${totalEventos}</div>
            <div class="gr-pdf-stat-lbl">Eventos</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${fmt(totalOfrenda)}</div>
            <div class="gr-pdf-stat-lbl">Total Recaudado</div>
          </div>
          <div class="gr-pdf-stat">
            <div class="gr-pdf-stat-val">${fmt(promedio)}</div>
            <div class="gr-pdf-stat-lbl">Promedio por Evento</div>
          </div>
        </div>
      </div>
      <div class="gr-pdf-seccion">
        <div class="gr-pdf-seccion-titulo">Detalle de Ofrendas por Evento</div>
        <table class="gr-pdf-tabla">
          <thead>
            <tr><th>Evento</th><th>Fecha Reporte</th><th>Ofrenda (COP)</th><th>Reportado por</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>` + _piePDF();
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  renderHistorial();
});
