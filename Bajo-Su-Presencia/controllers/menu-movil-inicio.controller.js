// Menú hamburguesa (index.html / home público)
(function () {
  const btn   = document.getElementById('header-hamburger');
  const menu  = document.getElementById('header-mobile-menu');

  function cerrarMenuMovil() {
    menu.classList.remove('header-mobile-menu--open');
    btn.classList.remove('header-hamburger--open');
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => {
    const abierto = menu.classList.toggle('header-mobile-menu--open');
    btn.classList.toggle('header-hamburger--open', abierto);
    btn.setAttribute('aria-expanded', abierto);
    menu.setAttribute('aria-hidden', !abierto);
    document.body.style.overflow = abierto ? 'hidden' : '';
  });

  // Delegación: cierra el menú al hacer clic en cualquier enlace de la lista
  // (antes cada <a> tenía onclick="cerrarMenuMovil()").
  menu.addEventListener('click', e => {
    if (e.target.closest('a')) cerrarMenuMovil();
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.site-header')) cerrarMenuMovil();
  });

  // ── Navegación por anclas (#Inicio, #Contacto, …) ────────────────────────
  // El front controller inyecta una etiqueta <base> para que funcionen las
  // rutas relativas de los assets. Como efecto colateral, un enlace "#Contacto"
  // se resolvía contra esa base ( /Bajo-Su-Presencia/views/public/inicio/ ) en
  // lugar de contra la URL limpia /inicio, provocando un 404. Se interceptan los
  // clics de todos los enlaces de ancla y se hace scroll suave dentro de la
  // misma página, sin navegar.
  document.querySelectorAll('a[href^="#"]').forEach(enlace => {
    enlace.addEventListener('click', e => {
      const id = enlace.getAttribute('href').slice(1);
      e.preventDefault();                       // nunca navegar (evita el 404 por <base>)
      const destino = id ? document.getElementById(id) : null;
      if (destino) {
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
})();
