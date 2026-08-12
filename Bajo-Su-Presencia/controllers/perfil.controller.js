/**
 * ============================================================
 * CONTROLADOR: perfil.controller.js
 * ============================================================
 * Permite que el usuario logueado (voluntario o colaborador)
 * vea y edite su propia información personal: nombre, correo,
 * teléfono, ubicación, a qué se dedica, especialidad y una
 * breve descripción.
 *
 * La especialidad es TEXTO LIBRE: el usuario la escribe, no la
 * selecciona de una lista. Si la deja registrada, podrá ser
 * escogido como especialista en los eventos.
 *
 * La sesión se guarda en localStorage como:
 *   usuarioLogueado = { nombre: <username>, rol: <rol> }
 * (el campo "nombre" de la sesión es en realidad el username).
 *
 * Depende de:
 *   - usuarios.model.js    → leer / actualizar el usuario
 *   - validators.helper.js → validaciones (BSPVal)
 *   - alertify.helper.js   → alertas (showAlertSuccess / Error)
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', async () => {

  // Control de acceso verificado contra el SERVIDOR (rol tomado del JWT).
  // Unifica el criterio con el resto del panel: antes esta vista solo
  // dependía de localStorage, que el usuario puede editar.
  const sesion = await window.BSPSession.exigir(['Administrador','Colaborador','Voluntario']);
  if (!sesion) return;

  // Filtra dígitos mientras se escribe (antes oninput= inline en el HTML).
  document.getElementById('perfil-nombre')
    ?.addEventListener('input', function () { this.value = this.value.replace(/[0-9]/g, ''); });

  // ── Referencias DOM ──────────────────────────────────────────────────────
  const form        = document.getElementById('form-perfil');
  const avatar      = document.getElementById('perfil-avatar');
  const cabeceraNom = document.getElementById('perfil-cabecera-nombre');
  const cabeceraRol = document.getElementById('perfil-cabecera-rol');
  const sinPerfil   = document.getElementById('perfil-sin-datos');

  // Sugerencias de especialidad (texto libre permitido)
  const datalistEsp = document.getElementById('especialidades-sugeridas');
  if (datalistEsp && typeof UsuariosModel !== 'undefined' && Array.isArray(UsuariosModel.ESPECIALIDADES)) {
    UsuariosModel.ESPECIALIDADES.forEach(esp => {
      const opt = document.createElement('option');
      opt.value = esp;
      datalistEsp.appendChild(opt);
    });
  }

  // ── Localizar al usuario de la sesión ─────────────────────────────────────
  // 1) Por username (la sesión guarda el username en "nombre")
  // 2) Si no coincide, por rol (primer usuario con ese rol)
  async function obtenerUsuarioActual() {
    if (typeof UsuariosModel === 'undefined') return null;
    // Endpoint de "mi perfil": cualquier rol puede ver SU propio perfil (usa el JWT).
    return await UsuariosModel.getMiPerfil();
  }

  const usuario = await obtenerUsuarioActual();

  // Si no se encuentra el perfil, mostrar aviso y ocultar el formulario
  if (!usuario) {
    if (form)      form.style.display = 'none';
    if (sinPerfil) sinPerfil.style.display = 'block';
    return;
  }

  // ── Estado de la foto de perfil ───────────────────────────────────────────
  let fotoActual = usuario.foto || '';

  const inicialUsuario = () =>
    (document.getElementById('perfil-nombre')?.value || usuario.nombre || usuario.username || '?')
      .trim().charAt(0).toUpperCase();

  // Pinta el avatar de la cabecera (foto si existe, si no la inicial)
  function pintarCabecera() {
    if (!avatar) return;
    if (fotoActual) {
      // Se construye por DOM en vez de innerHTML: asignar .src como propiedad
      // impide que un valor tipo  x" onerror="..."  se escape del atributo.
      avatar.textContent = '';
      const img = document.createElement('img');
      img.src       = fotoActual;
      img.alt       = 'Foto de perfil';
      img.className = 'perfil-avatar-img';
      avatar.appendChild(img);
    } else {
      avatar.textContent = inicialUsuario();
    }
  }

  // ── Pintar cabecera ───────────────────────────────────────────────────────
  if (cabeceraNom) cabeceraNom.textContent = usuario.nombre || usuario.username;
  if (cabeceraRol) cabeceraRol.textContent = usuario.rol;
  pintarCabecera();

  // ── Precargar el formulario ────────────────────────────────────────────────
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('perfil-nombre',       usuario.nombre);
  set('perfil-username',     usuario.username);
  set('perfil-email',        usuario.email);
  set('perfil-telefono',     usuario.telefono);
  set('perfil-ubicacion',    usuario.ubicacion);
  set('perfil-ocupacion',    usuario.ocupacion);
  set('perfil-especialidad', usuario.especialidad);
  set('perfil-bio',          usuario.bio);

  // ── Límites de longitud ─────────────────────────────────────────────────────
  [['perfil-nombre', 80], ['perfil-telefono', 20], ['perfil-ubicacion', 120],
   ['perfil-ocupacion', 100], ['perfil-especialidad', 80], ['perfil-bio', 500]].forEach(([id, max]) => {
    const el = document.getElementById(id);
    if (el) el.maxLength = max;
  });

  // ── Foto de perfil (subir / previsualizar / quitar) ─────────────────────────
  const fotoInput   = document.getElementById('perfil-foto-input');
  const fotoImg     = document.getElementById('perfil-foto-img');
  const fotoInicial = document.getElementById('perfil-foto-inicial');
  const fotoQuitar  = document.getElementById('perfil-foto-quitar');
  const fotoError   = document.getElementById('perfil-foto-error');

  const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB de archivo original
  const MAX_LADO       = 256;             // px máximos tras redimensionar

  function _errFoto(msg) {
    if (!fotoError) return;
    fotoError.textContent = msg;
    fotoError.style.display = msg ? 'block' : 'none';
  }

  // Muestra la foto en el preview del formulario (y sincroniza la cabecera)
  function mostrarFotoPreview() {
    if (fotoActual) {
      if (fotoImg)     { fotoImg.src = fotoActual; fotoImg.style.display = 'block'; }
      if (fotoInicial) fotoInicial.style.display = 'none';
      if (fotoQuitar)  fotoQuitar.style.display = 'inline-flex';
    } else {
      if (fotoImg)     fotoImg.style.display = 'none';
      if (fotoInicial) { fotoInicial.style.display = ''; fotoInicial.textContent = inicialUsuario(); }
      if (fotoQuitar)  fotoQuitar.style.display = 'none';
    }
    pintarCabecera();
  }

  // Redimensiona/comprime la imagen a un cuadrado <= MAX_LADO y la devuelve como data URL
  function redimensionarImagen(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
        img.onload = () => {
          const lado = Math.min(MAX_LADO, Math.max(img.width, img.height));
          const escala = Math.min(1, lado / Math.max(img.width, img.height));
          const w = Math.round(img.width * escala);
          const h = Math.round(img.height * escala);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (fotoInput) {
    fotoInput.addEventListener('change', async () => {
      _errFoto('');
      const file = fotoInput.files && fotoInput.files[0];
      if (!file) return;

      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
        _errFoto('Formato no válido. Usa JPG, PNG o WEBP.'); fotoInput.value = ''; return;
      }
      if (file.size > MAX_FOTO_BYTES) {
        _errFoto('La imagen es muy pesada (máximo 5 MB).'); fotoInput.value = ''; return;
      }

      try {
        fotoActual = await redimensionarImagen(file);
        mostrarFotoPreview();
      } catch (err) {
        _errFoto(err.message || 'No se pudo procesar la imagen.');
      }
      fotoInput.value = ''; // permite volver a elegir el mismo archivo
    });
  }

  if (fotoQuitar) {
    fotoQuitar.addEventListener('click', () => {
      fotoActual = '';
      _errFoto('');
      mostrarFotoPreview();
    });
  }

  mostrarFotoPreview();

  // ── Helpers de validación DOM ──────────────────────────────────────────────
  const _err = (id, msg) => BSPVal._err(id, msg);
  const _ok  = (...ids)  => BSPVal._ok(...ids);

  // ── Guardar cambios ─────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre      = BSPVal.cleanText(document.getElementById('perfil-nombre').value);
    const emailVal    = document.getElementById('perfil-email').value.trim().toLowerCase();
    const telefono    = BSPVal.cleanText(document.getElementById('perfil-telefono').value);
    const ubicacion   = BSPVal.cleanText(document.getElementById('perfil-ubicacion').value);
    const ocupacion   = BSPVal.cleanText(document.getElementById('perfil-ocupacion').value);
    const especialidad = BSPVal.cleanText(document.getElementById('perfil-especialidad').value);
    const bio         = BSPVal.cleanText(document.getElementById('perfil-bio').value);

    _ok('perfil-nombre', 'perfil-email', 'perfil-especialidad');
    let valido = true;
    let err;

    /* Nombre: 3-80, solo letras */
    err = BSPVal.txt(nombre, { min: 3, max: 80, label: 'El nombre' });
    if (err) { _err('perfil-nombre', err); valido = false; }
    else {
      err = BSPVal.soloLetras(nombre, { label: 'El nombre' });
      if (err) { _err('perfil-nombre', err); valido = false; }
    }

    /* Correo */
    err = BSPVal.email(emailVal);
    if (err) { _err('perfil-email', err); valido = false; }

    /* Teléfono (opcional): si viene, exactamente 10 dígitos numéricos */
    err = BSPVal.tel(telefono, { required: false });
    if (err) { _err('perfil-telefono', err); valido = false; } else { _ok('perfil-telefono'); }

    /* Especialidad: texto libre opcional, máximo 80 */
    if (especialidad.length > 80) {
      _err('perfil-especialidad', 'La especialidad no puede superar 80 caracteres.'); valido = false;
    }

    if (!valido) return;

    // El username y el rol no se modifican desde el perfil
    const data = {
      nombre,
      username:     usuario.username,
      email:        emailVal,
      rol:          usuario.rol,
      telefono,
      ubicacion,
      ocupacion,
      especialidad,
      bio,
      foto: fotoActual
    };

    let resultado;
    try { resultado = await UsuariosModel.updateMiPerfil(data); }
    catch (ex) { showAlertError('Error de conexión. Intenta de nuevo.'); return; }
    if (!resultado.ok) {
      showAlertError(resultado.error || 'No se pudo guardar el perfil.');
      return;
    }

    // Mantener la cabecera y el avatar sincronizados con los nuevos datos
    if (cabeceraNom) cabeceraNom.textContent = nombre;
    pintarCabecera();

    showAlertSuccess('Tu perfil fue actualizado correctamente.');
  });
});
