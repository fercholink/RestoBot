import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
/* global process */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      // Solo configurar proxy si la URL de n8n está definida
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




