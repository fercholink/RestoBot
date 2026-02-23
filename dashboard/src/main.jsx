import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { RealtimeProvider } from './context/RealtimeContext'
import ErrorBoundary from './components/ErrorBoundary'

console.log("Rendering main.jsx");
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {/* RealtimeProvider va DENTRO de AuthProvider para acceder al usuario */}
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
