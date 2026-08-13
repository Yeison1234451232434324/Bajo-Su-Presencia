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
         <span class="res-evento-nombre">${esc(resumen.mejor.eventoNombre)}</span>`
      : '<span class="sin-dato">—</span>';

    // Peor calificación
    document.getElementById('res-peor').innerHTML = resumen.peor
      ? `${renderEstrellasFijas(resumen.peor.estrellas)}
         <span class="res-evento-nombre">${esc(resumen.peor.eventoNombre)}</span>`
      : '<span class="sin-dato">—</span>';

    // Distribución de estrellas (barras)
    // Antes: `distWrap.innerHTML += ...` dentro del loop reconstruía TODO el
    // contenido en cada vuelta, destruyendo las barras ya creadas y con ellas
    // el `style.width` que se les había asignado — por eso solo la última
    // barra procesada (1★) conservaba su ancho real y las demás se veían al
    // 100%. Se arma el HTML completo (con el ancho ya incluido) y se asigna
    // una sola vez.
    const distWrap = document.getElementById('res-dist');
    const maxVal = Math.max(...Object.values(resumen.distribucion), 1);

    let distHtml = '';
    for (let i = 5; i >= 1; i--) {
      const cant = resumen.distribucion[i];
      const pct  = Math.round((cant / maxVal) * 100);
      distHtml += `
        <div class="dist-fila">
          <span class="dist-label">
            ${i} <i class="bx bxs-star u-icono-dorado u-font-085" aria-hidden="true"></i>
          </span>
          <div class="dist-barra-wrap">
            <div class="dist-barra" style="width:${pct}%"></div>
          </div>
          <span class="dist-cant">${cant}</span>
        </div>`;
    }
    distWrap.innerHTML = distHtml;
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
      const claseTier = c.estrellas >= 4 ? 'hist-card--alta' : c.estrellas === 3 ? 'hist-card--media' : 'hist-card--baja';
      return `
        <div class="hist-card ${claseTier}">
          <div class="hist-card-header">
            <div>
              <h4 class="hist-evento">${esc(c.eventoNombre)}</h4>
              <p class="hist-fecha"><i class="bx bx-calendar" aria-hidden="true"></i> ${esc(c.fecha)}</p>
            </div>
            <div class="hist-nota-grande">
              ${c.estrellas}<span class="u-font-1">/5</span>
            </div>
          </div>
          <div class="hist-estrellas">${renderEstrellasFijas(c.estrellas)}</div>
          ${c.comentario
            ? `<div class="hist-observacion">
                 <i class="bx bx-comment-detail hist-obs-icon" aria-hidden="true"></i>
                 <p>"${esc(c.comentario)}"</p>
               </div>`
            : `<p class="sin-dato u-mt-05">Sin observaciones registradas.</p>`}
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
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-star" aria-hidden="true"></i><p>Aún no tienes calificaciones registradas.</p><small>El administrador calificará tu desempeño después de cada evento.</small></div>`
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
