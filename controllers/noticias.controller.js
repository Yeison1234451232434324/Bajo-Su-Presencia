/**
 * Noticias Controller
 * Maneja la lógica del formulario de publicación de noticias.
 */

function submitNews(e) {
    e.preventDefault();
    showToast('¡Noticia publicada exitosamente!', 'La noticia ahora aparece en la página principal.');
    e.target.reset();
}
