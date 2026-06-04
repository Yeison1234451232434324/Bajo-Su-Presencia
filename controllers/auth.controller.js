document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const user     = document.getElementById('username').value.trim();
    const emailVal = document.getElementById('email').value.trim();
    const pass     = document.getElementById('password').value.trim();

    // ── Base de datos simulada ──────────────────────────────────────────────
    const usuariosConfigurados = [
        {
            username: 'admin',
            email:    'admin@correo.com',
            password: '123',
            rol:      'Administrador',
            url:      '../../dashboard/admin/dashboard.html'
        },
        {
            username: 'voluntario',
            email:    'voluntario@correo.com',
            password: '123',
            rol:      'Voluntario',
            url:      '../../dashboard/voluntario/calificaciones.html'
        },
        {
            username: 'colaborador',
            email:    'colaborador@correo.com',
            password: '123',
            rol:      'Colaborador',
            url:      '../../dashboard/colaborador/eventos.html'
        }
    ];

    const usuarioValido = usuariosConfigurados.find(u =>
        u.username === user &&
        u.email    === emailVal &&
        u.password === pass
    );

    if (usuarioValido) {
        localStorage.setItem('usuarioLogueado', JSON.stringify({
            nombre: usuarioValido.username,
            rol:    usuarioValido.rol
        }));
        window.location.href = usuarioValido.url;
    } else {
        showAlertError('Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.');
    }
});
