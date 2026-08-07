/**
 * Donaciones Controller — historial, filtros, eliminación y factura imprimible.
 */
document.addEventListener('DOMContentLoaded', async () => {

  const esc = (v) => (window.BSPVal?.escapeHtml
    ? window.BSPVal.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"'`/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
      }[c])));

  const fmtCOP = (n) => '$' + Number(n || 0).toLocaleString('es-CO') + ' COP';
  const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtFechaHora = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Control de acceso contra el SERVIDOR (mismo patrón que usuarios.controller.js).
  const sesion = await window.BSPSession.exigir(['Administrador']);
  if (!sesion) return;

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const modalOverlay      = document.getElementById('modal-overlay');
  const modalFactura       = document.getElementById('modal-factura');
  const btnCerrarFactura   = document.getElementById('btn-cerrar-factura');
  const btnFacturaCerrar   = document.getElementById('btn-factura-cerrar');
  const btnFacturaImprimir = document.getElementById('btn-factura-imprimir');
  const facturaContenido   = document.getElementById('dn-factura-contenido');

  const contTotal    = document.getElementById('cont-total-recaudado');
  const contTrans    = document.getElementById('cont-transacciones');
  const contPromedio = document.getElementById('cont-promedio');

  // ── Badges ────────────────────────────────────────────────────────────────
  function metodoBadge(metodo) {
    const map = {
      'PSE':     '<span class="badge badge-blue">PSE</span>',
      'Nequi':   '<span class="badge badge-amber">Nequi</span>',
      'Tarjeta': '<span class="badge badge-especialidad">Tarjeta</span>'
    };
    return map[metodo] || `<span class="badge">${esc(metodo)}</span>`;
  }

  function estadoBadge(estado) {
    const map = {
      'Aprobada':  '<span class="badge badge-green">Aprobada</span>',
      'Pendiente': '<span class="badge badge-amber">Pendiente</span>',
      'Rechazada': '<span class="badge badge-red">Rechazada</span>'
    };
    return map[estado] || `<span class="badge">${esc(estado)}</span>`;
  }

  // ── DataTable ─────────────────────────────────────────────────────────────
  let dtDonaciones = null;
  let cache = [];

  async function renderTabla() {
    cache = await DonacionesModel.getAll();
    const stats = await DonacionesModel.getEstadisticas();

    if (contTotal)    contTotal.textContent    = fmtCOP(stats.total);
    if (contTrans)    contTrans.textContent    = String(stats.cantidad);
    if (contPromedio) contPromedio.textContent = fmtCOP(stats.promedio);

    const data = cache.map(d => ({ ...d, montoFmt: fmtCOP(d.monto) }));

    function renderRow(d) {
      return `
        <div class="dt-row-donaciones">
          <div class="dn-cell-ref">
            <p class="dn-referencia">${esc(d.referencia)}</p>
            <p class="dn-fecha-sub">${esc(fmtFecha(d.creadoEn))}</p>
          </div>
          <div class="dn-cell-donante">
            <p class="dn-donante-nombre">${esc(d.nombre)}</p>
            <p class="dn-donante-correo">${esc(d.correo)}</p>
          </div>
          <span class="dt-c-metodo">${metodoBadge(d.metodo)}</span>
          <span class="dt-c-monto dn-monto">${esc(d.montoFmt)}</span>
          <span class="dt-c-proposito">${esc(d.proposito)}</span>
          <span class="dt-c-estado">${estadoBadge(d.estado)}</span>
          <div class="acciones-cell">
            <button class="btn-accion btn-ver" onclick="verFactura('${d.id}')" title="Ver factura"><i class="bx bx-receipt" aria-hidden="true"></i></button>
            <button class="btn-accion btn-eliminar" onclick="eliminarDonacion('${d.id}')" title="Eliminar"><i class="bx bx-trash" aria-hidden="true"></i></button>
          </div>
        </div>`;
    }

    if (!dtDonaciones) {
      dtDonaciones = new BSPDataTable({
        containerId:  'dt-donaciones',
        data,
        pageSize:     10,
        searchFields: ['referencia', 'nombre', 'correo', 'proposito'],
        filters: [
          { key: 'metodo', label: 'Método', type: 'select', options: DonacionesModel.METODOS },
          { key: 'estado', label: 'Estado', type: 'select', options: DonacionesModel.ESTADOS },
          { key: 'fecha',  label: 'Desde',  type: 'date-from' },
          { key: 'fecha',  label: 'Hasta',  type: 'date-to'   },
        ],
        renderRow,
        headerHTML: `
          <span>Referencia</span>
          <span>Donante</span>
          <span>Método</span>
          <span>Monto</span>
          <span>Propósito</span>
          <span>Estado</span>
          <span class="acciones-cell">Acciones</span>
        `,
        exportable:   true,
        exportName:   'donaciones',
        exportFields: ['referencia', 'nombre', 'correo', 'metodo', 'montoFmt', 'proposito', 'estado', 'fecha'],
        exportLabels: ['Referencia', 'Donante', 'Correo', 'Método', 'Monto', 'Propósito', 'Estado', 'Fecha'],
        emptyHTML: `<div class="dt-empty"><i class="bx bx-donate-heart" aria-hidden="true"></i><p>Aún no se han registrado donaciones.</p></div>`
      });
      window.__bspDT['dt-donaciones'] = dtDonaciones;
      dtDonaciones.init();
    } else {
      dtDonaciones.refresh(data);
    }
  }

  // ── Factura profesional ──────────────────────────────────────────────────
  window.verFactura = async function(id) {
    const d = cache.find(x => x.id === id);
    if (!d) return;

    facturaContenido.innerHTML = `
      <div class="dn-factura-header">
        <div class="dn-factura-marca">
          <img src="/Bajo-Su-Presencia/assets/images/logo.png" alt="Bajo Su Presencia" class="dn-factura-logo">
          <div>
            <p class="dn-factura-org">Bajo Su Presencia</p>
            <p class="dn-factura-org-sub">Comunidad de fe y servicio</p>
          </div>
        </div>
        <div class="dn-factura-num">
          <p class="dn-factura-num-label">Factura N.°</p>
          <p class="dn-factura-num-valor">${esc(d.referencia)}</p>
          <span class="dn-factura-anio">2026</span>
        </div>
      </div>

      <div class="dn-factura-meta">
        <div>
          <p class="dn-factura-meta-label">Facturado a</p>
          <p class="dn-factura-meta-valor">${esc(d.nombre)}</p>
          <p class="dn-factura-meta-valor">${esc(d.correo)}</p>
        </div>
        <div>
          <p class="dn-factura-meta-label">Fecha de emisión</p>
          <p class="dn-factura-meta-valor">${esc(fmtFechaHora(d.creadoEn))}</p>
          <p class="dn-factura-meta-label" style="margin-top:0.5rem;">Estado</p>
          <p class="dn-factura-meta-valor">${estadoBadge(d.estado)}</p>
        </div>
      </div>

      <table class="dn-factura-tabla">
        <thead>
          <tr><th>Concepto</th><th>Método</th><th>Valor</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Donación — ${esc(d.proposito)}</td>
            <td>${esc(d.metodo)}</td>
            <td>${esc(fmtCOP(d.monto))}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="2">Total</td><td>${esc(fmtCOP(d.monto))}</td></tr>
        </tfoot>
      </table>

      <p class="dn-factura-legal">
        Esta donación fue realizada de forma voluntaria y no constituye la compra de bienes o servicios.
        Documento generado automáticamente por el sistema de Bajo Su Presencia como constancia de la transacción.
      </p>
    `;

    BSPModal.abrir({ overlay: modalOverlay, modal: modalFactura });
  };

  function cerrarFactura() {
    BSPModal.cerrar({ overlay: modalOverlay, modal: modalFactura });
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  window.eliminarDonacion = async function(id) {
    const d = cache.find(x => x.id === id);
    if (!d) return;

    showAlertConfirm(
      'Eliminar donación',
      `¿Eliminar la transacción "${d.referencia}" de ${d.nombre}? Esta acción no se puede deshacer.`,
      async function() {
        const res = await DonacionesModel.eliminar(id);
        if (!res.ok) { showAlertError(res.error); return; }
        await renderTabla();
        showAlertSuccess(`La transacción "${d.referencia}" fue eliminada.`);
      }
    );
  };

  // ── Event listeners ──────────────────────────────────────────────────────
  btnCerrarFactura.addEventListener('click', cerrarFactura);
  btnFacturaCerrar.addEventListener('click', cerrarFactura);
  btnFacturaImprimir.addEventListener('click', () => window.print());
  modalOverlay.addEventListener('click', cerrarFactura);

  // ── Render inicial ────────────────────────────────────────────────────────
  renderTabla();
});
