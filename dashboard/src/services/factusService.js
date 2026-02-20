import { supabase } from '../lib/supabase';

// ================================================================
// FACTUS SERVICE — Integración API REST Factus
// Docs: https://developers.factus.com.co/
// ================================================================

const ENVIRONMENTS = {
    sandbox: 'https://api-sandbox.factus.com.co',
    production: 'https://api.factus.com.co'
};

// ----------------------------------------------------------------
// Token Cache en memoria (se pierde al recargar la página, 
// pero evita múltiples logins en la misma sesión)
// ----------------------------------------------------------------
let _tokenCache = {
    access_token: null,
    refresh_token: null,
    expires_at: null,       // timestamp en ms
    environment: null       // 'sandbox' | 'production'
};

const _isTokenValid = (env) => {
    return (
        _tokenCache.access_token &&
        _tokenCache.environment === env &&
        _tokenCache.expires_at &&
        Date.now() < _tokenCache.expires_at - 60_000 // 1 min de margen
    );
};

const _setTokenCache = (data, env) => {
    _tokenCache = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        environment: env
    };
};

// ----------------------------------------------------------------
// Helper: Obtener la URL base según el entorno guardado
// ----------------------------------------------------------------
const _getBaseUrl = async () => {
    const creds = await factusService.getCredentials();
    const env = creds?.environment || 'sandbox';
    return { baseUrl: ENVIRONMENTS[env], env };
};

const factusService = {

    // ============================================================
    // 1. AUTENTICACIÓN — OAuth 2.0 Password Grant
    // ============================================================

    /**
     * Login explícito (no usa caché). Útil para probar credenciales.
     */
    login: async (credentials) => {
        const env = credentials.environment || 'sandbox';
        const baseUrl = ENVIRONMENTS[env];

        const response = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'password',
                client_id: credentials.client_id,
                client_secret: credentials.client_secret,
                username: credentials.email,
                password: credentials.password
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error_description || data.message || 'Error en autenticación Factus');
        }

        // Guardar en caché
        _setTokenCache(data, env);
        return data;
    },

    /**
     * Obtiene un token válido: reutiliza caché, refresca si casi expira,
     * o hace login completo si no hay nada.
     */
    getToken: async () => {
        const { baseUrl, env } = await _getBaseUrl();

        // 1. Token en caché y válido → reutilizar
        if (_isTokenValid(env)) {
            console.log('[Factus] Reutilizando token en caché');
            return _tokenCache.access_token;
        }

        // 2. Hay refresh_token → intentar refrescar
        if (_tokenCache.refresh_token && _tokenCache.environment === env) {
            try {
                const creds = await factusService.getCredentials();
                const response = await fetch(`${baseUrl}/oauth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        client_id: creds.client_id,
                        client_secret: creds.client_secret,
                        refresh_token: _tokenCache.refresh_token
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    _setTokenCache(data, env);
                    console.log('[Factus] Token refrescado');
                    return data.access_token;
                }
            } catch (e) {
                console.warn('[Factus] Refresh falló, haciendo login completo:', e.message);
            }
        }

        // 3. Login completo
        console.log('[Factus] Haciendo login completo');
        const credentials = await factusService.getCredentials();
        if (!credentials) throw new Error('No hay credenciales de Factus configuradas. Ve a Contabilidad → Facturación → Configuración.');
        const data = await factusService.login(credentials);
        return data.access_token;
    },

    // ============================================================
    // 2. FACTURAS (BILLS)
    // ============================================================

    /**
     * Crea y valida una factura electrónica en la DIAN vía Factus.
     * @param {object} invoiceData - Payload completo para /v1/bills/validate
     */
    createInvoice: async (invoiceData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await fetch(`${baseUrl}/v1/bills/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(invoiceData)
        });

        const data = await response.json();
        if (!response.ok) {
            // Factus retorna errores de validación estructurados
            const errorsObj = data.errors || data.message || data;
            const errorMsg = typeof errorsObj === 'object'
                ? Object.entries(errorsObj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
                : String(errorsObj);
            throw new Error(errorMsg);
        }

        return data;
    },

    /**
     * Consulta el detalle de una factura por número de documento.
     * @param {string} docNumber - Ej: "FV-001" o "1"
     */
    getInvoice: async (docNumber) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await fetch(`${baseUrl}/v1/bills/show/${docNumber}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error consultando factura');
        return data;
    },

    /**
     * Descarga el PDF de una factura como Blob.
     * @param {string} docNumber - Número de documento Factus
     */
    downloadPdf: async (docNumber) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await fetch(`${baseUrl}/v1/bills/download-pdf/${docNumber}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status} descargando PDF`);
        }

        return response.blob();
    },

    // ============================================================
    // 3. RANGOS DE NUMERACIÓN
    // ============================================================

    /**
     * Obtiene los rangos de numeración activos de la cuenta.
     */
    getRanges: async () => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await fetch(
            `${baseUrl}/v1/numbering-ranges?filter[id]=&filter[document]=&filter[company_id]=`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error consultando rangos');
        return data;
    },

    // ============================================================
    // 4. CREDENCIALES (Supabase)
    // ============================================================

    /**
     * Guarda las credenciales en la tabla app_settings de Supabase.
     */
    saveCredentials: async (credentials) => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'factus_credentials',
                value: credentials,
                description: 'Credenciales API Factus'
            }, { onConflict: 'key' });

        if (error) throw error;

        // Limpiar caché al cambiar credenciales
        _tokenCache = { access_token: null, refresh_token: null, expires_at: null, environment: null };
    },

    /**
     * Recupera las credenciales guardadas en Supabase.
     * @returns {object|null} credentials con campos: email, password, client_id, client_secret, environment
     */
    getCredentials: async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'factus_credentials')
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || null;
    },

    /**
     * Expone el estado del token en caché (para mostrar en UI).
     */
    getTokenStatus: () => {
        if (!_tokenCache.access_token) return { active: false };
        const remainingMs = _tokenCache.expires_at - Date.now();
        return {
            active: remainingMs > 0,
            environment: _tokenCache.environment,
            expiresInMinutes: Math.floor(remainingMs / 60_000)
        };
    }
};

export default factusService;
