/**
 * ============================================================
 * CONTROLADOR: eventos.controller.js
 * ============================================================
 * Maneja la lógica del formulario de publicación de eventos.
 * Depende de:
 *   - EventosModel  (eventos.model.js)   → guardar el evento
 *   - RecursosModel (recursos.model.js)  → leer el inventario disponible
 *
 * Flujo:
 *   1. Al cargar la página, lee los recursos disponibles del inventario
 *      y los muestra como tarjetas seleccionables.
 *   2. El admin selecciona recursos y define la cantidad a usar.
 *   3. Al publicar, el evento se guarda con los recursos seleccionados
 *      y también se sincroniza con bsp_eventos_vol (voluntarios/recursos).
 *   4. Se muestra la lista de eventos publicados debajo del formulario.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const form            = document.getElementById('form-evento');
  const recursosGrid    = document.getElementById('recursos-grid');
  const sinRecursos     = document.getElementById('sin-recursos-msg');
  const listaEventos    = document.getElementById('lista-eventos-publicados');
  const contadorRecursos = document.getElementById('contador-recursos');

  // Mapa interno: recursoId → cantidad seleccionada por el admin
  // Se actualiza cada vez que el admin cambia un input de cantidad
  const seleccionados = {};

  // ════════════════════════════════════════════════════════════════
  // 1. CARGAR RECURSOS DEL INVENTARIO
  // ════════════════════════════════════════════════════════════════

  /**
   * Lee RecursosModel y renderiza las tarjetas de recursos disponibles.
   * Solo muestra los que tienen disponible = true y cantidad > 0.
   */
  function cargarRecursos() {
    // RecursosModel puede no estar cargado si el admin nunca visitó esa sección.
    // En ese caso, el modelo se auto-inicializa con los datos por defecto.
    const recursos = RecursosModel.getAll().filter(r => r.disponible && r.cantidad > 0);

    recursosGrid.innerHTML = '';

    if (recursos.length === 0) {
      sinRecursos.style.display = 'block';
      return;
    }

    sinRecursos.style.display = 'none';

    recursos.forEach(r => {
      // Ícono según categoría (mismo helper que recursos.controller.js)
      const iconMap = {
        'Mobiliario':    'bx-chair',
        'Audio y Video': 'bx-microphone',
        'Iluminación':   'bx-bulb',
        'Papelería':     'bx-file',
        'Cocina':        'bx-bowl-hot',
        'Otros':         'bx-package'
      };
      const icono = iconMap[r.categoria] || 'bx-package';

      const card = document.createElement('div');
      card.className   = 'ev-recurso-card';
      card.id          = `ev-rec-${r.id}`;
      card.dataset.id  = r.id;

      card.innerHTML = `
        <div class="ev-rec-check">
          <input type="checkbox" id="chk-rec-${r.id}"
            onchange="toggleRecursoEvento(${r.id})" />
        </div>
        <div class="ev-rec-body">
          <div class="ev-rec-header">
            <i class="bx ${icono} ev-rec-icon"></i>
            <label for="chk-rec-${r.id}" class="ev-rec-nombre">${r.nombre}</label>
            <span class="badge badge-green ev-rec-stock">${r.cantidad} ${r.unidad}</span>
          </div>
          <p class="ev-rec-cat">${r.categoria}</p>
          <!-- Input de cantidad, visible solo cuando el recurso está seleccionado -->
          <div class="ev-rec-qty" id="ev-qty-${r.id}" style="display:none;">
            <label for="qty-rec-${r.id}">Cantidad a usar:</label>
            <input
              type="number"
              id="qty-rec-${r.id}"
              class="ev-qty-input"
              min="1"
              max="${r.cantidad}"
              value="1"
              onchange="actualizarCantidad(${r.id}, this.value, ${r.cantidad})"
              oninput="actualizarCantidad(${r.id}, this.value, ${r.cantidad})"
            />
            <span class="ev-qty-max">máx. ${r.cantidad}</span>
          </div>
        </div>`;

      recursosGrid.appendChild(card);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIÓN DE RECURSOS
  // ════════════════════════════════════════════════════════════════

  /**
   * Activa o desactiva la selección de un recurso.
   * Muestra/oculta el input de cantidad y actualiza el mapa seleccionados.
   */
  window.toggleRecursoEvento = function(id) {
    const card   = document.getElementById(`ev-rec-${id}`);
    const chk    = document.getElementById(`chk-rec-${id}`);
    const qtyDiv = document.getElementById(`ev-qty-${id}`);
    const qtyInput = document.getElementById(`qty-rec-${id}`);

    if (chk.checked) {
      card.classList.add('ev-rec-selected');
      qtyDiv.style.display = 'flex';
      seleccionados[id] = parseInt(qtyInput.value) || 1;
    } else {
      card.classList.remove('ev-rec-selected');
      qtyDiv.style.display = 'none';
      delete seleccionados[id];
    }

    actualizarContador();
  };

  /**
   * Actualiza la cantidad del recurso en el mapa seleccionados.
   * Valida que no supere el stock disponible.
   */
  window.actualizarCantidad = function(id, valor, max) {
    let cant = parseInt(valor) || 1;
    if (cant < 1)   cant = 1;
    if (cant > max) cant = max;

    // Corregir el input si el valor estaba fuera de rango
    const input = document.getElementById(`qty-rec-${id}`);
    if (input) input.value = cant;

    seleccionados[id] = cant;
  };

  /** Actualiza el badge contador de recursos seleccionados */
  function actualizarContador() {
    const total = Object.keys(seleccionados).length;
    contadorRecursos.textContent = total > 0
      ? `${total} recurso(s) seleccionado(s)`
      : 'Ningún recurso seleccionado (opcional)';
    contadorRecursos.style.color = total > 0 ? '#059669' : '#9ca3af';
  }

  // ════════════════════════════════════════════════════════════════
  // 3. PUBLICAR EVENTO
  // ════════════════════════════════════════════════════════════════

  /**
   * Submit del formulario.
   * Construye el array de recursos seleccionados con sus cantidades
   * y llama a EventosModel.publicar().
   */
  window.submitEvent = function(e) {
    e.preventDefault();

    // Construir array de recursos seleccionados para guardar con el evento
    const recursosSeleccionados = Object.entries(seleccionados).map(([id, cantidad]) => {
      const r = RecursosModel.getById(parseInt(id));
      return {
        recursoId:    parseInt(id),
        recursoNombre: r ? r.nombre : 'Recurso',
        cantidad,
        unidad:       r ? r.unidad : 'unidades'
      };
    });

    const data = {
      titulo:                document.getElementById('ev-titulo').value,
      fecha:                 document.getElementById('ev-fecha').value,
      horario:               document.getElementById('ev-horario').value,
      ubicacion:             document.getElementById('ev-ubicacion').value,
      asistentes:            document.getElementById('ev-asistentes').value,
      // Número de voluntarios que el admin necesita para este evento
      voluntariosNecesarios: document.getElementById('ev-voluntarios').value,
      descripcion:           document.getElementById('ev-descripcion').value,
      recursos:              recursosSeleccionados
    };

    const resultado = EventosModel.publicar(data);

    if (!resultado.ok) {
      showToast('Error', resultado.error);
      return;
    }

    // Limpiar formulario y selección
    e.target.reset();
    Object.keys(seleccionados).forEach(k => delete seleccionados[k]);
    document.querySelectorAll('.ev-recurso-card').forEach(c => c.classList.remove('ev-rec-selected'));
    document.querySelectorAll('[id^="ev-qty-"]').forEach(d => d.style.display = 'none');
    document.querySelectorAll('[id^="chk-rec-"]').forEach(c => c.checked = false);
    actualizarContador();

    // Recargar lista de eventos publicados
    renderEventosPublicados();

    const nRec = recursosSeleccionados.length;
    showToast(
      '¡Evento publicado!',
      `"${data.titulo}" fue publicado${nRec > 0 ? ` con ${nRec} recurso(s) asignado(s)` : ''}.`
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 4. LISTA DE EVENTOS PUBLICADOS
  // ════════════════════════════════════════════════════════════════

  /**
   * Renderiza la lista de eventos ya publicados debajo del formulario.
   * Muestra los recursos asignados a cada uno.
   */
  function renderEventosPublicados() {
    const eventos = EventosModel.getAll();
    listaEventos.innerHTML = '';

    if (eventos.length === 0) {
      listaEventos.innerHTML = `
        <div class="ev-lista-vacia">
          <i class="bx bx-calendar-x"></i>
          <p>Aún no hay eventos publicados.</p>
        </div>`;
      return;
    }

    // Mostrar del más reciente al más antiguo
    [...eventos].reverse().forEach(ev => {
      // Construir chips de recursos asignados
      const chipsRecursos = ev.recursos.length > 0
        ? ev.recursos.map(r =>
            `<span class="ev-chip-recurso">
               <i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad}
             </span>`
          ).join('')
        : '<span class="ev-sin-recursos">Sin recursos asignados</span>';

      listaEventos.innerHTML += `
        <div class="ev-publicado-card">
          <div class="ev-pub-header">
            <div>
              <h4 class="ev-pub-titulo">${ev.titulo}</h4>
              <p class="ev-pub-meta">
                <i class="bx bx-calendar"></i> ${ev.fecha}
                &nbsp;·&nbsp;
                <i class="bx bx-time"></i> ${ev.horario}
                &nbsp;·&nbsp;
                <i class="bx bx-map-pin"></i> ${ev.ubicacion}
                &nbsp;·&nbsp;
                <i class="bx bx-group"></i> ${ev.voluntariosNecesarios || 0} voluntario(s) necesario(s)
              </p>
            </div>
            <!-- Botón eliminar evento publicado -->
            <button class="btn-ev-eliminar" onclick="eliminarEvento(${ev.id})" title="Eliminar evento">
              <i class="bx bx-trash"></i>
            </button>
          </div>
          ${ev.descripcion ? `<p class="ev-pub-desc">${ev.descripcion}</p>` : ''}
          <!-- Recursos asignados al evento -->
          <div class="ev-pub-recursos">
            <span class="ev-pub-recursos-label">
              <i class="bx bx-package"></i> Recursos:
            </span>
            <div class="ev-chips-wrap">${chipsRecursos}</div>
          </div>
        </div>`;
    });
  }

  /** Elimina un evento de la lista publicada */
  window.eliminarEvento = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;
    if (!confirm(`¿Eliminar el evento "${ev.titulo}"?`)) return;
    EventosModel.eliminar(id);
    renderEventosPublicados();
    showToast('Evento eliminado', `"${ev.titulo}" fue eliminado.`);
  };

  // ── Inicialización ───────────────────────────────────────────────────────
  cargarRecursos();
  actualizarContador();
  renderEventosPublicados();
});
