import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

async function run() {
    const { data: orders, error: errOrds } = await supabase.from('orders')
        .select('id, table_number, notes, payment_method, is_paid')
        .eq('id', 91);
    console.log("Order 91:", orders);

    const { data: o89, error: e89 } = await supabase.from('orders')
        .select('id, table_number, notes, payment_method, is_paid')
        .eq('id', 89);
    console.log("Order 89:", o89);
}

run();
