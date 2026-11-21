/*
 * Inicialización de Google tag (Google Ads).
 * Vive en un archivo propio porque el CSP no permite scripts en línea.
 * La librería gtag.js se carga aparte desde googletagmanager.com.
 */
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', 'AW-18582865569');

// Conversión "Vista de página" (Google Ads): una por carga de la home y de /pqr,
// las únicas vistas públicas que incluyen este archivo.
gtag('event', 'conversion', {
  send_to: 'AW-18582865569/-9-FCL2J-rwdEKGNgJ1F',
  value: 1.0,
  currency: 'COP',
});

/*
 * Conversión "Clic saliente" (Google Ads): cuenta un clic en teléfono, correo
 * o cualquier enlace que lleve fuera de este sitio (Maps, Facebook…).
 * Un único listener delegado en el documento: no depende del HTML de cada vista.
 */
document.addEventListener('click', (e) => {
  const enlace = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!enlace) return;

  const destino = enlace.getAttribute('href') || '';
  const esContacto = /^(tel|mailto):/i.test(destino);
  const esExterno = /^https?:\/\//i.test(destino) && enlace.host !== window.location.host;
  if (!esContacto && !esExterno) return;

  gtag('event', 'conversion', {
    send_to: 'AW-18582865569/yViwCKvS_7wdEKGNgJ1F',
    value: 1.0,
    currency: 'COP',
  });
});
