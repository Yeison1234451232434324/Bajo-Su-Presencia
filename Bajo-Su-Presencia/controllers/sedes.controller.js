/**
 * ============================================================
 * CONTROLADOR: sedes.controller.js
 * ============================================================
 * Gestión de Múltiples Sedes — Solo Administrador.
 * Depende de SedesModel (sedes.model.js).
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  /** Escapa datos de usuario antes de insertarlos con innerHTML (anti-XSS). */
  const esc = (v) => (window.BSPVal?.escapeHtml
    ? window.BSPVal.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"'`/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
      }[c])));

  const modal        = document.getElementById('sed-modal');
  const modalOverlay = document.getElementById('sed-modal-overlay');
  const form         = document.getElementById('form-sede');

  // ── DataTable de sedes ───────────────────────────────────────────────────
  let dtSedes = null;

  async function render() {
    const sedes = await SedesModel.getAll();
    const data  = sedes.map(s => ({
      ...s,
      miembrosTexto: s.miembros ? `${s.miembros} miembros` : ''
    }));

    function renderRow(s) {
      return `
        <div class="sed-item">
          <div class="sed-item-header">
            <div class="sed-item-icon"><i class="bx bx-buildings" aria-hidden="true"></i></div>
            <span class="sed-item-nombre">${esc(s.nombre)}</span>
            <button class="sed-btn-eliminar" onclick="eliminarSede('${s.id}')" title="Eliminar sede">
              <i class="bx bx-trash" aria-hidden="true"></i>
            </button>
          </div>
          <div class="sed-item-meta">
            <p><i class="bx bx-map-pin" aria-hidden="true"></i> ${esc(s.direccion)}, ${esc(s.ciudad)}</p>
            ${s.telefono ? `<p><i class="bx bx-phone" aria-hidden="true"></i> ${esc(s.telefono)}</p>` : ''}
            ${s.pastor   ? `<p><i class="bx bx-user-circle" aria-hidden="true"></i> ${esc(s.pastor)}${s.miembros ? ` · ${esc(s.miembros)} miembros` : ''}</p>` : ''}
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
        emptyHTML: `<div class="dt-empty"><i class="bx bx-buildings" aria-hidden="true"></i><p>No hay sedes registradas. Agrega la primera.</p></div>`
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

  // ── Helpers de validación DOM (delegados a BSPVal) ──────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  // Bloquear caracteres peligrosos en el campo numérico de miembros
  BSPVal.blockNumericChars(document.getElementById('sed-miembros'));

  // ── Guardar sede ─────────────────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();

    /* Leer y limpiar todos los valores */
    const nombre      = BSPVal.cleanText(document.getElementById('sed-nombre').value);
    const ciudad      = BSPVal.cleanText(document.getElementById('sed-ciudad').value);
    const direccion   = BSPVal.cleanText(document.getElementById('sed-direccion').value);
    const telefono    = document.getElementById('sed-telefono').value.trim();
    const pastor      = BSPVal.cleanText(document.getElementById('sed-pastor').value);
    const miembrosRaw = document.getElementById('sed-miembros').value;

    // ── Limpiar estado previo ─────────────────────────────────────────────
    _ok('sed-nombre','sed-ciudad','sed-direccion','sed-telefono','sed-pastor','sed-miembros');
    let valido = true;
    let err;

    /* Nombre de la sede: mínimo 2, máximo 100, debe iniciar con letra */
    err = BSPVal.txt(nombre, { min: 2, max: 100, label: 'El nombre de la sede', iniciaLetra: true });
    if (err) { _err('sed-nombre', err); valido = false; }

    /* Ciudad: mínimo 2, máximo 100, solo letras y espacios */
    err = BSPVal.txt(ciudad, { min: 2, max: 100, label: 'La ciudad' });
    if (!err) err = BSPVal.soloLetras(ciudad, { label: 'La ciudad' });
    if (err) { _err('sed-ciudad', err); valido = false; }

    /* Dirección: mínimo 5, máximo 200 (puede tener números de calle) */
    err = BSPVal.txt(direccion, { min: 5, max: 200, label: 'La dirección' });
    if (err) { _err('sed-direccion', err); valido = false; }

    /* Teléfono: opcional — solo si se ingresó */
    err = BSPVal.tel(telefono, { required: false });
    if (err) { _err('sed-telefono', err); valido = false; }

    /* Pastor/a: opcional, solo letras, máximo 100 */
    if (pastor.length > 0) {
      err = BSPVal.txt(pastor, { min: 2, max: 100, label: 'El nombre del pastor/a' });
      if (!err) err = BSPVal.soloLetras(pastor, { label: 'El nombre del pastor/a' });
      if (err) { _err('sed-pastor', err); valido = false; }
    }

    /* Miembros: entero >= 0, máximo 999999 — bloquea 'e', '+', '-' */
    if (miembrosRaw.trim() !== '') {
      err = BSPVal.num(miembrosRaw, { min: 0, max: 999999, entero: true, label: 'El número de miembros' });
      if (err) { _err('sed-miembros', err); valido = false; }
    }

    if (!valido) return;
    // ─────────────────────────────────────────────────────────────────────

    /* Datos limpios — miembros como entero */
    const data = {
      nombre,
      ciudad,
      direccion,
      telefono,
      pastor,
      miembros: miembrosRaw.trim() !== '' ? parseInt(miembrosRaw, 10) : 0
    };

    /* Llamada async al modelo con try-catch */
    let res;
    try {
      res = await SedesModel.crear(data);
    } catch (ex) {
      showAlertError('Error de conexión. Revisa tu internet e intenta de nuevo.');
      return;
    }
    if (!res.ok) { showAlertError(res.error); return; }
    cerrarModalSede();
    await render();
    showAlertSuccess(`"${data.nombre}" fue registrada correctamente.`);
  });

  // ── Eliminar sede ────────────────────────────────────────────────────────
  window.eliminarSede = async function(id) {
    const s = await SedesModel.getById(id);
    if (!s) return;
    showAlertConfirm(
      'Eliminar sede',
      `¿Eliminar la sede "${s.nombre}"? Esta acción no se puede deshacer.`,
      async function() {
        const res = await SedesModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await render();
        showAlertSuccess(`"${s.nombre}" fue eliminada.`);
      }
    );
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  render();
});
