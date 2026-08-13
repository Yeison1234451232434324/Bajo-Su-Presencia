/**
 * ============================================================
 * CONTROLADOR: actividades.controller.js  (Supabase)
 * ============================================================
 * Gestión de actividades por evento. Async.
 * Depende de: ActividadesModel, EventosModel, UsuariosModel.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador','Colaborador']);
  if (!sesion) return;

  const _esColaborador = ((JSON.parse(localStorage.getItem('usuarioLogueado') || '{}')).rol || '') === 'Colaborador';

  /**
   * Escapa datos antes de insertarlos con innerHTML (título/descripción de
   * evento y actividad, nombre de voluntario asignado, etc. son escritos
   * por usuarios y podrían contener HTML/JS malicioso).
   */
  const esc = (v) => (window.BSPVal?.escapeHtml
    ? window.BSPVal.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"'`/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
      }[c])));

  let eventoActual = null;
  let modoEdicion  = false;
  let actEditId    = null;
  let _volsCache   = [];   // voluntarios/colaboradores para el select

  const vistaEventos     = document.getElementById('vista-eventos');
  const vistaActividades = document.getElementById('vista-actividades');
  const gridEventos      = document.getElementById('grid-eventos');
  const listaActividades = document.getElementById('lista-actividades');
  const contadorActs     = document.getElementById('contador-acts');
  const bannerEvento     = document.getElementById('banner-evento');
  const modal            = document.getElementById('modal-actividad');
  const modalOverlay     = document.getElementById('modal-overlay-act');
  const modalTitulo      = document.getElementById('modal-act-titulo');
  const formAct          = document.getElementById('form-actividad');
  const selectVol        = document.getElementById('act-voluntario');

  // ════════════════════════════════════════════════════════════════
  // 1. VISTA DE EVENTOS
  // ════════════════════════════════════════════════════════════════
  async function renderEventos() {
    let eventos = [];
    try { eventos = await EventosModel.getAll(); }
    catch (e) { window.BSPLog?.error('actividades.cargarEventos', e); }

    gridEventos.innerHTML = '';
    if (!eventos.length) {
      gridEventos.innerHTML = `<div class="act-empty"><i class="bx bx-calendar-x" aria-hidden="true"></i><p>No hay eventos publicados aún.</p></div>`;
      return;
    }

    // Una sola consulta acotada a los eventos visibles (WHERE evento_id IN (...))
    // en vez de una por evento (antes: getResumenEvento(ev.id) dentro del bucle)
    // y en vez de traer la tabla completa con getAll().
    let todasActividades = [];
    try { todasActividades = await ActividadesModel.getByEventos(eventos.map(ev => ev.id)); }
    catch (e) { window.BSPLog?.error('actividades.cargarResumen', e); }
    const resumenPorEvento = {};
    for (const a of todasActividades) {
      const r = resumenPorEvento[a.eventoId] || (resumenPorEvento[a.eventoId] = { total: 0, completadas: 0 });
      r.total++;
      if (a.completada) r.completadas++;
    }

    function _crearCardEvento(ev) {
      const resumen = resumenPorEvento[ev.id] || { total: 0, completadas: 0 };
      const volDisp = ev.voluntariosNecesarios || 0;
      const volInscritos = (ev.especialistas || []).length;   // inscritos en voluntarios_eventos
      const fechaFmt = _formatFecha(ev.fecha);

      const card = document.createElement('div');
      card.className = 'act-evento-card';
      card.innerHTML = `
        <div class="act-ev-icon"><i class="bx bx-calendar-event" aria-hidden="true"></i></div>
        <div class="act-ev-body">
          <h3 class="act-ev-titulo">${esc(ev.titulo)}</h3>
          <p class="act-ev-meta"><i class="bx bx-calendar" aria-hidden="true"></i> ${fechaFmt}</p>
          ${ev.horario ? `<p class="act-ev-meta"><i class="bx bx-time" aria-hidden="true"></i> ${esc(ev.horario)}</p>` : ''}
          <p class="act-ev-meta"><i class="bx bx-notepad" aria-hidden="true"></i> ${resumen.total} actividad(es) - ${resumen.completadas} completada(s)</p>
          <p class="act-ev-meta act-ev-vol"><i class="bx bx-group" aria-hidden="true"></i> ${volDisp} voluntario(s) necesario(s)</p>
          <p class="act-ev-meta act-ev-inscritos"><i class="bx bx-user-check" aria-hidden="true"></i> ${volInscritos} voluntario(s) inscrito(s)</p>
        </div>`;
      card.addEventListener('click', () => seleccionarEvento(ev));
      return card;
    }

    function _crearSubgrupo(titulo, iconoClase, modificador, lista) {
      const wrap = document.createElement('div');
      wrap.className = 'act-subgrupo';

      const label = document.createElement('p');
      label.className = `act-subgrupo-titulo${modificador ? ` ${modificador}` : ''}`;
      label.innerHTML = `<i class="bx ${iconoClase}" aria-hidden="true"></i> ${titulo} (${lista.length})`;
      wrap.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'act-grid-eventos';
      lista.forEach(ev => grid.appendChild(_crearCardEvento(ev)));
      wrap.appendChild(grid);

      return wrap;
    }

    // Tres grupos: sin ninguna actividad asignada, con actividades pero
    // aún no todas completadas, y con el 100% de sus actividades completadas.
    const sinAsignar  = [];
    const pendientes  = [];
    const completados = [];
    for (const ev of eventos) {
      const r = resumenPorEvento[ev.id] || { total: 0, completadas: 0 };
      if (r.total === 0) sinAsignar.push(ev);
      else if (r.completadas < r.total) pendientes.push(ev);
      else completados.push(ev);
    }

    gridEventos.classList.add('act-grid-eventos--agrupado');
    if (sinAsignar.length) {
      gridEventos.appendChild(_crearSubgrupo('Sin actividades asignadas', 'bx-error-circle', 'act-subgrupo-titulo--alerta', sinAsignar));
    }
    if (pendientes.length) {
      gridEventos.appendChild(_crearSubgrupo('Actividades pendientes', 'bx-time-five', null, pendientes));
    }
    if (completados.length) {
      gridEventos.appendChild(_crearSubgrupo('Actividades completadas', 'bx-check-circle', 'act-subgrupo-titulo--ok', completados));
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 2. SELECCIONAR EVENTO
  // ════════════════════════════════════════════════════════════════
  async function seleccionarEvento(ev) {
    eventoActual = ev;
    bannerEvento.querySelector('.act-banner-titulo').textContent = ev.titulo;
    bannerEvento.querySelector('.act-banner-fecha').textContent  = _formatFecha(ev.fecha);
    bannerEvento.querySelector('.act-banner-hora').textContent   = ev.horario || '';
    bannerEvento.querySelector('.act-banner-lugar').textContent  = ev.ubicacion || ev.lugar || '';
    vistaEventos.style.display     = 'none';
    vistaActividades.style.display = 'block';
    await renderActividades();
  }

  function volverAEventos() {
    eventoActual = null;
    vistaActividades.style.display = 'none';
    vistaEventos.style.display     = 'block';
    renderEventos();
  }
  document.querySelector('.btn-volver')?.addEventListener('click', volverAEventos);

  // ════════════════════════════════════════════════════════════════
  // 3. LISTA DE ACTIVIDADES DEL EVENTO
  // ════════════════════════════════════════════════════════════════
  async function renderActividades() {
    if (!eventoActual) return;
    const acts = await ActividadesModel.getByEvento(eventoActual.id);
    const completadas = acts.filter(a => a.completada).length;

    contadorActs.textContent = `${completadas} de ${acts.length} completadas`;
    listaActividades.innerHTML = '';

    if (!acts.length) {
      listaActividades.innerHTML = `<div class="act-empty"><i class="bx bx-task" aria-hidden="true"></i><p>No hay actividades para este evento. Crea la primera.</p></div>`;
      return;
    }

    acts.forEach(act => {
      const prioClass = { alta:'act-prio--alta', media:'act-prio--media', baja:'act-prio--baja' }[act.prioridad] || '';
      const prioLabel = { alta:'Alta', media:'Media', baja:'Baja' }[act.prioridad] || act.prioridad;
      const item = document.createElement('div');
      item.className = `act-item${act.completada ? ' act-item--completada' : ''}`;
      item.id = `act-item-${act.id}`;
      item.innerHTML = `
        <button class="act-check-btn act-check-btn--readonly" disabled title="Solo el voluntario asignado puede cambiar el estado">
          ${act.completada ? '<i class="bx bx-check-circle act-check-icon act-check-icon--done" aria-hidden="true"></i>' : '<i class="bx bx-circle act-check-icon" aria-hidden="true"></i>'}
        </button>
        <div class="act-item-body">
          <div class="act-item-header">
            <span class="act-item-titulo${act.completada ? ' act-titulo--tachado' : ''}">${esc(act.titulo)}</span>
            <span class="act-prio-badge ${prioClass}">${prioLabel}</span>
          </div>
          ${act.descripcion ? `<p class="act-item-desc">${esc(act.descripcion)}</p>` : ''}
          <p class="act-item-asignado"><i class="bx bx-user" aria-hidden="true"></i> Asignado a: ${esc(act.voluntarioNombre || '—')}</p>
        </div>
        <div class="act-item-acciones">
          <button class="act-btn-accion act-btn-editar" data-action="editar-actividad" data-id="${act.id}" title="Editar"><i class="bx bx-edit" aria-hidden="true"></i></button>
          ${!_esColaborador ? `<button class="act-btn-accion act-btn-eliminar" data-action="eliminar-actividad" data-id="${act.id}" title="Eliminar"><i class="bx bx-trash" aria-hidden="true"></i></button>` : ''}
        </div>`;
      listaActividades.appendChild(item);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 4. MODAL NUEVA / EDITAR
  // ════════════════════════════════════════════════════════════════
  async function abrirNuevaActividad() {
    if (_eventoTerminado(eventoActual)) {
      showAlertError('Este evento ya finalizó: no se pueden crear nuevas actividades.');
      return;
    }
    modoEdicion = false; actEditId = null;
    modalTitulo.textContent = 'Nueva Actividad';
    formAct.reset();
    document.getElementById('act-prioridad').value = 'media';
    await _cargarVoluntarios();
    _mostrarModal();
  }
  document.querySelector('.btn-nueva-actividad')?.addEventListener('click', abrirNuevaActividad);

  async function abrirEditar(id) {
    const act = await ActividadesModel.getById(id);
    if (!act) return;
    modoEdicion = true; actEditId = id;
    modalTitulo.textContent = 'Editar Actividad';
    await _cargarVoluntarios();
    document.getElementById('act-titulo-input').value = act.titulo;
    document.getElementById('act-descripcion').value  = act.descripcion || '';
    document.getElementById('act-prioridad').value    = act.prioridad;
    selectVol.value = act.voluntarioId || '';
    _mostrarModal();
  }

  // ════════════════════════════════════════════════════════════════
  // 5. CARGAR VOLUNTARIOS EN EL SELECT (desde usuarios)
  // ════════════════════════════════════════════════════════════════
  async function _cargarVoluntarios() {
    selectVol.innerHTML = '<option value="">Selecciona un voluntario</option>';

    // Solo los voluntarios INSCRITOS al evento seleccionado (voluntarios_eventos),
    // no todos los usuarios. Se relee el evento para tener la lista actualizada.
    let inscritos = [];
    try {
      const ev = eventoActual ? await EventosModel.getById(eventoActual.id) : null;
      inscritos = (ev && Array.isArray(ev.especialistas)) ? ev.especialistas
                : (eventoActual && eventoActual.especialistas) || [];
    } catch (_) {
      inscritos = (eventoActual && eventoActual.especialistas) || [];
    }
    _volsCache = inscritos;

    if (!inscritos.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.disabled = true;
      opt.textContent = 'No hay voluntarios inscritos a este evento';
      selectVol.appendChild(opt);
      return;
    }

    inscritos.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.usuarioId;
      opt.textContent = v.nombre || 'Voluntario';
      selectVol.appendChild(opt);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 6. GUARDAR ACTIVIDAD
  // ════════════════════════════════════════════════════════════════
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);
  const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];

  // Cerrojo anti-doble-submit (mismo patrón que auth.controller.js).
  let enviandoActividad = false;

  formAct.addEventListener('submit', async e => {
    e.preventDefault();
    if (enviandoActividad) return;
    const titulo      = BSPVal.cleanText(document.getElementById('act-titulo-input').value);
    const descripcion = BSPVal.cleanText(document.getElementById('act-descripcion').value);
    const prioridad   = document.getElementById('act-prioridad').value;
    const volId       = selectVol.value;   // UUID (string)
    const volOpt      = selectVol.options[selectVol.selectedIndex];
    const volNombre   = volOpt ? BSPVal.cleanText(volOpt.textContent) : '';

    _ok('act-titulo-input','act-descripcion','act-prioridad','act-voluntario');
    let valido = true, err;

    err = BSPVal.txt(titulo, { min: 3, max: 120, label: 'El título', iniciaLetra: true });
    if (err) { _err('act-titulo-input', err); valido = false; }
    if (descripcion.length > 0) {
      err = BSPVal.txt(descripcion, { min: 5, max: 500, label: 'La descripción' });
      if (err) { _err('act-descripcion', err); valido = false; }
    }
    err = BSPVal.select(prioridad, PRIORIDADES_VALIDAS, { label: 'La prioridad' });
    if (err) { _err('act-prioridad', err); valido = false; }
    if (!volId) { _err('act-voluntario', 'Debes asignar la actividad a un voluntario.'); valido = false; }
    if (!valido) return;

    if (!modoEdicion && _eventoTerminado(eventoActual)) {
      showAlertError('Este evento ya finalizó: no se pueden crear nuevas actividades.');
      return;
    }

    const data = { eventoId: eventoActual.id, titulo, descripcion, prioridad, voluntarioId: volId, voluntarioNombre: volNombre };

    const btnSubmitAct = formAct.querySelector('button[type="submit"]');
    enviandoActividad = true;
    if (btnSubmitAct) { btnSubmitAct.disabled = true; btnSubmitAct.setAttribute('aria-busy', 'true'); }

    let resultado;
    try {
      resultado = modoEdicion ? await ActividadesModel.actualizar(actEditId, data) : await ActividadesModel.crear(data);
    } catch (ex) {
      showAlertError('Error de conexión. Intenta de nuevo.');
      enviandoActividad = false;
      if (btnSubmitAct) { btnSubmitAct.disabled = false; btnSubmitAct.removeAttribute('aria-busy'); }
      return;
    }
    if (!resultado.ok) {
      showAlertError(resultado.error);
      enviandoActividad = false;
      if (btnSubmitAct) { btnSubmitAct.disabled = false; btnSubmitAct.removeAttribute('aria-busy'); }
      return;
    }

    enviandoActividad = false;
    if (btnSubmitAct) { btnSubmitAct.disabled = false; btnSubmitAct.removeAttribute('aria-busy'); }
    _cerrarModal();
    await renderActividades();
    showAlertSuccess(`"${data.titulo}" fue ${modoEdicion ? 'actualizada' : 'creada'} correctamente.`);
  });

  // ════════════════════════════════════════════════════════════════
  // 7. ELIMINAR
  // ════════════════════════════════════════════════════════════════
  async function eliminarActividad(id) {
    if (_esColaborador) { showAlertError('Los colaboradores no tienen permiso para eliminar actividades.'); return; }
    const act = await ActividadesModel.getById(id);
    if (!act) return;
    showAlertConfirm(
      'Eliminar actividad',
      `¿Eliminar la actividad "${act.titulo}"? Esta acción no se puede deshacer.`,
      async function() {
        const res = await ActividadesModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await renderActividades();
        showAlertSuccess(`"${act.titulo}" fue eliminada.`);
      }
    );
  }

  // Delegación de eventos para acciones dinámicas de la lista de actividades
  // (antes onclick="..." inline generado por template literal).
  listaActividades.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !listaActividades.contains(btn)) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'editar-actividad') abrirEditar(id);
    else if (btn.dataset.action === 'eliminar-actividad') eliminarActividad(id);
  });

  // ════════════════════════════════════════════════════════════════
  // 8. HELPERS MODAL + FECHA
  // ════════════════════════════════════════════════════════════════
  function _mostrarModal() { BSPModal.abrir({ overlay: modalOverlay, modal, modoDisplay: true }); }
  function _cerrarModal()  { BSPModal.cerrar({ overlay: modalOverlay, modal, modoDisplay: true }); formAct.reset(); }
  modalOverlay.addEventListener('click', _cerrarModal);
  document.querySelector('.act-modal-close')?.addEventListener('click', _cerrarModal);
  document.querySelector('.btn-act-cancelar')?.addEventListener('click', _cerrarModal);

  function _formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const [y, m, d] = fechaStr.split('-');
      const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return `${dias[fecha.getDay()]} ${parseInt(d)} ${meses[parseInt(m) - 1]}`;
    } catch (_) { return fechaStr; }
  }

  // Un evento se considera "terminado" cuando ya pasó su hora de fin
  // (o el día completo, si no tiene hora de fin registrada).
  function _eventoTerminado(ev) {
    if (!ev || !ev.fecha) return false;
    const horaFin = (ev.horario || '').includes(' - ') ? ev.horario.split(' - ')[1].trim() : '';
    const finStr = horaFin ? `${ev.fecha}T${horaFin}:00` : `${ev.fecha}T23:59:59`;
    const fin = new Date(finStr);
    return !isNaN(fin) && fin < new Date();
  }

  // ── Inicialización ───────────────────────────────────────────────────────
  renderEventos();
});
