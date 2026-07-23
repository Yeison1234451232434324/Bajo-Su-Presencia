/**
 * ================================================================
 *  MÓDULO DE AYUDA Y SOPORTE — Bajo Su Presencia
 * ================================================================
 *  El contenido se filtra automáticamente según el rol del usuario
 *  logueado (localStorage 'usuarioLogueado'):
 *    - Administrador → ve todo (6 categorías, 18 artículos)
 *    - Colaborador   → ve solo lo que puede hacer (5 categorías)
 *    - Voluntario    → ve solo su contexto (3 categorías)
 *
 *  Cómo se integra:
 *    Añade al final de cada página, antes de </body>:
 *    <script src="../../../controllers/ayuda.controller.js"></script>
 * ================================================================
 */

/* ═══════════════════════════════════════════════════════════════
   1. LECTURA DEL ROL — fuente: localStorage 'usuarioLogueado'
   ═══════════════════════════════════════════════════════════════ */
function _bspGetRol() {
  try {
    const data = localStorage.getItem('usuarioLogueado');
    if (data) return JSON.parse(data).rol || 'Administrador';
  } catch (_) {}
  return 'Administrador';
}

const ROL = _bspGetRol();

/* ═══════════════════════════════════════════════════════════════
   2. BASE DE CONOCIMIENTO — estructura filtrada por rol.

   roles: array de strings que indica qué roles ven ese ítem.
   Roles válidos: 'Administrador', 'Colaborador', 'Voluntario'
   ═══════════════════════════════════════════════════════════════ */
const BSP_AYUDA_DATA = [

  /* ── CATEGORÍA: Primeros Pasos ──────────────────────────────── */
  {
    id: 'inicio',
    categoria: 'Primeros Pasos',
    icono: 'bx-rocket',
    colorBg: '#dbeafe',
    colorStroke: '#1E3A8A',
    roles: ['Administrador', 'Colaborador', 'Voluntario'],
    preguntas: [
      {
        id: 'q-01',
        pregunta: '¿Cómo inicio sesión en el sistema?',
        respuesta: 'Ve a la pantalla de inicio e ingresa tu <strong>nombre de usuario</strong>, <strong>correo</strong> y <strong>contraseña</strong>. Si olvidaste la contraseña, usa el enlace "Recuperar contraseña" que aparece debajo del formulario.',
        roles: ['Administrador', 'Colaborador', 'Voluntario']
      },
      {
        id: 'q-02',
        pregunta: '¿Qué puede hacer cada rol en el sistema?',
        respuesta: '<strong>Administrador:</strong> acceso completo — gestiona usuarios, eventos, noticias, sedes, recursos, reportes y PQR.<br><strong>Colaborador:</strong> publica eventos, noticias y oraciones, sube reportes y gestiona actividades.<br><strong>Voluntario:</strong> consulta sus calificaciones, registra su disponibilidad y revisa sus actividades asignadas.',
        roles: ['Administrador']
      },
      {
        id: 'q-02b',
        pregunta: '¿Qué módulos tengo disponibles como Colaborador?',
        respuesta: 'Como Colaborador puedes: <strong>Publicar Eventos</strong>, publicar la <strong>Oración del Día</strong>, publicar <strong>Noticias</strong>, gestionar <strong>Actividades</strong> y <strong>Subir Reportes</strong>. Si necesitas acceso a otro módulo, contacta al Administrador.',
        roles: ['Colaborador']
      },
      {
        id: 'q-02c',
        pregunta: '¿Qué módulos tengo disponibles como Voluntario?',
        respuesta: 'Como Voluntario tienes acceso a tres secciones: <strong>Mis Calificaciones</strong> (ver tu desempeño), <strong>Mi Disponibilidad</strong> (indicar cuándo puedes servir) y <strong>Mis Actividades</strong> (ver las tareas asignadas).',
        roles: ['Voluntario']
      },
      {
        id: 'q-03',
        pregunta: '¿Qué hago si no puedo acceder a mi cuenta?',
        respuesta: 'Verifica que tu nombre de usuario, correo y contraseña sean correctos. Si el problema persiste, contacta al Administrador a través del formulario de soporte de este panel o mediante el módulo PQR.',
        roles: ['Administrador', 'Colaborador', 'Voluntario']
      }
    ]
  },

  /* ── CATEGORÍA: Eventos y Actividades ──────────────────────── */
  {
    id: 'eventos',
    categoria: 'Eventos y Actividades',
    icono: 'bx-calendar-event',
    colorBg: '#fef3c7',
    colorStroke: '#d97706',
    roles: ['Administrador', 'Colaborador'],
    preguntas: [
      {
        id: 'q-04',
        pregunta: '¿Cómo creo un nuevo evento?',
        respuesta: 'Ve a <strong>"Publicar Evento"</strong> en el menú lateral. Completa título, descripción, fecha y sede. Haz clic en "Publicar" para que el evento sea visible en la comunidad.',
        roles: ['Administrador', 'Colaborador']
      },
      {
        id: 'q-05',
        pregunta: '¿Puedo editar o eliminar un evento publicado?',
        respuesta: 'Sí. En la lista de eventos, cada fila tiene botones de <strong>editar</strong> (lápiz) y <strong>eliminar</strong> (papelera). Confirma la acción en el diálogo que aparece.',
        roles: ['Administrador', 'Colaborador']
      },
      {
        id: 'q-06a',
        pregunta: '¿Cómo gestiono las actividades del sistema?',
        respuesta: 'Ve a <strong>"Actividades"</strong> en el menú. Puedes crear actividades, asignarlas a voluntarios y hacer seguimiento del estado de cada una desde la tabla principal.',
        roles: ['Administrador', 'Colaborador']
      }
    ]
  },

  /* ── CATEGORÍA: Mi Disponibilidad y Actividades (Voluntario) ─ */
  {
    id: 'voluntario-trabajo',
    categoria: 'Mi Disponibilidad y Actividades',
    icono: 'bx-time-five',
    colorBg: '#fce7f3',
    colorStroke: '#db2777',
    roles: ['Voluntario'],
    preguntas: [
      {
        id: 'q-vol-01',
        pregunta: '¿Cómo registro mi disponibilidad?',
        respuesta: 'Ve a <strong>"Mi Disponibilidad"</strong> en el menú lateral. Selecciona los días y franjas horarias en que puedes servir y guarda los cambios. El coordinador verá esta información al asignarte actividades.',
        roles: ['Voluntario']
      },
      {
        id: 'q-vol-02',
        pregunta: '¿Cómo veo las actividades que me han asignado?',
        respuesta: 'En <strong>"Mis Actividades"</strong> aparece la lista de tareas asignadas a ti, con su fecha, descripción y estado. Puedes marcar actividades como completadas desde esa misma vista.',
        roles: ['Voluntario']
      },
      {
        id: 'q-vol-03',
        pregunta: '¿Dónde veo mis calificaciones y evaluaciones?',
        respuesta: 'En <strong>"Mis Calificaciones"</strong> puedes ver la valoración que el equipo ha dado a tu desempeño en cada actividad, incluyendo observaciones del coordinador.',
        roles: ['Voluntario']
      }
    ]
  },

  /* ── CATEGORÍA: Noticias y Contenido ───────────────────────── */
  {
    id: 'noticias',
    categoria: 'Noticias y Contenido',
    icono: 'bx-news',
    colorBg: '#d1fae5',
    colorStroke: '#059669',
    roles: ['Administrador', 'Colaborador'],
    preguntas: [
      {
        id: 'q-07',
        pregunta: '¿Cómo publico una noticia?',
        respuesta: 'Ve a <strong>"Publicar Noticia"</strong> en el menú. Escribe el título y contenido, adjunta una imagen si lo deseas y haz clic en "Publicar".',
        roles: ['Administrador', 'Colaborador']
      },
      {
        id: 'q-07b',
        pregunta: '¿Cómo publico la Oración del Día?',
        respuesta: 'Ve a <strong>"Oración del Día"</strong> en el menú. Escribe el texto de la oración, una referencia bíblica opcional, y haz clic en "Publicar". Solo se muestra una oración activa a la vez.',
        roles: ['Administrador', 'Colaborador']
      },
      {
        id: 'q-08',
        pregunta: '¿Dónde aparece el contenido publicado?',
        respuesta: 'Las noticias y oraciones aparecen en el panel principal y en el <strong>Dashboard</strong> como resumen del contenido publicado este mes.',
        roles: ['Administrador', 'Colaborador']
      }
    ]
  },

  /* ── CATEGORÍA: Reportes ────────────────────────────────────── */
  {
    id: 'reportes',
    categoria: 'Reportes y Estadísticas',
    icono: 'bx-bar-chart-alt-2',
    colorBg: '#fce7f3',
    colorStroke: '#db2777',
    roles: ['Administrador', 'Colaborador'],
    preguntas: [
      {
        id: 'q-rep-01',
        pregunta: '¿Cómo subo un reporte de actividad?',
        respuesta: 'Ve a <strong>"Subir Reporte"</strong> en el menú lateral. Selecciona el archivo, completa los campos requeridos y haz clic en "Subir". El reporte quedará disponible para revisión del Administrador.',
        roles: ['Administrador', 'Colaborador']
      },
      {
        id: 'q-11',
        pregunta: '¿Cómo genero reportes consolidados del sistema?',
        respuesta: 'Ve a <strong>"Generar Reportes"</strong> (solo Administrador). Selecciona rango de fechas y tipo de reporte (miembros, eventos, voluntarios). Haz clic en "Exportar" para descargar el archivo.',
        roles: ['Administrador']
      },
      {
        id: 'q-12',
        pregunta: '¿Qué información muestra el Dashboard?',
        respuesta: 'El Dashboard muestra métricas clave: miembros activos, eventos del mes, noticias, oraciones, voluntarios, asistencia promedio y <strong>gráficas de crecimiento</strong> de los últimos 6 meses.',
        roles: ['Administrador']
      }
    ]
  },

  /* ── CATEGORÍA: PQR y Comunicación ─────────────────────────── */
  {
    id: 'pqr',
    categoria: 'PQR y Comunicación',
    icono: 'bx-message-detail',
    colorBg: '#ede9fe',
    colorStroke: '#7c3aed',
    roles: ['Administrador', 'Colaborador', 'Voluntario'],
    preguntas: [
      {
        id: 'q-09',
        pregunta: '¿Qué es un PQR y para qué sirve?',
        respuesta: '<strong>PQR</strong> son Peticiones, Quejas y Reclamos. Usa este canal para comunicarte formalmente con el equipo de administración. Tu solicitud quedará registrada y recibirás seguimiento.',
        roles: ['Administrador', 'Colaborador', 'Voluntario']
      },
      {
        id: 'q-10',
        pregunta: '¿Cómo reviso y gestiono las PQR recibidas?',
        respuesta: 'Ve a <strong>"PQR"</strong> en el menú del Administrador para ver todas las solicitudes, filtrarlas por estado (pendiente, en proceso, resuelto) y actualizar cada caso.',
        roles: ['Administrador']
      }
    ]
  },

  /* ── CATEGORÍA: Gestión Administrativa (solo Admin) ─────────── */
  {
    id: 'admin-gestion',
    categoria: 'Gestión Administrativa',
    icono: 'bx-shield',
    colorBg: '#dbeafe',
    colorStroke: '#1E3A8A',
    roles: ['Administrador'],
    preguntas: [
      {
        id: 'q-adm-01',
        pregunta: '¿Cómo creo o edito un usuario del sistema?',
        respuesta: 'Ve a <strong>"Gestión de Usuarios"</strong>. Haz clic en "Nuevo Usuario", completa nombre, username, email, rol y contraseña. Para editar, usa el botón de lápiz en la fila del usuario.',
        roles: ['Administrador']
      },
      {
        id: 'q-adm-02',
        pregunta: '¿Cómo califico el desempeño de un voluntario?',
        respuesta: 'Ve a <strong>"Calificar Voluntarios"</strong> en el menú. Selecciona el voluntario, asigna una puntuación y escribe observaciones. El voluntario podrá ver su evaluación desde su panel.',
        roles: ['Administrador']
      },
      {
        id: 'q-adm-03',
        pregunta: '¿Cómo gestiono las sedes de la comunidad?',
        respuesta: 'En <strong>"Gestión de Sedes"</strong> puedes crear, editar y eliminar sedes. Cada sede tiene nombre, dirección y capacidad. Las sedes aparecen como opciones al crear eventos.',
        roles: ['Administrador']
      },
      {
        id: 'q-adm-04',
        pregunta: '¿Cómo gestiono los recursos disponibles?',
        respuesta: 'En <strong>"Gestión de Recursos"</strong> registra equipos, materiales y espacios. Asígnalos a eventos o actividades para llevar un control preciso del inventario de la comunidad.',
        roles: ['Administrador']
      }
    ]
  }
];


/* ═══════════════════════════════════════════════════════════════
   3. FILTRADO — devuelve solo las categorías y preguntas
      que aplican al rol del usuario actual.
   ═══════════════════════════════════════════════════════════════ */
function _bspFilterData(rol) {
  return BSP_AYUDA_DATA
    .filter(cat => cat.roles.includes(rol))
    .map(cat => ({
      ...cat,
      preguntas: cat.preguntas.filter(q => q.roles.includes(rol))
    }))
    .filter(cat => cat.preguntas.length > 0);
}

const DATA_ROL = _bspFilterData(ROL);


/* ═══════════════════════════════════════════════════════════════
   4. INYECCIÓN DE ESTILOS
   ═══════════════════════════════════════════════════════════════ */
function _bspInjectStyles() {
  if (document.getElementById('bsp-ayuda-styles')) return;

  const css = `
    .bsp-ayuda-widget,
    .bsp-ayuda-fab {
      --bsp-primary:       var(--primary,       #1E3A8A);
      --bsp-primary-dark:  var(--primary-dark,  #0F1E5A);
      --bsp-primary-light: var(--primary-light, #2D4FAF);
      --bsp-accent:        var(--accent,        #F5C215);
      --bsp-amber:         var(--amber,         #d97706);
      --bsp-bg:            var(--bg,            #faf8f3);
      --bsp-border:        var(--border,        #e5e1d8);
      --bsp-muted:         var(--muted,         #6b7280);
      --bsp-font-title:    var(--font-title,    'Cormorant Garamond', serif);
      --bsp-font-text:     var(--font-text,     'Crimson Text', serif);
      --bsp-shadow:        0 8px 32px rgba(15,30,90,0.18);
      --bsp-drawer-w:      380px;
      --bsp-transition:    0.35s cubic-bezier(0.4,0,0.2,1);
    }

    /* FAB */
    .bsp-ayuda-fab {
      position: fixed; bottom: 1.75rem; right: 1.75rem;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, var(--bsp-primary-dark), var(--bsp-primary-light));
      color: #fff; border: none; cursor: pointer;
      box-shadow: var(--bsp-shadow);
      display: flex; align-items: center; justify-content: center;
      z-index: 9998; transition: transform 0.2s, box-shadow 0.2s; outline: none;
    }
    .bsp-ayuda-fab:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 12px 40px rgba(15,30,90,0.28); }
    .bsp-ayuda-fab:focus-visible { outline: 3px solid var(--bsp-accent); outline-offset: 3px; }
    .bsp-ayuda-fab i { font-size: 1.65rem; transition: transform var(--bsp-transition); }
    .bsp-ayuda-fab.is-open i { transform: rotate(90deg); }
    .bsp-ayuda-fab::before {
      content: '¿Necesitas ayuda?';
      position: absolute; right: calc(100% + 0.75rem);
      background: var(--bsp-primary-dark); color: #fff;
      font-family: var(--bsp-font-text); font-size: 0.85rem; font-weight: 600;
      white-space: nowrap; padding: 0.35rem 0.8rem; border-radius: 2rem;
      opacity: 0; pointer-events: none;
      transform: translateX(6px); transition: opacity 0.2s, transform 0.2s;
    }
    .bsp-ayuda-fab:hover::before { opacity: 1; transform: translateX(0); }

    /* Overlay */
    .bsp-ayuda-overlay {
      position: fixed; inset: 0;
      background: rgba(15,30,90,0.35); backdrop-filter: blur(2px);
      z-index: 9999; opacity: 0; pointer-events: none;
      transition: opacity var(--bsp-transition);
    }
    .bsp-ayuda-overlay.is-visible { opacity: 1; pointer-events: auto; }

    /* Drawer */
    .bsp-ayuda-widget {
      position: fixed; top: 0; right: 0; height: 100vh;
      width: var(--bsp-drawer-w); max-width: 95vw;
      z-index: 10000; display: flex; flex-direction: column;
      background: var(--bsp-bg);
      box-shadow: -4px 0 40px rgba(15,30,90,0.20);
      transform: translateX(100%);
      transition: transform var(--bsp-transition);
      border-left: 2px solid var(--bsp-border); overflow: hidden;
    }
    .bsp-ayuda-widget.is-open { transform: translateX(0); }

    /* Cabecera */
    .bsp-drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem 1rem;
      background: linear-gradient(135deg, var(--bsp-primary-dark), var(--bsp-primary));
      flex-shrink: 0;
    }
    .bsp-drawer-header-left { display: flex; align-items: center; gap: 0.65rem; }
    .bsp-drawer-header-left i { font-size: 1.5rem; color: var(--bsp-accent); }
    .bsp-drawer-header h2 {
      font-family: var(--bsp-font-title); font-size: 1.3rem; font-weight: 700;
      color: #fff; margin: 0; line-height: 1.2;
    }
    .bsp-drawer-header p { font-size: 0.8rem; color: rgba(255,255,255,0.65); margin: 0.1rem 0 0; }

    /* Badge de rol */
    .bsp-rol-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      background: rgba(245,194,21,0.2); border: 1px solid rgba(245,194,21,0.4);
      border-radius: 2rem; padding: 0.15rem 0.6rem;
      font-family: var(--bsp-font-text); font-size: 0.75rem; font-weight: 600;
      color: var(--bsp-accent); margin-top: 0.25rem;
    }
    .bsp-rol-badge i { font-size: 0.8rem; }

    .bsp-close-btn {
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
      color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s; flex-shrink: 0;
    }
    .bsp-close-btn:hover { background: rgba(255,255,255,0.22); }
    .bsp-close-btn:focus-visible { outline: 3px solid var(--bsp-accent); outline-offset: 2px; }
    .bsp-close-btn i { font-size: 1.1rem; }

    /* Cuerpo scrollable */
    .bsp-drawer-body {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      scrollbar-width: thin; scrollbar-color: var(--bsp-border) transparent;
    }
    .bsp-drawer-body::-webkit-scrollbar { width: 4px; }
    .bsp-drawer-body::-webkit-scrollbar-thumb { background: var(--bsp-border); border-radius: 4px; }

    /* Pantallas */
    .bsp-screen { display: none; flex-direction: column; height: 100%; }
    .bsp-screen.is-active { display: flex; }

    /* Búsqueda */
    .bsp-search-wrap { padding: 1rem 1.25rem 0.75rem; position: relative; }
    .bsp-search-wrap i {
      position: absolute; left: 1.9rem; top: 50%; transform: translateY(-50%);
      color: var(--bsp-muted); font-size: 1.1rem; pointer-events: none;
    }
    .bsp-search-input {
      width: 100%; padding: 0.65rem 0.9rem 0.65rem 2.4rem;
      border: 2px solid var(--bsp-border); border-radius: 2rem;
      background: #fff; font-family: var(--bsp-font-text); font-size: 1rem;
      color: #1a1a2e; transition: border-color 0.2s; outline: none;
    }
    .bsp-search-input:focus { border-color: var(--bsp-primary-light); }
    .bsp-search-input::placeholder { color: var(--bsp-muted); }

    /* Separador de categoría */
    .bsp-cat-sep {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.6rem 1.25rem 0.3rem;
    }
    .bsp-cat-sep-icon {
      width: 22px; height: 22px; border-radius: 0.35rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .bsp-cat-sep-icon i { font-size: 0.85rem; }
    .bsp-cat-sep-label {
      font-family: var(--bsp-font-text); font-size: 0.72rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em; color: var(--bsp-muted);
    }

    /* Acordeón */
    .bsp-faq-section { padding: 0 1.25rem 0.5rem; }
    .bsp-faq-label {
      font-family: var(--bsp-font-text); font-size: 0.75rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--bsp-muted); margin-bottom: 0.65rem;
    }
    .bsp-accordion { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .bsp-acc-item {
      border: 1.5px solid var(--bsp-border); border-radius: 0.65rem;
      background: #fff; overflow: hidden; transition: border-color 0.2s;
    }
    .bsp-acc-item:hover { border-color: #c7d2e8; }
    .bsp-acc-item.is-open { border-color: var(--bsp-primary-light); }
    .bsp-acc-trigger {
      width: 100%; background: none; border: none; padding: 0.75rem 1rem;
      text-align: left; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      font-family: var(--bsp-font-text); font-size: 0.97rem; font-weight: 600;
      color: #1a1a2e; line-height: 1.35;
    }
    .bsp-acc-trigger:focus-visible { outline: 2px solid var(--bsp-primary-light); outline-offset: -2px; }
    .bsp-acc-chevron { flex-shrink: 0; font-size: 1.1rem; color: var(--bsp-muted); transition: transform 0.25s ease; }
    .bsp-acc-item.is-open .bsp-acc-chevron { transform: rotate(180deg); }
    .bsp-acc-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.28s ease; }
    .bsp-acc-item.is-open .bsp-acc-panel { grid-template-rows: 1fr; }
    .bsp-acc-inner { overflow: hidden; padding: 0 1rem; }
    .bsp-acc-item.is-open .bsp-acc-inner { padding-bottom: 0.85rem; }
    .bsp-acc-inner p { font-family: var(--bsp-font-text); font-size: 0.95rem; color: #374151; line-height: 1.6; margin: 0; }

    /* Sin resultados */
    .bsp-no-results {
      display: none; flex-direction: column; align-items: center;
      padding: 2rem 1rem; color: var(--bsp-muted);
      font-family: var(--bsp-font-text); font-size: 1rem; text-align: center; gap: 0.5rem;
    }
    .bsp-no-results i { font-size: 2rem; color: var(--bsp-border); }
    .bsp-no-results.is-visible { display: flex; }

    /* Acciones del panel principal */
    .bsp-main-actions {
      padding: 1rem 1.25rem 1.25rem;
      display: flex; flex-direction: column; gap: 0.6rem;
      margin-top: auto; flex-shrink: 0;
      border-top: 1.5px solid var(--bsp-border);
    }
    .bsp-contact-btn {
      width: 100%; padding: 0.75rem 1rem;
      background: linear-gradient(135deg, var(--bsp-primary-dark), var(--bsp-primary-light));
      color: #fff; border: none; border-radius: 0.65rem;
      font-family: var(--bsp-font-text); font-size: 1rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: opacity 0.2s, transform 0.2s;
    }
    .bsp-contact-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .bsp-contact-btn:focus-visible { outline: 3px solid var(--bsp-accent); outline-offset: 2px; }
    .bsp-helpcenter-link {
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      padding: 0.55rem 1rem; border: 1.5px solid var(--bsp-border); border-radius: 0.65rem;
      font-family: var(--bsp-font-text); font-size: 0.95rem; font-weight: 600;
      color: var(--bsp-primary); text-decoration: none; background: #fff;
      transition: background 0.2s, border-color 0.2s;
    }
    .bsp-helpcenter-link:hover { background: #f0f4ff; border-color: var(--bsp-primary-light); }

    /* Formulario */
    .bsp-form-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 1.25rem 0.5rem; flex-shrink: 0;
    }
    .bsp-back-btn {
      background: none; border: 1.5px solid var(--bsp-border); border-radius: 0.5rem;
      padding: 0.35rem 0.75rem; font-family: var(--bsp-font-text); font-size: 0.9rem;
      font-weight: 600; color: var(--bsp-primary); cursor: pointer;
      display: flex; align-items: center; gap: 0.3rem; transition: background 0.2s; flex-shrink: 0;
    }
    .bsp-back-btn:hover { background: #f0f4ff; }
    .bsp-back-btn:focus-visible { outline: 3px solid var(--bsp-primary-light); outline-offset: 2px; }
    .bsp-form-title {
      font-family: var(--bsp-font-title); font-size: 1.15rem; font-weight: 700;
      color: var(--bsp-primary-dark); margin: 0;
    }
    .bsp-support-form {
      padding: 0.5rem 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 1rem; overflow-y: auto;
    }
    .bsp-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .bsp-field label { font-family: var(--bsp-font-text); font-size: 0.9rem; font-weight: 600; color: #374151; }
    .bsp-field label .bsp-required { color: #ef4444; margin-left: 2px; }
    .bsp-field input,
    .bsp-field select,
    .bsp-field textarea {
      width: 100%; padding: 0.6rem 0.85rem;
      border: 2px solid var(--bsp-border); border-radius: 0.65rem;
      background: #fff; font-family: var(--bsp-font-text); font-size: 1rem;
      color: #1a1a2e; transition: border-color 0.2s; outline: none;
    }
    .bsp-field input:focus,
    .bsp-field select:focus,
    .bsp-field textarea:focus { border-color: var(--bsp-primary-light); }
    .bsp-field input.bsp-error,
    .bsp-field select.bsp-error,
    .bsp-field textarea.bsp-error { border-color: #ef4444; }
    .bsp-field-error { font-family: var(--bsp-font-text); font-size: 0.82rem; color: #ef4444; display: none; }
    .bsp-field-error.is-visible { display: block; }
    .bsp-field textarea { min-height: 110px; resize: vertical; }
    .bsp-char-count { font-family: var(--bsp-font-text); font-size: 0.78rem; color: var(--bsp-muted); text-align: right; }
    .bsp-submit-btn {
      width: 100%; padding: 0.8rem 1rem;
      background: linear-gradient(135deg, var(--bsp-primary-dark), var(--bsp-primary-light));
      color: #fff; border: none; border-radius: 0.65rem;
      font-family: var(--bsp-font-text); font-size: 1rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: opacity 0.2s, transform 0.2s; margin-top: 0.5rem;
    }
    .bsp-submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .bsp-submit-btn:focus-visible { outline: 3px solid var(--bsp-accent); outline-offset: 2px; }
    .bsp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    /* Éxito */
    .bsp-form-success {
      display: none; flex-direction: column; align-items: center;
      justify-content: center; text-align: center;
      padding: 2.5rem 1.5rem; gap: 1rem; flex: 1;
    }
    .bsp-form-success.is-visible { display: flex; }
    .bsp-success-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      display: flex; align-items: center; justify-content: center;
    }
    .bsp-success-icon i { font-size: 2rem; color: #059669; }
    .bsp-form-success h3 {
      font-family: var(--bsp-font-title); font-size: 1.4rem; font-weight: 700;
      color: var(--bsp-primary-dark); margin: 0;
    }
    .bsp-form-success p { font-family: var(--bsp-font-text); font-size: 1rem; color: var(--bsp-muted); margin: 0; line-height: 1.6; }
    .bsp-success-back-btn {
      padding: 0.65rem 1.5rem; background: var(--bsp-bg);
      border: 1.5px solid var(--bsp-border); border-radius: 2rem;
      font-family: var(--bsp-font-text); font-size: 0.95rem; font-weight: 600;
      color: var(--bsp-primary); cursor: pointer; transition: background 0.2s;
    }
    .bsp-success-back-btn:hover { background: #e8edf8; }

    /* Responsive: móvil */
    @media (max-width: 480px) {
      .bsp-ayuda-widget {
        width: 100vw; border-left: none;
        border-top: 2px solid var(--bsp-border); border-radius: 1rem 1rem 0 0;
        height: 92vh; top: auto; bottom: 0; transform: translateY(100%);
      }
      .bsp-ayuda-widget.is-open { transform: translateY(0); }
      .bsp-ayuda-fab { bottom: 1.25rem; right: 1.25rem; }
    }
  `;

  const style = document.createElement('style');
  style.id = 'bsp-ayuda-styles';
  style.textContent = css;
  document.head.appendChild(style);
}


/* ═══════════════════════════════════════════════════════════════
   5. CONSTRUCCIÓN DEL HTML DEL WIDGET — con contenido filtrado
   ═══════════════════════════════════════════════════════════════ */
function _bspGetRolIcon(rol) {
  const icons = { Administrador: 'bx-shield', Colaborador: 'bx-user-check', Voluntario: 'bx-heart' };
  return icons[rol] || 'bx-user';
}

function _bspBuildAccordionHTML(data) {
  let html = '';
  data.forEach(cat => {
    html += `
      <div class="bsp-cat-sep" aria-hidden="true">
        <div class="bsp-cat-sep-icon" style="background:${cat.colorBg}">
          <i class="bx ${cat.icono}" style="color:${cat.colorStroke}"></i>
        </div>
        <span class="bsp-cat-sep-label">${cat.categoria}</span>
      </div>`;
    cat.preguntas.forEach(q => {
      html += `
        <li class="bsp-acc-item"
            data-search="${(cat.categoria + ' ' + q.pregunta + ' ' + q.respuesta).toLowerCase().replace(/<[^>]+>/g,'')}">
          <button class="bsp-acc-trigger"
                  aria-expanded="false"
                  aria-controls="bsp-panel-${q.id}"
                  id="bsp-trigger-${q.id}">
            <span>${q.pregunta}</span>
            <i class="bx bx-chevron-down bsp-acc-chevron" aria-hidden="true"></i>
          </button>
          <div class="bsp-acc-panel" id="bsp-panel-${q.id}"
               role="region" aria-labelledby="bsp-trigger-${q.id}">
            <div class="bsp-acc-inner"><p>${q.respuesta}</p></div>
          </div>
        </li>`;
    });
  });
  return html;
}

function _bspInjectWidget() {
  if (document.getElementById('bsp-ayuda-widget')) return;

  const totalPreguntas = DATA_ROL.reduce((sum, cat) => sum + cat.preguntas.length, 0);
  const rolIcon        = _bspGetRolIcon(ROL);
  const accordionItems = _bspBuildAccordionHTML(DATA_ROL);

  const html = `
    <div class="bsp-ayuda-overlay" id="bsp-ayuda-overlay" aria-hidden="true"></div>

    <button class="bsp-ayuda-fab" id="bsp-ayuda-fab"
            aria-label="Abrir Centro de Ayuda"
            aria-expanded="false" aria-controls="bsp-ayuda-widget">
      <i class="bx bx-help-circle" aria-hidden="true"></i>
    </button>

    <aside class="bsp-ayuda-widget" id="bsp-ayuda-widget"
           aria-label="Centro de Ayuda" aria-hidden="true">

      <!-- Cabecera -->
      <div class="bsp-drawer-header">
        <div class="bsp-drawer-header-left">
          <i class="bx bx-church" aria-hidden="true"></i>
          <div>
            <h2 id="bsp-ayuda-title">Centro de Ayuda</h2>
            <p>Bajo Su Presencia</p>
            <span class="bsp-rol-badge">
              <i class="bx ${rolIcon}" aria-hidden="true"></i>
              ${ROL}
            </span>
          </div>
        </div>
        <button class="bsp-close-btn" id="bsp-close-btn"
                aria-label="Cerrar panel de ayuda">
          <i class="bx bx-x" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Cuerpo -->
      <div class="bsp-drawer-body" id="bsp-drawer-body">

        <!-- ░ PANTALLA PRINCIPAL ░ -->
        <div class="bsp-screen is-active" id="bsp-screen-main"
             role="tabpanel" aria-labelledby="bsp-ayuda-title">

          <div class="bsp-search-wrap">
            <i class="bx bx-search" aria-hidden="true"></i>
            <input type="search" class="bsp-search-input" id="bsp-search-input"
                   placeholder="Buscar entre ${totalPreguntas} artículos…"
                   aria-label="Buscar en preguntas frecuentes" autocomplete="off" />
          </div>

          <nav class="bsp-faq-section" aria-label="Preguntas frecuentes">
            <p class="bsp-faq-label">
              ${totalPreguntas} artículo${totalPreguntas !== 1 ? 's' : ''} para tu rol
            </p>
            <ul class="bsp-accordion" id="bsp-accordion" role="list">
              ${accordionItems}
            </ul>
            <div class="bsp-no-results" id="bsp-no-results" aria-live="polite">
              <i class="bx bx-search-alt" aria-hidden="true"></i>
              <span>No se encontraron resultados.<br>Intenta con otro término.</span>
            </div>
          </nav>

          <div class="bsp-main-actions">
            <button class="bsp-contact-btn" id="bsp-to-form-btn"
                    aria-label="Abrir formulario de soporte">
              <i class="bx bx-envelope" aria-hidden="true"></i>
              Contactar a Soporte
            </button>
            <a href="../../ayuda/ayuda.html" class="bsp-helpcenter-link"
               id="bsp-helpcenter-link"
               aria-label="Abrir el Centro de Ayuda completo">
              <i class="bx bx-book-open" aria-hidden="true"></i>
              Centro de Ayuda completo
              <i class="bx bx-right-arrow-alt" aria-hidden="true"></i>
            </a>
          </div>
        </div>

        <!-- ░ PANTALLA FORMULARIO ░ -->
        <div class="bsp-screen" id="bsp-screen-form"
             role="tabpanel" aria-label="Formulario de contacto a soporte">

          <div class="bsp-form-header">
            <button class="bsp-back-btn" id="bsp-back-btn"
                    aria-label="Volver a preguntas frecuentes">
              <i class="bx bx-arrow-back" aria-hidden="true"></i> Volver
            </button>
            <h3 class="bsp-form-title">Contactar Soporte</h3>
          </div>

          <form class="bsp-support-form" id="bsp-support-form"
                novalidate aria-label="Formulario de solicitud de soporte">

            <div class="bsp-field">
              <label for="bsp-f-asunto">
                Asunto <span class="bsp-required" aria-hidden="true">*</span>
              </label>
              <input type="text" id="bsp-f-asunto" name="asunto"
                     placeholder="Ej. No puedo publicar un evento"
                     maxlength="100" aria-required="true"
                     aria-describedby="bsp-e-asunto" />
              <span class="bsp-field-error" id="bsp-e-asunto" role="alert">
                El asunto es obligatorio (mínimo 5 caracteres).
              </span>
            </div>

            <div class="bsp-field">
              <label for="bsp-f-categoria">
                Categoría <span class="bsp-required" aria-hidden="true">*</span>
              </label>
              <select id="bsp-f-categoria" name="categoria"
                      aria-required="true" aria-describedby="bsp-e-categoria">
                <option value="">— Selecciona una categoría —</option>
                <option value="acceso">Acceso y contraseña</option>
                <option value="eventos">Eventos y actividades</option>
                <option value="noticias">Noticias y contenido</option>
                <option value="pqr">PQR y comunicación</option>
                <option value="reportes">Reportes y estadísticas</option>
                <option value="sedes">Sedes y recursos</option>
                <option value="voluntarios">Voluntarios</option>
                <option value="otro">Otro</option>
              </select>
              <span class="bsp-field-error" id="bsp-e-categoria" role="alert">
                Selecciona la categoría del problema.
              </span>
            </div>

            <div class="bsp-field">
              <label for="bsp-f-mensaje">
                Descripción <span class="bsp-required" aria-hidden="true">*</span>
              </label>
              <textarea id="bsp-f-mensaje" name="mensaje"
                        placeholder="Describe detalladamente tu problema…"
                        maxlength="600" aria-required="true"
                        aria-describedby="bsp-e-mensaje bsp-char-count"></textarea>
              <span class="bsp-char-count" id="bsp-char-count" aria-live="polite">0 / 600</span>
              <span class="bsp-field-error" id="bsp-e-mensaje" role="alert">
                La descripción es obligatoria (mínimo 20 caracteres).
              </span>
            </div>

            <button type="submit" class="bsp-submit-btn" id="bsp-submit-btn">
              <i class="bx bx-send" aria-hidden="true"></i>
              Enviar Solicitud
            </button>
          </form>

          <div class="bsp-form-success" id="bsp-form-success" aria-live="assertive">
            <div class="bsp-success-icon">
              <i class="bx bx-check-circle" aria-hidden="true"></i>
            </div>
            <h3>¡Solicitud Enviada!</h3>
            <p>Tu mensaje fue recibido. El equipo de soporte se comunicará contigo a la brevedad.</p>
            <button class="bsp-success-back-btn" id="bsp-success-back-btn">
              Volver al inicio
            </button>
          </div>
        </div>

      </div><!-- /bsp-drawer-body -->
    </aside>`;

  document.body.insertAdjacentHTML('beforeend', html);
}


/* ═══════════════════════════════════════════════════════════════
   6. INYECCIÓN EN SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function _bspInjectSidebarItem() {
  const tryInject = () => {
    const sidebar = document.querySelector('.sidebar ul');
    if (!sidebar || sidebar.querySelector('.bsp-sidebar-ayuda-li')) return;
    const logoutLi = sidebar.querySelector('.logout-li');
    const li = document.createElement('li');
    li.className = 'bsp-sidebar-ayuda-li';
    li.innerHTML = `
      <a href="../../ayuda/ayuda.html" aria-label="Centro de Ayuda">
        <i class="bx bx-help-circle"></i>
        <span class="nav-item">Centro de Ayuda</span>
      </a>
      <span class="tooltip">Centro de Ayuda</span>`;
    if (logoutLi) sidebar.insertBefore(li, logoutLi);
    else sidebar.appendChild(li);
  };
  tryInject();
  setTimeout(tryInject, 300);
}


/* ═══════════════════════════════════════════════════════════════
   7. CONTROLADOR — eventos e interacciones
   ═══════════════════════════════════════════════════════════════ */
function _bspInitController() {
  const fab        = document.getElementById('bsp-ayuda-fab');
  const widget     = document.getElementById('bsp-ayuda-widget');
  const overlay    = document.getElementById('bsp-ayuda-overlay');
  const closeBtn   = document.getElementById('bsp-close-btn');
  const screenMain = document.getElementById('bsp-screen-main');
  const screenForm = document.getElementById('bsp-screen-form');
  const toFormBtn  = document.getElementById('bsp-to-form-btn');
  const backBtn    = document.getElementById('bsp-back-btn');
  const searchInp  = document.getElementById('bsp-search-input');
  const accordion  = document.getElementById('bsp-accordion');
  const noResults  = document.getElementById('bsp-no-results');
  const form       = document.getElementById('bsp-support-form');
  const msgArea    = document.getElementById('bsp-f-mensaje');
  const charCount  = document.getElementById('bsp-char-count');
  const submitBtn  = document.getElementById('bsp-submit-btn');
  const successBox = document.getElementById('bsp-form-success');
  const successBack= document.getElementById('bsp-success-back-btn');

  let isOpen = false;

  const openWidget = () => {
    isOpen = true;
    widget.classList.add('is-open');
    overlay.classList.add('is-visible');
    fab.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    widget.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeBtn.focus(), 350);
  };

  const closeWidget = () => {
    isOpen = false;
    widget.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    fab.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    widget.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    fab.focus();
  };

  const showScreen = (show, hide) => {
    hide.classList.remove('is-active');
    show.classList.add('is-active');
    document.getElementById('bsp-drawer-body').scrollTop = 0;
  };

  fab.addEventListener('click', () => isOpen ? closeWidget() : openWidget());
  closeBtn.addEventListener('click', closeWidget);
  overlay.addEventListener('click', closeWidget);

  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { closeWidget(); return; }
    if (e.key === 'Tab') {
      const focusable = widget.querySelectorAll(
        'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* Acordeón */
  accordion.addEventListener('click', e => {
    const trigger = e.target.closest('.bsp-acc-trigger');
    if (!trigger) return;
    const item     = trigger.closest('.bsp-acc-item');
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    accordion.querySelectorAll('.bsp-acc-item.is-open').forEach(el => {
      if (el !== item) {
        el.classList.remove('is-open');
        el.querySelector('.bsp-acc-trigger').setAttribute('aria-expanded', 'false');
      }
    });
    item.classList.toggle('is-open', !expanded);
    trigger.setAttribute('aria-expanded', String(!expanded));
  });

  /* Búsqueda */
  searchInp.addEventListener('input', () => {
    const q = searchInp.value.trim().toLowerCase();
    const items = accordion.querySelectorAll('.bsp-acc-item');
    let visible = 0;
    items.forEach(item => {
      const match = !q || item.dataset.search.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    /* Mostrar/ocultar separadores de categoría según resultados visibles */
    accordion.querySelectorAll('.bsp-cat-sep').forEach(sep => {
      sep.style.display = q ? 'none' : '';
    });
    noResults.classList.toggle('is-visible', visible === 0);
  });

  /* Cambio de pantalla */
  toFormBtn.addEventListener('click', () => {
    showScreen(screenForm, screenMain);
    setTimeout(() => document.getElementById('bsp-f-asunto').focus(), 50);
  });
  backBtn.addEventListener('click', () => {
    showScreen(screenMain, screenForm);
    _resetForm();
    setTimeout(() => toFormBtn.focus(), 50);
  });

  /* Contador de caracteres */
  msgArea.addEventListener('input', () => {
    charCount.textContent = `${msgArea.value.length} / 600`;
  });

  /* Validación */
  const showError = (inputId, errorId, show) => {
    document.getElementById(inputId).classList.toggle('bsp-error', show);
    document.getElementById(errorId).classList.toggle('is-visible', show);
  };

  const validateForm = () => {
    const asunto    = document.getElementById('bsp-f-asunto').value.trim();
    const categoria = document.getElementById('bsp-f-categoria').value;
    const mensaje   = document.getElementById('bsp-f-mensaje').value.trim();
    let valid = true;
    const aErr = asunto.length < 5;
    showError('bsp-f-asunto', 'bsp-e-asunto', aErr);
    if (aErr) valid = false;
    const cErr = !categoria;
    showError('bsp-f-categoria', 'bsp-e-categoria', cErr);
    if (cErr) valid = false;
    const mErr = mensaje.length < 20;
    showError('bsp-f-mensaje', 'bsp-e-mensaje', mErr);
    if (mErr) valid = false;
    return valid;
  };

  const _resetForm = () => {
    form.reset();
    charCount.textContent = '0 / 600';
    ['bsp-f-asunto','bsp-f-categoria','bsp-f-mensaje'].forEach(id =>
      document.getElementById(id).classList.remove('bsp-error')
    );
    ['bsp-e-asunto','bsp-e-categoria','bsp-e-mensaje'].forEach(id =>
      document.getElementById(id).classList.remove('is-visible')
    );
    form.style.display = '';
    successBox.classList.remove('is-visible');
  };

  /* Envío — reemplaza el setTimeout con fetch() a tu API real */
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin" aria-hidden="true"></i> Enviando…';
    setTimeout(() => {
      const payload = {
        rol:       ROL,
        asunto:    document.getElementById('bsp-f-asunto').value.trim(),
        categoria: document.getElementById('bsp-f-categoria').value,
        mensaje:   document.getElementById('bsp-f-mensaje').value.trim(),
        fecha:     new Date().toISOString()
      };
      console.info('[BSP Ayuda] Solicitud de soporte:', payload);
      form.style.display = 'none';
      successBox.classList.add('is-visible');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bx bx-send" aria-hidden="true"></i> Enviar Solicitud';
    }, 1200);
  });

  successBack.addEventListener('click', () => {
    showScreen(screenMain, screenForm);
    _resetForm();
  });
}


/* ═══════════════════════════════════════════════════════════════
   ENTRADA
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _bspInjectStyles();
  _bspInjectWidget();
  _bspInitController();
  _bspInjectSidebarItem();
});
