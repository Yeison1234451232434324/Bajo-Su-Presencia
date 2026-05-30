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
    actualizarPreview(); // Resetear previsualización

    // Recargar lista de eventos publicados
    renderEventosPublicados();

    const nRec = recursosSeleccionados.length;
    showToast(
      '¡Evento publicado!',
      `"${data.titulo}" fue publicado${nRec > 0 ? ` con ${nRec} recurso(s) asignado(s)` : ''}.`
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 4. HISTORIAL DE EVENTOS PUBLICADOS — DataTable
  // ════════════════════════════════════════════════════════════════

  let dtEventos = null;

  function renderEventosPublicados() {
    const eventos = EventosModel.getAll();

    function renderCard(ev) {
      const chipsRecursos = ev.recursos && ev.recursos.length > 0
        ? ev.recursos.map(r =>
            `<span class="ev-chip-recurso">
               <i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad}
             </span>`
          ).join('')
        : '<span class="ev-sin-recursos">Sin recursos asignados</span>';

      const hoy   = new Date().toISOString().split('T')[0];
      const badge = ev.fecha >= hoy
        ? '<span class="ev-badge ev-badge--activo">Próximo</span>'
        : '<span class="ev-badge ev-badge--pasado">Realizado</span>';

      return `
        <div class="ev-publicado-card" id="ev-card-${ev.id}">
          <div class="ev-pub-header">
            <div class="ev-pub-header-info">
              <div class="ev-pub-titulo-row">
                <h4 class="ev-pub-titulo">${ev.titulo}</h4>
                ${badge}
              </div>
              <p class="ev-pub-meta">
                <i class="bx bx-calendar"></i> ${ev.fecha}
                &nbsp;·&nbsp;
                <i class="bx bx-time"></i> ${ev.horario}
                &nbsp;·&nbsp;
                <i class="bx bx-map-pin"></i> ${ev.ubicacion}
                &nbsp;·&nbsp;
                <i class="bx bx-group"></i> ${ev.voluntariosNecesarios || 0} voluntario(s)
              </p>
            </div>
            <div class="ev-pub-acciones">
              <button class="btn-ev-accion btn-ev-ver"
                onclick="verEvento(${ev.id})" title="Ver detalle">
                <i class="bx bx-show"></i>
              </button>
              <button class="btn-ev-accion btn-ev-editar"
                onclick="abrirEditar(${ev.id})" title="Editar evento">
                <i class="bx bx-edit"></i>
              </button>
              <button class="btn-ev-accion btn-ev-eliminar"
                onclick="eliminarEvento(${ev.id})" title="Eliminar evento">
                <i class="bx bx-trash"></i>
              </button>
            </div>
          </div>
          ${ev.descripcion ? `<p class="ev-pub-desc">${ev.descripcion}</p>` : ''}
          <div class="ev-pub-recursos">
            <span class="ev-pub-recursos-label">
              <i class="bx bx-package"></i> Recursos:
            </span>
            <div class="ev-chips-wrap">${chipsRecursos}</div>
          </div>
          ${ev.publicado ? `<p class="ev-pub-fecha-pub">Publicado el ${ev.publicado}</p>` : ''}
        </div>`;
    }

    // Ordenar del más reciente al más antiguo antes de pasar al DT
    const ordenados = [...eventos].reverse();

    if (!dtEventos) {
      dtEventos = new BSPDataTable({
        containerId:  'lista-eventos-publicados',
        data:         ordenados,
        pageSize:     5,
        searchFields: ['titulo', 'fecha', 'horario', 'ubicacion', 'descripcion'],
        renderRow:    renderCard,
        emptyHTML:    `<div class="dt-empty"><i class="bx bx-calendar-x"></i><p>Aún no hay eventos publicados.</p></div>`
      });
      window.__dtInstances['lista-eventos-publicados'] = dtEventos;
      dtEventos.init();
    } else {
      dtEventos.refresh(ordenados);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 5. VER DETALLE
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal con el detalle completo del evento */
  window.verEvento = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;

    document.getElementById('modal-ver-titulo').textContent = ev.titulo;

    const chipsRecursos = ev.recursos && ev.recursos.length > 0
      ? ev.recursos.map(r =>
          `<span class="ev-chip-recurso">
             <i class="bx bx-package"></i> ${r.recursoNombre} × ${r.cantidad} ${r.unidad || ''}
           </span>`
        ).join('')
      : '<span class="ev-sin-recursos">Sin recursos asignados</span>';

    document.getElementById('modal-ver-body').innerHTML = `
      <div class="ev-detalle-grid">
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-calendar"></i> Fecha</span>
          <span class="ev-detalle-valor">${ev.fecha}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-time"></i> Horario</span>
          <span class="ev-detalle-valor">${ev.horario}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-map-pin"></i> Ubicación</span>
          <span class="ev-detalle-valor">${ev.ubicacion}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-user"></i> Asistentes</span>
          <span class="ev-detalle-valor">${ev.asistentes || '—'}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-group"></i> Voluntarios necesarios</span>
          <span class="ev-detalle-valor">${ev.voluntariosNecesarios || 0}</span>
        </div>
        <div class="ev-detalle-item">
          <span class="ev-detalle-label"><i class="bx bx-calendar-plus"></i> Publicado</span>
          <span class="ev-detalle-valor">${ev.publicado || '—'}</span>
        </div>
      </div>
      ${ev.descripcion ? `
        <div class="ev-detalle-desc">
          <span class="ev-detalle-label"><i class="bx bx-note"></i> Descripción</span>
          <p>${ev.descripcion}</p>
        </div>` : ''}
      <div class="ev-detalle-recursos">
        <span class="ev-detalle-label"><i class="bx bx-package"></i> Recursos asignados</span>
        <div class="ev-chips-wrap" style="margin-top:0.5rem;">${chipsRecursos}</div>
      </div>`;

    document.getElementById('modal-ver-evento').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  /** Cierra el modal de ver detalle */
  window.cerrarModalVer = function(e) {
    if (e && e.target !== document.getElementById('modal-ver-evento')) return;
    document.getElementById('modal-ver-evento').style.display = 'none';
    document.body.style.overflow = '';
  };

  // ════════════════════════════════════════════════════════════════
  // 6. EDITAR EVENTO
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal de edición con los datos del evento precargados */
  window.abrirEditar = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;

    document.getElementById('edit-id').value          = ev.id;
    document.getElementById('edit-titulo').value      = ev.titulo;
    document.getElementById('edit-fecha').value       = ev.fecha;
    document.getElementById('edit-horario').value     = ev.horario;
    document.getElementById('edit-ubicacion').value   = ev.ubicacion;
    document.getElementById('edit-asistentes').value  = ev.asistentes !== '—' ? ev.asistentes : '';
    document.getElementById('edit-voluntarios').value = ev.voluntariosNecesarios || 1;
    document.getElementById('edit-descripcion').value = ev.descripcion || '';

    document.getElementById('modal-editar-evento').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  /** Guarda los cambios del formulario de edición */
  window.guardarEdicion = function(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('edit-id').value);
    const ev = EventosModel.getById(id);

    const data = {
      titulo:                document.getElementById('edit-titulo').value,
      fecha:                 document.getElementById('edit-fecha').value,
      horario:               document.getElementById('edit-horario').value,
      ubicacion:             document.getElementById('edit-ubicacion').value,
      asistentes:            document.getElementById('edit-asistentes').value,
      voluntariosNecesarios: document.getElementById('edit-voluntarios').value,
      descripcion:           document.getElementById('edit-descripcion').value,
      // Mantener los recursos originales del evento
      recursos:              ev ? ev.recursos : []
    };

    const resultado = EventosModel.actualizar(id, data);

    if (!resultado.ok) {
      showToast('Error', resultado.error);
      return;
    }

    cerrarModalEditar();
    renderEventosPublicados();
    showToast('Evento actualizado', `"${data.titulo}" fue actualizado correctamente.`);
  };

  /** Cierra el modal de edición */
  window.cerrarModalEditar = function(e) {
    if (e && e.target !== document.getElementById('modal-editar-evento')) return;
    document.getElementById('modal-editar-evento').style.display = 'none';
    document.body.style.overflow = '';
  };

  // ════════════════════════════════════════════════════════════════
  // 7. ELIMINAR EVENTO
  // ════════════════════════════════════════════════════════════════

  /** Elimina un evento del historial */
  window.eliminarEvento = function(id) {
    const ev = EventosModel.getById(id);
    if (!ev) return;
    if (!confirm(`¿Eliminar el evento "${ev.titulo}"?\nEsta acción no se puede deshacer.`)) return;
    EventosModel.eliminar(id);
    renderEventosPublicados();
    showToast('Evento eliminado', `"${ev.titulo}" fue eliminado.`);
  };

  // ── Inicialización ───────────────────────────────────────────────────────
  cargarRecursos();
  actualizarContador();
  renderEventosPublicados();

  // ════════════════════════════════════════════════════════════════
  // 8. PREVISUALIZACIÓN EN TIEMPO REAL
  // ════════════════════════════════════════════════════════════════

  /**
   * Lee los campos del formulario y actualiza la tarjeta de previsualización
   * en tiempo real. Se llama desde los eventos oninput/onchange de cada campo.
   * La columna de previsualización se muestra solo cuando hay algún dato.
   */
  window.actualizarPreview = function() {
    const titulo      = document.getElementById('ev-titulo').value.trim();
    const fecha       = document.getElementById('ev-fecha').value;
    const horario     = document.getElementById('ev-horario').value.trim();
    const ubicacion   = document.getElementById('ev-ubicacion').value.trim();
    const asistentes  = document.getElementById('ev-asistentes').value.trim();
    const voluntarios = document.getElementById('ev-voluntarios').value;
    const descripcion = document.getElementById('ev-descripcion').value.trim();

    const previewCol  = document.getElementById('ev-preview-col');
    const empty       = document.getElementById('ev-preview-empty');
    const content     = document.getElementById('ev-preview-content');

    const hayDatos = titulo || fecha || horario || ubicacion;

    // Mostrar u ocultar la columna completa de previsualización
    if (hayDatos) {
      previewCol.classList.add('ev-preview-col--visible');
    } else {
      previewCol.classList.remove('ev-preview-col--visible');
      return; // No hay nada que renderizar
    }

    // Siempre mostrar contenido cuando hay datos
    empty.style.display   = 'none';
    content.style.display = 'block';

    // Título
    document.getElementById('prev-ev-titulo').textContent = titulo || 'Sin título';

    // Fecha formateada
    if (fecha) {
      const [y, m, d] = fecha.split('-');
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      document.getElementById('prev-ev-fecha').textContent = `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
      document.getElementById('prev-row-fecha').style.display = 'flex';
    } else {
      document.getElementById('prev-row-fecha').style.display = 'none';
    }

    // Horario
    if (horario) {
      document.getElementById('prev-ev-horario').textContent = horario;
      document.getElementById('prev-row-horario').style.display = 'flex';
    } else {
      document.getElementById('prev-row-horario').style.display = 'none';
    }

    // Ubicación
    if (ubicacion) {
      document.getElementById('prev-ev-ubicacion').textContent = ubicacion;
      document.getElementById('prev-row-ubicacion').style.display = 'flex';
    } else {
      document.getElementById('prev-row-ubicacion').style.display = 'none';
    }

    // Asistentes
    if (asistentes) {
      document.getElementById('prev-ev-asistentes').textContent = `${asistentes} asistentes esperados`;
      document.getElementById('prev-row-asistentes').style.display = 'flex';
    } else {
      document.getElementById('prev-row-asistentes').style.display = 'none';
    }

    // Voluntarios
    if (voluntarios && parseInt(voluntarios) > 0) {
      document.getElementById('prev-ev-voluntarios').textContent = `${voluntarios} voluntario(s) necesario(s)`;
      document.getElementById('prev-row-voluntarios').style.display = 'flex';
    } else {
      document.getElementById('prev-row-voluntarios').style.display = 'none';
    }

    // Descripción
    const descEl = document.getElementById('prev-ev-desc');
    if (descripcion) {
      descEl.textContent   = descripcion;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  };

  // Al cargar la página la previsualización está oculta (sin datos aún)
  actualizarPreview();
});
