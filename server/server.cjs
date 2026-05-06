'use strict';

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_URL = process.env.N8N_INTERNAL_URL || process.env.VITE_N8N_URL;
const DIST_DIR = path.join(__dirname, 'dist');

// ── CSP: construir según el host de Supabase en tiempo de arranque ──
// VITE_SUPABASE_URL se pasa como ENV en el Dockerfile (build arg + runtime).
const _supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const _supabaseOrigin = _supabaseUrl
    ? (() => { try { return new URL(_supabaseUrl).origin; } catch { return ''; } })()
    : '';

// Dominios de imagen permitidos explícitamente (auditados en el código fuente)
const IMG_EXTERNAL = [
    'https://images.unsplash.com',     // imágenes de menú
    'https://upload.wikimedia.org',    // logo Nequi en PaymentModal
    'https://api.dicebear.com',        // avatares en Marketing preview
];

const buildCSP = (supabaseOrigin) => {
    const sb = supabaseOrigin;
    const parts = [
        // Fallback para directivas no especificadas
        "default-src 'self'",

        // Scripts: solo el propio bundle (sin unsafe-inline gracias a modulePreload.polyfill:false en Vite)
        "script-src 'self'",

        // Estilos: unsafe-inline necesario por React inline styles (style={{ ... }}) y framer-motion
        "style-src 'self' 'unsafe-inline'",

        // Imágenes: self + data: (canvas/QR base64) + blob: (PDFs) + Supabase Storage + CDNs auditados
        [
            "img-src 'self' data: blob:",
            sb && `${sb}`,
            ...IMG_EXTERNAL,
        ].filter(Boolean).join(' '),

        // Fuentes: self + data: (fuentes embebidas en CSS)
        "font-src 'self' data:",

        // Conexiones de red: Supabase (REST + Auth + Realtime WS) + Factus API directa.
        sb
            ? `connect-src 'self' ${sb} ${sb.replace(/^https:/, 'wss:')} https://api-sandbox.factus.com.co https://api.factus.com.co`
            : "connect-src 'self' https://api-sandbox.factus.com.co https://api.factus.com.co",

        // Workers: Service Worker del PWA (Workbox) + blobs de web workers
        "worker-src 'self' blob:",

        // Iframes: ninguno permitido
        "frame-src 'none'",

        // Plugins (Flash, PDF embed): ninguno
        "object-src 'none'",

        // Evita inyección de <base href="..."> por XSS
        "base-uri 'self'",

        // Formularios solo envían a mismo origen
        "form-action 'self'",

        // Clickjacking (alternativa a X-Frame-Options, más moderna)
        "frame-ancestors 'none'",

        // Fuerza upgrade de http:// a https:// dentro del mismo dominio
        "upgrade-insecure-requests",
    ];
    return parts.join('; ');
};

const CSP = buildCSP(_supabaseOrigin);

// ── Middleware: security headers en TODAS las respuestas ───────────
app.use((req, res, next) => {
    // ▸ Clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // ▸ Previene MIME sniffing (ejecutar JS desde respuesta con Content-Type: text/html)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // ▸ Refleja al browser si debe activar su filtro XSS legacy (IE/Edge antiguo)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // ▸ No filtrar Referer a sitios externos (útil para analytics interno)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // ▸ HSTS: forzar HTTPS por 2 años (solo cuando llega por HTTPS)
    if (req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // ▸ Permissions-Policy: deshabilitar todas las APIs de dispositivo no necesarias
    res.setHeader('Permissions-Policy', [
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=(self)',
        'camera=()',
        'display-capture=()',
        'encrypted-media=()',
        'fullscreen=(self)',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'payment=()',
        'picture-in-picture=()',
        'screen-wake-lock=()',
        'usb=()',
        'web-share=(self)',
        'xr-spatial-tracking=()',
    ].join(', '));

    // ▸ Aísla el contexto de navegación de ventanas externas (previene Spectre/Meltdown cross-window)
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    // ▸ Evita que otros sitios incrusten recursos de este servidor
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    // ▸ Content-Security-Policy — la defensa principal contra XSS e inyección
    res.setHeader('Content-Security-Policy', CSP);

    next();
});

// ── Proxy: Factus sandbox ─────────────────────────────────────────
app.use('/api/factus/sandbox', createProxyMiddleware({
    target: 'https://api-sandbox.factus.com.co',
    changeOrigin: true,
    pathRewrite: { '^/api/factus/sandbox': '' },
    on: {
        error: (err, req, res) => {
            console.error('[Factus sandbox proxy]', err.message);
            res.status(502).json({ error: 'Factus sandbox no disponible' });
        }
    }
}));

// ── Proxy: Factus producción ──────────────────────────────────────
app.use('/api/factus/production', createProxyMiddleware({
    target: 'https://api.factus.com.co',
    changeOrigin: true,
    pathRewrite: { '^/api/factus/production': '' },
    on: {
        error: (err, req, res) => {
            console.error('[Factus production proxy]', err.message);
            res.status(502).json({ error: 'Factus API no disponible' });
        }
    }
}));

// ── Proxy: n8n webhooks ───────────────────────────────────────────
if (N8N_URL) {
    app.use('/webhook', createProxyMiddleware({
        target: N8N_URL,
        changeOrigin: true,
        on: {
            error: (err, req, res) => {
                console.error('[n8n proxy]', err.message);
                res.status(502).json({ error: 'n8n no disponible' });
            }
        }
    }));
    console.log(`[Nexus] Proxy n8n → ${N8N_URL}`);
} else {
    console.warn('[Nexus] N8N_URL no definido — proxy /webhook desactivado');
}

// ── Serve SPA ─────────────────────────────────────────────────────
// Assets Vite con hash en nombre → cache agresivo 1 año
// index.html → sin cache (punto de entrada del SPA, cambia con cada deploy)
app.use(express.static(DIST_DIR, {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Fallback SPA — rutas del router de React sirven index.html
app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nexus PMS] Servidor en http://0.0.0.0:${PORT}`);
    console.log(`[Nexus PMS] CSP Supabase host: ${_supabaseOrigin || '(no configurado — connect-src restringido a self)'}`);
    console.log(`[Nexus PMS] Proxy Factus sandbox    → https://api-sandbox.factus.com.co`);
    console.log(`[Nexus PMS] Proxy Factus producción → https://api.factus.com.co`);
});
