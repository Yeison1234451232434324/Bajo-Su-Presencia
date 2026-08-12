// La dashboard es exclusiva de administradores: se exige una sesión válida
// verificada por el backend. Sin ella, se regresa al login con
// location.replace (no queda en el historial de "atrás").
if (window.BSPSession) { window.BSPSession.exigir(['Administrador']); }
