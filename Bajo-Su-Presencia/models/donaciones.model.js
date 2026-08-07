/**
 * ============================================================
 * MODELO: donaciones.model.js  (Supabase, vía Data Gateway PHP)
 * ============================================================
 * Lectura y eliminación del historial de donaciones sobre public.donaciones.
 * La ESCRITURA (creación) la hace el backend PHP directamente al procesar
 * el pago (DonacionesController::store) — este modelo no crea donaciones,
 * solo las lista y las elimina desde el panel admin.
 *
 * Requiere window.DB (services/db.client.js → Data Gateway PHP) y una
 * sesión iniciada con rol Administrador.
 * ============================================================
 */

const DonacionesModel = (() => {

  const TABLA = 'donaciones';
  const METODOS = ['PSE', 'Nequi', 'Tarjeta'];
  const ESTADOS = ['Aprobada', 'Pendiente', 'Rechazada'];

  function _fromRow(r) {
    return {
      id:          r.id,
      referencia:  r.referencia || '',
      correo:      r.correo || '',
      nombre:      r.nombre || 'Donante anónimo',
      metodo:      r.metodo || '',
      monto:       Number(r.monto) || 0,
      proposito:   r.proposito || 'General',
      estado:      r.estado || 'Aprobada',
      creadoEn:    r.creado_en || '',
      fecha:       (r.creado_en || '').toString().slice(0, 10)
    };
  }

  function _msg(error) { return DB.mensajeError(error); }

  async function getAll() {
    const { data, error } = await DB.from(TABLA).select('*').order('creado_en', { ascending: false });
    if (error) { (window.BSPLog ? window.BSPLog.error('DonacionesModel.getAll', error) : console.error('DonacionesModel.getAll')); return []; }
    return (data || []).map(_fromRow);
  }

  async function getById(id) {
    const { data, error } = await DB.from(TABLA).select('*').eq('id', id).single();
    if (error || !data) return null;
    return _fromRow(data);
  }

  async function eliminar(id) {
    const { error } = await DB.from(TABLA).delete().eq('id', id);
    if (error) return { ok: false, error: _msg(error) };
    return { ok: true };
  }

  async function getEstadisticas() {
    const lista = await getAll();
    const total = lista.reduce((acc, d) => acc + d.monto, 0);
    return {
      total,
      cantidad:  lista.length,
      promedio:  lista.length ? Math.round(total / lista.length) : 0
    };
  }

  return { getAll, getById, eliminar, getEstadisticas, METODOS, ESTADOS };

})();
