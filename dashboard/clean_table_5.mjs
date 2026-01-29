
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host';
// Using the anon key found in .env
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable() {
    console.log("Cleaning active orders for Table 5...");
    /*
    const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelado' }) // Cancel phantom order
        .eq('table_number', '5')
        .neq('status', 'pagado')
        .neq('status', 'cancelado');
    */
    // Let's delete it if it's junk, or cancel it.
    // Given user complaint, cancelling is safest to keep record but free table.
    const { error: delError } = await supabase
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('table_number', '5')
        .neq('status', 'pagado')
        .neq('status', 'cancelado');

    if (delError) {
        console.error("Error cleaning:", delError);
    } else {
        console.log("Cleaned up table 5 by marking orders as 'cancelado'.");
    }
}

checkTable();
