
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable() {
    console.log("Checking orders for Table 5...");
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('table_number', '5')
        .neq('status', 'pagado')
        .neq('status', 'cancelado');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Active orders:", data);
        if (data.length > 0) {
            console.log("Found active orders on Table 5. Cleaning up...");
            // Optional: clean up phantom orders?
            // Uncomment to delete:
            /*
            const { error: delError } = await supabase
               .from('orders')
               .update({ status: 'cancelado' })
               .eq('table_number', '5')
               .neq('status', 'pagado');
            if(delError) console.error("Error cleaning:", delError);
            else console.log("Cleaned up table 5.");
            */
        } else {
            console.log("Table 5 looks free in DB.");
        }
    }
}

checkTable();
