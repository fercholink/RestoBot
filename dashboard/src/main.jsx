import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { RealtimeProvider } from './context/RealtimeContext'
import { OfflineProvider } from './context/OfflineContext'
import ErrorBoundary from './components/ErrorBoundary'

// Registrar Service Worker solo en producción
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        console.log('[PWA] Nueva versión disponible — recargando...');
        window.location.reload();
      },
      onOfflineReady() {
        console.log('[PWA] App lista para funcionar sin conexión');
      }
    });
  }).catch(e => console.warn('[PWA] No se pudo registrar SW:', e));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {/* OfflineProvider va dentro de AuthProvider para acceder a useAuth() */}
        <OfflineProvider>
          <RealtimeProvider>
            <App />
          </RealtimeProvider>
        </OfflineProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
