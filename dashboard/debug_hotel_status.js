
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBookings() {
    console.log("Fetching bookings...");
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
            id,
            status,
            check_in,
            check_out,
            room:rooms(number),
            guest:guests(full_name)
        `);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Total bookings:", bookings.length);
    if (bookings.length === 0) {
        console.log("No bookings found.");
    } else {
        bookings.forEach(b => {
            console.log(`- Room ${b.room?.number || '?'}: ${b.guest?.full_name} | Status: '${b.status}' | In: ${b.check_in}`);
        });
    }
}

checkBookings();
