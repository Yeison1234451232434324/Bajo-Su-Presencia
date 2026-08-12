// Menú hamburguesa (pqr.html)
(function () {
  const btn  = document.getElementById('header-hamburger');
  const menu = document.getElementById('header-mobile-menu');

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

  document.addEventListener('click', e => {
    if (!e.target.closest('.site-header')) cerrarMenuMovil();
  });
})();
