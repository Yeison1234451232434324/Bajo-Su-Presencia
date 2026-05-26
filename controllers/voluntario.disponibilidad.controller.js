/**
 * ============================================================
 * CONTROLADOR: voluntario.disponibilidad.controller.js
 * ============================================================
 * Permite al voluntario logueado:
 *   - Ver todos los eventos publicados
 *   - Marcar su disponibilidad (disponible / no disponible) en cada uno
 *   - Ver en qué eventos ya está registrado como voluntario
 *
 * Depende de:
 *   - VoluntariosModel (voluntarios.model.js) → eventos y disponibilidad
 *   - EventosModel     (eventos.model.js)     → eventos publicados
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

  const nombreSesion = sesion.nombre;

  // ── Actualizar nombre en el encabezado ────────────────────────────────────
  document.getElementById('vol-nombre-disp').textContent = nombreSesion;

  // ── Obtener ID del voluntario en el modelo ────────────────────────────────
  function obtenerVoluntarioId() {
    const califs = VoluntariosModel.getCalificaciones();
    const calif  = califs.find(c =>
      c.voluntarioNombre.toLowerCase() === nombreSesion.toLowerCase()
    );
    if (calif) return calif.voluntarioId;

    const eventos = VoluntariosModel.getEventos();
    for (const ev of eventos) {
      const vol = ev.voluntarios.find(v =>
        v.nombre.toLowerCase() === nombreSesion.toLowerCase()
      );
      if (vol) return vol.id;
    }
    // Si no existe en ningún lado, asignar un ID temporal basado en el nombre
    return null;
  }

  let voluntarioId = obtenerVoluntarioId();

  // ════════════════════════════════════════════════════════════════
  // OBTENER EVENTOS DISPONIBLES
  // ════════════════════════════════════════════════════════════════

  /**
   * Combina los eventos de bsp_eventos_vol (voluntarios) con los de
   * bsp_eventos_publicados (publicar evento) para mostrar todos.
   * Elimina duplicados por ID.
   * También copia voluntariosNecesarios desde bsp_eventos_publicados.
   */
  function obtenerTodosLosEventos() {
    const eventosVol = VoluntariosModel.getEventos(); // { id, nombre, fecha, lugar, voluntarios }

    // Leer eventos publicados para obtener voluntariosNecesarios
    let eventosPublicados = [];
    try {
      const raw = localStorage.getItem('bsp_eventos_publicados');
      if (raw) {
        eventosPublicados = JSON.parse(raw).map(e => ({
          id:                    e.id,
          nombre:                e.titulo,
          fecha:                 e.fecha,
          lugar:                 e.ubicacion || '—',
          voluntariosNecesarios: e.voluntariosNecesarios || 0,
          voluntarios:           []
        }));
      }
    } catch (_) {}

    // Mapa de voluntariosNecesarios por ID para enriquecer eventosVol
    const necesariosMap = {};
    eventosPublicados.forEach(e => { necesariosMap[e.id] = e.voluntariosNecesarios; });

    // Enriquecer eventosVol con voluntariosNecesarios si existe
    const eventosVolEnriquecidos = eventosVol.map(e => ({
      ...e,
      voluntariosNecesarios: necesariosMap[e.id] ?? e.voluntariosNecesarios ?? 0
    }));

    // Agregar los publicados que no están en eventosVol
    const idsVol = new Set(eventosVolEnriquecidos.map(e => e.id));
    const extras = eventosPublicados.filter(e => !idsVol.has(e.id));

    return [...eventosVolEnriquecidos, ...extras];
  }

  // ════════════════════════════════════════════════════════════════
  // RENDERIZAR TARJETAS DE EVENTOS
  // ════════════════════════════════════════════════════════════════

  function renderEventos() {
    const grid    = document.getElementById('eventos-grid');
    const eventos = obtenerTodosLosEventos();

    // Contadores para las tarjetas superiores
    let totalEventos    = eventos.length;
    let eventosConmigo  = 0;
    let disponibleCount = 0;

    grid.innerHTML = '';

    if (eventos.length === 0) {
      grid.innerHTML = `
        <div class="disp-vacio">
          <i class="bx bx-calendar-x"></i>
          <p>No hay eventos publicados por el momento.</p>
          <small>El administrador publicará los próximos eventos aquí.</small>
        </div>`;
      actualizarContadores(0, 0, 0);
      return;
    }

    eventos.forEach(ev => {
      // Buscar si el voluntario ya está en este evento
      const volEnEvento = ev.voluntarios.find(v =>
        v.nombre.toLowerCase() === nombreSesion.toLowerCase() ||
        v.id === voluntarioId
      );

      const estaRegistrado = !!volEnEvento;
      const estaDisponible = volEnEvento?.disponible ?? false;

      if (estaRegistrado) eventosConmigo++;
      if (estaDisponible) disponibleCount++;

      // Determinar estado visual de la tarjeta
      let estadoClass = '';
      let estadoBadge = '';
      let btnTexto    = '';
      let btnClass    = '';
      let btnIcono    = '';

      if (!estaRegistrado) {
        // No está en el evento → puede unirse
        estadoBadge = '<span class="badge badge-muted">No inscrito</span>';
        btnTexto    = 'Unirme como voluntario';
        btnClass    = 'btn-unirse';
        btnIcono    = 'bx-user-plus';
      } else if (estaDisponible) {
        // Está registrado y disponible
        estadoClass = 'card-disponible';
        estadoBadge = '<span class="badge badge-green">Disponible</span>';
        btnTexto    = 'Marcar no disponible';
        btnClass    = 'btn-no-disponible';
        btnIcono    = 'bx-x-circle';
      } else {
        // Está registrado pero no disponible
        estadoClass = 'card-no-disponible';
        estadoBadge = '<span class="badge badge-red">No disponible</span>';
        btnTexto    = 'Marcar disponible';
        btnClass    = 'btn-disponible';
        btnIcono    = 'bx-check-circle';
      }

      // Fecha formateada
      const fechaObj = new Date(ev.fecha + 'T00:00:00');
      const fechaStr = fechaObj.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      // Rol del voluntario en el evento (si está registrado)
      const rolEnEvento = volEnEvento?.rol || '—';

      // Número de voluntarios inscritos actualmente en este evento
      const inscritos  = ev.voluntarios.length;
      const necesarios = ev.voluntariosNecesarios || 0;
      // Cuántos hacen falta aún (nunca negativo)
      const faltan     = Math.max(necesarios - inscritos, 0);

      // Badge de cupo: muestra necesarios y cuántos faltan
      const badgeCupo = necesarios > 0
        ? faltan === 0
          ? `<span class="badge badge-red">Cupo completo</span>`
          : `<span class="badge badge-amber">Necesitan ${necesarios} · Faltan ${faltan}</span>`
        : `<span class="badge badge-muted">Sin cupo definido</span>`;

      grid.innerHTML += `
        <div class="disp-card ${estadoClass}" id="card-ev-${ev.id}">
          <div class="disp-card-header">
            <div class="disp-card-info">
              <h4 class="disp-evento-nombre">${ev.nombre}</h4>
              <p class="disp-evento-meta">
                <i class="bx bx-calendar"></i> ${fechaStr}
              </p>
              <p class="disp-evento-meta">
                <i class="bx bx-map-pin"></i> ${ev.lugar || '—'}
              </p>
              <!-- Voluntarios necesarios vs cuántos faltan -->
              <p class="disp-evento-meta">
                <i class="bx bx-group"></i>
                ${necesarios > 0
                  ? `Se necesitan <strong>${necesarios}</strong> · Faltan <strong>${faltan}</strong>`
                  : 'Sin cupo de voluntarios definido'}
              </p>
              ${estaRegistrado
                ? `<p class="disp-evento-meta">
                     <i class="bx bx-briefcase"></i> Rol: <strong>${rolEnEvento}</strong>
                   </p>`
                : ''}
            </div>
            <div class="disp-card-estado" style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end;">
              ${estadoBadge}
              ${badgeCupo}
            </div>
          </div>

          <!-- Botón de acción -->
          <button
            class="btn-disp-accion ${btnClass}"
            onclick="accionEvento(${ev.id}, '${estaRegistrado ? 'toggle' : 'unirse'}')"
          >
            <i class="bx ${btnIcono}"></i>
            ${btnTexto}
          </button>
        </div>`;
    });

    actualizarContadores(totalEventos, eventosConmigo, disponibleCount);
  }

  /** Actualiza las tarjetas de contadores superiores */
  function actualizarContadores(total, conmigo, disponible) {
    document.getElementById('cnt-total').textContent     = total;
    document.getElementById('cnt-conmigo').textContent   = conmigo;
    document.getElementById('cnt-disponible').textContent = disponible;
  }

  // ════════════════════════════════════════════════════════════════
  // ACCIONES DEL VOLUNTARIO
  // ════════════════════════════════════════════════════════════════

  /**
   * Maneja las acciones del voluntario sobre un evento:
   *   - 'unirse'  → agrega al voluntario al evento con disponible = true
   *   - 'toggle'  → cambia su disponibilidad en el evento
   */
  window.accionEvento = function(eventoId, accion) {
    const eventos = VoluntariosModel.getEventos();
    const evIdx   = eventos.findIndex(e => e.id === eventoId);

    if (accion === 'unirse') {
      // Agregar al voluntario al evento si no existe
      if (evIdx === -1) {
        // El evento viene de bsp_eventos_publicados, hay que crearlo en bsp_eventos_vol
        const raw = localStorage.getItem('bsp_eventos_publicados');
        const pubs = raw ? JSON.parse(raw) : [];
        const pub  = pubs.find(e => e.id === eventoId);
        if (!pub) return;

        // Crear entrada en bsp_eventos_vol
        const nuevaEntrada = {
          id:          pub.id,
          nombre:      pub.titulo,
          fecha:       pub.fecha,
          lugar:       pub.ubicacion || '—',
          voluntarios: [{
            id:         voluntarioId || Date.now(),
            nombre:     nombreSesion,
            rol:        'Voluntario General',
            disponible: true
          }]
        };
        eventos.push(nuevaEntrada);
        // Actualizar ID si no lo teníamos
        if (!voluntarioId) voluntarioId = nuevaEntrada.voluntarios[0].id;
      } else {
        // El evento ya existe en bsp_eventos_vol, agregar al voluntario
        const yaEsta = eventos[evIdx].voluntarios.find(v =>
          v.nombre.toLowerCase() === nombreSesion.toLowerCase()
        );
        if (!yaEsta) {
          const nuevoId = voluntarioId || Date.now();
          eventos[evIdx].voluntarios.push({
            id:         nuevoId,
            nombre:     nombreSesion,
            rol:        'Voluntario General',
            disponible: true
          });
          if (!voluntarioId) voluntarioId = nuevoId;
        }
      }

      localStorage.setItem('bsp_eventos_vol', JSON.stringify(eventos));
      renderEventos();
      showToast('¡Te uniste al evento!', 'Ahora estás registrado como voluntario disponible.');

    } else if (accion === 'toggle') {
      // Cambiar disponibilidad
      if (evIdx === -1) return;

      const volIdx = eventos[evIdx].voluntarios.findIndex(v =>
        v.nombre.toLowerCase() === nombreSesion.toLowerCase() ||
        v.id === voluntarioId
      );
      if (volIdx === -1) return;

      const nuevaDisp = !eventos[evIdx].voluntarios[volIdx].disponible;
      eventos[evIdx].voluntarios[volIdx].disponible = nuevaDisp;
      localStorage.setItem('bsp_eventos_vol', JSON.stringify(eventos));

      renderEventos();
      showToast(
        nuevaDisp ? 'Marcado como disponible' : 'Marcado como no disponible',
        nuevaDisp
          ? 'El administrador podrá verte como disponible para este evento.'
          : 'Has indicado que no estarás disponible para este evento.'
      );
    }
  };

  // ── Render inicial ────────────────────────────────────────────────────────
  renderEventos();
});
