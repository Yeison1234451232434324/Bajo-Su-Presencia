/**
 * Oracion Controller
 * Maneja la lógica del formulario de publicación de la oración del día.
 */

function updatePrayerPreview() {
    const text  = document.getElementById('prayerText').value;
    const verse = document.getElementById('prayerVerse').value;
    const img   = document.getElementById('prayerImage').value;

    document.getElementById('prayerCount').textContent = text.length;

    const preview = document.getElementById('prayerPreview');
    if (!text) { preview.style.display = 'none'; return; }

    preview.style.display = 'block';
    document.getElementById('previewText').textContent  = text;
    document.getElementById('previewVerse').textContent = verse;

    const imgWrap = document.getElementById('previewImgWrap');
    if (img) {
        document.getElementById('previewImg').src = img;
        imgWrap.style.display = 'block';
    } else {
        imgWrap.style.display = 'none';
    }
}

function submitPrayer(e) {
    e.preventDefault();
    showToast('¡Oración del día publicada!', 'La oración se ha actualizado en la página principal.');
    e.target.reset();
    document.getElementById('prayerPreview').style.display = 'none';
    document.getElementById('prayerCount').textContent = '0';
}
