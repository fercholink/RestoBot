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
// Caché en memoria
// ----------------------------------------------------------------
let _tokenCache = {
    access_token: null,
    refresh_token: null,
    expires_at: null,
    environment: null
};

let _credentialsCache = null; // Caché de credenciales por sesión

const _isTokenValid = (env) =>
    _tokenCache.access_token &&
    _tokenCache.environment === env &&
    _tokenCache.expires_at &&
    Date.now() < _tokenCache.expires_at - 60_000;

const _setTokenCache = (data, env) => {
    _tokenCache = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        environment: env
    };
};

// ----------------------------------------------------------------
// Helper: fetch con timeout (evita que se cuelgue indefinidamente)
// ----------------------------------------------------------------
const _fetchWithTimeout = async (url, options = {}, timeoutMs = 15_000) => {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timerId);
        return response;
    } catch (err) {
        clearTimeout(timerId);
        if (err.name === 'AbortError') {
            throw new Error(`Timeout: Factus no respondió en ${timeoutMs / 1000}s. Verifica tu conexión o el estado del servicio.`);
        }
        throw err;
    }
};

// ----------------------------------------------------------------
// Helper: Obtener URL base y entorno
// ----------------------------------------------------------------
const _getBaseUrl = async () => {
    const creds = await factusService.getCredentials();
    const env = creds?.environment || 'sandbox';
    return { baseUrl: ENVIRONMENTS[env], env };
};

// ----------------------------------------------------------------
// Helper: parsear error de Factus de forma segura
// ----------------------------------------------------------------
const _parseFactusError = (data, status) => {
    try {
        const parts = [];
        // Mensaje general
        if (data.message && typeof data.message === 'string') {
            parts.push(data.message);
        }
        // Errores de campo específicos
        const errors = data.errors;
        if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
            const fieldErrors = Object.entries(errors)
                .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('\n');
            if (fieldErrors) parts.push(fieldErrors);
        } else if (Array.isArray(errors)) {
            parts.push(errors.join('\n'));
        }
        const result = parts.join('\n');
        return result || `Error HTTP ${status} de Factus`;
    } catch {
        return `Error HTTP ${status}: ${JSON.stringify(data)}`;
    }
};

const factusService = {

    // ============================================================
    // 1. AUTENTICACIÓN — OAuth 2.0 Password Grant
    // ============================================================

    login: async (credentials) => {
        const env = credentials.environment || 'sandbox';
        const baseUrl = ENVIRONMENTS[env];

        const response = await _fetchWithTimeout(`${baseUrl}/oauth/token`, {
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

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus devolvió una respuesta inválida al autenticar (HTTP ${response.status})`); }

        if (!response.ok) {
            throw new Error(data.error_description || data.message || 'Error en autenticación Factus');
        }

        _setTokenCache(data, env);
        return data;
    },

    getToken: async () => {
        const { baseUrl, env } = await _getBaseUrl();

        if (_isTokenValid(env)) {
            console.log('[Factus] Reutilizando token en caché');
            return _tokenCache.access_token;
        }

        if (_tokenCache.refresh_token && _tokenCache.environment === env) {
            try {
                const creds = await factusService.getCredentials();
                const response = await _fetchWithTimeout(`${baseUrl}/oauth/token`, {
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

        console.log('[Factus] Haciendo login completo');
        const credentials = await factusService.getCredentials();
        if (!credentials) throw new Error('No hay credenciales de Factus configuradas. Ve a Facturación → Configuración.');
        const data = await factusService.login(credentials);
        return data.access_token;
    },

    // ============================================================
    // 2. FACTURAS (BILLS)
    // ============================================================

    createInvoice: async (invoiceData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(invoiceData)
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus respondió con un formato inesperado (HTTP ${response.status})`); }

        if (!response.ok) {
            console.error('[Factus] createInvoice - Error HTTP', response.status, '- Respuesta:', JSON.stringify(data, null, 2));
            throw new Error(_parseFactusError(data, response.status));
        }

        return data;
    },

    getInvoice: async (docNumber) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/show/${docNumber}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error consultando factura');
        return data;
    },

    downloadPdf: async (docNumber) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/download-pdf/${docNumber}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, 20_000); // PDF puede tardar un poco más

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `Error ${response.status} descargando PDF`);
        }

        if (data && data.data && data.data.pdf_base_64_encoded) {
            const byteCharacters = atob(data.data.pdf_base_64_encoded);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: 'application/pdf' });
        }

        throw new Error('El PDF no está disponible en la respuesta de Factus');
    },

    // ============================================================
    // 3. RANGOS DE NUMERACIÓN
    // ============================================================

    getRanges: async () => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(
            `${baseUrl}/v1/numbering-ranges?filter[id]=&filter[document]=&filter[company_id]=`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus devolvió una respuesta inválida al consultar rangos (HTTP ${response.status})`); }

        if (!response.ok) throw new Error(data.message || 'Error consultando rangos');
        return data;
    },

    // ============================================================
    // 4. CREDENCIALES (Supabase - Multi-Tenant)
    // ============================================================

    saveCredentials: async (credentials) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No autenticado");

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) throw new Error("Usuario sin organización asignada");

        const { error } = await supabase
            .from('tenant_accounting_config')
            .upsert({
                organization_id: profile.organization_id,
                factus_client_id: credentials.client_id,
                factus_client_secret: credentials.client_secret,
                factus_email: credentials.email,
                factus_password: credentials.password,
                factus_environment: credentials.environment || 'sandbox',
                updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' });

        if (error) throw error;
        
        // Actualizar caché
        _credentialsCache = { ...credentials };
        _tokenCache = { access_token: null, refresh_token: null, expires_at: null, environment: null };
    },

    getCredentials: async () => {
        // 1. Si ya tenemos en caché, devolver inmediatamente
        if (_credentialsCache) return _credentialsCache;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) return null;

        const { data, error } = await supabase
            .from('tenant_accounting_config')
            .select('factus_client_id, factus_client_secret, factus_email, factus_password, factus_environment')
            .eq('organization_id', profile.organization_id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (!data || !data.factus_email) return null;

        const creds = {
            client_id: data.factus_client_id,
            client_secret: data.factus_client_secret,
            email: data.factus_email,
            password: data.factus_password,
            environment: data.factus_environment
        };

        _credentialsCache = creds;
        return creds;
    },

    getTokenStatus: () => {
        if (!_tokenCache.access_token) return { active: false };
        const remainingMs = _tokenCache.expires_at - Date.now();
        return {
            active: remainingMs > 0,
            environment: _tokenCache.environment,
            expiresInMinutes: Math.floor(remainingMs / 60_000)
        };
    },

    // ============================================================
    // 5. NÓMINA ELECTRÓNICA
    // ============================================================

    emitPayroll: async (payrollData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(`${baseUrl}/v1/electronic-payroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payrollData)
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus respondió con un formato inesperado (HTTP ${response.status})`); }

        if (!response.ok) {
            throw new Error(_parseFactusError(data, response.status));
        }

        return data;
    },

    // ============================================================
    // 6. NOTAS DE CRÉDITO
    // ============================================================

    createCreditNote: async (creditNoteData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/credit-notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(creditNoteData)
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus respondió con un formato inesperado en Nota Crédito (HTTP ${response.status})`); }

        if (!response.ok) {
            throw new Error(_parseFactusError(data, response.status));
        }

        return data;
    },

    // ============================================================
    // 7. DOCUMENTOS SOPORTE
    // ============================================================

    createSupportDocument: async (supportDocData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        // En Factus, el documento soporte se envía al mismo endpoint de validación de facturas
        // pero con un rango de numeración cuyo document_id es 11
        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ...supportDocData,
                type_document_id: 11 // Asegurar que sea Documento Soporte
            })
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus respondió con un formato inesperado (HTTP ${response.status})`); }

        if (!response.ok) {
            throw new Error(_parseFactusError(data, response.status));
        }

        return data;
    },

    // ============================================================
    // 8. EVENTOS RADIAN (RECEPCIÓN DE FACTURAS)
    // ============================================================

    emitEvent: async (eventData) => {
        const { baseUrl } = await _getBaseUrl();
        const token = await factusService.getToken();

        // Generalmente /v1/bills/events o endpoint documentado específico
        // eventData debe incluir: event_code (030, 032, 033), etc.
        const response = await _fetchWithTimeout(`${baseUrl}/v1/bills/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error(`Factus respondió con un formato inesperado (HTTP ${response.status})`); }

        if (!response.ok) {
            throw new Error(_parseFactusError(data, response.status));
        }

        return data;
    }
};

export default factusService;
