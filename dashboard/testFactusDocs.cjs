const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function debugDocs() {
    try {
        const envContent = fs.readFileSync('c:/Users/Personal/Documents/BS COMUNICACIONES/Proyecto_Agente_whatsapp_qr/dashboard/.env', 'utf8');
        let supabaseUrl = '', supabaseKey = '';
        envContent.split('\n').forEach(line => {
            if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
            if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
        });

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: credsData } = await supabase.from('app_settings').select('value').eq('key', 'factus_credentials').single();
        const creds = credsData.value;
        const baseUrl = 'https://api-sandbox.factus.com.co';

        const authResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: 'password', client_id: creds.client_id, client_secret: creds.client_secret,
                username: creds.email, password: creds.password
            })
        });
        const token = (await authResponse.json()).access_token;

        const docsResp = await fetch(`${baseUrl}/v1/identification-documents`, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const docs = await docsResp.json();
        console.log(JSON.stringify(docs, null, 2));
    } catch (e) { console.error(e); }
}
debugDocs();
