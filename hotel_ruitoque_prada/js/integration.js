/**
 * integration.js — Hotel Ruitoque de Prada × Nexus PMS
 * Formulario de reserva en 3 pasos:
 *  1. Selección de fechas (hero form)
 *  2. Selección de tipo de habitación
 *  3. Datos del huésped → guardado en channel_bookings (Nexus Dashboard)
 *  4. Confirmación de éxito
 */

const SUPABASE_URL = 'https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Tipos de habitación (precios en COP por noche) ──────────────────────
const ROOM_TYPES = [
    {
        id: 'estandar',
        name: 'Habitación Estándar',
        description: 'Confort y descanso con todas las comodidades esenciales.',
        price: 120000,
        capacity: 2,
        icon: '🛏️',
        features: ['Cama Queen', 'Wifi', 'TV 32"', 'A/C', 'Baño privado']
    },
    {
        id: 'ejecutiva',
        name: 'Habitación Ejecutiva',
        description: 'Espacio amplio con área de trabajo y vista a la ciudad.',
        price: 180000,
        capacity: 2,
        icon: '💼',
        features: ['Cama King', 'Escritorio', 'Wifi Premium', 'TV Smart 42"', 'A/C', 'Nevera']
    },
    {
        id: 'suite',
        name: 'Suite',
        description: 'Lujo exclusivo con sala privada y las mejores vistas del hotel.',
        price: 280000,
        capacity: 4,
        icon: '⭐',
        features: ['Cama King', 'Sala privada', 'Jacuzzi', 'Minibar', 'Vista panorámica', 'Bata & amenidades']
    }
];

// ─── Estado del flujo ─────────────────────────────────────────────────────
let state = {
    checkIn: '',
    checkOut: '',
    nights: 0,
    adults: 1,
    children: 0,
    selectedRoom: null,
    preselectedRoomId: null
};

// ─── Utilidades ───────────────────────────────────────────────────────────
const fmt = {
    price: (n) => '$' + n.toLocaleString('es-CO'),
    date: (d) => {
        const [y, m, day] = d.split('-');
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
    }
};

function showError(containerId, msg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.style.display = 'none';
}

// ─── Navegación entre vistas del modal ───────────────────────────────────
function showView(viewId) {
    ['resViewRooms', 'resViewGuest', 'resViewSuccess'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === viewId ? 'block' : 'none';
    });
    // Actualizar barra de progreso
    const stepMap = { resViewRooms: 1, resViewGuest: 2, resViewSuccess: 3 };
    const currentStep = stepMap[viewId] || 1;
    document.querySelectorAll('.res-progress-step').forEach(s => {
        const n = parseInt(s.dataset.step);
        s.classList.toggle('active', n === currentStep);
        s.classList.toggle('done', n < currentStep);
    });
}

function openModal() {
    document.getElementById('reservationModal').classList.add('active');
}

function closeModal() {
    document.getElementById('reservationModal').classList.remove('active');
}

// ─── Renderizar tarjetas de habitación ────────────────────────────────────
function renderRooms() {
    const list = document.getElementById('resRoomsList');
    if (!list) return;

    list.innerHTML = ROOM_TYPES.map(room => {
        const total = room.price * state.nights;
        const isPreselected = room.id === state.preselectedRoomId;
        return `
        <div class="res-room-card ${isPreselected ? 'selected' : ''}" data-room-id="${room.id}" tabindex="0" role="button">
            <div class="res-room-main">
                <div class="res-room-icon">${room.icon}</div>
                <div class="res-room-info">
                    <h4>${room.name}</h4>
                    <p>${room.description}</p>
                    <div class="res-room-features">
                        ${room.features.slice(0, 3).map(f => `<span>${f}</span>`).join('')}
                        ${room.features.length > 3 ? `<span>+${room.features.length - 3} más</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="res-room-pricing">
                <div class="res-room-price">${fmt.price(room.price)}<small>/noche</small></div>
                <div class="res-room-total">Total ${state.nights} noche${state.nights !== 1 ? 's' : ''}: <strong>${fmt.price(total)}</strong></div>
                <button class="btn-select-room btn-reservar-sm" data-room-id="${room.id}">
                    ${isPreselected ? '✓ Seleccionada' : 'Elegir →'}
                </button>
            </div>
        </div>`;
    }).join('');

    // Listeners en tarjetas
    list.querySelectorAll('.btn-select-room').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectRoom(btn.dataset.roomId);
        });
    });
    list.querySelectorAll('.res-room-card').forEach(card => {
        card.addEventListener('click', () => selectRoom(card.dataset.roomId));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') selectRoom(card.dataset.roomId); });
    });

}

function selectRoom(roomId) {
    const room = ROOM_TYPES.find(r => r.id === roomId);
    if (!room) return;
    state.selectedRoom = room;

    // Actualizar visual
    document.querySelectorAll('.res-room-card').forEach(c => {
        const selected = c.dataset.roomId === roomId;
        c.classList.toggle('selected', selected);
        const btn = c.querySelector('.btn-select-room');
        if (btn) btn.textContent = selected ? '✓ Seleccionada' : 'Elegir →';
    });

    // Mostrar paso 2 tras breve pausa para feedback visual
    setTimeout(() => {
        populateGuestFormSummary();
        showView('resViewGuest');
        const inner = document.querySelector('.reservation-modal');
        if (inner) inner.scrollTop = 0;
    }, 200);
}

// ─── Llenar resumen en el formulario de huésped ───────────────────────────
function populateGuestFormSummary() {
    const room = state.selectedRoom;
    if (!room) return;
    const total = room.price * state.nights;

    const summaryEl = document.getElementById('resBookingSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="res-summary-row">
                <span>${room.icon} ${room.name}</span>
                <span>${fmt.price(room.price)}/noche</span>
            </div>
            <div class="res-summary-row">
                <span>📅 ${fmt.date(state.checkIn)} → ${fmt.date(state.checkOut)}</span>
                <span>${state.nights} noche${state.nights !== 1 ? 's' : ''}</span>
            </div>
            <div class="res-summary-row res-summary-total">
                <span>Total estimado</span>
                <span>${fmt.price(total)}</span>
            </div>`;
    }
}

// ─── Inicializar formulario principal ────────────────────────────────────
function initBookingForm() {
    const heroForm = document.getElementById('mainBookingForm');
    const modal = document.getElementById('reservationModal');
    const closeBtn = document.getElementById('closeResModal');
    const guestForm = document.getElementById('resGuestForm');
    const backBtn = document.getElementById('resBackBtn');
    const finishBtn = document.getElementById('finishResBtn');

    if (!modal) return;

    // Fecha mínima: hoy
    const today = new Date().toISOString().split('T')[0];
    const qIn = document.getElementById('q_check_in');
    const qOut = document.getElementById('q_check_out');
    if (qIn) qIn.min = today;
    if (qOut) qOut.min = today;
    if (qIn) qIn.addEventListener('change', () => {
        if (qOut && qIn.value >= qOut.value) {
            const next = new Date(qIn.value);
            next.setDate(next.getDate() + 1);
            qOut.value = next.toISOString().split('T')[0];
        }
    });

    // Abrir modal desde el hero form
    if (heroForm) {
        heroForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const checkIn = qIn?.value;
            const checkOut = qOut?.value;
            if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
                const errEl = document.getElementById('heroFormError');
                if (errEl) { errEl.textContent = 'Selecciona fechas válidas de entrada y salida.'; errEl.style.display = 'block'; }
                return;
            }
            const guestsSel = document.getElementById('q_guests');
            const guestsVal = guestsSel?.value || '2 adultos';
            const adults = parseInt(guestsVal.match(/\d+/)?.[0] || '1');
            const children = (guestsVal.match(/(\d+)\s*(niño|child)/i)?.[1]) ? parseInt(guestsVal.match(/(\d+)\s*(niño|child)/i)[1]) : 0;

            state.checkIn = checkIn;
            state.checkOut = checkOut;
            state.nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
            state.adults = adults;
            state.children = children;
            state.selectedRoom = null;

            // Actualizar encabezado del modal
            const header = document.getElementById('resDatesLabel');
            if (header) header.textContent = `${fmt.date(checkIn)} → ${fmt.date(checkOut)}  ·  ${state.nights} noche${state.nights !== 1 ? 's' : ''}  ·  ${adults} adulto${adults !== 1 ? 's' : ''}${children ? `, ${children} niño${children !== 1 ? 's' : ''}` : ''}`;

            renderRooms();
            showView('resViewRooms');
            openModal();
            if (document.getElementById('heroFormError')) document.getElementById('heroFormError').style.display = 'none';
        });
    }

    // Botones de habitación (desde la sección habitaciones)
    document.querySelectorAll('[data-book-room]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const roomId = btn.dataset.bookRoom;
            const checkIn = qIn?.value;
            const checkOut = qOut?.value;

            if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
                // Scroll al hero form y mostrar mensaje
                document.getElementById('inicio')?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                    const errEl = document.getElementById('heroFormError');
                    if (errEl) { errEl.textContent = 'Selecciona primero las fechas de entrada y salida arriba.'; errEl.style.display = 'block'; }
                    qIn?.focus();
                }, 600);
                return;
            }

            const guestsSel = document.getElementById('q_guests');
            const guestsVal = guestsSel?.value || '2 adultos';
            const adults = parseInt(guestsVal.match(/\d+/)?.[0] || '1');
            const children = (guestsVal.match(/(\d+)\s*(niño|child)/i)?.[1]) ? parseInt(guestsVal.match(/(\d+)\s*(niño|child)/i)[1]) : 0;

            state.checkIn = checkIn;
            state.checkOut = checkOut;
            state.nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
            state.adults = adults;
            state.children = children;
            state.selectedRoom = null;
            state.preselectedRoomId = roomId;

            const header = document.getElementById('resDatesLabel');
            if (header) header.textContent = `${fmt.date(checkIn)} → ${fmt.date(checkOut)}  ·  ${state.nights} noche${state.nights !== 1 ? 's' : ''}  ·  ${adults} adulto${adults !== 1 ? 's' : ''}${children ? `, ${children} niño${children !== 1 ? 's' : ''}` : ''}`;

            renderRooms();

            // Si hay preselección, ir directo al paso 2
            const room = ROOM_TYPES.find(r => r.id === roomId);
            if (room) {
                state.selectedRoom = room;
                populateGuestFormSummary();
                showView('resViewGuest');
            } else {
                showView('resViewRooms');
            }
            openModal();
        });
    });

    // Volver al paso anterior
    if (backBtn) backBtn.addEventListener('click', () => {
        renderRooms();
        showView('resViewRooms');
    });

    // Cerrar modal
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    if (finishBtn) finishBtn.addEventListener('click', () => { closeModal(); heroForm?.reset(); });

    // Envío del formulario de huésped → Supabase
    if (guestForm) {
        guestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError('resFormError');

            const fullName = document.getElementById('guestFullName').value.trim();
            const docId = document.getElementById('guestId').value.trim();
            const phone = document.getElementById('guestPhone').value.trim();
            const email = document.getElementById('guestEmail').value.trim();
            const notes = document.getElementById('guestNotes')?.value.trim() || '';

            if (!fullName || !docId || !phone) {
                showError('resFormError', 'Por favor completa todos los campos obligatorios.');
                return;
            }

            const submitBtn = document.getElementById('submitResBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            try {
                const room = state.selectedRoom;
                const totalAmount = room ? room.price * state.nights : null;

                const payload = {
                    channel: 'direct',
                    guest_name: fullName,
                    guest_document: docId,
                    guest_phone: phone,
                    guest_email: email || null,
                    check_in: state.checkIn,
                    check_out: state.checkOut,
                    nights: state.nights,
                    adults: state.adults,
                    children: state.children,
                    room_type_requested: room?.name || null,
                    total_amount: totalAmount,
                    currency: 'COP',
                    status: 'pendiente',
                    notes: notes || null,
                    raw_email_body: `Solicitud web — ${room?.name || 'Sin tipo'} — ${state.checkIn} a ${state.checkOut}`
                };

                const { data, error } = await supabase.from('channel_bookings').insert([payload]).select('id').single();
                if (error) throw error;

                // Mostrar confirmación
                const confirmRef = document.getElementById('resConfirmRef');
                const refCode = data?.id?.slice(0, 8).toUpperCase() || '—';
                if (confirmRef) confirmRef.textContent = `# ${refCode}`;

                const confirmDetails = document.getElementById('resConfirmDetails');
                if (confirmDetails) {
                    confirmDetails.innerHTML = `
                        <div class="res-confirm-row"><span>${room?.icon || '🛏️'} ${room?.name || 'Habitación'}</span></div>
                        <div class="res-confirm-row"><span>📅 ${fmt.date(state.checkIn)} → ${fmt.date(state.checkOut)}</span></div>
                        ${totalAmount ? `<div class="res-confirm-row"><strong>Total estimado: ${fmt.price(totalAmount)}</strong></div>` : ''}
                    `;
                }

                // WhatsApp link
                const waLink = document.getElementById('resWhatsappLink');
                if (waLink) {
                    const waMsg = encodeURIComponent(`Hola! Acabo de hacer una solicitud de reserva en su web.\n*Código:* #${refCode}\n*Nombre:* ${fullName}\n*Fechas:* ${state.checkIn} al ${state.checkOut}\n*Habitación:* ${room?.name || '-'}`);
                    waLink.href = `https://wa.me/573176474440?text=${waMsg}`;
                }

                showView('resViewSuccess');

            } catch (err) {
                console.error('Error al registrar reserva:', err);
                showError('resFormError', 'Hubo un problema al enviar tu solicitud. Por favor intenta de nuevo o contáctanos por WhatsApp.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirmar Reserva';
            }
        });
    }
}

// ─── Arrancar ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingForm);
} else {
    initBookingForm();
}
