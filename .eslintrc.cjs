/**
 * ESLint — Airbnb JavaScript Style Guide (eslint-config-airbnb-base).
 *
 * El frontend se sirve como scripts clásicos (sin módulos ES): cada archivo se
 * carga con <script> y comparte el ámbito global. Por eso:
 *   · sourceType es 'script'.
 *   · las dependencias entre archivos (DB, BSPVal, alertify…) se declaran al
 *     inicio de cada archivo con un comentario de globales.
 *
 * Desviaciones deliberadas respecto a Airbnb (todas justificadas en
 * docs/ESTANDAR_DE_CODIFICACION.md, sección «Excepciones a Airbnb»).
 */
module.exports = {
  root: true,
  extends: ['airbnb-base'],
  env: { browser: true, es2022: true, node: false },
  parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
  ignorePatterns: ['node_modules/', 'backend/'],
  rules: {
    // Quitar 'use strict' de un script clásico cambiaría su semántica (dejaría
    // de ser modo estricto); Airbnb lo prohíbe porque asume módulos ES.
    strict: 'off',
    // Las funciones declaradas (`function x() {}`) se elevan; ordenar ~120
    // usos habría obligado a reescribir el orden de archivos enteros. Clases y
    // variables siguen sujetas a la regla.
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    // Los callbacks de DOM (`forEach((el) => { el.style... })`) mutan el nodo
    // recibido por diseño; se sigue prohibiendo reasignar el parámetro mismo.
    'no-param-reassign': ['error', { props: false }],
    // console.warn / console.error son el canal de diagnóstico de la app.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
