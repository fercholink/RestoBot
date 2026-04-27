FROM nginx:alpine

# Copiar los archivos estáticos de la landing page
COPY . /usr/share/nginx/html

# Configuración nginx optimizada para SPA/static
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    gzip on; \
    gzip_types text/plain text/css application/javascript application/json image/svg+xml; \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|JPG)$ { \
    expires 30d; \
    add_header Cache-Control "public, no-transform"; \
    } \
    location ~* \.(css|js)$ { \
    expires 7d; \
    add_header Cache-Control "public, no-transform"; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
