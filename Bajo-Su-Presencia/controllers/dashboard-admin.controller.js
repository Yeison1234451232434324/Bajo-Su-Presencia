  window.addEventListener('DOMContentLoaded', async () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const fmtCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

    // Fecha en formato YYYY-MM-DD a partir de los componentes LOCALES del
    // Date, sin pasar por toISOString() (que convierte a UTC y por eso
    // corría la fecha un día hacia atrás/adelante según la hora y el huso
    // horario del navegador — bug real, no solo de noche: para Colombia
    // (UTC-5) cualquier fecha local se desplazaba al convertir a UTC).
    const fechaLocal = (d) => {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Este bloque corre en paralelo con BSPSession.exigir() (script aparte,
    // más abajo) — no lo espera. Si la sesión NO es válida o el rol no es
    // Administrador, exigir() reemplaza document.body por la pantalla
    // "Acceso denegado" (ver session.manager.js → #negar()), y ese reemplazo
    // puede ocurrir MIENTRAS este bloque sigue en medio de sus propias
    // esperas asíncronas (el fetch de /api/db/*, etc.). Sin este control, el
    // código de más abajo seguía intentando usar elementos que ya no existen
    // en el DOM (getElementById devuelve null) y lanzaba una excepción sin
    // capturar — cosmético (el acceso ya estaba correctamente denegado), pero
    // real. Un solo elemento ancla (#panel-fecha-hoy, presente desde el HTML
    // inicial) basta para saber si la página sigue siendo el dashboard real.
    const fechaHoyEl = document.getElementById('panel-fecha-hoy');
    if (!fechaHoyEl) return;

    const hoyDate = new Date();
    fechaHoyEl.textContent =
      hoyDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (typeof sb === 'undefined') return;

    // ── Una sola consulta por tabla, en paralelo ────────────────────────────
    // pqr/donaciones se leen UNA vez con getAll() y las estadísticas se
    // calculan aquí mismo en memoria (antes: PQRModel.getEstadisticas() y
    // DonacionesModel.getEstadisticas() hacían CADA UNA su propio getAll()
    // interno, y más abajo el bloque de "Actividad reciente" volvía a llamar
    // PQRModel.getAll()/DonacionesModel.getAll() por tercera vez — 3
    // consultas a la misma tabla donde basta 1). auditoriaRows reutiliza el
    // endpoint dedicado del módulo Auditoría (AuditoriaModel), sin duplicar
    // su lógica de consulta.
    const [usuariosRes, eventosRes, noticiasRes, oracionesRes, volEventosRes, actividades, pqrTodas, donTodas, auditoriaRows] =
      await Promise.all([
        sb.from('usuarios').select('nombre_completo, activo, creado_en, roles(nombre), usuario_especialidades(especialidades(nombre))'),
        sb.from('eventos').select('id, titulo, fecha, hora, hora_fin, ubicacion, estado, publicado_en'),
        sb.from('noticias').select('titulo, publicado_en'),
        sb.from('oraciones').select('titulo, publicado_en'),
        sb.from('voluntarios_eventos').select('usuario_id, usuarios(nombre_completo, usuario_especialidades(especialidades(nombre)))'),
        (typeof ActividadesModel !== 'undefined' ? ActividadesModel.getAll() : Promise.resolve([])).catch(() => []),
        (typeof PQRModel !== 'undefined' ? PQRModel.getAll() : Promise.resolve([])).catch(() => []),
        (typeof DonacionesModel !== 'undefined' ? DonacionesModel.getAll() : Promise.resolve([])).catch(() => []),
        (typeof AuditoriaModel !== 'undefined' ? AuditoriaModel.listar({ limite: 100 }) : Promise.resolve([])).catch(() => [])
      ]);

    // Segundo control: esta espera (varias peticiones en paralelo) es
    // exactamente la ventana de tiempo en la que exigir() puede terminar
    // primero y reemplazar el DOM. Sin este control, el resto del bloque
    // (alertas, gráficas Chart.js, tablas) seguía ejecutándose contra
    // elementos ya inexistentes.
    if (!document.getElementById('panel-fecha-hoy')) return;

    if (usuariosRes.error) window.BSPLog?.error('dashboard.usuarios', usuariosRes.error);
    const usuarios  = (usuariosRes.data || []).map(u => ({
      ...u,
      especialidad: u.usuario_especialidades?.[0]?.especialidades?.nombre || ''
    }));
    const eventos   = eventosRes.data   || [];
    const noticias  = noticiasRes.data  || [];
    const oraciones = oracionesRes.data || [];

    const pqrStats = pqrTodas.length ? {
      total:      pqrTodas.length,
      pendientes: pqrTodas.filter(p => p.estado === 'Pendiente').length,
      enProceso:  pqrTodas.filter(p => p.estado === 'En proceso').length,
      resueltos:  pqrTodas.filter(p => p.estado === 'Resuelto').length,
      cerrados:   pqrTodas.filter(p => p.estado === 'Cerrado').length
    } : { total: 0, pendientes: 0, enProceso: 0, resueltos: 0, cerrados: 0 };

    const donTotal = donTodas.reduce((acc, d) => acc + d.monto, 0);
    const donStats = { total: donTotal, cantidad: donTodas.length, promedio: donTodas.length ? Math.round(donTotal / donTodas.length) : 0 };

    const activos     = usuarios.filter(u => u.activo !== false);
    const voluntarios = usuarios.filter(u => u.roles?.nombre === 'Voluntario');
    const volActivos  = activos.filter(u => u.roles?.nombre === 'Voluntario');

    const iniMes    = fechaLocal(new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1));
    const finMes    = fechaLocal(new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0));
    const iniMesAnt = fechaLocal(new Date(hoyDate.getFullYear(), hoyDate.getMonth() - 1, 1));
    const finMesAnt = fechaLocal(new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 0));
    const eventosEsteMes = eventos.filter(e => e.fecha >= iniMes && e.fecha <= finMes);
    const eventosMesAnt  = eventos.filter(e => e.fecha >= iniMesAnt && e.fecha <= finMesAnt);
    const noticiasEsteMes  = noticias.filter(n => (n.publicado_en || '') >= iniMes);
    const oracionesEsteMes = oraciones.filter(o => (o.publicado_en || '') >= iniMes);

    // ── Tarjetas de métricas (todo el texto de contexto es un dato real,
    //    no un porcentaje inventado) ──────────────────────────────────────
    set('kpi-miembros', activos.length);
    set('kpi-miembros-sub', `de ${usuarios.length} registrados`);

    set('kpi-eventos', eventosEsteMes.length);
    const deltaEventos = eventosEsteMes.length - eventosMesAnt.length;
    set('kpi-eventos-sub', deltaEventos === 0
      ? `Igual que el mes anterior (${eventosMesAnt.length})`
      : `${deltaEventos > 0 ? '↑' : '↓'} ${Math.abs(deltaEventos)} vs. mes anterior (${eventosMesAnt.length})`);

    set('kpi-noticias', noticias.length);
    set('kpi-noticias-sub', `${noticiasEsteMes.length} publicada${noticiasEsteMes.length === 1 ? '' : 's'} este mes`);

    set('kpi-oraciones', oraciones.length);
    set('kpi-oraciones-sub', `${oracionesEsteMes.length} publicada${oracionesEsteMes.length === 1 ? '' : 's'} este mes`);

    set('kpi-voluntarios', volActivos.length);
    set('kpi-voluntarios-sub', `de ${voluntarios.length} registrados`);

    set('kpi-pqr', pqrStats.pendientes);
    set('kpi-pqr-sub', `de ${pqrStats.total} recibidas`);

    set('kpi-donaciones', fmtCOP(donStats.total));
    set('kpi-donaciones-sub', `${donStats.cantidad} registro${donStats.cantidad === 1 ? '' : 's'}`);

    const actPendientes  = (actividades || []).filter(a => !a.completada).length;
    const actCompletadas = (actividades || []).length - actPendientes;
    set('kpi-actividades', actPendientes);
    set('kpi-actividades-sub', `${actCompletadas} de ${(actividades || []).length} completadas`);

    // ── Alertas / pendientes: solo se muestran si hay algo real que atender ─
    const alertsGrid = document.getElementById('alertsGrid');
    const eventosProx7 = eventos.filter(e => e.fecha >= fechaLocal(hoyDate)
      && e.fecha <= fechaLocal(new Date(hoyDate.getTime() + 7 * 86400000)));
    const alertas = [];
    if (pqrStats.pendientes > 0) {
      alertas.push({ tipo: 'danger', icono: 'bx-error-circle', valor: pqrStats.pendientes,
        label: `PQR pendiente${pqrStats.pendientes === 1 ? '' : 's'} de responder`, href: 'pqr.html' });
    }
    if (actPendientes > 0) {
      alertas.push({ tipo: 'warning', icono: 'bx-task', valor: actPendientes,
        label: `Actividad${actPendientes === 1 ? '' : 'es'} pendiente${actPendientes === 1 ? '' : 's'}`, href: 'actividades.html' });
    }
    if (eventosProx7.length > 0) {
      alertas.push({ tipo: 'info', icono: 'bx-calendar-event', valor: eventosProx7.length,
        label: `Evento${eventosProx7.length === 1 ? '' : 's'} en los próximos 7 días`, href: 'eventos.html' });
    }
    if (alertsGrid && alertas.length) {
      alertsGrid.style.display = 'grid';
      alertsGrid.innerHTML = alertas.map(a => `
        <a class="alert-card alert-card--${a.tipo}" href="${a.href}">
          <span class="alert-card-icon"><i class="bx ${a.icono}" aria-hidden="true"></i></span>
          <span class="alert-card-body">
            <span class="alert-card-value">${a.valor}</span>
            <span class="alert-card-label">${a.label}</span>
          </span>
        </a>`).join('');
    }

    // ── Actividad reciente: noticias, eventos, voluntarios nuevos, PQR y
    //    donaciones — todo con fecha real, ordenado y recortado a 6 ──────────
    const tiempoRelativo = (fechaISO) => {
      const d = new Date(fechaISO);
      const diffMs = Date.now() - d.getTime();
      const min = Math.floor(diffMs / 60000);
      if (min < 1) return 'Hace un momento';
      if (min < 60) return `Hace ${min} min`;
      const horas = Math.floor(min / 60);
      if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`;
      const dias = Math.floor(horas / 24);
      if (dias === 1) return 'Ayer';
      return `Hace ${dias} días`;
    };
    const activityEl = document.getElementById('activityList');
    if (activityEl) {
      // pqrTodas/donTodas ya se cargaron una sola vez arriba: se reutilizan
      // aquí en vez de volver a consultar las mismas tablas.
      const items = [
        ...noticias.slice(0, 5).map(n => ({ fecha: n.publicado_en, dot: 'green', text: `Nueva noticia publicada: <strong>${esc(n.titulo || 'Sin título')}</strong>` })),
        ...eventos.slice(0, 5).map(e => ({ fecha: e.publicado_en, dot: 'blue', text: `Evento creado: <strong>${esc(e.titulo || 'Sin título')}</strong>` })),
        ...usuarios.filter(u => u.roles?.nombre === 'Voluntario').slice(0, 5)
          .map(u => ({ fecha: u.creado_en, dot: 'purple', text: `Nuevo voluntario registrado: <strong>${esc(u.nombre_completo || 'Sin nombre')}</strong>` })),
        ...pqrTodas.slice(0, 5).map(p => ({ fecha: p.creadoEn, dot: 'amber', text: `PQR recibida: <strong>${esc(p.asunto || 'Sin asunto')}</strong>` })),
        ...donTodas.slice(0, 5).map(d => ({ fecha: d.creadoEn, dot: 'green', text: `Donación registrada: <strong>${esc(d.nombre || 'Donante anónimo')}</strong>` }))
      ]
        .filter(it => it.fecha)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 6);

      activityEl.innerHTML = items.length ? items.map(it => `
        <li class="activity-item">
          <div class="activity-dot activity-dot--${it.dot}"></div>
          <div class="activity-body">
            <p class="activity-text">${it.text}</p>
            <span class="activity-time">${tiempoRelativo(it.fecha)}</span>
          </div>
        </li>`).join('') : '<li class="activity-item"><div class="activity-body"><p class="activity-text">Sin actividad reciente.</p></div></li>';
    }

    // ── Voluntarios destacados: ranking por participación en eventos ───────
    const volunteerEl = document.getElementById('volunteerList');
    if (volunteerEl) {
      const conteo = {};
      (volEventosRes.data || []).forEach(ve => {
        if (!ve.usuario_id) return;
        if (!conteo[ve.usuario_id]) {
          conteo[ve.usuario_id] = { usuarioId: ve.usuario_id, nombre: ve.usuarios?.nombre_completo || 'Sin nombre', especialidad: ve.usuarios?.usuario_especialidades?.[0]?.especialidades?.nombre || 'Sin área', total: 0 };
        }
        conteo[ve.usuario_id].total++;
      });
      const top = Object.values(conteo).sort((a, b) => b.total - a.total).slice(0, 5);
      const avatarClases = ['volunteer-avatar--0', 'volunteer-avatar--1', 'volunteer-avatar--2', 'volunteer-avatar--3', 'volunteer-avatar--4'];
      const badgeClases  = ['badge-blue', 'badge-amber', 'badge-green', 'badge-purple', 'badge-red'];
      const iniciales = (n) => n.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '—';

      // Carga de actividades por voluntario: se reutiliza el mismo array
      // `actividades` (ActividadesModel.getAll(), ya cargado arriba con sus
      // nombres resueltos en una sola consulta batch) — no se agrega ninguna
      // consulta nueva para esta columna.
      const actividadesPorVoluntario = {};
      (actividades || []).forEach(a => {
        if (!a.voluntarioId) return;
        actividadesPorVoluntario[a.voluntarioId] = (actividadesPorVoluntario[a.voluntarioId] || 0) + 1;
      });

      volunteerEl.innerHTML = top.length ? top.map((v, i) => {
        const numActividades = actividadesPorVoluntario[v.usuarioId] || 0;
        return `
        <div class="volunteer-item">
          <div class="volunteer-avatar ${avatarClases[i % avatarClases.length]}">${esc(iniciales(v.nombre))}</div>
          <div class="volunteer-info">
            <p class="volunteer-name">${esc(v.nombre)}</p>
            <p class="volunteer-area">Área: ${esc(v.especialidad)}</p>
          </div>
          <div class="volunteer-stats">
            <span class="badge ${badgeClases[i % badgeClases.length]}">${v.total} evento${v.total === 1 ? '' : 's'}</span>
            ${numActividades > 0 ? `<span class="badge badge-accion">${numActividades} actividad${numActividades === 1 ? '' : 'es'}</span>` : ''}
          </div>
        </div>`;
      }).join('') : '<div class="volunteer-item"><div class="volunteer-info"><p class="volunteer-name">Aún no hay voluntarios asignados a eventos.</p></div></div>';
    }

    // ── PQR por Estado (los 4 estados reales de public.pqr) ─────────────────
    const pqrEstadoEl = document.getElementById('pqrEstadoList');
    if (pqrEstadoEl) {
      const filas = [
        { label: 'Pendiente',  valor: pqrStats.pendientes },
        { label: 'En proceso', valor: pqrStats.enProceso  },
        { label: 'Resuelto',   valor: pqrStats.resueltos  },
        { label: 'Cerrado',    valor: pqrStats.cerrados   }
      ];
      pqrEstadoEl.innerHTML = pqrStats.total > 0
        ? filas.map(f => `<div class="table-row"><span>${f.label}</span><span class="badge badge-accion">${f.valor}</span></div>`).join('')
        : '<div class="table-row"><span>Aún no se han radicado PQR.</span></div>';
    }

    // ── Actividades por Evento (top 5 eventos con más actividades, con su
    //    desglose pendientes/completadas) — reutiliza `actividades` y
    //    `eventos`, ya cargados arriba; sin consultas adicionales. ──────────
    const actEventoEl = document.getElementById('actividadesEventoList');
    if (actEventoEl) {
      const tituloPorEvento = {};
      eventos.forEach(e => { tituloPorEvento[e.id] = e.titulo || 'Sin título'; });

      const porEvento = {};
      (actividades || []).forEach(a => {
        if (!a.eventoId) return;
        if (!porEvento[a.eventoId]) porEvento[a.eventoId] = { pendientes: 0, completadas: 0 };
        if (a.completada) porEvento[a.eventoId].completadas++;
        else porEvento[a.eventoId].pendientes++;
      });
      const topEventos = Object.entries(porEvento)
        .map(([eventoId, c]) => ({ titulo: tituloPorEvento[eventoId] || 'Evento eliminado', ...c, total: c.pendientes + c.completadas }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      actEventoEl.innerHTML = topEventos.length ? topEventos.map(e => `
        <div class="table-row">
          <span>${esc(e.titulo)}</span>
          <span>
            ${e.pendientes > 0 ? `<span class="badge badge-accion">${e.pendientes} pend.</span>` : ''}
            ${e.completadas > 0 ? `<span class="badge badge-accion">${e.completadas} listas</span>` : ''}
          </span>
        </div>`).join('') : '<div class="table-row"><span>Aún no hay actividades registradas.</span></div>';
    }

    // ── Auditoría: reutiliza AuditoriaModel (mismo endpoint del módulo
    //    Auditoría) — solo se agrega un resumen (éxitos/errores y módulos
    //    más activos), calculado en memoria sobre los mismos registros. ─────
    const auditoriaEl = document.getElementById('auditoriaResumen');
    if (auditoriaEl) {
      const rows = auditoriaRows || [];
      if (!rows.length) {
        auditoriaEl.innerHTML = '<div class="table-row"><span>Aún no hay registros de auditoría.</span></div>';
      } else {
        const exitos = rows.filter(r => r.resultado !== 'error').length;
        const errores = rows.length - exitos;

        const porModulo = {};
        rows.forEach(r => { porModulo[r.modulo] = (porModulo[r.modulo] || 0) + 1; });
        const topModulos = Object.entries(porModulo).sort((a, b) => b[1] - a[1]).slice(0, 3);

        auditoriaEl.innerHTML = `
          <div class="table-row"><span>Éxitos (últimos ${rows.length})</span><span class="badge badge-accion">${exitos}</span></div>
          <div class="table-row"><span>Errores (últimos ${rows.length})</span><span class="badge badge-accion">${errores}</span></div>
          ${topModulos.map(([modulo, n]) => `<div class="table-row"><span>Módulo más activo: ${esc(modulo)}</span><span class="badge badge-accion">${n}</span></div>`).join('')}
        `;
      }
    }

    // ── Próximos eventos: se reutiliza el mismo array `eventos` ya cargado ──
    const eventsBody = document.getElementById('eventsTableBody');
    if (eventsBody) {
      const hoyISO = fechaLocal(hoyDate);
      const proximos = eventos.filter(e => e.fecha >= hoyISO).sort((a, b) => a.fecha < b.fecha ? -1 : 1).slice(0, 5);

      const fechaFmt = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      };
      const horaFmt = (h) => h ? String(h).slice(0, 5) : '—';
      const badgeEstado = (estado) => {
        const mapa = { 'Publicado': 'badge-blue', 'En ejecución': 'badge-amber', 'Finalizado': 'badge-green', 'Cancelado': 'badge-amber' };
        return mapa[estado] || 'badge-blue';
      };

      eventsBody.innerHTML = proximos.length ? proximos.map(e => `
        <tr>
          <td><strong>${esc(e.titulo || 'Sin título')}</strong></td>
          <td>${fechaFmt(e.fecha)}</td>
          <td>${horaFmt(e.hora)}</td>
          <td>${esc(e.ubicacion || '—')}</td>
          <td><span class="badge ${badgeEstado(e.estado)}">${e.estado || 'Publicado'}</span></td>
        </tr>`).join('') : '<tr><td colspan="6">No hay próximos eventos.</td></tr>';
    }

    // ── Gráficas (Chart.js) ─────────────────────────────────────────────────
    // Los colores se leen de las variables CSS reales del tema activo (claro/
    // oscuro), no de hex fijos: Chart.js pinta en <canvas>, así que no puede
    // heredar var(--...) solo — hay que resolverlas con getComputedStyle.
    const cs = getComputedStyle(document.documentElement);
    const token = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
    const cPrimary   = token('--primary', '#1E3A8A');
    const cAccent    = token('--accent', '#F5C215');
    const cSuccess   = token('--success', '#059669');
    const cInfo      = token('--info', '#2563eb');
    const cWarning   = token('--warning', '#d97706');
    const cPurple    = token('--purple', '#7c3aed');
    const cDanger    = token('--danger', '#dc2626');
    const cSurface   = token('--surface', '#ffffff');
    const gridColor  = token('--border-light', '#e5e1d8');
    const fontColor  = token('--muted', '#6b7280');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoyDate.getFullYear(), hoyDate.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: meses[d.getMonth()] });
    }
    const labels = months.map(x => x.label);

    const _fechaUsuario = (u) => new Date(u.creado_en || hoyDate);
    const countByMonth = (rows, field) =>
      months.map(mo => rows.filter(r => (r[field] || '').toString().startsWith(mo.key)).length);

    const cumMiembros = months.map(mo => {
      const fin = new Date(mo.y, mo.m + 1, 0, 23, 59, 59);
      return usuarios.filter(u => _fechaUsuario(u) <= fin).length;
    });
    const cumVols = months.map(mo => {
      const fin = new Date(mo.y, mo.m + 1, 0, 23, 59, 59);
      return usuarios.filter(u => u.roles?.nombre === 'Voluntario' && _fechaUsuario(u) <= fin).length;
    });
    const noticiasMes  = countByMonth(noticias, 'publicado_en');
    const oracionesMes = countByMonth(oraciones, 'publicado_en');
    const eventosMes   = countByMonth(eventos, 'fecha');

    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily || 'inherit';

    new Chart(document.getElementById('userGrowthChart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Miembros', data: cumMiembros, fill: true, backgroundColor: cPrimary + '1a', borderColor: cPrimary, tension: 0.4, pointBackgroundColor: cPrimary, pointRadius: 5, pointHoverRadius: 7 },
        { label: 'Voluntarios', data: cumVols, fill: true, backgroundColor: cAccent + '1a', borderColor: cAccent, tension: 0.4, pointBackgroundColor: cAccent, pointRadius: 5, pointHoverRadius: 7 }
      ]},
      options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: fontColor, font: { size: 12 } } } },
        scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: fontColor } }, x: { grid: { display: false }, ticks: { color: fontColor } } } }
    });

    new Chart(document.getElementById('contentChart').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Noticias', data: noticiasMes, backgroundColor: cPrimary, borderRadius: 6 },
        { label: 'Oraciones', data: oracionesMes, backgroundColor: cAccent, borderRadius: 6 }
      ]},
      options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: fontColor, font: { size: 12 } } } },
        scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: fontColor } }, x: { grid: { display: false }, ticks: { color: fontColor } } } }
    });

    new Chart(document.getElementById('eventsMonthChart').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Eventos', data: eventosMes, backgroundColor: cPrimary, borderRadius: 6 }
      ]},
      options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2,
        plugins: { legend: { position: 'top', labels: { color: fontColor, font: { size: 12 } } } },
        scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: fontColor } }, x: { grid: { display: false }, ticks: { color: fontColor } } } }
    });

    // ── Listado de Voluntarios: reemplaza la gráfica de dona "Distribución
    //    por área" (con datos reales quedaba prácticamente siempre vacía o
    //    con una sola categoría — poco útil como gráfica). Reutiliza el
    //    mismo array `voluntarios` ya cargado arriba, sin consultas nuevas. ─
    const volListEl = document.getElementById('volunteersFullList');
    const volTotalBadge = document.getElementById('volunteersTotalBadge');
    if (volTotalBadge) volTotalBadge.textContent = `${voluntarios.length} total`;
    if (volListEl) {
      const ordenados = [...voluntarios].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      volListEl.innerHTML = ordenados.length ? ordenados.slice(0, 12).map(v => `
        <div class="table-row">
          <span>${esc(v.nombre_completo || 'Sin nombre')}</span>
          <span>
            <span class="badge badge-accion">${esc((v.especialidad && v.especialidad.trim()) || 'Sin área')}</span>
            <span class="badge badge-accion">${v.activo !== false ? 'Activo' : 'Inactivo'}</span>
          </span>
        </div>`).join('') : '<div class="table-row"><span>Aún no hay voluntarios registrados.</span></div>';
    }
  });
