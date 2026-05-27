/**
 * ============================================================
 * CONTROLADOR: sedes.controller.js
 * ============================================================
 * Gestión de Múltiples Sedes — Solo Administrador.
 * Depende de SedesModel (sedes.model.js).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  const grid         = document.getElementById('sed-grid');
  const modal        = document.getElementById('sed-modal');
  const modalOverlay = document.getElementById('sed-modal-overlay');
  const form         = document.getElementById('form-sede');

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const sedes = SedesModel.getAll();
    grid.innerHTML = '';

    if (!sedes.length) {
      grid.innerHTML = `
        <div class="sed-empty">
          <i class="bx bx-buildings"></i>
          <p>No hay sedes registradas. Agrega la primera.</p>
        </div>`;
      return;
    }

    sedes.forEach(s => {
      const div = document.createElement('div');
      div.className = 'sed-item';
      div.innerHTML = `
        <div class="sed-item-header">
          <div class="sed-item-icon"><i class="bx bx-buildings"></i></div>
          <span class="sed-item-nombre">${s.nombre}</span>
          <button class="sed-btn-eliminar" onclick="eliminarSede(${s.id})" title="Eliminar sede">
            <i class="bx bx-trash"></i>
          </button>
        </div>
        <div class="sed-item-meta">
          <p><i class="bx bx-map-pin"></i> ${s.direccion}, ${s.ciudad}</p>
          ${s.telefono ? `<p><i class="bx bx-phone"></i> ${s.telefono}</p>` : ''}
          ${s.pastor   ? `<p><i class="bx bx-user-circle"></i> ${s.pastor}${s.miembros ? ` · ${s.miembros} miembros` : ''}</p>` : ''}
        </div>`;
      grid.appendChild(div);
    });
  }

  // ── Abrir modal ──────────────────────────────────────────────────────────
  window.abrirModalSede = function() {
    form.reset();
    modal.style.display        = 'flex';
    modalOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  // ── Cerrar modal ─────────────────────────────────────────────────────────
  window.cerrarModalSede = function() {
    modal.style.display        = 'none';
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  };
  modalOverlay.addEventListener('click', cerrarModalSede);

  // ── Guardar sede ─────────────────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      nombre:    document.getElementById('sed-nombre').value,
      ciudad:    document.getElementById('sed-ciudad').value,
      direccion: document.getElementById('sed-direccion').value,
      telefono:  document.getElementById('sed-telefono').value,
      pastor:    document.getElementById('sed-pastor').value,
      miembros:  document.getElementById('sed-miembros').value
    };
    const res = SedesModel.agregar(data);
    if (!res.ok) { showToast('Error', res.error); return; }
    cerrarModalSede();
    render();
    showToast('Sede agregada', `"${data.nombre}" fue registrada correctamente.`);
  });

  // ── Eliminar sede ────────────────────────────────────────────────────────
  window.eliminarSede = function(id) {
    const s = SedesModel.getById(id);
    if (!s) return;
    if (!confirm(`¿Eliminar la sede "${s.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    SedesModel.eliminar(id);
    render();
    showToast('Sede eliminada', `"${s.nombre}" fue eliminada.`);
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  render();
});
