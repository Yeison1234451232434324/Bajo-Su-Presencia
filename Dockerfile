# ─────────────────────────────────────────────────────────────
#  Bajo Su Presencia — imagen de producción
#
#  Un solo contenedor: PHP 8.2 + Apache (mod_php).
#    · El front controller raíz (index.php) sirve el sitio y el panel.
#    · /api/*  lo atiende backend/public/index.php (mismo origen → sin CORS).
#
#  Construir/local:   docker build -t bsp . && docker run -p 8080:10000 --env-file backend/.env bsp
#  En Render:         se construye solo a partir de este archivo (ver render.yaml).
# ─────────────────────────────────────────────────────────────
FROM php:8.2-apache

# 1. Extensiones PHP que el código necesita.
#    · mbstring  → mb_substr() en la capa de auditoría
#    · curl/json → ya vienen en la imagen oficial
#    · apcu      → acelera el RateLimiter; si faltara, cae a archivos en /tmp
RUN apt-get update \
 && apt-get install -y --no-install-recommends libonig-dev \
 && docker-php-ext-install -j"$(nproc)" mbstring \
 && pecl install apcu \
 && docker-php-ext-enable apcu \
 && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
 && rm -rf /var/lib/apt/lists/*

# 2. php.ini de producción + ajustes propios.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY deploy/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"

# 3. Apache: mod_rewrite + headers y el VirtualHost del proyecto.
#    Apache escuchará en el puerto que inyecta el host (Render define $PORT).
RUN a2enmod rewrite headers
COPY deploy/000-default.conf /etc/apache2/sites-available/000-default.conf
RUN printf 'Listen ${PORT}\n' > /etc/apache2/ports.conf
ENV PORT=10000

# 4. Composer (solo para resolver las dependencias del backend).
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# 5. Código.
WORKDIR /var/www/html
COPY . .

# 6. Dependencias del backend: sin dev, autoloader optimizado.
RUN composer install --working-dir=backend \
      --no-dev --optimize-autoloader --no-interaction --no-progress \
 && rm -f /usr/bin/composer

# 7. Permisos: lo único que necesita escritura es backend/logs.
RUN mkdir -p backend/logs \
 && chown -R www-data:www-data backend/logs

EXPOSE 10000
CMD ["apache2-foreground"]
