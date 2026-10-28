/* global BSPModal, EventosModel, ReportesModel, VoluntariosModel, esc */
/**
 * ============================================================
 * CONTROLADOR: generar-reportes.controller.js
 * ============================================================
 * Genera reportes con plantilla oficial BSP (portada + páginas
 * internas con tablas, gráficas de barras y dona en SVG).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  let tipoSeleccionado = 'eventos';
  const historial = JSON.parse(localStorage.getItem('bsp_historial_reportes') || '[]');

  const tipoBtns = document.querySelectorAll('.gr-tipo-btn');
  const fechaDesde = document.getElementById('gr-fecha-desde');
  const fechaHasta = document.getElementById('gr-fecha-hasta');
  const listaRecientes = document.getElementById('gr-lista-recientes');
  const modal = document.getElementById('gr-modal');
  const modalOverlay = document.getElementById('gr-modal-overlay');
  const pdfContenido = document.getElementById('gr-pdf-contenido');

  tipoBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tipoBtns.forEach((b) => b.classList.remove('gr-tipo-btn--activo'));
      btn.classList.add('gr-tipo-btn--activo');
      tipoSeleccionado = btn.dataset.tipo;
    });
  });
  if (tipoBtns.length) tipoBtns[0].classList.add('gr-tipo-btn--activo');

  function renderHistorial() {
    listaRecientes.innerHTML = '';
    if (!historial.length) {
      listaRecientes.innerHTML = '<p class="gr-sin-reportes">Aún no se han generado reportes.</p>';
      return;
    }
    [...historial].reverse().slice(0, 5).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'gr-reciente-item';
      div.innerHTML = `
        <div class="gr-reciente-icon"><i class="bx bx-file" aria-hidden="true"></i></div>
        <div class="gr-reciente-info">
          <div class="gr-reciente-nombre">${esc(item.nombre)}</div>
          <div class="gr-reciente-fecha">Generado: ${esc(item.fecha)}</div>
        </div>
        <button class="gr-reciente-dl" title="Descargar" data-action="descargar-historial" data-idx="${historial.length - 1 - idx}">
          <i class="bx bx-download" aria-hidden="true"></i>
        </button>`;
      listaRecientes.appendChild(div);
    });
  }
  listaRecientes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="descargar-historial"]');
    if (btn) descargarHistorial(parseInt(btn.dataset.idx, 10));
  });

  async function generarReporte() {
    const desde = fechaDesde.value;
    const hasta = fechaHasta.value;
    let html = ''; let
      nombreReporte = '';

    if (tipoSeleccionado === 'eventos') {
      html = await localGenerarReporteEventos(desde, hasta);
      nombreReporte = 'Reporte de Eventos';
    } else if (tipoSeleccionado === 'voluntarios') {
      html = await localGenerarReporteVoluntarios(desde, hasta);
      nombreReporte = 'Reporte de Voluntarios';
    } else if (tipoSeleccionado === 'ofrendas') {
      html = await localGenerarReporteOfrendas(desde, hasta);
      nombreReporte = 'Reporte de Ofrendas y Diezmo';
    }

    const hoy = new Date().toLocaleDateString('es-CO');
    const rangoLabel = desde && hasta ? ` (${desde} – ${hasta})` : '';
    historial.push({ nombre: `${nombreReporte}${rangoLabel}`, fecha: hoy, html });
    localStorage.setItem('bsp_historial_reportes', JSON.stringify(historial));
    renderHistorial();

    pdfContenido.innerHTML = html;
    BSPModal.abrir({ overlay: modalOverlay, modal, modoDisplay: true });
  }

  function descargarPDF() {
    // Mover el contenido del PDF al body temporalmente para que
    // el @media print lo encuentre fuera del modal
    const contenido = document.getElementById('gr-pdf-contenido');
    const wrapper = document.createElement('div');
    wrapper.id = 'bsp-print-wrapper';
    wrapper.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;overflow:auto;';
    wrapper.appendChild(contenido.cloneNode(true));
    document.body.appendChild(wrapper);

    window.print();

    // Limpiar después de imprimir
    setTimeout(() => {
      const w = document.getElementById('bsp-print-wrapper');
      if (w) w.remove();
    }, 1000);
  }

  function descargarHistorial(idx) {
    const item = historial[idx];
    if (!item) return;
    pdfContenido.innerHTML = item.html;
    BSPModal.abrir({ overlay: modalOverlay, modal, modoDisplay: true });
  }

  function cerrarModalReporte() {
    BSPModal.cerrar({ overlay: modalOverlay, modal, modoDisplay: true });
  }
  modalOverlay.addEventListener('click', cerrarModalReporte);
  document.querySelector('.gr-btn-generar')?.addEventListener('click', generarReporte);
  document.querySelector('.gr-btn-descargar')?.addEventListener('click', descargarPDF);
  document.querySelector('.gr-btn-cerrar-modal')?.addEventListener('click', cerrarModalReporte);

  // ══════════════════════════════════════════════════════════════
  // PLANTILLA BSP — helpers de construcción
  // ══════════════════════════════════════════════════════════════

  const C_AZUL = '#0F1E5A';
  const C_DORADO = '#F5C215';

  function localGetUsuario() {
    try { return JSON.parse(localStorage.getItem('usuarioLogueado') || '{}').nombre || 'Administrador'; } catch (_) { return 'Administrador'; }
  }

  function localFiltrar(items, desde, hasta, campo) {
    if (!desde && !hasta) return items;
    return items.filter((i) => {
      const f = i[campo]; if (!f) return true;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }

  function localFmt(n) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }

  /* ── Portada oficial ── */
  function localPortada(tipo, preparadoPor, area, periodo) {
    const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    return `
    <div class="bsp-page bsp-portada">
      <div class="bsp-franja-top"></div>
      <div class="bsp-franja-left"></div>
      <div class="bsp-franja-right"></div>
      <div class="bsp-portada-inner">
        <div class="bsp-portada-logo-wrap">
          <img src="../../../assets/images/logo.png" alt="BSP" class="bsp-portada-logo"/>
          <p class="bsp-portada-logo-sub">Iglesia Cristiana</p>
        </div>
        <h1 class="bsp-portada-nombre">Bajo Su Presencia</h1>
        <p class="bsp-portada-subtitulo">Iglesia Cristiana &nbsp;•&nbsp; B.S.P</p>
        <div class="bsp-portada-divisor"></div>
        <p class="bsp-portada-reporte-label">REPORTE OFICIAL</p>
        <div class="bsp-portada-tipo-box">${tipo}</div>
        <div class="bsp-portada-meta">
          <div class="bsp-portada-meta-row"><span class="bsp-portada-meta-key">Fecha:</span><span class="bsp-portada-meta-val">${hoy}</span></div>
          <div class="bsp-portada-meta-row"><span class="bsp-portada-meta-key">Preparado por:</span><span class="bsp-portada-meta-val">${preparadoPor}</span></div>
          <div class="bsp-portada-meta-row"><span class="bsp-portada-meta-key">Área / Ministerio:</span><span class="bsp-portada-meta-val">${area}</span></div>
          <div class="bsp-portada-meta-row"><span class="bsp-portada-meta-key">Período:</span><span class="bsp-portada-meta-val">${periodo}</span></div>
        </div>
      </div>
      <div class="bsp-portada-pie">Documento confidencial — Iglesia Cristiana Bajo Su Presencia (B.S.P.)</div>
      <div class="bsp-franja-bottom"></div>
    </div>`;
  }

  /* ── Encabezado / pie de página interna ── */
  function localAbrirPagina(pag) {
    return `
    <div class="bsp-page bsp-pagina-interna">
      <div class="bsp-page-header">
        <div class="bsp-page-header-left">
          <img src="../../../assets/images/logo.png" alt="BSP" class="bsp-page-header-logo"/>
          <div>
            <div class="bsp-page-header-org">Bajo Su Presencia — Iglesia Cristiana</div>
            <div class="bsp-page-header-sub">Reporte Oficial | B.S.P</div>
          </div>
        </div>
        <div class="bsp-page-header-pag">Pág. ${pag}</div>
      </div>
      <div class="bsp-page-header-line"></div>
      <div class="bsp-page-body">`;
  }

  function localCerrarPagina() {
    return `</div>
      <div class="bsp-page-footer">Documento confidencial — Iglesia Cristiana Bajo Su Presencia (B.S.P.)</div>
    </div>`;
  }

  /* ── Tarjetas de estadísticas ── */
  function localStats(items) {
    return `<div class="bsp-stats-row">${items.map((s) => `<div class="bsp-stat-card"><div class="bsp-stat-val">${s.v}</div><div class="bsp-stat-lbl">${s.l}</div></div>`).join('')}</div>`;
  }

  /* ── Tabla ── */
  // Las filas se arman con celdas ya "pre-renderizadas" (algunas incluyen
  // markup literal como <strong>TOTAL</strong>), así que el escape de los
  // valores dinámicos (título de evento, nombre, propósito, etc.) se hace
  // en el punto donde se arma cada `filas.map(...)`, no aquí.
  function localTabla(cols, filas, nota) {
    const ths = cols.map((c) => `<th>${c}</th>`).join('');
    const trs = filas.length
      ? filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" class="bsp-tabla-empty">Sin datos en el período seleccionado</td></tr>`;
    return `<table class="bsp-tabla"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
            ${nota ? `<p class="bsp-tabla-nota">${nota}</p>` : ''}`;
  }

  /* ── Gráfica de barras SVG ── */
  function localBarras(titulo, datos, color) {
    if (!datos.length) return '';
    const max = Math.max(...datos.map((d) => d.v), 1);
    const W = 500; const H = 180; const
      PAD = 44;
    const slot = (W - PAD * 2) / datos.length;
    const BW = Math.min(38, slot - 10);
    // Renombrado de "esc" a "escala": el nombre "esc" tapaba (shadowing) la
    // función esc() de escape HTML del scope exterior, usada más abajo en
    // labs (esc(d.l)) — causaba "TypeError: esc is not a function" al
    // generar cualquier gráfico de barras.
    const escala = (H - 50) / max;
    let bars = ''; let labs = ''; let vals = ''; let
      guias = '';

    for (let i = 1; i <= 4; i += 1) {
      const gy = H - 30 - ((max / 4) * i * escala);
      guias += `<line x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}" stroke="#e5e7eb" stroke-width="1"/>
                <text x="${PAD - 4}" y="${gy + 4}" text-anchor="end" font-size="9" fill="#9ca3af">${Math.round((max / 4) * i)}</text>`;
    }
    datos.forEach((d, i) => {
      const x = PAD + i * slot + (slot - BW) / 2;
      const h = Math.max(d.v * escala, 2);
      const y = H - 30 - h;
      bars += `<rect x="${x}" y="${y}" width="${BW}" height="${h}" rx="4" fill="${color || C_AZUL}" opacity="0.85"/>`;
      labs += `<text x="${x + BW / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#6b7280">${esc(d.l)}</text>`;
      vals += `<text x="${x + BW / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="${color || C_AZUL}">${d.v}</text>`;
    });

    return `<div class="bsp-grafica-wrap">
      <div class="bsp-grafica-titulo">${titulo}</div>
      <svg viewBox="0 0 ${W} ${H}" class="bsp-grafica-svg">
        ${guias}
        <line x1="${PAD}" y1="${H - 30}" x2="${W - PAD}" y2="${H - 30}" stroke="#d1d5db" stroke-width="1.5"/>
        ${bars}${labs}${vals}
      </svg></div>`;
  }

  /* ── Gráfica de dona SVG ── */
  function localDona(titulo, datos) {
    if (!datos.length) return '';
    const total = datos.reduce((s, d) => s + d.v, 0) || 1;
    const cols = [C_AZUL, C_DORADO, '#059669', '#7c3aed', '#dc2626', '#0891b2'];
    const R = 58; const CX = 75; const
      CY = 75;
    let ang = -Math.PI / 2; let
      arcos = '';
    datos.forEach((d, i) => {
      const pct = d.v / total;
      const a2 = ang + pct * 2 * Math.PI;
      const x1 = CX + R * Math.cos(ang); const
        y1 = CY + R * Math.sin(ang);
      const x2 = CX + R * Math.cos(a2); const
        y2 = CY + R * Math.sin(a2);
      arcos += `<path d="M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${pct > 0.5 ? 1 : 0},1 ${x2},${y2} Z" fill="${cols[i % cols.length]}" opacity="0.9"/>`;
      ang = a2;
    });
    arcos += `<circle cx="${CX}" cy="${CY}" r="${R * 0.55}" fill="white"/>`;
    const leyenda = datos.map((d, i) => `<div class="bsp-dona-leyenda-item"><span class="bsp-dona-dot bsp-dona-dot--${i % cols.length}"></span><span>${esc(d.l)}: <strong>${d.v}</strong></span></div>`).join('');
    return `<div class="bsp-grafica-wrap bsp-grafica-dona-wrap">
      <div class="bsp-grafica-titulo">${titulo}</div>
      <div class="bsp-dona-row">
        <svg viewBox="0 0 150 150" class="bsp-dona-svg">${arcos}</svg>
        <div class="bsp-dona-leyenda">${leyenda}</div>
      </div></div>`;
  }

  /* ── Sección con título ── */
  function localSec(titulo, contenido) {
    return `<div class="bsp-seccion"><div class="bsp-seccion-titulo">${titulo}</div>${contenido}</div>`;
  }

  // ── 1. Reporte de Eventos ──────────────────────────────────────────────
  async function localGenerarReporteEventos(desde, hasta) {
    // eventos y localReps son independientes entre sí (ninguno usa el resultado
    // del otro para su propia consulta): se cruzan por evento_id recién
    // después, en JS plano (repMap). Se piden en paralelo en vez de en
    // serie para no sumar sus latencias.
    let eventos = []; let
      localReps = [];
    const [eventosRes, repsRes] = await Promise.allSettled([
      EventosModel.getAll(),
      ReportesModel.getAll(),
    ]);
    if (eventosRes.status === 'fulfilled') eventos = eventosRes.value;
    else window.BSPLog?.error('generarReportes.eventos', eventosRes.reason);
    if (repsRes.status === 'fulfilled') localReps = repsRes.value;
    else window.BSPLog?.error('generarReportes.reportes', repsRes.reason);

    eventos = localFiltrar(eventos, desde, hasta, 'fecha');

    // Pre-cargar reportes en un mapa por evento (evita llamadas async en filter/map)
    const repMap = {};
    localReps.forEach((r) => { repMap[r.eventoId] = r; });

    const conRep = eventos.filter((ev) => repMap[ev.id]).length;
    const periodo = desde && hasta ? `${desde} al ${hasta}` : 'Todos los registros';

    // Gráfica: eventos por mes
    const porMes = {};
    eventos.forEach((ev) => {
      if (!ev.fecha) return;
      const m = ev.fecha.substring(0, 7);
      porMes[m] = (porMes[m] || 0) + 1;
    });
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const datosBar = Object.entries(porMes).sort().map(([k, v]) => ({
      l: `${meses[parseInt(k.split('-')[1], 10) - 1]}'${k.split('-')[0].slice(2)}`, v,
    }));

    // Tabla
    const filas = eventos.map((ev) => {
      const rep = repMap[ev.id];
      return [esc(ev.titulo), esc(ev.fecha || '—'), esc(ev.ubicacion || '—'), esc(ev.asistentes || '—'),
        rep ? '✅ Sí' : '⏳ No', rep ? localFmt(rep.ofrenda) : '—'];
    });

    return localPortada('Reporte de Eventos', localGetUsuario(), 'Administración', periodo)
      + localAbrirPagina(2)
      + localSec('Resumen Ejecutivo', localStats([
        { v: eventos.length, l: 'Total Eventos' },
        { v: conRep, l: 'Con Reporte' },
        { v: eventos.length - conRep, l: 'Sin Reporte' },
        { v: eventos.filter((e) => e.fecha >= new Date().toISOString().split('T')[0]).length, l: 'Próximos' },
      ]))
      + localSec('Eventos por Mes', localBarras('Cantidad de eventos por mes', datosBar, C_AZUL))
      + localSec('Detalle de Eventos', localTabla(
        ['Evento', 'Fecha', 'Ubicación', 'Asistentes', 'Reporte', 'Ofrenda'],
        filas,
        `Total: ${eventos.length} evento(s) en el período`,
      ))
      + localCerrarPagina();
  }

  // ── 2. Reporte de Voluntarios ──────────────────────────────────────────
  async function localGenerarReporteVoluntarios(desde, hasta) {
    // eventos y califs son independientes entre sí (ninguno usa el resultado
    // del otro para su propia consulta): se cruzan por voluntarioId recién
    // después, en JS plano (mapaVol). Se piden en paralelo en vez de en
    // serie para no sumar sus latencias.
    let eventos = []; let
      califs = [];
    const [eventosRes, califsRes] = await Promise.allSettled([
      VoluntariosModel.getEventos(),
      VoluntariosModel.getCalificaciones(),
    ]);
    if (eventosRes.status === 'fulfilled') eventos = eventosRes.value;
    else window.BSPLog?.error('generarReportes.voluntarios', eventosRes.reason);
    if (califsRes.status === 'fulfilled') califs = califsRes.value;
    else window.BSPLog?.error('generarReportes.calificaciones', califsRes.reason);

    eventos = localFiltrar(eventos, desde, hasta, 'fecha');

    const mapaVol = {};
    eventos.forEach((ev) => {
      (ev.voluntarios || []).forEach((v) => {
        if (!mapaVol[v.id]) {
          mapaVol[v.id] = {
            nombre: v.nombre, rol: v.rol, eventos: 0, califs: [],
          };
        }
        mapaVol[v.id].eventos += 1;
      });
    });

    califs = localFiltrar(califs, desde, hasta, 'fecha');
    califs.forEach((c) => {
      if (mapaVol[c.voluntarioId]) mapaVol[c.voluntarioId].califs.push(c.estrellas);
    });

    const vols = Object.values(mapaVol);
    const promG = califs.length
      ? (califs.reduce((s, c) => s + c.estrellas, 0) / califs.length).toFixed(1) : '—';
    const periodo = desde && hasta ? `${desde} al ${hasta}` : 'Todos los registros';

    const filas = vols.map((v) => {
      const p = v.califs.length ? (v.califs.reduce((s, e) => s + e, 0) / v.califs.length).toFixed(1) : '—';
      const e = p !== '—' ? '★'.repeat(Math.round(Number(p))) + '☆'.repeat(5 - Math.round(Number(p))) : '—';
      return [esc(v.nombre), esc(v.rol || '—'), v.eventos, p !== '—' ? `${p} ${e}` : '—'];
    });

    const top8 = [...vols].sort((a, b) => b.eventos - a.eventos).slice(0, 8);
    const datosBar = top8.map((v) => ({ l: v.nombre.split(' ')[0], v: v.eventos }));

    const dist = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    };
    califs.forEach((c) => { if (dist[c.estrellas] !== undefined) dist[c.estrellas] += 1; });
    const datosDona = Object.entries(dist).filter(([, v]) => v > 0).map(([k, v]) => ({ l: `${k} ★`, v }));

    return localPortada('Reporte de Voluntarios', localGetUsuario(), 'Gestión de Voluntarios', periodo)
      + localAbrirPagina(2)
      + localSec('Resumen Ejecutivo', localStats([
        { v: vols.length, l: 'Voluntarios' },
        { v: eventos.length, l: 'Eventos' },
        { v: califs.length, l: 'Calificaciones' },
        { v: promG, l: 'Promedio Global ★' },
      ]))
      + localSec('Participación por Voluntario', localBarras('Eventos por voluntario (Top 8)', datosBar, C_AZUL))
      + (datosDona.length ? localSec('Distribución de Calificaciones', localDona('Calificaciones recibidas', datosDona)) : '')
      + localSec('Detalle de Voluntarios', localTabla(
        ['Nombre', 'Rol', 'Eventos', 'Calificación Prom.'],
        filas,
        `Total: ${vols.length} voluntario(s) en el período`,
      ))
      + localCerrarPagina();
  }

  // ── 3. Reporte de Ofrendas ─────────────────────────────────────────────
  async function localGenerarReporteOfrendas(desde, hasta) {
    let reportes = [];
    try { reportes = await ReportesModel.getAll(); } catch (e) { window.BSPLog?.error('generarReportes.listaReportes', e); }
    reportes = localFiltrar(reportes, desde, hasta, 'creadoEn');

    const total = reportes.reduce((s, r) => s + (r.ofrenda || 0), 0);
    const prom = reportes.length ? Math.round(total / reportes.length) : 0;
    const maxOf = reportes.length ? Math.max(...reportes.map((r) => r.ofrenda || 0)) : 0;
    const periodo = desde && hasta ? `${desde} al ${hasta}` : 'Todos los registros';

    const filas = reportes.map((r) => [esc(r.eventoTitulo || '—'), esc(r.creadoEn || '—'), localFmt(r.ofrenda), esc(r.creadoPor || '—')]);
    if (reportes.length) filas.push(['', '<strong>TOTAL</strong>', `<strong>${localFmt(total)}</strong>`, '']);

    const datosBar = reportes.slice(-8).map((r) => ({
      l: (r.eventoTitulo || '').split(' ')[0].substring(0, 8),
      v: r.ofrenda || 0,
    }));

    const rangos = {
      '< 500k': 0, '500k–1M': 0, '1M–2M': 0, '> 2M': 0,
    };
    reportes.forEach((r) => {
      const o = r.ofrenda || 0;
      if (o < 500000) rangos['< 500k'] += 1;
      else if (o < 1000000) rangos['500k–1M'] += 1;
      else if (o < 2000000) rangos['1M–2M'] += 1;
      else rangos['> 2M'] += 1;
    });
    const datosDona = Object.entries(rangos)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ l: k, v }));

    return localPortada('Reporte de Ofrendas y Diezmo', localGetUsuario(), 'Finanzas / Tesorería', periodo)
      + localAbrirPagina(2)
      + localSec('Resumen Ejecutivo', localStats([
        { v: reportes.length, l: 'Eventos con Reporte' },
        { v: localFmt(total), l: 'Total Recaudado' },
        { v: localFmt(prom), l: 'Promedio por Evento' },
        { v: localFmt(maxOf), l: 'Mayor Ofrenda' },
      ]))
      + localSec('Ofrendas por Evento', localBarras('Ofrenda recaudada por evento (últimos 8)', datosBar, C_DORADO))
      + (datosDona.length ? localSec('Distribución por Rango', localDona('Eventos por rango de ofrenda', datosDona)) : '')
      + localSec('Detalle de Ofrendas', localTabla(
        ['Evento', 'Fecha Reporte', 'Ofrenda (COP)', 'Reportado por'],
        filas,
        `Total recaudado: ${localFmt(total)}`,
      ))
      + localCerrarPagina();
  }

  renderHistorial();
});
