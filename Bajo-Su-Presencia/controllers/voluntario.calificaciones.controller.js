/**
 * ============================================================
 * CONTROLADOR: voluntario.calificaciones.controller.js
 * ============================================================
 * Muestra al voluntario logueado:
 *   - Resumen estadístico personal (promedio, total, distribución)
 *   - Historial completo de calificaciones con observaciones
 *
 * Depende de: VoluntariosModel (voluntarios.model.js)
 * El voluntario se identifica por su username guardado en
 * localStorage bajo la clave 'usuarioLogueado'.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Verificar que sea voluntario ─────────────────────────────────────────
  // Control de acceso contra el SERVIDOR: el rol procede del JWT
  // verificado en /api/auth/me, no de localStorage (editable por el usuario).
  const sesion = await window.BSPSession.exigir(['Voluntario']);
  if (!sesion) return;

  // ── Identificar al voluntario en el modelo ────────────────────────────────
  // El modelo de voluntarios usa IDs numéricos. Buscamos el voluntario
  // cuyo nombre coincida con el username de la sesión.
  // En un sistema real esto vendría del backend; aquí lo resolvemos
  // buscando en las calificaciones existentes o usando el nombre de sesión.
  const nombreSesion = sesion.nombre; // nombre completo guardado al hacer login

  // El id (usuarios) del voluntario se resuelve con miUsuarioId() en la init.
  let voluntarioId = null;

  // ── Actualizar nombre en el encabezado ────────────────────────────────────
  document.getElementById('vol-nombre-header').textContent = nombreSesion;

  // ════════════════════════════════════════════════════════════════
  // RESUMEN ESTADÍSTICO
  // ════════════════════════════════════════════════════════════════

  async function renderResumen() {
    if (!voluntarioId) {
      // Sin datos: mostrar estado vacío en todas las tarjetas
      document.getElementById('res-promedio').textContent = '—';
      document.getElementById('res-total').textContent    = '0';
      document.getElementById('res-mejor').innerHTML      = '<span class="sin-dato">Sin datos</span>';
      document.getElementById('res-peor').innerHTML       = '<span class="sin-dato">Sin datos</span>';
      document.getElementById('res-dist').innerHTML       = '<p class="sin-dato">Aún no tienes calificaciones registradas.</p>';
      return;
    }

    const resumen = await VoluntariosModel.getResumenVoluntario(voluntarioId);

    // Promedio con estrellas visuales
    document.getElementById('res-promedio').textContent = resumen.promedio || '—';
    document.getElementById('res-promedio-stars').innerHTML =
      resumen.total > 0 ? renderEstrellasFijas(Math.round(resumen.promedio)) : '';

    // Total de eventos calificados
    document.getElementById('res-total').textContent = resumen.total;

    // Mejor calificación
    document.getElementById('res-mejor').innerHTML = resumen.mejor
      ? `${renderEstrellasFijas(resumen.mejor.estrellas)}
         <span class="res-evento-nombre">${resumen.mejor.eventoNombre}</span>`
      : '<span class="sin-dato">—</span>';

    // Peor calificación
    document.getElementById('res-peor').innerHTML = resumen.peor
      ? `${renderEstrellasFijas(resumen.peor.estrellas)}
         <span class="res-evento-nombre">${resumen.peor.eventoNombre}</span>`
      : '<span class="sin-dato">—</span>';

    // Distribución de estrellas (barras)
    const distWrap = document.getElementById('res-dist');
    distWrap.innerHTML = '';
    const maxVal = Math.max(...Object.values(resumen.distribucion), 1);

    for (let i = 5; i >= 1; i--) {
      const cant = resumen.distribucion[i];
      const pct  = Math.round((cant / maxVal) * 100);
      distWrap.innerHTML += `
        <div class="dist-fila">
          <span class="dist-label">
            ${i} <i class="bx bxs-star" style="color:#F5C215;font-size:0.85rem;"></i>
          </span>
          <div class="dist-barra-wrap">
            <div class="dist-barra" style="width:${pct}%"></div>
          </div>
          <span class="dist-cant">${cant}</span>
        </div>`;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // HISTORIAL DE CALIFICACIONES — DataTable v3 con filtros
  // ════════════════════════════════════════════════════════════════

  let dtCalif = null;

  async function renderHistorial() {
    const historial = voluntarioId
      ? await VoluntariosModel.getHistorialVoluntario(voluntarioId)
      : [];

    // Extraer eventos únicos para el filtro
    const eventos = [...new Set(historial.map(c => c.eventoNombre).filter(Boolean))].sort();

    function renderCard(c) {
      const colorBorde = c.estrellas >= 4 ? '#059669' : c.estrellas === 3 ? '#d97706' : '#dc2626';
      return `
        <div class="hist-card" style="border-left-color:${colorBorde}">
          <div class="hist-card-header">
            <div>
              <h4 class="hist-evento">${esc(c.eventoNombre)}</h4>
              <p class="hist-fecha"><i class="bx bx-calendar"></i> ${esc(c.fecha)}</p>
            </div>
            <div class="hist-nota-grande" style="color:${colorBorde}">
              ${c.estrellas}<span style="font-size:1rem;">/5</span>
            </div>
          </div>
          <div class="hist-estrellas">${renderEstrellasFijas(c.estrellas)}</div>
          ${c.comentario
            ? `<div class="hist-observacion">
                 <i class="bx bx-comment-detail hist-obs-icon"></i>
                 <p>"${esc(c.comentario)}"</p>
               </div>`
            : `<p class="sin-dato" style="margin-top:0.5rem;">Sin observaciones registradas.</p>`}
        </div>`;
    }

    const ordenado = [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (!dtCalif) {
      dtCalif = new BSPDataTable({
        containerId:  'historial-lista',
        data:         ordenado,
        pageSize:     5,
        searchFields: ['eventoNombre', 'fecha', 'comentario'],
        filters: [
          { key: 'eventoNombre', label: 'Evento',        type: 'select', options: eventos },
          { key: 'estrellas',    label: 'Calificación',  type: 'stars' },
          { key: 'fecha',        label: 'Desde',         type: 'date-from' },
          { key: 'fecha',        label: 'Hasta',         type: 'date-to' },
        ],
        renderRow:    renderCard,
        exportable:   true,
        exportName:   'mis_calificaciones',
        exportFields: ['eventoNombre', 'fecha', 'estrellas', 'comentario'],
        exportLabels: ['Evento', 'Fecha', 'Estrellas', 'Comentario'],
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-star"></i><p>Aún no tienes calificaciones registradas.</p><small>El administrador calificará tu desempeño después de cada evento.</small></div>`
      });
      window.__bspDT['historial-lista'] = dtCalif;
      dtCalif.init();
    } else {
      dtCalif.refresh(ordenado);
    }
  }

  // ── Helper: estrellas fijas (solo lectura) ────────────────────────────────
  function renderEstrellasFijas(n) {
    let html = '<div class="estrellas-fijas">';
    for (let i = 1; i <= 5; i++) {
      html += `<i class="bx bxs-star ${i <= n ? 'star-on' : 'star-off'}"></i>`;
    }
    html += '</div>';
    return html;
  }

  // ── Render inicial ────────────────────────────────────────────────────────
  (async () => {
    try { voluntarioId = await window.miUsuarioId(); } catch (_) { voluntarioId = null; }
    await renderResumen();
    await renderHistorial();
  })();
});
