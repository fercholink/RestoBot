/**
 * integration.js - Hotel Ruitoque de Prada x RestoBot Dashboard
 * Flujo Simplificado OTA:
 *  1. Usuario elige fechas y huéspedes → abre modal con formulario
 *  2. Usuario llena sus datos → se guarda en channel_bookings (Canales OTA del dashboard)
 *  3. Recepción ve la solicitud pendiente y confirma/cancela desde el dashboard
 */

const SUPABASE_URL = 'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

// Inicializar cliente de Supabase (requiere que el CDN ya cargó antes de este script)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function initBookingForm() {
    const bookingForm = document.getElementById('mainBookingForm');
    const modal = document.getElementById('reservationModal');
    const closeBtn = document.getElementById('closeResModal');
    const viewForm = document.getElementById('resModalForm');
    const viewSuccess = document.getElementById('resModalSuccess');
    const datesLabel = document.getElementById('resDatesLabel');
    const resGuestForm = document.getElementById('resGuestForm');
    const finishBtn = document.getElementById('finishResBtn');

    let currentSearch = { checkIn: '', checkOut: '', pax: 1, nights: 0 };

    function switchView(el) {
        [viewForm, viewSuccess].forEach(v => v.style.display = 'none');
        if (el) el.style.display = 'block';
    }

    // — Paso 1: abrir modal al buscar disponibilidad —
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const checkIn = document.getElementById('q_check_in')?.value;
            const checkOut = document.getElementById('q_check_out')?.value;
            const gSel = document.getElementById('q_guests');
            const pax = gSel ? parseInt(gSel.value.charAt(0)) : 1;

            if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
                alert('Por favor selecciona correctamente las fechas de llegada y salida.');
                return;
            }

            const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
            currentSearch = { checkIn, checkOut, pax, nights };

            datesLabel.textContent =
                `🗓 ${checkIn} → ${checkOut}  •  ${nights} noche(s)  •  ${pax} persona(s)`;

            modal.classList.add('active');
            switchView(viewForm);
        });
    }

    // — Paso 2: enviar datos a Supabase (channel_bookings = Canales OTA) —
    resGuestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitResBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        const fullName = document.getElementById('guestFullName').value.trim();
        const docId = document.getElementById('guestId').value.trim();
        const phone = document.getElementById('guestPhone').value.trim();
        const email = document.getElementById('guestEmail').value.trim();
        const notes = document.getElementById('guestNotes')?.value.trim() || '';

        try {
            const { error } = await supabase.from('channel_bookings').insert([{
                channel: 'direct',          // canal web del hotel
                guest_name: fullName,
                guest_document: docId,
                guest_phone: phone,
                guest_email: email,
                check_in: currentSearch.checkIn,
                check_out: currentSearch.checkOut,
                nights: currentSearch.nights,
                adults: currentSearch.pax,
                status: 'pendiente',
                notes: notes,
                raw_email_body: 'Solicitud web vía landing page Hotel Ruitoque'
            }]);

            if (error) throw error;

            switchView(viewSuccess);

        } catch (err) {
            console.error('Error al registrar solicitud OTA:', err);
            alert('Hubo un problema enviando tu solicitud. Por favor escríbenos por WhatsApp.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Solicitud';
        }
    });

    // — Botones de cierre —
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    finishBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        bookingForm.reset();
        resGuestForm.reset();
    });
}

// Patrón robusto: funciona tanto si el DOM ya cargó como si no
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingForm);
} else {
    initBookingForm();
}
