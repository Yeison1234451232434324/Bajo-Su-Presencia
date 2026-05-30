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

document.addEventListener('DOMContentLoaded', () => {

  // ── Verificar que sea voluntario ─────────────────────────────────────────
  const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  if (sesion.rol !== 'Voluntario') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:serif;flex-direction:column;gap:1rem;">
        <h2 style="color:#1E3A8A;font-size:2rem;">Acceso Denegado</h2>
        <p style="color:#6b7280;">Esta sección es solo para voluntarios.</p>
        <a href="../../public/login/login.html" style="color:#1E3A8A;font-weight:600;">Volver al inicio</a>
      </div>`;
    return;
  }

  // ── Identificar al voluntario en el modelo ────────────────────────────────
  // El modelo de voluntarios usa IDs numéricos. Buscamos el voluntario
  // cuyo nombre coincida con el username de la sesión.
  // En un sistema real esto vendría del backend; aquí lo resolvemos
  // buscando en las calificaciones existentes o usando el nombre de sesión.
  const nombreSesion = sesion.nombre; // username guardado al hacer login

  /**
   * Obtiene el ID del voluntario logueado buscando en las calificaciones.
   * Si no tiene calificaciones aún, devuelve null y se muestra estado vacío.
   */
  function obtenerVoluntarioId() {
    const califs = VoluntariosModel.getCalificaciones();
    // Buscar por nombre (voluntarioNombre coincide con el nombre de sesión)
    const calif = califs.find(c =>
      c.voluntarioNombre.toLowerCase() === nombreSesion.toLowerCase()
    );
    if (calif) return calif.voluntarioId;

    // Si no hay calificaciones, buscar en los eventos como voluntario asignado
    const eventos = VoluntariosModel.getEventos();
    for (const ev of eventos) {
      const vol = ev.voluntarios.find(v =>
        v.nombre.toLowerCase() === nombreSesion.toLowerCase()
      );
      if (vol) return vol.id;
    }
    return null;
  }

  const voluntarioId = obtenerVoluntarioId();

  // ── Actualizar nombre en el encabezado ────────────────────────────────────
  document.getElementById('vol-nombre-header').textContent = nombreSesion;

  // ════════════════════════════════════════════════════════════════
  // RESUMEN ESTADÍSTICO
  // ════════════════════════════════════════════════════════════════

  function renderResumen() {
    if (!voluntarioId) {
      // Sin datos: mostrar estado vacío en todas las tarjetas
      document.getElementById('res-promedio').textContent = '—';
      document.getElementById('res-total').textContent    = '0';
      document.getElementById('res-mejor').innerHTML      = '<span class="sin-dato">Sin datos</span>';
      document.getElementById('res-peor').innerHTML       = '<span class="sin-dato">Sin datos</span>';
      document.getElementById('res-dist').innerHTML       = '<p class="sin-dato">Aún no tienes calificaciones registradas.</p>';
      return;
    }

    const resumen = VoluntariosModel.getResumenVoluntario(voluntarioId);

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
  // HISTORIAL DE CALIFICACIONES — DataTable
  // ════════════════════════════════════════════════════════════════

  let dtCalif = null;

  function renderHistorial() {
    const historial = voluntarioId
      ? VoluntariosModel.getHistorialVoluntario(voluntarioId)
      : [];

    function renderCard(c) {
      const colorBorde = c.estrellas >= 4 ? '#059669' : c.estrellas === 3 ? '#d97706' : '#dc2626';
      return `
        <div class="hist-card" style="border-left-color:${colorBorde}">
          <div class="hist-card-header">
            <div>
              <h4 class="hist-evento">${c.eventoNombre}</h4>
              <p class="hist-fecha"><i class="bx bx-calendar"></i> ${c.fecha}</p>
            </div>
            <div class="hist-nota-grande" style="color:${colorBorde}">
              ${c.estrellas}<span style="font-size:1rem;">/5</span>
            </div>
          </div>
          <div class="hist-estrellas">${renderEstrellasFijas(c.estrellas)}</div>
          ${c.comentario
            ? `<div class="hist-observacion">
                 <i class="bx bx-comment-detail hist-obs-icon"></i>
                 <p>"${c.comentario}"</p>
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
        renderRow:    renderCard,
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-star"></i><p>Aún no tienes calificaciones registradas.</p><small>El administrador calificará tu desempeño después de cada evento.</small></div>`
      });
      window.__dtInstances['historial-lista'] = dtCalif;
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
  renderResumen();
  renderHistorial();
});
