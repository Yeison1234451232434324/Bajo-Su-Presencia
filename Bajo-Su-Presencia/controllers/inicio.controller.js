(function () {
  /**
   * Escapa datos antes de insertarlos con innerHTML. Noticias y eventos
   * (título, resumen, contenido, autor, horario, ubicación...) los escribe
   * el panel de administración (Administrador/Colaborador) y esta es la
   * página pública sin login: sin escapar, cualquier visitante que cargue
   * la portada ejecutaría el HTML/JS que se haya guardado ahí (stored XSS
   * contra todo el público, no solo contra otro admin).
   */
  const esc = (v) => (window.BSPVal?.escapeHtml
    ? window.BSPVal.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"'`/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;'
      }[c])));

  /* ─── Utilidades de fecha ─────────────────────────────────────────────── */
  const hoy      = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hace7    = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
  const en7      = new Date(hoy); en7.setDate(hoy.getDate() + 7);

  function parseISO(str) {
    // Acepta 'YYYY-MM-DD' o '15 May 2026'
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }

  function formatFecha(str) {
    const d = parseISO(str);
    if (!d) return str;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ─── Leer datos REALES desde Supabase (sin datos demo) ──────────────── */
  async function leerNoticias() {
    try {
      const todas = await NoticiasModel.getAll();   // Supabase
      // Solo noticias del día de hoy o futuras: al día siguiente de su
      // fecha de publicación dejan de mostrarse en el home.
      return todas.filter(n => {
        const f = parseISO(n.fechaISO || n.fecha);
        return f && f >= hoy;
      });
    } catch (_) { return []; }
  }

  async function leerEventos() {
    try {
      const todos = await EventosModel.getAll();   // Supabase
      // Todos los eventos próximos (de hoy en adelante)
      return todos.filter(e => {
        const f = parseISO(e.fecha);
        return f && f >= hoy;
      });
    } catch (_) { return []; }
  }

  /* ─── Datos de respaldo si localStorage está vacío ───────────────────── */
  function fallbackNoticias() {
    const d = (offset) => {
      const f = new Date(hoy); f.setDate(hoy.getDate() - offset);
      return f.toISOString().split('T')[0];
    };
    return [
      {
        id: 1, titulo: 'Campaña de Ayuda Comunitaria',
        resumen: 'Este mes lanzamos nuestra campaña anual para apoyar a las familias más necesitadas de la comunidad.',
        contenido: 'Con el amor de Cristo como guía, este mes iniciamos nuestra campaña anual de ayuda comunitaria. Recolectaremos alimentos, ropa y útiles escolares para distribuir entre las familias más vulnerables de nuestra ciudad. ¡Únete y sé parte del cambio!',
        autor: 'Pastor Carlos', imagen: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=600&q=80', fechaISO: d(0)
      },
      {
        id: 2, titulo: 'Nueva Sede en el Norte',
        resumen: 'Con gran alegría anunciamos la apertura de nuestra nueva sede en el norte de la ciudad.',
        contenido: 'Después de meses de preparación y oración, Dios ha abierto las puertas para establecer nuestra nueva sede en el norte de la ciudad. Este espacio estará disponible para cultos, estudios bíblicos y actividades comunitarias.',
        autor: 'Hna. María', imagen: 'https://images.unsplash.com/photo-1545987796-200677ee1011?w=600&q=80', fechaISO: d(1)
      },
      {
        id: 3, titulo: 'Retiro Espiritual de Jóvenes',
        resumen: 'El próximo mes realizaremos nuestro retiro espiritual anual para jóvenes. ¡Inscríbete ya!',
        contenido: 'Un fin de semana de encuentro con Dios, alabanza y comunión para jóvenes de 15 a 30 años. Cupos limitados. Inscripciones abiertas en la secretaría de la iglesia.',
        autor: 'Jto. Juan', imagen: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80', fechaISO: d(2)
      },
      {
        id: 4, titulo: 'Taller de Liderazgo Cristiano',
        resumen: 'Aprende a liderar con propósito y fe en nuestro taller intensivo de dos días.',
        contenido: 'El taller abordará temas como servicio, visión, comunicación efectiva y liderazgo basado en los principios del evangelio. Dirigido a líderes de célula, diáconos y voluntarios.',
        autor: 'Pastor Miguel', imagen: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&q=80', fechaISO: d(3)
      },
      {
        id: 5, titulo: 'Concierto de Alabanza Comunitario',
        resumen: 'Una noche especial de música y adoración con grupos de toda la región.',
        contenido: 'Grupos de alabanza de cinco iglesias hermanas se unirán para una noche de adoración colectiva. Entrada libre. Habrá espacio para niños y familias.',
        autor: 'Equipo de Música', imagen: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80', fechaISO: d(4)
      },
      {
        id: 6, titulo: 'Bautismos del Mes',
        resumen: 'Este domingo celebramos los bautismos de 12 nuevos miembros de nuestra comunidad.',
        contenido: 'Con gran gozo celebramos el paso de fe de 12 hermanos que han decidido seguir a Cristo públicamente. La ceremonia será al finalizar el culto dominical. ¡Todos están invitados!',
        autor: 'Pastor Carlos', imagen: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', fechaISO: d(5)
      }
    ];
  }

  function fallbackEventos() {
    const fmt = (offset) => {
      const f = new Date(hoy); f.setDate(hoy.getDate() + offset);
      return f.toISOString().split('T')[0];
    };
    return [
      {
        id: 1, titulo: 'Culto de Adoración',
        fecha: fmt(1), horario: '10:00 AM', ubicacion: 'Sede Principal',
        asistentes: '300', descripcion: 'Culto dominical de adoración y predicación de la Palabra.',
        voluntariosNecesarios: 8
      },
      {
        id: 2, titulo: 'Estudio Bíblico',
        fecha: fmt(2), horario: '7:00 PM', ubicacion: 'Salón B',
        asistentes: '80', descripcion: 'Estudio profundo del libro de Romanos. Trae tu Biblia.',
        voluntariosNecesarios: 3
      },
      {
        id: 3, titulo: 'Reunión de Jóvenes',
        fecha: fmt(3), horario: '6:00 PM', ubicacion: 'Auditorio',
        asistentes: '150', descripcion: 'Noche de alabanza, testimonios y comunión para jóvenes.',
        voluntariosNecesarios: 5
      },
      {
        id: 4, titulo: 'Oración Matutina',
        fecha: fmt(4), horario: '6:00 AM', ubicacion: 'Capilla',
        asistentes: '40', descripcion: 'Encuentro de intercesión y oración por la comunidad y la nación.',
        voluntariosNecesarios: 2
      },
      {
        id: 5, titulo: 'Taller de Familias',
        fecha: fmt(5), horario: '3:00 PM', ubicacion: 'Salón Principal',
        asistentes: '120', descripcion: 'Taller sobre comunicación y valores en el hogar cristiano.',
        voluntariosNecesarios: 6
      },
      {
        id: 6, titulo: 'Noche de Alabanza',
        fecha: fmt(6), horario: '7:30 PM', ubicacion: 'Auditorio Central',
        asistentes: '200', descripcion: 'Concierto de adoración con grupos invitados de la región.',
        voluntariosNecesarios: 10
      }
    ];
  }

  /* ─── Construir tarjeta de NOTICIA ───────────────────────────────────── */
  const barColors = [
    'linear-gradient(to right,#f59e0b,#ca8a04)',
    'linear-gradient(to right,#f97316,#ef4444)',
    'linear-gradient(to right,#eab308,#d97706)',
    'linear-gradient(to right,#3b82f6,#1d4ed8)',
    'linear-gradient(to right,#8b5cf6,#6d28d9)'
  ];

  function crearTarjetaNoticia(n, idx) {
    const art = document.createElement('article');
    art.className = 'carousel-card news-card';
    art.setAttribute('tabindex', '0');
    art.setAttribute('role', 'button');
    art.setAttribute('aria-label', 'Ver noticia: ' + n.titulo);
    art.innerHTML = `
      <div class="news-card-img-wrap">
        ${n.imagen
          ? `<img src="${esc(n.imagen)}" alt="${esc(n.titulo)}" class="news-card-img" loading="lazy" />`
          : `<div class="news-card-img-placeholder"><span>📰</span></div>`}
        <div class="news-card-img-fade"></div>
      </div>
      <div class="news-card-body">
        <h4 class="news-card-title">${esc(n.titulo)}</h4>
        <p class="news-card-excerpt">${esc(n.resumen || '')}</p>
        <div class="news-card-meta">
          <span>📅 ${esc(formatFecha(n.fechaISO || n.fecha))}</span>
          <span>👤 ${esc(n.autor || '—')}</span>
        </div>
        <span class="card-leer-mas">Leer más →</span>
      </div>`;
    art.addEventListener('click', () => abrirModalNoticia(n));
    art.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') abrirModalNoticia(n); });
    return art;
  }

  /* ─── Construir tarjeta de EVENTO ────────────────────────────────────── */
  function crearTarjetaEvento(ev, idx) {
    const div = document.createElement('div');
    div.className = 'carousel-card event-card';
    div.setAttribute('tabindex', '0');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', 'Ver evento: ' + ev.titulo);
    const barIdx = idx % barColors.length;
    div.innerHTML = `
      <div class="event-card-bar event-card-bar--${barIdx}"></div>
      <div class="event-card-body">
        <h4 class="event-card-title">${esc(ev.titulo)}</h4>
        <div class="event-card-info">
          <div class="event-info-row"><span class="event-icon">📅</span> ${esc(formatFecha(ev.fecha))}</div>
          ${ev.horario   ? `<div class="event-info-row"><span class="event-icon">🕙</span> ${esc(ev.horario)}</div>` : ''}
          ${ev.ubicacion ? `<div class="event-info-row"><span class="event-icon">📍</span> ${esc(ev.ubicacion)}</div>` : ''}
          ${ev.asistentes ? `<div class="event-info-row"><span class="event-icon">👥</span> ${esc(ev.asistentes)} asistentes esperados</div>` : ''}
        </div>
        <span class="card-leer-mas">Ver detalle →</span>
      </div>`;
    div.addEventListener('click', () => abrirModalEvento(ev));
    div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') abrirModalEvento(ev); });
    return div;
  }

  /* ─── Motor de carrusel ──────────────────────────────────────────────── */
  function initCarrusel(trackId, prevId, nextId, dotsId, items, crearTarjeta) {
    const track    = document.getElementById(trackId);
    const prevBtn  = document.getElementById(prevId);
    const nextBtn  = document.getElementById(nextId);
    const dotsWrap = document.getElementById(dotsId);

    if (!track) return;

    // Cuántas tarjetas visibles según ancho
    function visibles() {
      const vw = window.innerWidth;
      if (vw < 640)  return 1;
      if (vw < 1024) return 2;
      return 3;
    }

    let current = 0;

    // Renderizar tarjetas
    track.innerHTML = '';
    items.forEach((item, i) => track.appendChild(crearTarjeta(item, i)));

    // Puntos indicadores
    function renderDots() {
      dotsWrap.innerHTML = '';
      const total = Math.ceil(items.length / visibles());
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === current ? ' carousel-dot--active' : '');
        dot.setAttribute('aria-label', `Ir a página ${i + 1}`);
        dot.addEventListener('click', () => { current = i; mover(); });
        dotsWrap.appendChild(dot);
      }
    }

    function mover() {
      const v   = visibles();
      const max = Math.max(0, items.length - v);
      current   = Math.max(0, Math.min(current, max));

      // Ancho real de una tarjeta + su gap para calcular el offset exacto
      const cards   = track.querySelectorAll('.carousel-card');
      if (!cards.length) return;
      const cardEl  = cards[0];
      const gap     = parseFloat(getComputedStyle(track).gap) || 0;
      const cardW   = cardEl.getBoundingClientRect().width;
      const offset  = current * (cardW + gap);

      track.style.transform = `translateX(-${offset}px)`;

      // Actualizar dots
      const total = Math.ceil(items.length / v);
      const page  = Math.floor(current / 1) % total;
      dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.classList.toggle('carousel-dot--active', i === page);
      });

      prevBtn.disabled = current === 0;
      nextBtn.disabled = current >= max;
    }

    prevBtn.addEventListener('click', () => { current = Math.max(0, current - 1); mover(); });
    nextBtn.addEventListener('click', () => { current = Math.min(items.length - visibles(), current + 1); mover(); });

    // Auto-play cada 5 segundos
    let autoplay = setInterval(() => {
      if (current >= items.length - visibles()) { current = 0; }
      else { current++; }
      mover();
    }, 5000);

    // Pausar al hover
    track.parentElement.addEventListener('mouseenter', () => clearInterval(autoplay));
    track.parentElement.addEventListener('mouseleave', () => {
      autoplay = setInterval(() => {
        if (current >= items.length - visibles()) { current = 0; }
        else { current++; }
        mover();
      }, 5000);
    });

    // Swipe táctil
    let startX = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) { current = Math.min(items.length - visibles(), current + 1); }
        else          { current = Math.max(0, current - 1); }
        mover();
      }
    });

    window.addEventListener('resize', () => { current = 0; renderDots(); mover(); });

    renderDots();
    mover();
  }

  /* ─── Modal flotante ─────────────────────────────────────────────────── */
  const overlay = document.getElementById('modal-blur-overlay');
  const modal   = document.getElementById('modal-flotante');
  const btnClose= document.getElementById('modal-flotante-close');

  function abrirModal() {
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal() {
    overlay.classList.remove('active');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  btnClose.addEventListener('click', cerrarModal);
  overlay.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

  function abrirModalNoticia(n) {
    // Mostrar cabecera con imagen, ocultar cabecera de evento
    document.getElementById('mf-ev-header').style.display  = 'none';
    document.getElementById('mf-badge').style.display      = 'inline-block';

    document.getElementById('mf-badge').textContent  = '📰 Noticia';
    document.getElementById('mf-badge').className    = 'mf-badge mf-badge--noticia';
    document.getElementById('mf-titulo').textContent = n.titulo;
    document.getElementById('mf-meta').innerHTML     =
      `📅 ${esc(formatFecha(n.fechaISO || n.fecha))} &nbsp;·&nbsp; 👤 ${esc(n.autor || '—')}`;
    document.getElementById('mf-texto').textContent  = n.resumen || '';

    const extra = document.getElementById('mf-extra');
    extra.innerHTML = n.contenido
      ? `<div class="mf-contenido"><p>${esc(n.contenido)}</p></div>`
      : '';

    const imgWrap = document.getElementById('mf-img-wrap');
    const img     = document.getElementById('mf-img');
    if (n.imagen) {
      img.src = n.imagen; img.alt = n.titulo;
      imgWrap.style.display = 'block';
      document.getElementById('mf-badge-over').textContent = '📰 Noticia';
      document.getElementById('mf-badge-over').className   = 'mf-badge mf-badge--over mf-badge--noticia';
    } else {
      imgWrap.style.display = 'none';
    }
    abrirModal();
  }

  function abrirModalEvento(ev) {
    // Ocultar cabecera de imagen, mostrar cabecera visual de evento
    document.getElementById('mf-img-wrap').style.display   = 'none';
    document.getElementById('mf-badge').style.display      = 'none';
    document.getElementById('mf-titulo').textContent       = '';
    document.getElementById('mf-meta').textContent         = '';

    document.getElementById('mf-ev-header').style.display  = 'flex';
    document.getElementById('mf-titulo-ev').textContent    = ev.titulo;
    document.getElementById('mf-meta-ev').innerHTML        =
      `📅 ${esc(formatFecha(ev.fecha))}${ev.horario ? ' &nbsp;·&nbsp; 🕙 ' + esc(ev.horario) : ''}`;

    // Ícono grande según tipo de evento (heurística por título)
    const titulo = ev.titulo.toLowerCase();
    let icono = '📅';
    if (titulo.includes('culto') || titulo.includes('adorac'))  icono = '⛪';
    else if (titulo.includes('joven') || titulo.includes('juvenil')) icono = '🎉';
    else if (titulo.includes('orac'))  icono = '🙏';
    else if (titulo.includes('estudio') || titulo.includes('bíblic')) icono = '📖';
    else if (titulo.includes('alabanza') || titulo.includes('música')) icono = '🎵';
    else if (titulo.includes('familia')) icono = '👨‍👩‍👧‍👦';
    else if (titulo.includes('bautis'))  icono = '💧';
    document.getElementById('mf-ev-header-icon').textContent = icono;

    document.getElementById('mf-texto').textContent = ev.descripcion || '';

    const extra = document.getElementById('mf-extra');
    extra.innerHTML = `
      <div class="mf-ev-cards">
        ${ev.fecha ? `
          <div class="mf-ev-card">
            <span class="mf-ev-card-icon">📅</span>
            <div>
              <p class="mf-ev-card-label">Fecha</p>
              <p class="mf-ev-card-val">${esc(formatFecha(ev.fecha))}</p>
            </div>
          </div>` : ''}
        ${ev.horario ? `
          <div class="mf-ev-card">
            <span class="mf-ev-card-icon">🕙</span>
            <div>
              <p class="mf-ev-card-label">Horario</p>
              <p class="mf-ev-card-val">${esc(ev.horario)}</p>
            </div>
          </div>` : ''}
        ${ev.ubicacion ? `
          <div class="mf-ev-card">
            <span class="mf-ev-card-icon">📍</span>
            <div>
              <p class="mf-ev-card-label">Ubicación</p>
              <p class="mf-ev-card-val">${esc(ev.ubicacion)}</p>
            </div>
          </div>` : ''}
        ${ev.asistentes ? `
          <div class="mf-ev-card">
            <span class="mf-ev-card-icon">👥</span>
            <div>
              <p class="mf-ev-card-label">Asistentes esperados</p>
              <p class="mf-ev-card-val">${esc(ev.asistentes)}</p>
            </div>
          </div>` : ''}
      </div>`;
    abrirModal();
  }

  /* ─── Oración del Día — carga desde Supabase ────────────────────────── */
  async function cargarOracionDelDia() {
    const textoEl     = document.getElementById('prayer-texto-dia');
    const versiculoEl = document.getElementById('prayer-versiculo-dia');
    const imagenEl    = document.getElementById('prayer-imagen-dia');

    let oracion = null;
    try {
      const oraciones = await OracionModel.getAll();   // ordenadas: más reciente primero
      oracion = oraciones[0] || null;
    } catch (_) { oracion = null; }

    // Sin oración en la BD → limpiar el texto fijo del HTML
    if (!oracion) {
      if (textoEl)     textoEl.textContent     = 'Aún no se ha publicado una oración.';
      if (versiculoEl) versiculoEl.textContent = '';
      if (imagenEl)    imagenEl.style.display  = 'none';
      return;
    }

    if (textoEl && oracion.texto) {
      textoEl.textContent = `"${oracion.texto}"`;
    }
    if (versiculoEl) {
      versiculoEl.textContent = oracion.versiculo || '';
    }
    if (imagenEl && oracion.imagen && oracion.imagen.trim()) {
      imagenEl.src = oracion.imagen.trim();
      imagenEl.style.display = 'block';
      imagenEl.onerror = () => { imagenEl.style.display = 'none'; };
    } else if (imagenEl) {
      imagenEl.style.display = 'none';
    }
  }
  /* ─── Inicializar (noticias y oración desde Supabase) ─────────────────── */
  (async () => {
    // Las 3 operaciones son independientes entre sí (ninguna depende del
    // resultado de otra), así que se disparan en paralelo en vez de
    // encadenarlas con await secuencial: el tiempo total pasa a ser el
    // máximo de las 3 en vez de la suma.
    const [, noticias, eventos] = await Promise.all([
      cargarOracionDelDia(),
      leerNoticias(),
      leerEventos()   // Supabase
    ]);

    // El atributo `hidden` del HTML no basta: `.carousel-empty { display: flex }`
    // en styles.css (una regla de autor) siempre le gana al `[hidden]` del
    // navegador (una regla de user-agent), así que sin un `display:none`
    // explícito aquí el mensaje de "vacío" queda visible SIEMPRE, aunque sí
    // haya noticias/eventos y el carrusel se esté mostrando encima.
    if (noticias.length) {
      initCarrusel('news-track', 'news-prev', 'news-next', 'news-dots', noticias, crearTarjetaNoticia);
      document.getElementById('news-empty').style.display = 'none';
    } else {
      document.getElementById('news-empty').style.display = 'flex';
    }

    if (eventos.length) {
      initCarrusel('ev-track', 'ev-prev', 'ev-next', 'ev-dots', eventos, crearTarjetaEvento);
      document.getElementById('ev-empty').style.display = 'none';
    } else {
      document.getElementById('ev-empty').style.display = 'flex';
    }
  })();

})();
