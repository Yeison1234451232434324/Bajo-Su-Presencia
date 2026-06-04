/**
 * ============================================================
 * CONTROLADOR: sedes.controller.js
 * ============================================================
 * Gestión de Múltiples Sedes — Solo Administrador.
 * Depende de SedesModel (sedes.model.js).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  const modal        = document.getElementById('sed-modal');
  const modalOverlay = document.getElementById('sed-modal-overlay');
  const form         = document.getElementById('form-sede');

  // ── DataTable de sedes ───────────────────────────────────────────────────
  let dtSedes = null;

  function render() {
    const sedes = SedesModel.getAll();
    const data  = sedes.map(s => ({
      ...s,
      miembrosTexto: s.miembros ? `${s.miembros} miembros` : ''
    }));

    function renderRow(s) {
      return `
        <div class="sed-item">
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
          </div>
        </div>`;
    }

    if (!dtSedes) {
      dtSedes = new BSPDataTable({
        containerId:  'dt-sedes',
        data,
        pageSize:     9,
        searchFields: ['nombre', 'ciudad', 'direccion', 'pastor'],
        renderRow,
        exportable:   true,
        exportName:   'sedes',
        exportFields: ['nombre', 'ciudad', 'direccion', 'telefono', 'pastor', 'miembrosTexto'],
        exportLabels: ['Sede', 'Ciudad', 'Dirección', 'Teléfono', 'Pastor/a', 'Miembros'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-buildings"></i><p>No hay sedes registradas. Agrega la primera.</p></div>`
      });
      window.__bspDT['dt-sedes'] = dtSedes;
      dtSedes.init();
    } else {
      dtSedes.refresh(data);
    }
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

  // ── Helpers de validación DOM ────────────────────────────────────────────
  function _err(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('campo-invalido');
    const box = el.closest('.sed-field, .form-group') || el.parentElement;
    let s = box.querySelector('.campo-error');
    if (!s) { s = document.createElement('span'); s.className = 'campo-error'; box.appendChild(s); }
    s.textContent = msg;
  }
  function _ok(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('campo-invalido');
      const box = el.closest('.sed-field, .form-group') || el.parentElement;
      const s = box.querySelector('.campo-error');
      if (s) s.remove();
    });
  }

  // ── Guardar sede ─────────────────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();

    const nombre    = document.getElementById('sed-nombre').value.trim();
    const ciudad    = document.getElementById('sed-ciudad').value.trim();
    const direccion = document.getElementById('sed-direccion').value.trim();
    const miembros  = parseInt(document.getElementById('sed-miembros').value) || 0;

    // ── Validación DOM ────────────────────────────────────────────────────
    const RX_NOMBRE   = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
    const RX_INI_LETRA = /^[a-zA-ZÀ-ÿñÑ]/;
    const RX_TELEFONO = /^[\d\s\+\-\(\)]{7,20}$/;
    const telefono = document.getElementById('sed-telefono').value.trim();
    _ok('sed-nombre','sed-ciudad','sed-direccion','sed-telefono','sed-miembros');
    let valido = true;

    if (!nombre || nombre.length < 2) {
      _err('sed-nombre', 'El nombre de la sede debe tener al menos 2 caracteres.');   valido = false;
    } else if (!RX_INI_LETRA.test(nombre)) {
      _err('sed-nombre', 'El nombre debe comenzar con una letra.');                    valido = false;
    } else if (nombre.length > 100) {
      _err('sed-nombre', 'El nombre no puede superar 100 caracteres.');                valido = false;
    }
    if (!ciudad || ciudad.length < 2) {
      _err('sed-ciudad', 'La ciudad es obligatoria (mínimo 2 caracteres).');           valido = false;
    } else if (!RX_NOMBRE.test(ciudad)) {
      _err('sed-ciudad', 'La ciudad solo puede contener letras y espacios.');          valido = false;
    }
    if (!direccion || direccion.length < 5) {
      _err('sed-direccion', 'La dirección debe tener al menos 5 caracteres.');         valido = false;
    } else if (direccion.length > 200) {
      _err('sed-direccion', 'La dirección no puede superar 200 caracteres.');          valido = false;
    }
    if (telefono && !RX_TELEFONO.test(telefono)) {
      _err('sed-telefono', 'Teléfono inválido. Usa solo dígitos, +, -, () y espacios.'); valido = false;
    }
    if (miembros < 0) {
      _err('sed-miembros', 'El número de miembros no puede ser negativo.');            valido = false;
    } else if (miembros > 999999) {
      _err('sed-miembros', 'El número de miembros parece excesivo (máx. 999,999).');   valido = false;
    }
    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    const data = {
      nombre,
      ciudad,
      direccion,
      telefono:  document.getElementById('sed-telefono').value,
      pastor:    document.getElementById('sed-pastor').value,
      miembros:  document.getElementById('sed-miembros').value
    };
    const res = SedesModel.agregar(data);
    if (!res.ok) { showAlertError(res.error); return; }
    cerrarModalSede();
    render();
    showAlertSuccess(`"${data.nombre}" fue registrada correctamente.`);
  });

  // ── Eliminar sede ────────────────────────────────────────────────────────
  window.eliminarSede = function(id) {
    const s = SedesModel.getById(id);
    if (!s) return;
    showAlertConfirm(
      'Eliminar sede',
      `¿Eliminar la sede "${s.nombre}"? Esta acción no se puede deshacer.`,
      function() {
        SedesModel.eliminar(id);
        render();
        showAlertSuccess(`"${s.nombre}" fue eliminada.`);
      }
    );
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  render();
});
