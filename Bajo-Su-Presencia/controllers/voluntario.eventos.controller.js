/* global EventosModel, showAlertConfirm, showAlertError, showAlertSuccess, showAlertWarning */
/**
 * ============================================================
 * CONTROLADOR: voluntario.eventos.controller.js  (Supabase)
 * ============================================================
 * El voluntario logueado ve los eventos de la congregación y puede
 * inscribirse o cancelar su inscripción. La inscripción crea/borra
 * su fila en voluntarios_eventos (vía EventosModel.inscribir /
 * cancelarInscripcion).
 *
 * El estado "¿estoy inscrito?" se deduce de EventosModel.getAll(),
 * que ya trae los voluntarios de cada evento en `especialistas`
 * (cada uno con su usuarioId). No hace falta una consulta extra.
 *
 * Depende de: EventosModel, window.BSPSession, alertify.helper.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  const sesion = await window.BSPSession.exigir(['Voluntario']);
  if (!sesion) return;

  const volId = String(sesion.id);
  const lista = document.getElementById('vev-lista');
  const contBox = document.getElementById('vev-count');
  const contNum = document.getElementById('vev-count-num');

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /** 'YYYY-MM-DD' → '15 may 2026' (sin depender de zona horaria). */
  function localFechaLegible(iso) {
    if (!iso) return 'Fecha por confirmar';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return String(iso);
    return `${Number(m[3])} ${MESES[Number(m[2]) - 1] || ''} ${m[1]}`;
  }

  /**
   * Estado del evento para mostrar: se calcula por fecha (igual que en el
   * panel de admin/colaborador), no se elige manualmente ni queda guardado
   * en BD — así nunca se desactualiza. "Cancelado" es la única excepción
   * que sigue viniendo del campo `estado` de la BD.
   */
  function localEstadoMostrar(evento) {
    if (evento.estado === 'Cancelado') return 'Cancelado';
    const hoy = new Date().toISOString().split('T')[0];
    return evento.fecha && evento.fecha < hoy ? 'Finalizado' : 'Publicado';
  }

  /** Clase de badge según el estado del evento. */
  function localBadgeEstado(estado) {
    switch (estado) {
      case 'Finalizado': return 'badge-muted';
      case 'Cancelado': return 'badge-red';
      default: return 'badge-blue'; // Publicado
    }
  }

  /** ¿El voluntario logueado ya está inscrito en este evento? */
  function localEstoyInscrito(evento) {
    return (evento.especialistas || []).some((e) => String(e.usuarioId) === volId);
  }

  /** Crea un <div> con icono + texto para la zona de metadatos. */
  function localMeta(icono, texto, muted = false) {
    const div = document.createElement('div');
    div.className = `vev-meta-item${muted ? ' is-muted' : ''}`;
    const i = document.createElement('i');
    i.className = icono;
    i.setAttribute('aria-hidden', 'true');
    const span = document.createElement('span');
    span.textContent = texto;
    div.append(i, span);
    return div;
  }

  /**
   * Calcula los cupos de VOLUNTARIO que quedan para un evento.
   * @returns {{necesarios:number, inscritos:number, restantes:number|null, lleno:boolean}}
   *          restantes = null cuando el evento no define un límite (necesarios <= 0).
   */
  function localCupos(evento) {
    const necesarios = Number(evento.voluntariosNecesarios) || 0;
    const inscritos = (evento.especialistas || []).length;
    if (necesarios <= 0) {
      return {
        necesarios: 0, inscritos, restantes: null, lleno: false,
      };
    }
    const restantes = Math.max(0, necesarios - inscritos);
    return {
      necesarios, inscritos, restantes, lleno: restantes === 0,
    };
  }

  /** Línea de metadatos que muestra los cupos de voluntario restantes. */
  function localMetaCupos(cupos) {
    const div = document.createElement('div');
    div.className = 'vev-meta-item vev-cupos';
    const i = document.createElement('i');
    i.className = 'bx bx-group';
    i.setAttribute('aria-hidden', 'true');
    const span = document.createElement('span');

    if (cupos.restantes === null) {
      span.textContent = 'Cupos de voluntario abiertos';
    } else if (cupos.lleno) {
      span.textContent = `Cupos completos (${cupos.necesarios}/${cupos.necesarios})`;
      div.classList.add('is-lleno');
    } else {
      const plazas = cupos.restantes === 1 ? 'cupo disponible' : 'cupos disponibles';
      span.textContent = `${cupos.restantes} de ${cupos.necesarios} ${plazas}`;
      div.classList.add('is-disponible');
    }
    div.append(i, span);
    return div;
  }

  /** Construye la tarjeta de un evento. */
  function localCrearTarjeta(evento) {
    const inscrito = localEstoyInscrito(evento);
    const cancelado = evento.estado === 'Cancelado';
    const finalizado = localEstadoMostrar(evento) === 'Finalizado';
    // Un evento cancelado o ya finalizado no admite nuevas inscripciones.
    const cerrado = cancelado || finalizado;
    const cupos = localCupos(evento);

    const card = document.createElement('article');
    card.className = `vev-card${inscrito ? ' is-inscrito' : ''}`;
    card.dataset.id = evento.id;

    // ── Cabecera: título + estado ──
    const top = document.createElement('div');
    top.className = 'vev-card-top';
    const titRow = document.createElement('div');
    titRow.className = 'vev-card-titulo-row';
    const h3 = document.createElement('h3');
    h3.className = 'vev-card-titulo';
    h3.textContent = evento.titulo || 'Evento sin título';
    const estadoMostrar = localEstadoMostrar(evento);
    const badge = document.createElement('span');
    badge.className = `badge ${localBadgeEstado(estadoMostrar)}`;
    badge.textContent = estadoMostrar;
    titRow.append(h3, badge);
    top.appendChild(titRow);
    if (evento.descripcion) {
      const desc = document.createElement('p');
      desc.className = 'vev-card-desc';
      desc.textContent = evento.descripcion;
      top.appendChild(desc);
    }

    // ── Metadatos ──
    const meta = document.createElement('div');
    meta.className = 'vev-card-meta';
    meta.appendChild(localMeta('bx bx-calendar', localFechaLegible(evento.fecha)));
    meta.appendChild(localMeta('bx bx-time-five', evento.horario || 'Horario por confirmar', !evento.horario));
    meta.appendChild(localMeta('bx bx-map', evento.ubicacion || 'Lugar por confirmar', !evento.ubicacion));
    meta.appendChild(localMetaCupos(cupos));

    // ── Pie: estado de inscripción + acción ──
    const foot = document.createElement('div');
    foot.className = 'vev-card-foot';

    const btn = document.createElement('button');
    btn.type = 'button';

    if (inscrito) {
      const tag = document.createElement('span');
      tag.className = 'vev-inscrito-tag';
      tag.innerHTML = '<i class="bx bx-check-circle" aria-hidden="true"></i>';
      tag.append(document.createTextNode(' Estás inscrito'));
      foot.appendChild(tag);

      btn.className = 'vev-btn vev-btn-cancelar';
      btn.innerHTML = '<i class="bx bx-x" aria-hidden="true"></i>';
      btn.append(document.createTextNode('Cancelar'));
      btn.addEventListener('click', () => localCancelar(evento, btn));
    } else {
      const hueco = document.createElement('span');
      hueco.className = 'vev-meta-item is-muted';
      let textoHueco = 'Aún no te has inscrito';
      if (cancelado) textoHueco = 'Evento cancelado';
      else if (finalizado) textoHueco = 'Evento finalizado';
      else if (cupos.lleno) textoHueco = 'Sin cupos disponibles';
      hueco.textContent = textoHueco;
      foot.appendChild(hueco);

      btn.className = 'vev-btn vev-btn-inscribir';
      btn.innerHTML = '<i class="bx bx-user-plus" aria-hidden="true"></i>';
      btn.append(document.createTextNode('Inscribirme'));
      btn.disabled = cerrado || cupos.lleno;
      btn.addEventListener('click', () => localInscribir(evento, btn));
    }
    foot.appendChild(btn);

    card.append(top, meta, foot);
    return card;
  }

  /** Inscribe al voluntario y recarga la vista. */
  async function localInscribir(evento, btn) {
    if (evento.estado === 'Cancelado' || localEstadoMostrar(evento) === 'Finalizado') {
      showAlertError('Este evento ya no admite inscripciones.');
      return;
    }
    btn.disabled = true;
    const res = await EventosModel.inscribir(evento.id, volId);
    if (!res.ok) {
      btn.disabled = false;
      showAlertError(res.error || 'No se pudo completar la inscripción.');
      return;
    }
    showAlertSuccess(`Te inscribiste en «${evento.titulo}».`);
    await render();
  }

  /** Pide confirmación y cancela la inscripción. */
  function localCancelar(evento, btn) {
    showAlertConfirm(
      'Cancelar inscripción',
      `¿Seguro que quieres cancelar tu inscripción en «${evento.titulo}»?`,
      async () => {
        btn.disabled = true;
        const res = await EventosModel.cancelarInscripcion(evento.id, volId);
        if (!res.ok) {
          btn.disabled = false;
          showAlertError(res.error || 'No se pudo cancelar la inscripción.');
          return;
        }
        showAlertWarning('Cancelaste tu inscripción.');
        await render();
      },
    );
  }

  /** Carga y pinta todos los eventos. */
  async function render() {
    let eventos = [];
    try {
      eventos = await EventosModel.getAll();
    } catch (e) {
      window.BSPLog?.error('voluntarioEventos.getAll', e);
      lista.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'vev-empty';
      err.innerHTML = '<i class="bx bx-error-circle" aria-hidden="true"></i>';
      const p = document.createElement('p');
      p.textContent = 'No se pudieron cargar los eventos. Intenta de nuevo.';
      err.appendChild(p);
      lista.appendChild(err);
      return;
    }

    // El voluntario solo ve eventos a los que todavía puede inscribirse:
    // se ocultan los ya finalizados (fecha pasada).
    eventos = eventos.filter((ev) => localEstadoMostrar(ev) !== 'Finalizado');

    // Orden: más próximos/recientes primero (fecha descendente).
    eventos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    lista.innerHTML = '';

    if (!eventos.length) {
      const vacio = document.createElement('div');
      vacio.className = 'vev-empty';
      vacio.innerHTML = '<i class="bx bx-calendar-x" aria-hidden="true"></i>';
      const p = document.createElement('p');
      p.textContent = 'No hay eventos disponibles por el momento.';
      vacio.appendChild(p);
      lista.appendChild(vacio);
      contBox.hidden = true;
      return;
    }

    let inscritos = 0;
    eventos.forEach((ev) => {
      if (localEstoyInscrito(ev)) inscritos += 1;
      lista.appendChild(localCrearTarjeta(ev));
    });

    // Contador de inscripciones activas.
    contNum.textContent = String(inscritos);
    contBox.hidden = inscritos === 0;
  }

  await render();
});
