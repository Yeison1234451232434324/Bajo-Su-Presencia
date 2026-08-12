(function () {
    // ── Estado en memoria (NUNCA en localStorage) ──────────────────────
    let resetToken = null;
    let resendTimer = null;

    const API = window.API_BASE;
    const pasos = {
        email: document.getElementById('form-email'),
        otp:   document.getElementById('form-otp'),
        pass:  document.getElementById('form-pass')
    };
    function mostrar(paso) {
        Object.values(pasos).forEach(p => p.classList.remove('activo'));
        pasos[paso].classList.add('activo');
    }

    async function post(path, payload) {
        const res = await fetch(`${API}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let body = {};
        try { body = await res.json(); } catch (_) {}
        return { ok: res.ok && body.status === 'success', body };
    }

    function btnLoading(btn, on, txt) {
        if (on) { btn.dataset.txt = btn.textContent; btn.disabled = true; btn.textContent = txt; }
        else    { btn.disabled = false; btn.textContent = btn.dataset.txt || btn.textContent; }
    }

    // ── Cooldown de 60s para reenviar ──────────────────────────────────
    function iniciarCooldown() {
        const btn = document.getElementById('btn-resend');
        let s = 60;
        btn.disabled = true; btn.textContent = `Reenviar (${s}s)`;
        clearInterval(resendTimer);
        resendTimer = setInterval(() => {
            s--;
            if (s <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.textContent = 'Reenviar'; }
            else btn.textContent = `Reenviar (${s}s)`;
        }, 1000);
    }

    // ── Paso 1: solicitar OTP ──────────────────────────────────────────
    pasos.email.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const btn = e.target.querySelector('button');
        btnLoading(btn, true, 'Enviando…');
        const { ok, body } = await post('/api/auth/password/forgot', { correo: email });
        btnLoading(btn, false);
        if (ok && body.data?.reset_token) {
            resetToken = body.data.reset_token;
            showAlertSuccess(body.message || 'Código enviado.');
            mostrar('otp');
            iniciarCooldown();
            document.getElementById('otp').focus();
        } else {
            showAlertError(body.message || 'No se pudo procesar la solicitud.');
        }
    });

    // ── Paso 2: verificar OTP ──────────────────────────────────────────
    document.getElementById('otp').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
    pasos.otp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = document.getElementById('otp').value.trim();
        if (otp.length !== 6) { showAlertError('El código debe tener 6 dígitos.'); return; }
        const btn = e.target.querySelector('button[type=submit]');
        btnLoading(btn, true, 'Verificando…');
        const { ok, body } = await post('/api/auth/password/verify-otp', { reset_token: resetToken, otp });
        btnLoading(btn, false);
        if (ok && body.data?.reset_token) {
            resetToken = body.data.reset_token; // ahora es el token "verificado"
            showAlertSuccess('Código correcto.');
            mostrar('pass');
            document.getElementById('pass1').focus();
        } else {
            showAlertError(body.message || 'Código incorrecto o expirado.');
        }
    });

    // ── Reenviar ───────────────────────────────────────────────────────
    document.getElementById('btn-resend').addEventListener('click', async (e) => {
        e.preventDefault();
        const { ok, body } = await post('/api/auth/password/resend', { reset_token: resetToken });
        if (ok && body.data?.reset_token) {
            resetToken = body.data.reset_token;
            showAlertSuccess('Te enviamos un código nuevo.');
            iniciarCooldown();
        } else {
            showAlertError(body.message || 'No se pudo reenviar el código.');
        }
    });

    // ── Paso 3: política de contraseña en vivo ─────────────────────────
    function evaluar() {
        const p = document.getElementById('pass1').value;
        const c = document.getElementById('pass2').value;
        const r = {
            len:   p.length >= 8,
            may:   /[A-Z]/.test(p),
            min:   /[a-z]/.test(p),
            num:   /\d/.test(p),
            esp:   /[^A-Za-z0-9]/.test(p),
            match: p !== '' && p === c
        };
        document.querySelectorAll('#reglas li').forEach(li => {
            li.classList.toggle('ok', !!r[li.dataset.r]);
        });
        document.getElementById('btn-guardar').disabled = !Object.values(r).every(Boolean);
    }
    document.getElementById('pass1').addEventListener('input', evaluar);
    document.getElementById('pass2').addEventListener('input', evaluar);

    pasos.pass.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p = document.getElementById('pass1').value;
        const btn = document.getElementById('btn-guardar');
        btnLoading(btn, true, 'Guardando…');
        const { ok, body } = await post('/api/auth/password/reset', { reset_token: resetToken, contrasena: p });
        btnLoading(btn, false);
        if (ok) {
            resetToken = null;
            pasos.pass.innerHTML = `
                <h1>¡Listo!</h1>
                <div class="recuperar-check-ok">✓</div>
                <p class="recuperar-texto">Tu contraseña fue actualizada. Ya puedes iniciar sesión.</p>
                <a href="login.html" class="boton boton--enlace">
                    Ir al inicio de sesión</a>`;
        } else {
            showAlertError(body.message || 'No se pudo cambiar la contraseña.');
        }
    });
})();
