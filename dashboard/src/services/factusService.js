import { supabase } from '../lib/supabase';

// Environments
const ENV = {
    SANDBOX: 'https://api-sandbox.factus.com.co',
    PRODUCTION: 'https://api.factus.com.co'
};

const BASE_URL = ENV.SANDBOX; // Default to Sandbox for now

const factusService = {
    // 1. Authentication
    login: async (credentials) => {
        try {
            const response = await fetch(`${BASE_URL}/oauth/token`, {
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

            return data; // contains access_token, refresh_token, expires_in
        } catch (error) {
            console.error('Factus Login Error:', error);
            throw error;
        }
    },

    // 2. Validate/Create Invoice
    createInvoice: async (token, invoiceData) => {
        try {
            const response = await fetch(`${BASE_URL}/v1/bills/validate`, {
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
                // Factus returns validation errors in a specific format
                const errorMsg = data.errors ? JSON.stringify(data.errors) : (data.message || 'Error creando factura');
                throw new Error(errorMsg);
            }

            return data;
        } catch (error) {
            console.error('Factus Create Invoice Error:', error);
            throw error;
        }
    },

    // 3. Get Invoice by ID (Consultar PDF/XML)
    getInvoice: async (token, number) => {
        try {
            const response = await fetch(`${BASE_URL}/v1/bills/show/${number}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error consultando factura');
            return data;
        } catch (error) {
            throw error;
        }
    },

    // 4. Get Numbering Ranges
    getRanges: async (token) => {
        try {
            const response = await fetch(`${BASE_URL}/v1/numbering-ranges?filter[id]=&filter[document]=&filter[company_id]=`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error consultando rangos');
            return data;
        } catch (error) {
            throw error;
        }
    },

    // 5. Download Pdf
    downloadPdf: async (token, number) => {
        try {
            const response = await fetch(`${BASE_URL}/v1/bills/download-pdf/${number}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Error descargando PDF');
            return await response.blob();
        } catch (error) {
            throw error;
        }
    },

    // Helper: Save Credentials to Supabase
    saveCredentials: async (credentials) => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'factus_credentials',
                value: credentials,
                description: 'Credenciales API Factus (Sandbox/Prod)'
            }, { onConflict: 'key' });

        if (error) throw error;
    },

    // Helper: Get Credentials from Supabase
    getCredentials: async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'factus_credentials')
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
        return data?.value || null;
    }
};

export default factusService;
