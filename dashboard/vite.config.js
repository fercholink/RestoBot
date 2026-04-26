import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
/* global process */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        // El SW solo actúa en producción (en dev interfiere con los módulos de Vite)
        devOptions: {
          enabled: false
        },
        workbox: {
          skipWaiting: false, // NO forzar la actualización inmediata
          clientsClaim: false, // NO tomar el control de clientes antiguos automáticamente
          // Cachear el shell de la app y assets estáticos
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Rutas de navegación → siempre servir index.html (SPA)
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // Estrategias de cache
          runtimeCaching: [
            {
              // Supabase REST API (self-hosted en easypanel + supabase.co cloud)
              urlPattern: /^https:\/\/.*(supabase\.co|easypanel\.host)\/rest\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              // Supabase Auth → NetworkOnly (nunca cachear tokens)
              urlPattern: /^https:\/\/.*(supabase\.co|easypanel\.host)\/auth\/.*/i,
              handler: 'NetworkOnly'
            },
            {
              // Assets de Google Fonts / CDN externos
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 2592000 }
              }
            }
          ]
        },
        manifest: {
          name: 'Nexus PMS',
          short_name: 'Nexus',
          description: 'Sistema de gestión para restaurantes y hoteles',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/vite.svg', sizes: 'any', type: 'image/svg+xml' }
          ]
        }
      })
    ],
    server: {
      proxy: {
        // n8n webhooks
        ...(env.VITE_N8N_URL ? {
          '/webhook': {
            target: env.VITE_N8N_URL,
            changeOrigin: true,
            secure: false,
          }
        } : {}),
        // Factus API — evita CORS en dev y mantiene consistencia con producción
        '/api/factus/sandbox': {
          target: 'https://api-sandbox.factus.com.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/factus\/sandbox/, ''),
        },
        '/api/factus/production': {
          target: 'https://api.factus.com.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/factus\/production/, ''),
        },
      },
    },
    build: {
      // Desactivar polyfill modulepreload inline — todos los browsers modernos
      // lo soportan nativamente, y el script inline requeriría 'unsafe-inline' en CSP.
      modulePreload: { polyfill: false },
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        // CSP permisivo en preview (facilita debug) — producción usa el servidor Express
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      }
    }
  }
})
