import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

async function run() {
    console.log("=== RECENT ORDERS ===");
    const { data: orders, error: errOrds } = await supabase.from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log("Orders:", orders?.map(o => ({ id: o.id, created: o.created_at, status: o.status })));

    console.log("=== ACCOUNTING ENTRIES ===");
    const { data: entries, error: errEntries } = await supabase.from('accounting_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log("Entries:", entries?.map(e => ({ id: e.id, date: e.date, ref: e.reference })));
}

run();
