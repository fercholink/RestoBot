FROM node:20-alpine AS build

WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
# Variables inyectadas en tiempo de compilación (quedan en el bundle JS)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_N8N_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_N8N_URL=$VITE_N8N_URL
RUN npm run build

# ── Runtime: Express con proxy server-side ────────────────────────
FROM node:20-alpine

# Re-declarar ARGs para que estén disponibles en esta etapa
ARG VITE_SUPABASE_URL
ARG VITE_N8N_URL

WORKDIR /app

# Instalar dependencias del servidor Express
COPY server/package.json ./
RUN npm install --omit=dev

# Copiar el servidor y el SPA compilado
COPY server/server.cjs ./
COPY --from=build /app/dashboard/dist ./dist

EXPOSE 3000

# Variables de entorno en runtime:
# - VITE_SUPABASE_URL → el servidor Express la usa para construir el CSP header
# - VITE_N8N_URL     → el servidor la usa para el proxy /webhook
# - NODE_ENV         → modo producción
ENV NODE_ENV=production \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_N8N_URL=$VITE_N8N_URL

CMD ["node", "server.cjs"]
