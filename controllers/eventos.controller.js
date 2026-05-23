/**
 * Eventos Controller
 * Maneja la lógica del formulario de publicación de eventos.
 */

function toggleResource(id) {
    const item  = document.getElementById('res-' + id);
    const qtyEl = document.getElementById('qty-' + id);
    const cb    = item.querySelector('input[type=checkbox]');

    if (cb.checked) {
        item.classList.add('selected');
        qtyEl.style.display = 'flex';
    } else {
        item.classList.remove('selected');
        qtyEl.style.display = 'none';
    }
}

function submitEvent(e) {
    e.preventDefault();
    showToast('¡Evento publicado exitosamente!', 'El evento ahora aparece en la página principal.');
    e.target.reset();
    document.querySelectorAll('.resource-item').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('[id^=qty-]').forEach(el => el.style.display = 'none');
}
