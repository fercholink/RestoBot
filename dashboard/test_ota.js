import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Muestra el error completo
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await sb.from('channel_bookings').insert([{
        channel: 'direct',
        guest_name: 'TEST Landing Page',
        guest_phone: '+57 300 0000000',
        guest_email: 'test@hotmail.com',
        guest_document: '000000001',
        check_in: '2026-03-10',
        check_out: '2026-03-12',
        nights: 2,
        adults: 2,
        status: 'pendiente',
        notes: 'Prueba',
        raw_email_body: 'Solicitud web'
    }]).select();

    if (error) {
        console.error('❌ ERROR completo:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ INSERT exitoso! ID:', data[0]?.id);
        // Limpiar
        await sb.from('channel_bookings').delete().eq('id', data[0].id);
        console.log('  Registro de prueba eliminado.');
    }
}
run();
