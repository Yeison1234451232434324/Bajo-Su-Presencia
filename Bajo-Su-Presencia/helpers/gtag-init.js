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
