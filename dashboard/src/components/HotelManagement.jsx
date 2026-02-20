import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Bed, Calendar, Key, Users, History, Settings, Bell, Star, MapPin, Search, Plus, Loader, Trash2, Edit, Tv, Wifi, Wind, ChevronLeft, ChevronRight, Building, Check, Hash, LayoutList, Columns } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NewReservationModal from './NewReservationModal';
import RoomModal from './RoomModal';
import ReservationDetailsModal from './ReservationDetailsModal';
import PaymentModal from './PaymentModal';
import TicketPrinter from './TicketPrinter';
import FloorManager from './FloorManager';

// Helper Component for Cleaning Timer
const CleaningTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const updateTimer = () => {
            if (!startTime) return;
            const start = new Date(startTime);
            const now = new Date();
            const diff = Math.floor((now - start) / 1000); // seconds

            if (diff < 0) {
                setElapsed('00:00');
                return;
            }

            const minutes = Math.floor(diff / 60);
            const seconds = diff % 60;
            const hours = Math.floor(minutes / 60);
            const displayMinutes = minutes % 60;

            const fmt = (n) => n.toString().padStart(2, '0');

            if (hours > 0) {
                setElapsed(`${fmt(hours)}:${fmt(displayMinutes)}:${fmt(seconds)}`);
            } else {
                setElapsed(`${fmt(displayMinutes)}:${fmt(seconds)}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <span className="font-mono text-xs font-black bg-white/20 px-1.5 py-0.5 rounded text-yellow-700">
            {elapsed}
        </span>
    );
};

const HotelManagement = ({ activeSubTab = 'habitaciones' }) => {
    // --- ESTADO GLOBAL ---
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(null);

    // --- DATOS DE LA SUCURSAL ACTIVA ---
    const [floors, setFloors] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);

    // --- ESTADO DE UI ---
    // --- ESTADO DE UI ---
    // viewMode replaced by activeSubTab prop
    const [currentDate, setCurrentDate] = useState(new Date());
    const [floorLayout, setFloorLayout] = useState('horizontal'); // 'vertical' | 'horizontal' -> Default Horizontal
    const [expandedFloors, setExpandedFloors] = useState({}); // { floorId: boolean }
    // Removed duplicate floorGroups for derived state

    // --- ESTADOS DE MODALES Y SELECCIONES ---
    const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [preSelectedBooking, setPreSelectedBooking] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [editingRoom, setEditingRoom] = useState(null);
    const [lastReceipt, setLastReceipt] = useState(null);
    const [historyBookings, setHistoryBookings] = useState([]);

    // ... (resto del código sin cambios hasta handleQuickCheckout)


    // =================================================================
    // 1. INICIALIZACIÓN: CARGAR SUCURSALES
    // =================================================================
    const fetchBranches = async () => {
        setLoading(true);
        try {
            // Promise.race para evitar que se quede cargando infinitamente
            const fetchPromise = supabase
                .from('branches')
                .select('*')
                .order('id', { ascending: true });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: La conexión tardó demasiado')), 5000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) throw error;

            if (data && data.length > 0) {
                setBranches(data);
                // Seleccionar la primera por defecto si no hay ninguna seleccionada
                if (!selectedBranchId) {
                    setSelectedBranchId(data[0].id);
                }
            } else {
                // Si no hay sucursales, intentar crear la "Sede Principal" por defecto
                await createDefaultBranch();
            }
        } catch (error) {
            console.error("Error al cargar sucursales:", error);
            // Si falla la carga, intentamos inicializar con datos vacíos para no bloquear la UI
            setBranches([]);
        } finally {
            setLoading(false);
        }
    };

    // =================================================================
    // 2. CARGA DE DATOS DE LA SEDE (Habitaciones, Pisos, Reservas)
    // =================================================================
    const loadBranchData = async () => {
        if (!selectedBranchId) return;
        setLoading(true);
        try {
            // 1. Cargar Pisos (Estructura)
            const { data: floorsData, error: floorsError } = await supabase
                .from('floors')
                .select('*')
                .eq('branch_id', selectedBranchId);
            // .order('level'); // Removed to avoid error if column missing

            if (floorsError) throw floorsError;
            const processedFloors = floorsData || [];

            // 2. Cargar Habitaciones (Independiente para asegurar que llegan todas)
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*') // No dependemos de join
                .eq('branch_id', selectedBranchId);

            if (roomsError) throw roomsError;
            const allRooms = roomsData || [];
            const allRoomIds = allRooms.map(r => r.id);

            // 3. Cargar Reservas y Historial
            let bookingsData = [];
            let historyData = [];

            if (allRoomIds.length > 0) {
                // Fetch Activas
                const { data: currentBookings, error: bookingsError } = await supabase
                    .from('bookings')
                    .select('*, guest:guests(*)') // Corrected relation: guests table, not profiles
                    .in('room_id', allRoomIds)
                    .neq('status', 'cancelada')
                    .limit(500);

                if (bookingsError) throw bookingsError;
                bookingsData = currentBookings;

                // Fetch Historial
                const { data: hist, error: histError } = await supabase
                    .from('bookings')
                    .select('*, guest:guests(*), room:rooms(number)') // Corrected relation
                    .in('room_id', allRoomIds)
                    .or('status.eq.checkout,status.eq.cancelada')
                    .order('check_out', { ascending: false })
                    .limit(50);

                historyData = hist || [];
            }

            // 4. Batch Updates & Grouping
            setFloors(processedFloors);
            setRooms(allRooms);
            setBookings(bookingsData || []);
            setHistoryBookings(historyData || []);

            // Agrupamiento Manual (Vital para UI)
            const grouped = {};
            // Inicializar grupos con los pisos existentes
            processedFloors.forEach(f => {
                grouped[f.id] = { ...f, rooms: [] };
            });

            // Asignar habitaciones a sus pisos
            let orphans = [];
            allRooms.forEach(room => {
                // Usar floor_id si existe, o intentar mapear por 'floor' number si es legacy
                const fId = room.floor_id;
                if (fId && grouped[fId]) {
                    grouped[fId].rooms.push(room);
                } else {
                    // Intento de fallback: si room.floor (legacy number) coincide con processedFloors.level o name?
                    // Mejor guardar en huérfanos
                    orphans.push(room);
                }
            });

            // Si hay huérfanos, ¿qué hacemos? 
            // Podríamos crear un grupo "Sin Asignar" o meterlos en el primer piso.
            // Por ahora, solo si hay orphans, los mostramos en consola debug.
            if (orphans.length > 0) {
                console.warn("Habitaciones sin piso asignado:", orphans.map(r => r.number));
                // Opcional: Meterlos en un grupo Dummy si queremos que se vean
                // const dummyId = 999999;
                // grouped[dummyId] = { id: dummyId, name: 'Sin Asignar', rooms: orphans };
            }

            // setFloorGroups(Object.values(grouped).sort((a, b) => (a.level || 0) - (b.level || 0)));

            // Expandir por defecto
            setExpandedFloors(prev => {
                const next = { ...prev };
                processedFloors.forEach(f => {
                    if (next[f.id] === undefined) next[f.id] = true;
                });
                return next;
            });
            console.log(`Carga: ${allRooms.length} habitaciones (orphans: ${orphans.length}), ${bookingsData.length} reservas.`);

        } catch (error) {
            console.error('Error loading branch data:', error);
            alert("⚠️ ERROR CRÍTICO CARGANDO DATOS:\n\n" + (error.message || JSON.stringify(error)));
            // sileo.error({ title: "Error de Carga", description: error.message });
        } finally {
            setLoading(false);
        }
    };    // Helper para expandir/colapsar pisos
    const toggleFloorExpanded = (floorId) => {
        setExpandedFloors(prev => ({
            ...prev,
            [floorId]: !prev[floorId]
        }));
    };

    // Efecto para cargar datos cuando cambia la sede
    useEffect(() => {
        if (selectedBranchId) {
            loadBranchData();
        }
    }, [selectedBranchId, currentDate]); // Recargar si cambia la fecha (para calendario si filtramos por fecha exacta)

    useEffect(() => {
        fetchBranches();
    }, []);

    // Crea una sede por defecto si no existe ninguna
    const createDefaultBranch = async () => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .insert([{
                    name: 'Sede Principal',
                    address: 'Dirección Principal',
                    phone: '0000000000',
                    active: true
                }])
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                setBranches(data);
                setSelectedBranchId(data[0].id);
            }
        } catch (error) {
            console.error("Error creando sede por defecto:", error);
        }
    };

    // Calcula el estado actual de una habitación basado en la fecha seleccionada
    const getRoomCurrentStatus = (room) => {
        // 1. Si está en limpieza hoy, prevalece (si la fecha seleccionada es HOY)
        const isToday = currentDate.toDateString() === new Date().toDateString();
        if (isToday && room.status === 'limpieza') {
            return { status: 'limpieza', booking: null };
        }

        // 2. Buscar reservas para la fecha seleccionada
        // Una reserva ocupa la habitación si:
        // (check_in <= selectedDate) AND (check_out > selectedDate)
        // Nota: check_out es el día de salida, así que ese día la habitación se libera (o pasa a limpieza)
        // Pero para efectos de "ocupación nocturna", cuenta hasta el día anterior.
        // Sin embargo, si queremos ver quién está hoy, incluimos el día de checkout como "ocupado" hasta que salgan.

        // Fix: Use local date string to avoid UTC shift issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const selectedDateStr = `${year}-${month}-${day}`;

        const activeBooking = bookings.find(b => {
            // 1. Check Room ID (loose equality for string/number mismatch)
            if (b.room_id != room.id) return false;

            // 2. Ignore cancelled
            if (b.status === 'cancelada') return false;
            // Note: We might want to see 'checkout' status as occupied for history, but usually they free the room.
            // If we want to show 'checkout' as a status on the card today, we should include it differently.
            // For now, let's keep hiding 'checkout' if it means "gone".
            if (b.status === 'checkout') return false;

            // 3. Date Comparison (String based to avoid Timezone shifts)
            const checkInStr = (b.check_in || '').split('T')[0];
            const checkOutStr = (b.check_out || '').split('T')[0];

            // Logic: Occupied if selectedDate is [checkIn, checkOut)
            // i.e. It includes checkIn day, but excludes checkOut day (guest leaves that morning)
            return selectedDateStr >= checkInStr && selectedDateStr < checkOutStr;
        });

        if (activeBooking) {
            return {
                status: activeBooking.status === 'ocupada' ? 'ocupada' : 'reservada',
                booking: activeBooking
            };
        }

        // 3. Si no hay reserva, está disponible
        // (A menos que la habitación en sí esté marcada como 'mantenimiento' en la BD, que podríamos agregar luego)
        return { status: 'disponible', booking: null };
    };

    const handleNewReservation = async (reservationData) => {
        setLoading(true);
        try {
            // Validar solapamiento de fechas
            const { data: conflicts, error: conflictError } = await supabase
                .from('bookings')
                .select('id')
                .eq('room_id', reservationData.room_id)
                .neq('status', 'cancelada')
                .neq('status', 'checkout')
                .or(`and(check_in.lte.${reservationData.check_out},check_out.gte.${reservationData.check_in})`);

            // Nota: La consulta OR de arriba es simplificada, para validación robusta postgreSQL range types son mejores.
            // Pero para MVP, confiamos en la lógica de cliente o backend simple.

            /*
            if (conflicts && conflicts.length > 0) {
                alert("Ya existe una reserva para esta habitación en las fechas seleccionadas.");
                setLoading(false);
                return;
            }
            */

            const { error } = await supabase
                .from('bookings')
                .insert([{
                    ...reservationData,
                    branch_id: selectedBranchId,
                    total_price: reservationData.total_price || 0
                }]);

            if (error) throw error;

            setIsNewReservationModalOpen(false);
            setPreSelectedBooking(null);
            await loadBranchData();

        } catch (error) {
            console.error("Error creando reserva:", error);
            alert("Error al crear reserva: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateReservation = async (id, updates) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            setIsNewReservationModalOpen(false);
            setPreSelectedBooking(null);
            await loadBranchData();
        } catch (error) {
            console.error("Error actualizando reserva:", error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickCheckout = async (booking, taxData, extraData) => {
        if (!booking) return;

        // Don't set global loading true to avoid full screen flicker
        // setLoading(true);
        try {
            // OPTIMISTIC UI UPDATE: Actualizar estado visualmente DE INMEDIATO
            setRooms(prevRooms => prevRooms.map(r => {
                if (r.id === booking.room_id) {
                    return { ...r, status: 'limpieza', features: { ...r.features, cleaning_start: new Date().toISOString() } };
                }
                return r;
            }));


            // 1. Actualizar estado de la reserva
            const { error: bookingError } = await supabase
                .from('bookings')
                .update({
                    status: 'checkout',
                    check_out: new Date().toISOString(), // Actualizar salida real
                    total_price: booking.total_price // Asegurar precio final
                })
                .eq('id', booking.id);

            if (bookingError) throw bookingError;

            // 2. Liberar habitación (Poner en limpieza) y guardar hora de inicio
            // Usamos la columna features para guardar el timestamp sin migración
            const { error: roomError } = await supabase
                .from('rooms')
                .update({
                    status: 'limpieza',
                    features: {
                        ...booking.room?.features,
                        cleaning_start: new Date().toISOString()
                    }
                })
                .eq('id', booking.room_id);

            if (roomError) throw roomError;

            // 3. Crear Registro en ORDERS para Facturación Electrónica (Shadow Order)
            // Esto permite que el checkout aparezca en el módulo de facturación
            const currentBranch = branches.find(b => b.id === selectedBranchId);
            const roomNumber = rooms.find(r => r.id === booking.room_id)?.number || '';

            // Calcular noches
            const startStr = booking.check_in.split('T')[0];
            const endStr = new Date().toISOString().split('T')[0]; // Fecha real de salida
            const start = new Date(startStr);
            const end = new Date(endStr);
            let nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            if (nights < 1) nights = 1; // Mínimo 1 noche

            const accommodationTotal = booking.price_per_night * nights; // Recalcular basado en noches reales o usar booking.total_price?
            // Mejor usamos booking.total_price seguro, pero para el item necesitamos desglose
            const finalTotal = extraData?.grandTotal || booking.total_price || 0;

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    customer_name: taxData?.names || booking.guest?.full_name || 'Huésped Hotel',
                    customer_phone: taxData?.phone || booking.guest?.phone,
                    table_number: `HAB-${roomNumber}`, // Identificador especial
                    status: 'pagado', // Ya sale pagado
                    total: finalTotal,
                    payment_method: 'efectivo', // Ojo: Deberíamos capturar el método real desde el modal
                    is_paid: true,
                    type: 'habitacion', // Nuevo tipo implícito
                    branch_id: selectedBranchId,
                    tax_data: taxData, // ¡CRÍTICO! Aquí van los datos de facturación
                    notes: `Checkout Habitación ${roomNumber}. Estadía: ${startStr} a ${endStr}`
                }])
                .select()
                .single();

            if (orderError) {
                console.error("Error creating shadow order:", orderError);
                // No bloqueamos el checkout si falla esto, pero avisamos
                // alert("Advertencia: No se pudo crear el registro para facturación.");
            } else {
                // Crear Items del Pedido (Alojamiento + Extras)
                const orderItems = [];

                // Item Alojamiento
                orderItems.push({
                    order_id: orderData.id,
                    product_id: null, // No es un producto del inventario
                    product_name: `Alojamiento Hab. ${roomNumber} (${nights} noches)`,
                    quantity: 1, // O nights? Factus prefiere cantidad 1 con valor total a veces, o unit * nights
                    unit_price: accommodationTotal,
                    price: accommodationTotal, // Legacy/New column fix
                    total: accommodationTotal
                });

                // Items Extras (Room Charges)
                if (extraData?.roomCharges?.length > 0) {
                    extraData.roomCharges.forEach(charge => {
                        orderItems.push({
                            order_id: orderData.id,
                            product_id: null,
                            product_name: charge.description || 'Consumo Extra Hotel',
                            quantity: 1,
                            unit_price: charge.amount,
                            price: charge.amount,
                            total: charge.amount
                        });
                    });
                }

                const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                if (itemsError) console.error("Error creating order items:", itemsError);
            }

            // 4. Generate Receipt Data for Printing (Legacy Logic preserved)
            const receiptItems = [
                {
                    quantity: nights,
                    product_name: `Alojamiento Hab. ${roomNumber}`,
                    unit_price: booking.price_per_night || (extraData?.accommodationTotal / nights) || 0,
                    total: extraData?.accommodationTotal || booking.total_price || 0,
                    tax_type: 'IVA_19'
                }
            ];

            // Add extra charges if available
            if (extraData?.roomCharges?.length > 0) {
                extraData.roomCharges.forEach(charge => {
                    receiptItems.push({
                        quantity: 1,
                        product_name: charge.description || 'Consumo Extra',
                        unit_price: charge.amount || 0,
                        total: charge.amount || 0,
                        tax_type: 'ICO_8'
                    });
                });
            }

            const receiptData = {
                id: orderData ? orderData.id : booking.id, // Preferimos el ID del pedido nuevo si existe
                prefix: 'HTL',
                created_at: new Date().toISOString(),
                type: taxData ? 'factura_hotel' : 'recibo',

                // Branch / Seller Info
                branch: {
                    name: currentBranch?.name || 'HOTEL',
                    nit: currentBranch?.nit || '900.876.543-1',
                    address: currentBranch?.address || currentBranch?.city || 'Ciudad Principal',
                    phone: currentBranch?.phone || '+57 300 000 0000',
                    resolution: currentBranch?.resolution || '187640000001',
                    resolution_date: currentBranch?.resolution_date || '2024/01/01',
                    resolution_range: currentBranch?.resolution_range || '1 - 5000',
                    type: currentBranch?.type || 'Régimen Común',
                    footer: currentBranch?.footer || 'Gracias por su visita'
                },

                // Buyer Info
                customer_name: taxData?.names || booking.guest?.full_name || 'CONSUMIDOR FINAL',
                customer_phone: taxData?.phone || booking.guest?.phone,
                customer_address: taxData?.address || booking.guest?.address || '',
                tax_data: taxData,

                // Items & Totals
                items: receiptItems,
                subtotal: finalTotal,
                total_price: finalTotal,
                payment_method: 'Efectivo', // This should technically come from PaymentModal

                // Electronic Invoice Mocks (Solo visual si no hay integración real aquí todavía)
                cufe: null,
                qr_code: null
            };

            console.log("Generating Receipt:", receiptData);
            setLastReceipt(receiptData);

            await loadBranchData(); // Refresh all data ensuring backend sync
            setSelectedBooking(null); // Close modal
        } catch (error) {
            console.error("Error en checkout:", error);
            alert("Error al procesar salida: " + error.message);
            await loadBranchData();
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (booking) => {
        if (!confirm(`¿Confirmar ingreso (Check-In) para ${booking.guest?.full_name || 'el huésped'}?`)) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'ocupada' })
                .eq('id', booking.id);
            if (error) throw error;

            await loadBranchData();
        } catch (error) {
            console.error("Error en check-in:", error);
            alert("Error al procesar ingreso: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFinishCleaning = async (room) => {
        if (!confirm(`¿La habitación ${room.number} está limpia y lista para usar?`)) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ status: 'disponible' })
                .eq('id', room.id);
            if (error) throw error;
            await loadBranchData();
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };



    const handlePrintHistory = async (booking) => {
        setLoading(true);
        try {
            // 1. Fetch Room Charges
            const { data: charges, error } = await supabase
                .from('room_charges')
                .select('*')
                .eq('booking_id', booking.id);

            if (error) throw error;

            // 2. Prepare Data
            const currentBranch = branches.find(b => b.id === selectedBranchId);
            const roomNumber = booking.room?.number || rooms.find(r => r.id === booking.room_id)?.number || '??';

            const start = new Date(booking.check_in);
            const end = new Date(booking.check_out);
            let nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            if (nights < 1) nights = 1;

            // Recalculate totals
            const accommodationTotal = (booking.price_per_night || 0) * nights;
            // Only add charges that have an amount
            const roomCharges = charges || [];

            const receiptItems = [
                {
                    quantity: nights,
                    product_name: `Alojamiento Hab. ${roomNumber} (Histórico)`,
                    unit_price: booking.price_per_night || 0,
                    total: accommodationTotal,
                    tax_type: 'IVA_19'
                }
            ];

            roomCharges.forEach(charge => {
                receiptItems.push({
                    quantity: 1,
                    product_name: charge.description || 'Consumo Extra',
                    unit_price: charge.amount || 0,
                    total: charge.amount || 0,
                    tax_type: 'ICO_8'
                });
            });

            // Calculate Subtotal and Total
            // Assuming booking.total_price is the final source of truth for history
            const finalTotal = booking.total_price || (accommodationTotal + roomCharges.reduce((a, c) => a + c.amount, 0));

            const receiptData = {
                id: booking.id,
                prefix: 'HTL',
                created_at: new Date().toISOString(), // Or booking.check_out
                type: 'recibo_copia', // Indicate copy

                // Branch Info
                branch: {
                    name: currentBranch?.name || 'HOTEL',
                    nit: currentBranch?.nit || '900.876.543-1',
                    address: currentBranch?.address || currentBranch?.city || 'Ciudad Principal',
                    phone: currentBranch?.phone || '+57 300 000 0000',
                    resolution: currentBranch?.resolution || '187640000001',
                    resolution_date: currentBranch?.resolution_date || '2024/01/01',
                    resolution_range: currentBranch?.resolution_range || '1 - 5000',
                    type: currentBranch?.type || 'Régimen Común',
                    footer: currentBranch?.footer || 'Copia de Recibo'
                },

                // Customer Info
                customer_name: booking.guest?.full_name || 'CONSUMIDOR FINAL',
                customer_phone: booking.guest?.phone,
                customer_address: booking.guest?.address || '',

                // Items
                items: receiptItems,
                subtotal: finalTotal,
                total_price: finalTotal,
                payment_method: 'Histórico'
            };

            setLastReceipt(receiptData);

        } catch (error) {
            console.error("Error al imprimir histórico:", error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // =================================================================
    // 4. RENDERIZADO
    // =================================================================

    // Agrupar habitaciones por piso (Floor)
    // Estructura: Floors explícitos de la DB + Habitaciones huérfanas
    const getFloorGroups = () => {
        const groups = floors.map(floor => ({
            id: floor.id,
            name: floor.name || `Piso ${floor.floor_number}`,
            rooms: rooms.filter(r => r.floor_id === floor.id)
        }));

        // Calculate stats for each group
        groups.forEach(group => {
            const stats = { disponible: 0, reservada: 0, ocupada: 0, limpieza: 0, mantenimiento: 0 };
            group.rooms.forEach(room => {
                const { status } = getRoomCurrentStatus(room);
                if (stats[status] !== undefined) stats[status]++;
                else stats.disponible++; // Fallback
            });
            group.stats = stats;
        });

        // Buscar habitaciones sin piso asignado (Huérfanas)
        const orphanRooms = rooms.filter(r => !r.floor_id);
        if (orphanRooms.length > 0) {
            groups.push({
                id: 'orphan',
                name: 'Sin Asignar',
                rooms: orphanRooms,
                stats: orphanRooms.reduce((acc, room) => {
                    const { status } = getRoomCurrentStatus(room);
                    if (acc[status] !== undefined) acc[status]++;
                    else acc.disponible++;
                    return acc;
                }, { disponible: 0, reservada: 0, ocupada: 0, limpieza: 0, mantenimiento: 0 })
            });
        }

        return groups;
    };

    const floorGroups = getFloorGroups();

    if (loading && branches.length === 0) {
        return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader className="animate-spin text-primary" size={48} /></div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50">
            {/* --- PORTAL CONTROLES AL HEADER --- */}
            {document.getElementById('header-actions-portal') && createPortal(
                <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                    {/* Branch Selector */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        {branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${selectedBranchId === branch.id
                                    ? 'bg-secondary text-white shadow-sm'
                                    : 'text-gray-400 hover:text-secondary hover:bg-gray-50'
                                    }`}
                            >
                                <Building size={12} />
                                {branch.name}
                            </button>
                        ))}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-7 pr-2 py-1 bg-transparent text-[10px] font-bold text-secondary focus:outline-none w-[90px] cursor-pointer"
                                value={currentDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                        const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                        setCurrentDate(newDate);
                                    }
                                }}
                            />
                            <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-2 py-1 rounded-md text-[9px] font-bold text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                            HOY
                        </button>
                    </div>

                    {/* Layout Toggles */}
                    <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => setFloorLayout('vertical')}
                            className={`p-1.5 rounded-lg transition-all ${floorLayout === 'vertical' ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Vista Vertical"
                        >
                            <LayoutList size={14} />
                        </button>
                        <button
                            onClick={() => setFloorLayout('horizontal')}
                            className={`p-1.5 rounded-lg transition-all ${floorLayout === 'horizontal' ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Vista Horizontal"
                        >
                            <Columns size={14} />
                        </button>
                    </div>

                    {/* New Room Button */}
                    <button
                        onClick={() => { setEditingRoom(null); setIsRoomModalOpen(true); }}
                        className="bg-primary text-white p-2 rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center"
                        title="Nueva Habitación"
                    >
                        <Plus size={16} />
                    </button>
                </div>,
                document.getElementById('header-actions-portal')
            )}

            {/* --- CONTENIDO PRINCIPAL --- */}
            {activeSubTab === 'habitaciones' ? (
                <div className={`transition-all duration-300 ${floorLayout === 'horizontal' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start' : 'space-y-4'}`}>
                    {branches.length === 0 && !loading ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-red-100 border-dashed w-full col-span-full">
                            <AlertCircle className="mx-auto text-red-300 mb-4" size={48} />
                            <p className="text-red-400 font-medium">No se encontraron sedes activas.</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">Puede ser un problema de conexión o permisos.</p>
                            <div className="flex gap-2 justify-center">
                                <button onClick={fetchBranches} className="px-6 py-2 bg-secondary text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-secondary/90 transition-all">Reintentar Carga</button>
                                <button onClick={createDefaultBranch} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-primary/90 transition-all">Crear Sede Default</button>
                            </div>
                        </div>
                    ) : floorGroups.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed w-full col-span-full">
                            <Settings className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-400 font-medium">Esta sede no tiene pisos ni habitaciones configuradas.</p>
                            <p className="mt-2 text-xs text-gray-400">Ve a "Pisos y Zonas" en el menú lateral para configurar.</p>
                        </div>
                    ) : (
                        floorGroups.map(group => (
                            <div
                                key={group.id}
                                className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${floorLayout === 'horizontal' ? 'w-full' : 'w-full'}`}
                            >
                                <div
                                    className="p-4 bg-gray-50/50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100"
                                    onClick={() => toggleFloorExpanded(group.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-all ${expandedFloors[group.id] ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                                            <Bed size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-secondary tracking-tight">{group.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{group.rooms.length} Habs</span>
                                                {/* Status Counters */}
                                                {group.stats.disponible > 0 && <span className="px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[9px] font-bold" title="Disponibles">{group.stats.disponible} D</span>}
                                                {group.stats.reservada > 0 && <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[9px] font-bold" title="Reservadas">{group.stats.reservada} R</span>}
                                                {group.stats.ocupada > 0 && <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[9px] font-bold" title="Ocupadas">{group.stats.ocupada} O</span>}
                                                {group.stats.limpieza > 0 && <span className="px-1.5 py-0.5 rounded-md bg-yellow-100 text-yellow-700 text-[9px] font-bold" title="Limpieza">{group.stats.limpieza} L</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className={`text-gray-400 transition-transform ${expandedFloors[group.id] ? 'rotate-90' : ''}`} />
                                </div>

                                {expandedFloors[group.id] && (
                                    <div className={`p-2 grid gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${floorLayout === 'horizontal'
                                        ? 'grid-cols-2' // Force 2 columns to make them smaller
                                        : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                                        }`}>
                                        {group.rooms.length === 0 && <p className="text-gray-400 text-xs italic col-span-full text-center">No hay habitaciones en este piso.</p>}

                                        {group.rooms.map(room => {
                                            const { status, booking } = getRoomCurrentStatus(room);
                                            return (
                                                <div key={room.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between overflow-hidden">

                                                    {/* Header Card: Status & Edit */}
                                                    <div className={`p-1.5 flex justify-between items-start ${status === 'ocupada' ? 'bg-primary/5' : status === 'reservada' ? 'bg-orange-50' : status === 'limpieza' ? 'bg-yellow-50' : 'bg-gray-50/50'}`}>
                                                        <div className={`p-1 rounded-lg shadow-sm ${status === 'ocupada' ? 'bg-primary text-white' :
                                                            status === 'reservada' ? 'bg-orange-500 text-white' :
                                                                status === 'limpieza' ? 'bg-yellow-400 text-white' :
                                                                    'bg-emerald-500 text-white'
                                                            }`}>
                                                            {status === 'limpieza' ? <Wind size={12} className="animate-spin-slow" /> :
                                                                status === 'ocupada' ? <Users size={12} /> :
                                                                    status === 'reservada' ? <Calendar size={12} /> :
                                                                        <Key size={12} />}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingRoom(room); setIsRoomModalOpen(true); }}
                                                            className="p-1 bg-white text-gray-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors border border-gray-100 shadow-sm"
                                                            title="Editar Habitación"
                                                        >
                                                            <Edit size={10} />
                                                        </button>
                                                    </div>

                                                    {/* Body: Info */}
                                                    <div className="px-2 py-1 text-center">
                                                        <h4 className="text-sm font-black text-secondary tracking-tight">#{room.number}</h4>
                                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{room.type}</p>

                                                        {/* Amenities Row */}
                                                        <div className="flex justify-center gap-1 mb-1 flex-wrap min-h-[16px]">
                                                            {room.features?.ac && <Wind size={10} className="text-blue-400" title="Aire Acondicionado" />}
                                                            {room.features?.tv && <Tv size={10} className="text-gray-600" title="TV" />}
                                                            {room.features?.wifi && <Wifi size={10} className="text-indigo-500" title="WiFi" />}
                                                            <div className="flex items-center gap-0.5 text-gray-400" title="Camas">
                                                                <Bed size={10} />
                                                                <span className="text-[8px] font-bold">{room.features?.beds || 1}</span>
                                                            </div>
                                                        </div>

                                                        {/* Cleaning Timer */}
                                                        {status === 'limpieza' && (
                                                            <div className="bg-yellow-100/50 p-1 rounded-lg mb-1 flex flex-col items-center">
                                                                {room.features?.cleaning_start && <CleaningTimer startTime={room.features.cleaning_start} />}
                                                            </div>
                                                        )}

                                                        {/* Guest Name if Occupied/Reserved */}
                                                        {(status === 'ocupada' || status === 'reservada') && (
                                                            <div className="bg-white border border-gray-100 p-1 rounded-lg mb-1 shadow-sm">
                                                                <p className="text-[9px] font-bold text-secondary truncate max-w-[80px] mx-auto">
                                                                    {booking?.guest?.full_name || 'Huésped'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>


                                                    {/* Footer: Actions */}
                                                    <div className="p-1.5 bg-gray-50/50 border-t border-gray-100 flex flex-col gap-1">
                                                        {status === 'disponible' ? (
                                                            <div className="grid grid-cols-2 gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0], status: 'ocupada' });
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                    className="bg-secondary text-white py-1 rounded text-[8px] font-black uppercase hover:bg-secondary/90 shadow-sm"
                                                                    title="Check-In Rápido"
                                                                >
                                                                    IN
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0] });
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                    className="bg-white text-secondary border border-gray-200 py-1 rounded text-[8px] font-black uppercase hover:bg-gray-50 shadow-sm"
                                                                    title="Reservar"
                                                                >
                                                                    RES
                                                                </button>
                                                            </div>
                                                        ) : status === 'limpieza' ? (
                                                            <button
                                                                onClick={() => handleFinishCleaning(room)}
                                                                className="w-full bg-yellow-400 text-white py-1 rounded text-[8px] font-black uppercase hover:bg-yellow-500 shadow-sm flex items-center justify-center gap-1"
                                                            >
                                                                <Check size={10} /> OK
                                                            </button>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-1">
                                                                <button
                                                                    onClick={() => setSelectedBooking(booking)}
                                                                    className="bg-white text-secondary border border-gray-200 py-1 rounded text-[8px] font-black uppercase hover:bg-gray-50 shadow-sm flex justify-center items-center"
                                                                    title="Ver Detalles"
                                                                >
                                                                    <Search size={10} />
                                                                </button>
                                                                {status === 'ocupada' ? (
                                                                    <button
                                                                        onClick={() => setSelectedBooking(booking)}
                                                                        className="bg-red-50 text-red-500 border border-red-100 py-1 rounded text-[8px] font-black uppercase hover:bg-red-100"
                                                                        title="Check-Out"
                                                                    >
                                                                        OUT
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleCheckIn(booking)}
                                                                        className="bg-blue-50 text-blue-600 border border-blue-100 py-1 rounded text-[8px] font-black uppercase hover:bg-blue-100"
                                                                        title="Check-In"
                                                                    >
                                                                        IN
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            ) : activeSubTab === 'floors' ? (
                <FloorManager branchId={selectedBranchId} onFloorUpdated={loadBranchData} />
            ) : activeSubTab === 'calendario' ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-180px)]">
                    {/* Calendar Controls */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h3 className="text-lg font-black text-secondary capitalize">
                                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <div className="flex gap-4 text-xs font-bold text-gray-400">
                            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Reservada</div>
                            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary"></span> Ocupada</div>
                            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> Checkout</div>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="flex-1 overflow-auto relative flex flex-col">
                        {(() => {
                            const year = currentDate.getFullYear();
                            const month = currentDate.getMonth();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

                            return (
                                <>
                                    {/* Days Header */}
                                    <div className="flex bg-white border-b border-gray-300 shadow-sm z-40 sticky top-0 min-w-max">
                                        <div className="w-48 flex-shrink-0 p-3 font-bold text-gray-500 border-r border-gray-300 bg-gray-100 flex items-center justify-center sticky left-0 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                                            Habitación
                                        </div>
                                        <div className="flex-1 flex">
                                            {days.map(day => (
                                                <div key={day.toISOString()} className={`flex-1 min-w-[30px] p-1 text-center border-r border-gray-300 flex flex-col items-center justify-center ${day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth() ? 'bg-primary/10' : ''
                                                    }`}>
                                                    <span className="text-[9px] uppercase font-bold text-gray-500">{day.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 2)}</span>
                                                    <span className={`text-xs font-black ${day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth() ? 'text-primary' : 'text-secondary'
                                                        }`}>{day.getDate()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scrollable Body */}
                                    <div className="flex-1 min-w-max">
                                        {floorGroups.map(group => (
                                            <React.Fragment key={group.id}>
                                                {/* Floor Header Row */}
                                                <div
                                                    className="bg-gray-200 border-b border-gray-300 py-2 px-4 sticky left-0 z-30 w-full font-black text-xs text-gray-700 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-gray-300 transition-colors"
                                                    onClick={() => toggleFloorExpanded(group.id)}
                                                >
                                                    <ChevronRight size={16} className={`transition-transform ${expandedFloors[group.id] !== false ? 'rotate-90' : ''}`} />
                                                    {group.name}
                                                </div>

                                                {expandedFloors[group.id] !== false && group.rooms.map(room => (
                                                    <div key={room.id} className="flex border-b border-gray-300 hover:bg-gray-50 transition-colors h-[50px]">
                                                        {/* Room Name Column */}
                                                        <div className="w-48 flex-shrink-0 p-2 font-bold text-secondary border-r border-gray-300 bg-white flex flex-col justify-center sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                            <span className="text-sm">#{room.number}</span>
                                                            <span className="text-[10px] text-gray-400 truncate">{room.type}</span>
                                                        </div>

                                                        {/* Days Cells & Bookings */}
                                                        <div className="flex-1 flex relative">
                                                            {/* Background Grid Cells */}
                                                            {days.map(day => (
                                                                <div
                                                                    key={day.toISOString()}
                                                                    className="flex-1 min-w-[30px] border-r border-gray-300 h-full cursor-pointer hover:bg-primary/5 transition-colors relative"
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({
                                                                            roomId: room.id,
                                                                            checkIn: day.toISOString().split('T')[0]
                                                                        });
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                ></div>
                                                            ))}

                                                            {/* Render Bookings for this Room */}
                                                            {bookings
                                                                .filter(b => b.room_id == room.id && b.status !== 'cancelada')
                                                                .map(booking => {
                                                                    // Safe Parse for Calendar
                                                                    const parseDate = (dateStr) => {
                                                                        if (!dateStr) return new Date(0);
                                                                        const part = dateStr.split('T')[0];
                                                                        const [y, m, d] = part.split('-').map(Number);
                                                                        return new Date(y, m - 1, d);
                                                                    };

                                                                    const bCheckIn = parseDate(booking.check_in);
                                                                    const bCheckOut = parseDate(booking.check_out);

                                                                    const monthStart = new Date(year, month, 1);
                                                                    const monthEnd = new Date(year, month + 1, 0);

                                                                    // Simplify comparisons to timestamps for safety
                                                                    if (bCheckOut.getTime() <= monthStart.getTime() || bCheckIn.getTime() > monthEnd.getTime()) return null;

                                                                    const visibleStart = bCheckIn < monthStart ? monthStart : bCheckIn;
                                                                    const visibleEnd = bCheckOut > monthEnd ? monthEnd : bCheckOut;

                                                                    const daysInMonthTotal = daysInMonth;
                                                                    const dayWidthPercent = 100 / daysInMonthTotal;

                                                                    // Calculate start index relative to month start
                                                                    // (VisibleStart - MonthStart) in days
                                                                    const startIndex = Math.floor((visibleStart - monthStart) / (1000 * 60 * 60 * 24));

                                                                    let duration = (visibleEnd - visibleStart) / (1000 * 60 * 60 * 24);
                                                                    if (duration < 1) duration = 1;

                                                                    return (
                                                                        <div
                                                                            key={booking.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPreSelectedBooking(booking);
                                                                                setIsNewReservationModalOpen(true);
                                                                            }}
                                                                            className={`absolute top-1 bottom-1 rounded-md shadow-sm border border-white/20 px-1 flex items-center overflow-hidden cursor-pointer hover:brightness-110 hover:shadow-md transition-all z-10 
                                                                                                ${booking.status === 'ocupada' ? 'bg-primary text-white' :
                                                                                    booking.status === 'reservada' ? 'bg-orange-500 text-white' : 'bg-gray-400 text-white'}`}
                                                                            style={{
                                                                                left: `${startIndex * dayWidthPercent}%`,
                                                                                width: `${duration * dayWidthPercent}%`,
                                                                            }}
                                                                            title={`${booking.guest?.full_name || 'Huésped'}`}
                                                                        >
                                                                            <span className="text-[9px] font-bold truncate leading-none">
                                                                                {booking.guest?.first_name || booking.guest?.full_name || 'Huésped'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })
                                                            }
                                                        </div>
                                                    </div>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            ) : activeSubTab === 'historial' ? (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="font-black text-secondary mb-4 flex items-center gap-2">
                        <History size={18} /> Historial de Reservas
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                                    <th className="pb-3 pl-2">Huésped</th>
                                    <th className="pb-3">Habitación</th>
                                    <th className="pb-3">Entrada</th>
                                    <th className="pb-3">Salida</th>
                                    <th className="pb-3 text-right">Total</th>
                                    <th className="pb-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {historyBookings.map(booking => (
                                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pl-2">
                                            <p className="font-bold text-secondary text-sm">{booking.guest?.full_name || 'Desconocido'}</p>
                                            <p className="text-[10px] text-gray-400">{booking.guest?.phone}</p>
                                        </td>
                                        <td className="py-3">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">
                                                {booking.room?.number}
                                            </span>
                                        </td>
                                        <td className="py-3 text-xs font-medium text-gray-500">{booking.check_in}</td>
                                        <td className="py-3 text-xs font-medium text-gray-500">{booking.check_out}</td>
                                        <td className="py-3 text-right font-black text-secondary text-sm">
                                            ${booking.total_price?.toLocaleString()}
                                        </td>
                                        <td className="py-3 text-center">
                                            <button
                                                onClick={() => handlePrintHistory(booking)}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                title="Reimprimir Recibo"
                                            >
                                                <Printer size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {historyBookings.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-gray-400 text-xs italic">
                                            No hay historial disponible.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {/* --- MODALES --- */}

            {/* New Reservation Modal */}
            <NewReservationModal
                isOpen={isNewReservationModalOpen}
                onClose={() => { setIsNewReservationModalOpen(false); setPreSelectedBooking(null); }}
                rooms={rooms}
                initialData={preSelectedBooking}
                bookingToEdit={preSelectedBooking?.id ? preSelectedBooking : null}
                onReservationCreated={loadBranchData}
                branchId={selectedBranchId}
            />

            {/* Room Edit/Create Modal */}
            <RoomModal
                isOpen={isRoomModalOpen}
                onClose={() => setIsRoomModalOpen(false)}
                room={editingRoom}
                existingFloors={floors}
                branchId={selectedBranchId}
                onRoomSaved={loadBranchData}
            />

            {/* Reservation Details / Checkout Modal */}
            {selectedBooking && (
                <ReservationDetailsModal
                    booking={selectedBooking}
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onCheckOut={(booking, taxData, extraData) => {
                        handleQuickCheckout(booking, taxData, extraData);
                    }}
                />
            )}

            {/* Ticket Printer */}
            {lastReceipt && (
                <TicketPrinter
                    order={lastReceipt}
                    type={lastReceipt.type || 'recibo'}
                    onAfterPrint={() => setLastReceipt(null)}
                />
            )}
            {/* DEBUG OVERLAY - TEMPORARY */}
            <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-xl z-[9999] text-xs max-w-sm shadow-2xl border border-white/20">
                <p className="font-bold border-b border-gray-600 pb-2 mb-2 flex justify-between items-center">
                    <span>Debug Info</span>
                    <button onClick={() => loadBranchData()} className="bg-white/20 px-2 py-0.5 rounded hover:bg-white/30">Reload</button>
                </p>
                <div className="space-y-1 font-mono">
                    <p>Branch ID: <span className="text-yellow-400 font-bold">{selectedBranchId}</span></p>
                    <p>Reservas en memoria: <span className="text-green-400 font-bold">{bookings.length}</span></p>
                    <p>Habitaciones: <span className="text-blue-400 font-bold">{rooms.length}</span></p>
                    <p>Current Date: {currentDate.toISOString().split('T')[0]}</p>
                    {bookings.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] opacity-75">
                            <p>First Booking:</p>
                            <p>ID: {bookings[0].id}</p>
                            <p>In: {bookings[0].check_in}</p>
                            <p>Out: {bookings[0].check_out}</p>
                            <p>Room: {bookings[0].room_id} ({typeof bookings[0].room_id})</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default HotelManagement;
