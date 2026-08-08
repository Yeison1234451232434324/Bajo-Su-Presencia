<?php

declare(strict_types=1);

use App\Controllers\AuditoriaController;
use App\Controllers\AuthController;
use App\Controllers\DataGatewayController;
use App\Controllers\DonacionesController;
use App\Controllers\HealthController;
use App\Controllers\PqrController;
use App\Controllers\UsuariosController;
use App\Http\Response;
use App\Http\Router;

/**
 * Definición de rutas de la API.
 *
 * @var Router $router Instancia inyectada desde el front controller.
 */

// ── Autenticación ───────────────────────────────────────────────
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/refresh', [AuthController::class, 'refresh']);
$router->get('/api/auth/me', [AuthController::class, 'me']); // protegido (JWT)
$router->post('/api/auth/password/forgot', [AuthController::class, 'forgotPassword']);
$router->post('/api/auth/password/verify-otp', [AuthController::class, 'verifyOtp']);
$router->post('/api/auth/password/resend', [AuthController::class, 'resendOtp']);
$router->post('/api/auth/password/reset', [AuthController::class, 'resetPassword']);

// ── Perfil propio (cualquier usuario autenticado) — ANTES de {id} ─
$router->get('/api/usuarios/mi-perfil', [UsuariosController::class, 'miPerfil']);
$router->put('/api/usuarios/mi-perfil', [UsuariosController::class, 'actualizarMiPerfil']);

// ── Usuarios (protegido: rol Administrador) ─────────────────────
$router->get('/api/usuarios/especialistas', [UsuariosController::class, 'especialistas']);
$router->get('/api/usuarios', [UsuariosController::class, 'index']);
$router->post('/api/usuarios', [UsuariosController::class, 'store']);
$router->get('/api/usuarios/{id}', [UsuariosController::class, 'show']);
$router->put('/api/usuarios/{id}', [UsuariosController::class, 'update']);
$router->patch('/api/usuarios/{id}/activo', [UsuariosController::class, 'toggleActivo']);
$router->delete('/api/usuarios/{id}', [UsuariosController::class, 'destroy']);

// ── Donaciones (público, anónimo) — envía comprobante al correo ─
$router->post('/api/donaciones', [DonacionesController::class, 'store']);

// ── PQR ───────────────────────────────────────────────────────────
// Crear: público (radicación anónima) — envía confirmación al correo.
$router->post('/api/pqr', [PqrController::class, 'crear']);
// Responder / cambiar estado: panel autenticado — envían correo al solicitante.
$router->patch('/api/pqr/{id}/responder', [PqrController::class, 'responder']);
$router->patch('/api/pqr/{id}/estado', [PqrController::class, 'cambiarEstado']);

// ── Auditoría (panel autenticado: rol Administrador) ────────────
$router->get('/api/auditoria', [AuditoriaController::class, 'index']);

// ── Data Gateway (panel autenticado) ────────────────────────────
$router->get('/api/db/{table}', [DataGatewayController::class, 'handle']);
$router->post('/api/db/{table}', [DataGatewayController::class, 'handle']);
$router->put('/api/db/{table}', [DataGatewayController::class, 'handle']);
$router->patch('/api/db/{table}', [DataGatewayController::class, 'handle']);
$router->delete('/api/db/{table}', [DataGatewayController::class, 'handle']);

// ── Salud y diagnóstico ─────────────────────────────────────────
// Se separan dos sondas siguiendo la práctica habitual de orquestadores:
//   · /api/health  — superficial, sin tocar dependencias. Apta para sondas
//                    frecuentes. Se mantiene su contrato original (`ok:true`)
//                    para no romper a los consumidores existentes.
//   · /api/health/ready — profunda: base de datos, almacenamiento, correo y
//                    configuración. Devuelve 503 si algo esencial falla.
$router->get('/api/health', static function (): void {
    Response::success(['ok' => true], 'API operativa.');
});
$router->get('/api/health/live', [HealthController::class, 'live']);
$router->get('/api/health/ready', [HealthController::class, 'ready']);
