const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testFactus() {
    try {
        console.log("Loading env...");
        const envPath = 'c:/Users/Personal/Documents/BS COMUNICACIONES/Proyecto_Agente_whatsapp_qr/dashboard/.env';
        const envContent = fs.readFileSync(envPath, 'utf8');
        let supabaseUrl = '', supabaseKey = '';
        envContent.split('\n').forEach(line => {
            if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
            if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
        });

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: credsData } = await supabase.from('app_settings').select('value').eq('key', 'factus_credentials').single();
        const creds = credsData.value;
        const baseUrl = creds.environment === 'sandbox' ? 'https://api-sandbox.factus.com.co' : 'https://api.factus.com.co';

        console.log(`Authenticating Factus (${creds.environment})...`);
        const authResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: 'password', client_id: creds.client_id, client_secret: creds.client_secret,
                username: creds.email, password: creds.password
            })
        });
        const token = (await authResponse.json()).access_token;

        const rangesResp = await fetch(`${baseUrl}/v1/numbering-ranges?filter[id]=&filter[document]=&filter[company_id]=`, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const rangesData = await rangesResp.json();
        let rangesList = Array.isArray(rangesData?.data) ? rangesData.data : (Array.isArray(rangesData?.data?.data) ? rangesData.data.data : []);

        if (rangesList.length === 0) {
            console.error("No ranges found. Data:", JSON.stringify(rangesData, null, 2));
            return;
        }
        const validRange = rangesList.find(r => r.document === "Factura de Venta") || rangesList[0];
        console.log("Using Range:", validRange.id, "Document:", validRange.document);

        // Fetch Order 84
        const { data: orders } = await supabase.from('orders').select('*, order_items(*)').eq('id', 84).single();
        if (!orders) throw new Error("Order 84 not found.");
        const order = orders;

        const legalOrg = order.tax_data?.type_person === '1' ? 2 : (order.tax_data?.type_person === '2' ? 1 : 2);
        const docType = order.tax_data?.document_type ? (order.tax_data.document_type === '13' ? 3 : (order.tax_data.document_type === '31' ? 6 : Number(order.tax_data.document_type))) : (legalOrg === 1 ? 6 : 3);
        const tributeIdClient = legalOrg === 1 ? 18 : 21;

        console.log("Mapeo Cliente:", "LegalOrg:", legalOrg, "DocType:", docType, "TributeId:", tributeIdClient);

        const invoicePayload = {
            numbering_range_id: Number(validRange.id),
            reference_code: `ORD-${order.id}-${Date.now()}`,
            observation: `Pedido #${order.id} - Prueba Factura Electrónica`,
            payment_form: '1',
            payment_method_code: '10',
            customer: {
                identification: String(order.tax_data?.identification || '222222222222'),
                company: legalOrg === 1 ? (order.tax_data?.names || 'Empresa') : null,
                trade_name: legalOrg === 1 ? (order.tax_data?.trade_name || order.tax_data?.names || 'Empresa') : null,
                names: legalOrg === 2 ? (order.tax_data?.names || order.customer_name || 'Consumidor Final') : null,
                address: order.tax_data?.address || 'Colombia',
                email: order.tax_data?.email || 'facturate@yopmail.com',
                phone: String(order.customer_phone || order.tax_data?.phone || '3000000000'),
                legal_organization_id: legalOrg,
                tribute_id: tributeIdClient,
                identification_document_id: docType
            },
            items: [
                {
                    code_reference: "ITM-1",
                    name: "Servicio General",
                    quantity: 1,
                    discount_rate: 0,
                    price: 126050.42,
                    tax_rate: "19.00",
                    unit_measure_id: 70,
                    standard_code_id: 1,
                    is_excluded: 0,
                    tribute_id: 1,
                    withholding_taxes: []
                }
            ]
        };

        if (order.tax_data?.dv) invoicePayload.customer.dv = Number(order.tax_data.dv);

        console.log("Submitting to Factus...", JSON.stringify(invoicePayload, null, 2));
        const emitResponse = await fetch(`${baseUrl}/v1/bills/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(invoicePayload)
        });

        const emitData = await emitResponse.json();
        if (!emitResponse.ok) {
            console.error("Validation Error:", JSON.stringify(emitData, null, 2));
        } else {
            console.log("SUCCESS!", JSON.stringify(emitData.data.bill, null, 2));
            const { error: dbError } = await supabase.from('orders').update({
                factus_id: emitData.data.bill.id,
                factus_doc_number: emitData.data.bill.number,
                factus_status: emitData.data.bill.status
            }).eq('id', order.id);
            if (dbError) console.error("DB Update Error", dbError); else console.log("DB Updated!");
        }

    } catch (e) {
        console.error("Script failed:", e.message);
    }
}
testFactus();
