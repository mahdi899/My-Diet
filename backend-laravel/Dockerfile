FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:8.4-fpm AS api
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libsodium-dev libonig-dev libcurl4-openssl-dev \
    && docker-php-ext-install pdo_mysql sodium mbstring curl pcntl opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/backend-laravel
COPY backend-laravel/composer.json backend-laravel/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts
COPY backend-laravel/ ./
RUN composer dump-autoload --no-dev --optimize \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
EXPOSE 9000
CMD ["php-fpm"]

FROM nginx:stable-alpine AS web
COPY --from=frontend-build /frontend/dist/ /usr/share/nginx/html/
COPY backend-laravel/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
