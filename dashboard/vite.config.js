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
          // Cachear el shell de la app y assets estáticos
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Rutas de navegación → siempre servir index.html (SPA)
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // Estrategias de cache
          runtimeCaching: [
            {
              // Supabase REST API → NetworkFirst (intenta red, cae a cache)
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
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
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
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
      ...(env.VITE_N8N_URL ? {
        proxy: {
          '/webhook': {
            target: env.VITE_N8N_URL,
            changeOrigin: true,
            secure: false,
          }
        }
      } : {}),
    },
    preview: {
      host: '0.0.0.0',
      port: 3000
    }
  }
})
