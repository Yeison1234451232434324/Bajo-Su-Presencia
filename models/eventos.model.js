/**
 * ============================================================
 * MODELO: eventos.model.js
 * ============================================================
 * Gestiona el almacenamiento de eventos publicados usando
 * localStorage como base de datos simulada.
 *
 * Cada evento guarda:
 *   - id, titulo, fecha, horario, ubicacion, asistentes, descripcion
 *   - recursos: array de { recursoId, recursoNombre, cantidad, unidad }
 *     (los recursos se toman del inventario en RecursosModel)
 *
 * Clave de almacenamiento: bsp_eventos_publicados
 * ============================================================
 */

const EventosModel = (() => {

  const KEY = 'bsp_eventos_publicados';

  // ── Datos de ejemplo para que la lista no arranque vacía ─────────────────
  const DEFAULT = [
    {
      id:          1,
      titulo:      'Culto Dominical',
      fecha:       '2026-05-18',
      horario:     '10:00 AM - 12:00 PM',
      ubicacion:   'Sede Principal',
      asistentes:  '300',
      voluntariosNecesarios: 8,
      descripcion: 'Culto dominical de adoración y predicación.',
      // Recursos asignados al momento de publicar el evento
      recursos: [
        { recursoId: 1, recursoNombre: 'Sillas plegables',      cantidad: 100, unidad: 'unidades' },
        { recursoId: 3, recursoNombre: 'Micrófonos inalámbricos', cantidad: 4,  unidad: 'unidades' }
      ],
      publicado: '2026-05-10'
    },
    {
      id:          2,
      titulo:      'Encuentro Juvenil',
      fecha:       '2026-05-23',
      horario:     '6:00 PM - 9:00 PM',
      ubicacion:   'Auditorio',
      asistentes:  '150',
      voluntariosNecesarios: 5,
      descripcion: 'Noche de alabanza y comunión para jóvenes.',
      recursos: [
        { recursoId: 1, recursoNombre: 'Sillas plegables',  cantidad: 80, unidad: 'unidades' },
        { recursoId: 4, recursoNombre: 'Proyector Full HD', cantidad: 1,  unidad: 'unidades' },
        { recursoId: 8, recursoNombre: 'Reflectores LED',   cantidad: 4,  unidad: 'unidades' }
      ],
      publicado: '2026-05-12'
    }
  ];

  // ── Inicializar si no existe ─────────────────────────────────────────────
  function _init() {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    }
  }

  /** Devuelve todos los eventos publicados */
  function getAll() {
    _init();
    return JSON.parse(localStorage.getItem(KEY));
  }

  /** Devuelve un evento por ID */
  function getById(id) {
    return getAll().find(e => e.id === id) || null;
  }

  /**
   * Publica (guarda) un nuevo evento con sus recursos asignados.
   * @param {object} data - campos del formulario + array recursos
   * @returns {{ ok: boolean, evento?: object, error?: string }}
   */
  function publicar(data) {
    if (!data.titulo?.trim())    return { ok: false, error: 'El título es obligatorio.' };
    if (!data.fecha)             return { ok: false, error: 'La fecha es obligatoria.' };
    if (!data.horario?.trim())   return { ok: false, error: 'El horario es obligatorio.' };
    if (!data.ubicacion?.trim()) return { ok: false, error: 'La ubicación es obligatoria.' };

    const eventos = getAll();

    const nuevo = {
      id:                    Date.now(),
      titulo:                data.titulo.trim(),
      fecha:                 data.fecha,
      horario:               data.horario.trim(),
      ubicacion:             data.ubicacion.trim(),
      asistentes:            data.asistentes?.trim() || '—',
      // Número de voluntarios que el admin indica que necesita para el evento
      voluntariosNecesarios: parseInt(data.voluntariosNecesarios) || 0,
      descripcion:           data.descripcion?.trim() || '',
      recursos:              data.recursos || [],
      publicado:             new Date().toISOString().split('T')[0]
    };

    eventos.push(nuevo);
    localStorage.setItem(KEY, JSON.stringify(eventos));

    // ── Sincronizar con bsp_eventos_vol (usado por voluntarios y recursos) ──
    // Agrega el nuevo evento a la lista de eventos de voluntarios para que
    // aparezca disponible en los módulos de calificación y asignación de recursos.
    _sincronizarConEventosVol(nuevo);

    return { ok: true, evento: nuevo };
  }

  /**
   * Sincroniza el evento recién publicado con la colección bsp_eventos_vol
   * que usan los módulos de voluntarios y recursos.
   * Si ya existe un evento con el mismo id, no lo duplica.
   */
  function _sincronizarConEventosVol(evento) {
    const KEY_VOL = 'bsp_eventos_vol';
    let eventosVol = [];

    try {
      eventosVol = JSON.parse(localStorage.getItem(KEY_VOL) || '[]');
    } catch (_) {
      eventosVol = [];
    }

    // Solo agregar si no existe ya
    if (!eventosVol.find(e => e.id === evento.id)) {
      eventosVol.push({
        id:                    evento.id,
        nombre:                evento.titulo,
        fecha:                 evento.fecha,
        lugar:                 evento.ubicacion,
        // Guardar cuántos voluntarios necesita este evento
        // para que el módulo del voluntario pueda mostrarlo
        voluntariosNecesarios: evento.voluntariosNecesarios || 0,
        voluntarios:           []
      });
      localStorage.setItem(KEY_VOL, JSON.stringify(eventosVol));
    }
  }

  /** Elimina un evento publicado */
  function eliminar(id) {
    const eventos = getAll().filter(e => e.id !== id);
    localStorage.setItem(KEY, JSON.stringify(eventos));
    return { ok: true };
  }

  // ── API pública ──────────────────────────────────────────────────────────
  return { getAll, getById, publicar, eliminar };

})();
