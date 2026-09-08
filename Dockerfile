# ─────────────────────────────────────────────────────────────
#  Bajo Su Presencia — imagen de producción
#
#  Un solo contenedor: PHP 8.2 + Apache (mod_php).
#    · El front controller raíz (index.php) sirve el sitio y el panel.
#    · /api/*  lo atiende backend/public/index.php (mismo origen → sin CORS).
#
#  Local:   docker build -t bsp .
#           docker run --rm -p 8080:10000 --env-file backend/.env -e PORT=10000 bsp
#  Render:  se construye solo a partir de este archivo (ver render.yaml).
# ─────────────────────────────────────────────────────────────

# ── Etapa 1: dependencias del backend ────────────────────────
#  Se usa la imagen oficial de Composer (trae git, unzip y ext-zip),
#  así el contenedor final no necesita nada de eso.
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
# Sin --optimize-autoloader a propósito: el classmap optimizado necesitaría el
# código de src/, que aquí no está. El autoload PSR-4 (App\ → src/) funciona sin
# classmap y el runtime lleva OPcache, así que la diferencia es inapreciable.
RUN composer install \
      --no-dev --no-interaction --no-progress --no-scripts --ignore-platform-reqs

# ── Etapa 2: runtime ────────────────────────────────────────
FROM php:8.2-apache

# Extensiones PHP que el código necesita.
#   · mbstring  → mb_substr() en la capa de auditoría
#   · curl/json → ya vienen en la imagen oficial
#   · apcu      → acelera el RateLimiter; si faltara, cae a archivos en /tmp
RUN apt-get update \
 && apt-get install -y --no-install-recommends libonig-dev \
 && docker-php-ext-install -j"$(nproc)" mbstring \
 && pecl install apcu \
 && docker-php-ext-enable apcu \
 && apt-get purge -y --auto-remove libonig-dev \
 && rm -rf /var/lib/apt/lists/*

# php.ini de producción + ajustes propios.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY deploy/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"

# Apache: mod_rewrite + headers y el VirtualHost del proyecto.
# Apache escuchará en el puerto que inyecta el host (Render define $PORT).
RUN a2enmod rewrite headers
COPY deploy/000-default.conf /etc/apache2/sites-available/000-default.conf
RUN printf 'Listen ${PORT}\n' > /etc/apache2/ports.conf
ENV PORT=10000

# Código de la aplicación (.dockerignore excluye vendor/, .env, docs…).
WORKDIR /var/www/html
COPY . .

# Dependencias ya resueltas en la etapa 1.
COPY --from=vendor /app/vendor /var/www/html/backend/vendor

# Permisos: lo único que necesita escritura es backend/logs.
RUN mkdir -p backend/logs \
 && chown -R www-data:www-data backend/logs

EXPOSE 10000
CMD ["apache2-foreground"]
