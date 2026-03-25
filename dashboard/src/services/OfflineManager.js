import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

/**
 * OfflineManager — gestión de persistencia local y sincronización con Supabase.
 * Todos los métodos verifican `navigator.onLine` antes de llamar a la nube.
 */
export const OfflineManager = {

    // ═══════════════════════════════════════════════════════════════════════
    //  SYNC DE REFERENCIA (se ejecuta en background cuando hay conexión)
    // ═══════════════════════════════════════════════════════════════════════

    /** Cachea productos y categorías para uso offline */
    async syncMenu(organizationId) {
        if (!navigator.onLine || !organizationId) return;
        try {
            const [{ data: prods }, { data: cats }] = await Promise.all([
                supabase.from('products').select('*').eq('organization_id', organizationId),
                supabase.from('categories').select('*').eq('organization_id', organizationId),
            ]);
            if (prods) await db.products.bulkPut(prods);
            if (cats)  await db.categories.bulkPut(cats);
            console.log(`[Offline] ✅ Menú: ${prods?.length} prods, ${cats?.length} cats`);
        } catch (e) {
            console.warn('[Offline] syncMenu error:', e.message);
        }
    },

    /** Cachea áreas y mesas */
    async syncTableMap(organizationId) {
        if (!navigator.onLine || !organizationId) return;
        try {
            const [{ data: areas }, { data: tables }] = await Promise.all([
                supabase.from('areas').select('*').eq('organization_id', organizationId),
                supabase.from('tables').select('*').eq('organization_id', organizationId),
            ]);
            if (areas)  await db.areas.bulkPut(areas);
            if (tables) await db.tables.bulkPut(tables);
            console.log(`[Offline] ✅ Mapa mesas: ${areas?.length} áreas, ${tables?.length} mesas`);
        } catch (e) {
            console.warn('[Offline] syncTableMap error:', e.message);
        }
    },

    /** Cachea pedidos del turno activo */
    async syncCurrentOrders(organizationId, shiftId) {
        if (!navigator.onLine || !organizationId) return;
        try {
            let q = supabase.from('orders')
                .select('*, items:order_items(*)')
                .eq('organization_id', organizationId);
            if (shiftId) q = q.eq('shift_id', shiftId);

            const { data: orders } = await q;
            if (orders) {
                await db.orders.bulkPut(orders);
                const allItems = orders.flatMap(o => o.items || []);
                if (allItems.length > 0) await db.order_items.bulkPut(allItems);
            }
        } catch (e) {
            console.warn('[Offline] syncCurrentOrders error:', e.message);
        }
    },

    /** Cachea habitaciones */
    async syncRooms(organizationId) {
        if (!navigator.onLine || !organizationId) return;
        try {
            const { data: rooms } = await supabase
                .from('rooms')
                .select('id, number, type, status, housekeeping_status, housekeeping_notes, branch_id, floor_id')
                .eq('organization_id', organizationId);
            if (rooms) {
                await db.rooms.bulkPut(rooms);
                console.log(`[Offline] ✅ Habitaciones: ${rooms.length}`);
            }
        } catch (e) {
            console.warn('[Offline] syncRooms error:', e.message);
        }
    },

    /** Cachea reservas activas + huéspedes */
    async syncBookings(organizationId) {
        if (!navigator.onLine || !organizationId) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: bookings } = await supabase
                .from('bookings')
                .select('id, room_id, guest_id, status, check_in, check_out, total_price, notes, organization_id')
                .eq('organization_id', organizationId)
                .gte('check_out', today)
                .in('status', ['reservada', 'ocupada']);

            if (bookings) {
                await db.bookings.bulkPut(bookings);
                // Cachear los huéspedes de esas reservas
                const guestIds = [...new Set(bookings.map(b => b.guest_id).filter(Boolean))];
                if (guestIds.length > 0) {
                    const { data: guests } = await supabase
                        .from('guests')
                        .select('id, full_name, email, phone, nationality, organization_id')
                        .in('id', guestIds);
                    if (guests) await db.guests.bulkPut(guests);
                }
                console.log(`[Offline] ✅ Reservas: ${bookings.length}`);
            }
        } catch (e) {
            console.warn('[Offline] syncBookings error:', e.message);
        }
    },

    /** Cachea el snapshot del resumen contable */
    async syncAccountingSnapshot(organizationId, summaryData) {
        try {
            await db.accounting_snapshots.put({
                key: `summary_${organizationId}`,
                data: summaryData,
                saved_at: new Date().toISOString()
            });
        } catch (e) {
            console.warn('[Offline] syncAccountingSnapshot error:', e.message);
        }
    },

    /** Lee el snapshot contable cacheado */
    async getAccountingSnapshot(organizationId) {
        try {
            return await db.accounting_snapshots.get(`summary_${organizationId}`);
        } catch {
            return null;
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  ESCRITURAS CON FALLBACK A LOCAL
    // ═══════════════════════════════════════════════════════════════════════

    /** Guarda un pedido: nube si hay conexión, local si no */
    async saveOrder(orderData, items) {
        if (navigator.onLine) {
            try {
                const { data: order, error } = await supabase
                    .from('orders').insert([orderData]).select().single();
                if (error) throw error;

                const orderItems = items.map(item => ({ ...item, order_id: order.id }));
                await supabase.from('order_items').insert(orderItems);

                await db.orders.put(order);
                await db.order_items.bulkPut(orderItems);
                return { success: true, mode: 'cloud', data: order };
            } catch (e) {
                console.warn('[Offline] Cloud saveOrder failed, saving locally:', e.message);
            }
        }

        // MODO OFFLINE
        const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const localOrder = { ...orderData, id: localId, sync_status: 'pending' };
        await db.orders.put(localOrder);
        const localItems = items.map(item => ({ ...item, order_id: localId }));
        await db.order_items.bulkPut(localItems);

        await db.pending_sync.add({
            type: 'insert-order',
            table: 'orders',
            data: { order: orderData, items },
            status: 'pending',
            created_at: new Date().toISOString()
        });

        return { success: true, mode: 'local', data: localOrder };
    },

    /** Guarda una reserva: nube si hay conexión, local si no */
    async saveBooking(guestData, bookingData) {
        if (navigator.onLine) {
            try {
                // Upsert huésped
                const { data: guest, error: gError } = await supabase
                    .from('guests')
                    .upsert(guestData, { onConflict: 'document_id' })
                    .select().single();
                if (gError) throw gError;

                const { data: booking, error: bError } = await supabase
                    .from('bookings')
                    .insert([{ ...bookingData, guest_id: guest.id }])
                    .select().single();
                if (bError) throw bError;

                await db.guests.put(guest);
                await db.bookings.put(booking);
                return { success: true, mode: 'cloud', data: booking };
            } catch (e) {
                console.warn('[Offline] Cloud saveBooking failed, saving locally:', e.message);
            }
        }

        // MODO OFFLINE
        const localId = `local_booking_${Date.now()}`;
        const localGuestId = `local_guest_${Date.now()}`;
        const localGuest   = { ...guestData, id: localGuestId };
        const localBooking = { ...bookingData, id: localId, guest_id: localGuestId, sync_status: 'pending' };

        await db.guests.put(localGuest);
        await db.bookings.put(localBooking);
        await db.pending_sync.add({
            type: 'insert-booking',
            table: 'bookings',
            data: { guest: guestData, booking: bookingData },
            status: 'pending',
            created_at: new Date().toISOString()
        });

        return { success: true, mode: 'local', data: localBooking };
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  COLA DE SINCRONIZACIÓN
    // ═══════════════════════════════════════════════════════════════════════

    /** Procesa todas las acciones pendientes en la cola */
    async processSyncQueue() {
        if (!navigator.onLine) return { synced: 0, errors: 0 };

        const pending = await db.pending_sync.where('status').equals('pending').toArray();
        if (pending.length === 0) return { synced: 0, errors: 0 };

        console.log(`[Offline] Procesando ${pending.length} operaciones pendientes...`);
        let synced = 0;
        let errors = 0;

        for (const item of pending) {
            try {
                await OfflineManager._syncItem(item);
                await db.pending_sync.update(item.local_id, { status: 'synced' });
                synced++;
            } catch (e) {
                console.error(`[Offline] Error al sincronizar item ${item.local_id}:`, e.message);
                errors++;
            }
        }

        console.log(`[Offline] ✅ Sync completo: ${synced} ok, ${errors} errores`);
        return { synced, errors };
    },

    /** Ejecuta la operación individual según su tipo */
    async _syncItem(item) {
        switch (item.type) {

            case 'insert-order': {
                const { order, items } = item.data;
                const { data: cloudOrder, error } = await supabase
                    .from('orders').insert([order]).select().single();
                if (error) throw error;

                const cloudItems = items.map(i => ({ ...i, order_id: cloudOrder.id }));
                await supabase.from('order_items').insert(cloudItems);

                // Actualizar cache local con el ID real de la nube
                await db.orders.put(cloudOrder);
                break;
            }

            case 'update-status': {
                const { orderId, status } = item.data;
                const { error } = await supabase
                    .from('orders').update({ status }).eq('id', orderId);
                if (error) throw error;
                break;
            }

            case 'insert-booking': {
                const { guest, booking } = item.data;
                const { data: cloudGuest, error: gError } = await supabase
                    .from('guests')
                    .upsert(guest, { onConflict: 'document_id' })
                    .select().single();
                if (gError) throw gError;

                const { data: cloudBooking, error: bError } = await supabase
                    .from('bookings')
                    .insert([{ ...booking, guest_id: cloudGuest.id }])
                    .select().single();
                if (bError) throw bError;

                await db.guests.put(cloudGuest);
                await db.bookings.put(cloudBooking);
                break;
            }

            case 'insert-room-charge': {
                const { charge } = item.data;
                const { error } = await supabase.from('room_charges').insert([charge]);
                if (error) throw error;
                break;
            }

            default:
                console.warn('[Offline] Tipo de sync desconocido:', item.type);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  LECTURAS DESDE CACHE LOCAL
    // ═══════════════════════════════════════════════════════════════════════

    async getLocalOrders(organizationId) {
        return db.orders.where('organization_id').equals(organizationId).toArray();
    },

    async getLocalRooms(organizationId) {
        return db.rooms.where('organization_id').equals(organizationId).toArray();
    },

    async getLocalBookings(organizationId) {
        return db.bookings.where('organization_id').equals(organizationId).toArray();
    },

    async getLocalProducts(organizationId) {
        return db.products.where('organization_id').equals(organizationId).toArray();
    },
};
