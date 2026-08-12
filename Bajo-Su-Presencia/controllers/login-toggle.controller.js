// Toggle mostrar/ocultar contraseña
document.getElementById('toggle-password').addEventListener('click', function() {
    const input   = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.className = 'bx bx-show';
    } else {
        input.type = 'password';
        eyeIcon.className = 'bx bx-hide';
    }
});
