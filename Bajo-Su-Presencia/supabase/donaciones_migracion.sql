-- ================================================================
--  MIGRACIÓN: tabla `donaciones`
-- ================================================================
--  Registra el historial real de donaciones procesadas por
--  backend/src/Controllers/DonacionesController.php (POST /api/donaciones).
--  Antes esta información no se guardaba en ningún lado: solo se enviaba
--  un correo de comprobante. El panel admin (módulo Donaciones) lee esta
--  tabla a través del Data Gateway (/api/db/donaciones).
--
--  Idempotente: re-ejecutable sin duplicar objetos.
-- ================================================================

create table if not exists public.donaciones (
  id          uuid primary key default gen_random_uuid(),
  referencia  text not null unique,
  correo      text not null,
  nombre      text,
  metodo      text not null check (metodo in ('PSE', 'Nequi', 'Tarjeta')),
  monto       integer not null check (monto between 1000 and 20000000),
  proposito   text,
  estado      text not null default 'Aprobada' check (estado in ('Aprobada', 'Pendiente', 'Rechazada')),
  creado_en   timestamptz not null default now()
);

create index if not exists idx_donaciones_creado_en on public.donaciones (creado_en desc);

comment on table public.donaciones is
  'Historial de donaciones (pago simulado). Escritura e lectura exclusivas del backend (service_role) — ver DataGatewayController::TABLES.';

-- RLS: sin políticas públicas. Solo el backend (service_role) accede,
-- igual que el resto de tablas administrativas del Data Gateway.
alter table public.donaciones enable row level security;

-- ================================================================
--  DATOS DEMO — mientras se integra la pasarela real (Wompi)
-- ================================================================
--  Se identifican con el prefijo DEMO- en la referencia para poder
--  distinguirlas de las donaciones reales y borrarlas más adelante
--  (desde el propio panel, con el botón "Eliminar", o con:
--    delete from public.donaciones where referencia like 'DEMO-%';
--  ). Idempotente: on conflict evita duplicarlas si se re-ejecuta.
-- ================================================================
insert into public.donaciones (referencia, correo, nombre, metodo, monto, proposito, estado, creado_en) values
  ('DEMO-20260701-A1B2C3', 'maria.gonzalez@example.com', 'María González',   'PSE',     150000, 'Ayuda comunitaria',       'Aprobada',  now() - interval '36 days'),
  ('DEMO-20260705-D4E5F6', 'carlos.ramirez@example.com', 'Carlos Ramírez',   'Nequi',    50000, 'Diezmo',                  'Aprobada',  now() - interval '32 days'),
  ('DEMO-20260712-G7H8I9', 'ana.torres@example.com',     'Ana Torres',      'Tarjeta', 300000, 'Construcción del templo', 'Aprobada',  now() - interval '25 days'),
  ('DEMO-20260716-J1K2L3', 'anonimo@example.com',        '',                'PSE',      20000, 'Ofrenda general',        'Pendiente', now() - interval '21 days'),
  ('DEMO-20260722-M4N5O6', 'luis.martinez@example.com',  'Luis Martínez',   'Nequi',   100000, 'Misiones',                'Aprobada',  now() - interval '15 days'),
  ('DEMO-20260726-P7Q8R9', 'sofia.perez@example.com',    'Sofía Pérez',     'Tarjeta',  75000, 'Ayuda comunitaria',       'Rechazada', now() - interval '11 days'),
  ('DEMO-20260731-S1T2U3', 'jorge.diaz@example.com',     'Jorge Díaz',      'PSE',      45000, 'Diezmo',                  'Aprobada',  now() - interval '6 days'),
  ('DEMO-20260803-V4W5X6', 'valentina.cruz@example.com', 'Valentina Cruz',  'Nequi',   200000, 'Construcción del templo', 'Aprobada',  now() - interval '3 days'),
  ('DEMO-20260805-Y7Z8A9', 'andres.lopez@example.com',   'Andrés López',    'Tarjeta',  60000, 'Ofrenda general',        'Aprobada',  now() - interval '1 day')
on conflict (referencia) do nothing;
