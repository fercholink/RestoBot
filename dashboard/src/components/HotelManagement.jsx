import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Bed, Calendar, Key, Users, History, Settings, Bell, Star, MapPin, Search, Plus, Loader, Trash2, Edit, Tv, Wifi, Wind, ChevronLeft, ChevronRight, Building, Check, Hash, LayoutList, Columns, Inbox, AlertCircle, Wrench, Filter, X, DollarSign, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';
import { emitInvoiceForOrder } from '../services/invoiceHelper';
import NewReservationModal from './NewReservationModal';
import RoomModal from './RoomModal';
import ReservationDetailsModal from './ReservationDetailsModal';
import PaymentModal from './PaymentModal';
import TicketPrinter from './TicketPrinter';
import FloorManager from './FloorManager';
import ChannelInbox from './ChannelInbox';
import TapeChart from './TapeChart';
import HousekeepingApp from './HousekeepingApp';
import HotelAnalytics from './HotelAnalytics';
import GuestCRM from './GuestCRM';
import HotelMapDesigner from './HotelMapDesigner';
import { useAuth } from '../context/AuthContext';

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
    const { user: currentUser } = useAuth();
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

    // Búsqueda y filtro de habitaciones
    const [roomSearch, setRoomSearch] = useState('');
    const [roomStatusFilter, setRoomStatusFilter] = useState('all');

    // ... (resto del código sin cambios hasta handleQuickCheckout)


    // =================================================================
    // 1. INICIALIZACIÓN: CARGAR SUCURSALES
    // =================================================================
    const fetchBranches = async () => {
        setLoading(true);
        try {
            // El aislamiento multi-tenant lo maneja RLS en Supabase.
            // No filtramos por organization_id aquí para no romper sedes
            // que aún no tienen ese campo asignado (migración gradual).
            const branchesQuery = supabase.from('branches').select('*').order('id', { ascending: true });

            // Promise.race para evitar que se quede cargando infinitamente
            const fetchPromise = branchesQuery;

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
                .eq('branch_id', selectedBranchId)
                .order('name', { ascending: true }); // Ensure floors don't jump randomly

            if (floorsError) throw floorsError;
            const processedFloors = floorsData || [];

            // 2. Cargar Habitaciones (Independiente para asegurar que llegan todas)
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*')
                .eq('branch_id', selectedBranchId)
                .order('number', { ascending: true }); // Prevent random jumping when updating status

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
            sileo.error({ title: 'Error de Carga', description: error.message || JSON.stringify(error) });
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
        if (currentUser) {
            fetchBranches();
        }
    }, [currentUser]);

    // Crea una sede por defecto si no existe ninguna, tomando datos de la empresa
    const createDefaultBranch = async () => {
        try {
            // Intentar traer los datos de la empresa configurados en contabilidad
            const { data: orgConfig } = await supabase
                .from('tenant_accounting_config')
                .select('*')
                .eq('organization_id', currentUser?.organization_id)
                .maybeSingle();

            const branchData = {
                name: orgConfig?.business_name || 'Sede Principal',
                address: orgConfig?.address || 'Dirección Principal',
                city: orgConfig?.city || '',
                phone: orgConfig?.phone || '0000000000',
                nit: orgConfig?.document_number || '',
                active: true,
                organization_id: currentUser?.organization_id || null
            };

            const { data, error } = await supabase
                .from('branches')
                .insert([branchData])
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                setBranches(data);
                setSelectedBranchId(data[0].id);
                sileo.info({ title: 'Sede Inicial Creada', description: 'Se creó una sede por defecto con los datos de tu empresa.' });
            }
        } catch (error) {
            console.error("Error creando sede por defecto:", error);
        }
    };

    // Calcula el estado actual de una habitación basado en la fecha seleccionada
    const getRoomCurrentStatus = (room) => {
        // 0. Mantenimiento prevalece sobre todo (campo directo o housekeeping_status)
        if (room.status === 'mantenimiento' || room.housekeeping_status === 'mantenimiento') {
            return { status: 'mantenimiento', booking: null };
        }

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
            const { data: conflicts } = await supabase
                .from('bookings')
                .select('id')
                .eq('room_id', reservationData.room_id)
                .neq('status', 'cancelada')
                .neq('status', 'checkout')
                .or(`and(check_in.lte.${reservationData.check_out},check_out.gte.${reservationData.check_in})`);

            if (conflicts && conflicts.length > 0) {
                sileo.error({ title: 'Conflicto de fechas', description: 'Ya existe una reserva para esta habitación en las fechas seleccionadas.' });
                setLoading(false);
                return;
            }

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
            sileo.error({ title: 'Error al crear reserva', description: error.message });
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
            sileo.error({ title: 'Error al actualizar reserva', description: error.message });
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
            const currentRoom = rooms.find(r => r.id === booking.room_id);
            const currentFeatures = currentRoom?.features || {};

            const { error: roomError } = await supabase
                .from('rooms')
                .update({
                    status: 'limpieza',
                    features: {
                        ...currentFeatures,
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

            const accommodationTotal = (booking.price_per_night || 0) * nights;
            const finalTotal = extraData?.grandTotal || booking.total_price || 0;

            // Construír payload solo con columnas que existen en la tabla orders
            const shadowOrderPayload = {
                customer_name: taxData?.names || booking.guest?.full_name || 'Huésped Hotel',
                customer_phone: taxData?.phone || booking.guest?.phone || null,
                table_number: `HAB-${roomNumber}`,
                status: 'pagado',
                total: finalTotal,
                payment_method: 'efectivo',
                is_paid: true,
                branch_id: selectedBranchId,
                tax_data: taxData || null,
                notes: `Checkout Habitación ${roomNumber}. Estadía: ${startStr} a ${endStr}`
            };

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([shadowOrderPayload])
                .select()
                .single();

            if (orderError) {
                console.error("Error creating shadow order:", orderError);
                sileo.error({ title: 'Advertencia Contabilidad', description: `Checkout realizado, pero no se registró en contabilidad: ${orderError.message}` });
            } else {
                console.log('[Hotel] Shadow order creado:', orderData.id);

                // Auto-factura electrónica: si el huésped proporcionó datos fiscales, emitir DIAN automáticamente
                if (taxData?.identification) {
                    sileo.info({ title: 'Generando factura DIAN...', description: 'Emitiendo factura electrónica en Factus.' });
                    const invoiceResult = await emitInvoiceForOrder({ ...orderData, tax_data: taxData });
                    if (invoiceResult.success) {
                        sileo.success({ title: '✓ Factura Electrónica Emitida', description: `Documento ${invoiceResult.bill.number} registrado ante la DIAN.` });
                    } else {
                        sileo.error({ title: 'Error Factura Electrónica', description: invoiceResult.error + ' — Puedes emitirla manualmente en Contabilidad → Facturación DIAN.' });
                    }
                }

                // Crear Items del Pedido (Alojamiento + Extras)
                const orderItems = [];

                // Item Alojamiento
                orderItems.push({
                    order_id: orderData.id,
                    product_id: null,
                    product_name: `Alojamiento Hab. ${roomNumber} (${nights} noches)`,
                    quantity: nights,
                    unit_price: booking.price_per_night || 0,
                    price: booking.price_per_night || 0,
                    total: accommodationTotal
                });

                // Items Extras (Room Charges sumados de los pedios del restaurante / adiciones)
                if (extraData?.roomCharges?.length > 0) {
                    extraData.roomCharges.forEach(charge => {
                        // Si el cargo viene de una orden, extraer los items (si ya los incluimos en la consulta al cargar history/charges)
                        // Como en charge tenemos amount y description, mapemoslo como 1 item genérico, EXCEPTO que sepamos el detalle.
                        // Para facilitar la facturación detallada, vamos a intentar ver si existe un breakdown.
                        if (charge.orders && charge.orders.order_items && charge.orders.order_items.length > 0) {
                            // Sub-items of the order
                            charge.orders.order_items.forEach(cItem => {
                                orderItems.push({
                                    order_id: orderData.id,
                                    product_id: cItem.product_id || null,
                                    product_name: cItem.product_name || 'Item de Cocina',
                                    quantity: cItem.quantity || 1,
                                    unit_price: cItem.unit_price || cItem.price || 0,
                                    price: cItem.price || cItem.unit_price || 0,
                                    total: (cItem.quantity || 1) * (cItem.unit_price || cItem.price || 0)
                                });
                            });
                        } else {
                            // Genérico si no viene de una orden específica de POS con items
                            orderItems.push({
                                order_id: orderData.id,
                                product_id: null,
                                product_name: charge.description || 'Consumo Extra Hotel',
                                quantity: 1,
                                unit_price: charge.amount || 0,
                                price: charge.amount || 0,
                                total: charge.amount || 0
                            });
                        }
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
            sileo.error({ title: 'Error en Checkout', description: error.message });
            await loadBranchData();
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (booking) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'ocupada' })
                .eq('id', booking.id);
            if (error) throw error;

            sileo.success({ title: 'Check-In realizado', description: `${booking.guest?.full_name || 'Huésped'} ha ingresado.` });
            await loadBranchData();
        } catch (error) {
            console.error("Error en check-in:", error);
            sileo.error({ title: 'Error en Check-In', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleFinishCleaning = async (room) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ status: 'disponible', housekeeping_status: 'limpio' })
                .eq('id', room.id);
            if (error) throw error;
            sileo.success({ title: 'Limpieza finalizada', description: `Hab. ${room.number} disponible.` });
            await loadBranchData();
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSetMaintenance = async (room) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ status: 'mantenimiento', housekeeping_status: 'mantenimiento' })
                .eq('id', room.id);
            if (error) throw error;
            sileo.success({ title: 'Mantenimiento activado', description: `Hab. ${room.number} en mantenimiento.` });
            await loadBranchData();
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleEndMaintenance = async (room) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ status: 'disponible', housekeeping_status: 'limpio' })
                .eq('id', room.id);
            if (error) throw error;
            sileo.success({ title: 'Mantenimiento finalizado', description: `Hab. ${room.number} disponible.` });
            await loadBranchData();
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
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
            sileo.error({ title: 'Error al imprimir', description: error.message });
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
        const applyFilters = (r) => {
            if (roomSearch) {
                const q = roomSearch.toLowerCase();
                if (!r.number?.toString().toLowerCase().includes(q) &&
                    !r.type?.toLowerCase().includes(q)) return false;
            }
            if (roomStatusFilter !== 'all') {
                const { status } = getRoomCurrentStatus(r);
                if (status !== roomStatusFilter) return false;
            }
            return true;
        };

        const groups = floors.map(floor => ({
            id: floor.id,
            name: floor.name || `Piso ${floor.floor_number}`,
            rooms: rooms.filter(r => r.floor_id === floor.id && applyFilters(r))
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
        const orphanRooms = rooms.filter(r => !r.floor_id && applyFilters(r));
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
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* --- PORTAL CONTROLES AL HEADER --- */}
            {document.getElementById('header-actions-portal') && createPortal(
                <div className="flex flex-wrap items-center gap-4 animate-in fade-in zoom-in duration-500">
                    {/* Branch Selector */}
                    <div className="flex items-center gap-1 bg-canvas p-1.5 rounded-full border border-hairline shadow-sm">
                        {branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${selectedBranchId === branch.id
                                    ? 'bg-secondary text-white shadow-airbnb'
                                    : 'text-accent hover:text-secondary hover:bg-surface-soft'
                                    }`}
                            >
                                <Building size={14} className="mr-2" />
                                {branch.name}
                            </button>
                        ))}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-canvas p-1.5 rounded-full border border-hairline shadow-sm">
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-10 pr-4 py-2.5 bg-transparent text-[12px] font-bold text-secondary focus:outline-none w-[140px] cursor-pointer"
                                value={currentDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                        const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                        setCurrentDate(newDate);
                                    }
                                }}
                            />
                            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
                        </div>
                        <div className="w-px h-6 bg-hairline"></div>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-6 py-2.5 rounded-full text-[11px] font-bold text-accent hover:text-primary hover:bg-primary/10 transition-all uppercase tracking-widest"
                        >
                            HOY
                        </button>
                    </div>

                    {/* Layout Toggles */}
                    <div className="flex bg-canvas p-1.5 rounded-full border border-hairline shadow-sm">
                        <button
                            onClick={() => setFloorLayout('vertical')}
                            className={`p-2.5 rounded-full transition-all duration-300 ${floorLayout === 'vertical' ? 'bg-secondary text-white shadow-airbnb' : 'text-accent hover:text-secondary hover:bg-surface-soft'}`}
                            title="Vista Vertical"
                        >
                            <LayoutList size={16} />
                        </button>
                        <button
                            onClick={() => setFloorLayout('horizontal')}
                            className={`p-2.5 rounded-full transition-all duration-300 ${floorLayout === 'horizontal' ? 'bg-secondary text-white shadow-airbnb' : 'text-accent hover:text-secondary hover:bg-surface-soft'}`}
                            title="Vista Horizontal"
                        >
                            <Columns size={16} />
                        </button>
                    </div>

                    {/* Search + Status Filter (solo tab habitaciones) */}
                    {activeSubTab === 'habitaciones' && (
                        <>
                            {/* Search */}
                            <div className="relative bg-canvas rounded-full shadow-sm border border-hairline group">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent pointer-events-none transition-colors group-focus-within:text-primary" />
                                <input
                                    type="text"
                                    placeholder="Buscar hab..."
                                    value={roomSearch}
                                    onChange={e => setRoomSearch(e.target.value)}
                                    className="pl-10 pr-10 py-2.5 bg-transparent text-[12px] font-bold text-secondary focus:outline-none focus:ring-0 w-40"
                                />
                                {roomSearch && (
                                    <button onClick={() => setRoomSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-hairline hover:text-danger">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-1 bg-canvas p-1.5 rounded-full border border-hairline shadow-sm">
                                {[
                                    { val: 'all', label: 'Todo' },
                                    { val: 'disponible', label: 'D', cls: 'hover:bg-success/5 text-success', active: 'bg-success text-white shadow-airbnb' },
                                    { val: 'reservada', label: 'R', cls: 'hover:bg-warning/5 text-warning', active: 'bg-warning text-white shadow-airbnb' },
                                    { val: 'ocupada', label: 'O', cls: 'hover:bg-primary/5 text-primary', active: 'bg-primary text-white shadow-airbnb' },
                                    { val: 'limpieza', label: 'L', cls: 'hover:bg-yellow-50 text-yellow-600', active: 'bg-yellow-500 text-white shadow-airbnb' },
                                    { val: 'mantenimiento', label: 'M', cls: 'hover:bg-violet-50 text-violet-600', active: 'bg-violet-600 text-white shadow-airbnb' },
                                ].map(({ val, label, cls = '', active = 'bg-secondary text-white shadow-airbnb' }) => (
                                    <button
                                        key={val}
                                        onClick={() => setRoomStatusFilter(val)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${roomStatusFilter === val
                                                ? active
                                                : `text-accent ${cls}`
                                            }`}
                                        title={val}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* New Room Button */}
                    <button
                        onClick={() => { setEditingRoom(null); setIsRoomModalOpen(true); }}
                        className="bg-primary text-white w-12 h-12 rounded-full hover:shadow-airbnb transition-all flex items-center justify-center active:scale-95 group"
                        title="Nueva Habitación"
                    >
                        <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>,
                document.getElementById('header-actions-portal')
            )}

            {/* --- CONTENIDO PRINCIPAL --- */}
            {activeSubTab === 'habitaciones' ? (
                <div className={`transition-all duration-500 ${floorLayout === 'horizontal' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 items-start' : 'space-y-8'}`}>
                    {branches.length === 0 && !loading ? (
                        <div className="text-center py-32 bg-canvas rounded-[40px] border border-hairline border-dashed w-full col-span-full shadow-sm">
                            <AlertCircle className="mx-auto text-danger/30 mb-6" size={64} />
                            <h3 className="text-xl font-bold text-secondary tracking-tight">Sin Sedes Activas</h3>
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest mt-2 mb-8">Inicializa la plataforma para continuar</p>
                            <div className="flex gap-4 justify-center">
                                <button onClick={fetchBranches} className="px-8 py-3 bg-canvas border border-hairline rounded-full text-[11px] font-bold uppercase tracking-widest shadow-sm hover:shadow-airbnb transition-all">Reintentar</button>
                                <button onClick={createDefaultBranch} className="px-8 py-3 bg-primary text-white rounded-full text-[11px] font-bold uppercase tracking-widest shadow-airbnb hover:scale-105 transition-all">Crear Sede</button>
                            </div>
                        </div>
                    ) : floorGroups.length === 0 ? (
                        <div className="text-center py-32 bg-canvas rounded-[40px] border border-hairline border-dashed w-full col-span-full shadow-sm">
                            <Bed className="mx-auto text-accent/20 mb-6" size={64} />
                            <h3 className="text-xl font-bold text-secondary tracking-tight">Configura tu Hotel</h3>
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest mt-2">Agrega pisos y habitaciones para comenzar</p>
                        </div>
                    ) : (
                        floorGroups.map(group => (
                            <div
                                key={group.id}
                                className={`bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden transition-all duration-500 mb-2 ${floorLayout === 'horizontal' ? 'w-full' : 'w-full hover:shadow-airbnb'}`}
                            >
                                <div
                                    className="p-6 flex justify-between items-center cursor-pointer hover:bg-surface-soft/50 transition-colors border-b border-hairline"
                                    onClick={() => toggleFloorExpanded(group.id)}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-12 h-12 rounded-[18px] transition-all flex items-center justify-center ${expandedFloors[group.id] ? 'bg-primary/10 text-primary' : 'bg-surface-soft text-accent'}`}>
                                            <Bed size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-secondary tracking-tight">{group.name}</h3>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[10px] text-accent font-bold uppercase tracking-widest">{group.rooms.length} HABITACIONES</span>
                                                <div className="flex items-center gap-1.5">
                                                    {group.stats.disponible > 0 && <span className="w-2 h-2 rounded-full bg-success" title="Disponible" />}
                                                    {group.stats.ocupada > 0 && <span className="w-2 h-2 rounded-full bg-primary" title="Ocupada" />}
                                                    {group.stats.reservada > 0 && <span className="w-2 h-2 rounded-full bg-warning" title="Reservada" />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className={`text-accent transition-transform duration-500 ${expandedFloors[group.id] ? 'rotate-90' : ''}`} />
                                </div>

                                {expandedFloors[group.id] && (
                                    <div className={`p-3 grid gap-2.5 animate-in fade-in slide-in-from-top-4 duration-500 ${floorLayout === 'horizontal'
                                        ? 'grid-cols-1'
                                        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                                        }`}>
                                        {group.rooms.length === 0 && <p className="text-accent text-[11px] font-bold uppercase tracking-widest col-span-full text-center py-8 opacity-40">Vacío</p>}

                                        {group.rooms.map(room => {
                                            const { status, booking } = getRoomCurrentStatus(room);
                                            const statusStyles = {
                                                disponible: 'bg-success/5 border-success/10 text-success',
                                                ocupada: 'bg-primary/5 border-primary/10 text-primary',
                                                reservada: 'bg-warning/5 border-warning/10 text-warning',
                                                limpieza: 'bg-yellow-500/5 border-yellow-500/10 text-yellow-600',
                                                mantenimiento: 'bg-violet-600/5 border-violet-600/10 text-violet-700'
                                            };

                                            return (
                                                <div 
                                                    key={room.id} 
                                                    className={`bg-canvas rounded-[16px] border border-hairline shadow-sm hover:shadow-premium transition-all duration-300 relative group overflow-hidden active:scale-[0.98] ${status === 'ocupada' ? 'ring-1 ring-primary/10' : status === 'reservada' ? 'ring-1 ring-warning/10' : ''}`}
                                                >
                                                    {/* Left accent stripe */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${status === 'ocupada' ? 'bg-primary' : status === 'reservada' ? 'bg-warning' : status === 'limpieza' ? 'bg-yellow-500' : status === 'mantenimiento' ? 'bg-violet-600' : 'bg-success'}`} />

                                                    {/* Horizontal Main Row */}
                                                    <div className="pl-4 pr-2.5 py-3 flex items-center gap-3">

                                                        {/* Left: Status Icon */}
                                                        <div className={`shrink-0 p-2 rounded-xl transition-transform group-hover:scale-105 duration-300 ${statusStyles[status]}`}>
                                                            {status === 'limpieza' ? <RefreshCw size={14} className="animate-spin-slow" /> :
                                                                status === 'ocupada' ? <Users size={14} /> :
                                                                    status === 'reservada' ? <Calendar size={14} /> :
                                                                        status === 'mantenimiento' ? <Wrench size={14} /> :
                                                                            <Key size={14} />}
                                                        </div>

                                                        {/* Center: Room Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-1.5 flex-wrap">
                                                                <span className="text-[15px] font-black text-secondary tracking-tight leading-none">#{room.number}</span>
                                                                <span className="text-[7px] font-black text-accent/50 uppercase tracking-widest truncate">{room.type}</span>
                                                            </div>
                                                            <div className="mt-0.5">
                                                                {status === 'limpieza' ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[8px] font-black text-yellow-600 uppercase">Limpieza</span>
                                                                        {room.features?.cleaning_start && <CleaningTimer startTime={room.features.cleaning_start} />}
                                                                    </div>
                                                                ) : (status === 'ocupada' || status === 'reservada') ? (
                                                                    <p className="text-[9px] font-black text-secondary/60 truncate">
                                                                        {booking?.guest?.full_name?.split(' ')[0] || 'Huésped'}
                                                                    </p>
                                                                ) : status === 'mantenimiento' ? (
                                                                    <p className="text-[8px] font-black text-violet-600 uppercase">Mantenim.</p>
                                                                ) : (
                                                                    <p className="text-[8px] font-black text-success uppercase opacity-70">Disponible</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right: Action Buttons (stacked vertically) */}
                                                        <div className="shrink-0 flex flex-col gap-1 items-end">
                                                            {status === 'disponible' ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0], status: 'ocupada' });
                                                                            setIsNewReservationModalOpen(true);
                                                                        }}
                                                                        className="bg-secondary text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase hover:shadow-airbnb transition-all w-full text-center"
                                                                    >
                                                                        IN
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0] });
                                                                            setIsNewReservationModalOpen(true);
                                                                        }}
                                                                        className="bg-canvas text-secondary border border-hairline px-2.5 py-1 rounded-lg text-[8px] font-black uppercase hover:bg-surface-soft transition-all w-full text-center"
                                                                    >
                                                                        RES
                                                                    </button>
                                                                </>
                                                            ) : status === 'mantenimiento' ? (
                                                                <button
                                                                    onClick={() => handleEndMaintenance(room)}
                                                                    className="bg-violet-600 text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:shadow-airbnb transition-all flex items-center gap-1"
                                                                >
                                                                    <Check size={9} /> OK
                                                                </button>
                                                            ) : status === 'limpieza' ? (
                                                                <button
                                                                    onClick={() => handleFinishCleaning(room)}
                                                                    className="bg-yellow-500 text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:shadow-airbnb transition-all flex items-center gap-1"
                                                                >
                                                                    <Check size={9} /> OK
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => setSelectedBooking(booking)}
                                                                        className="bg-canvas border border-hairline p-1.5 rounded-lg hover:bg-surface-soft transition-all"
                                                                        title="Ver Detalles"
                                                                    >
                                                                        <Search size={10} className="text-accent" />
                                                                    </button>
                                                                    <button
                                                                        onClick={status === 'ocupada' ? () => setSelectedBooking(booking) : () => handleCheckIn(booking)}
                                                                        className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all text-white w-full text-center ${status === 'ocupada' ? 'bg-danger' : 'bg-success'}`}
                                                                    >
                                                                        {status === 'ocupada' ? 'OUT' : 'IN'}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Hover Edit */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingRoom(room); setIsRoomModalOpen(true); }}
                                                            className="absolute top-1.5 right-1.5 p-1 opacity-0 group-hover:opacity-100 text-accent/40 hover:text-secondary hover:bg-surface-soft rounded-full transition-all z-10"
                                                        >
                                                            <Edit size={9} />
                                                        </button>
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
            ) : activeSubTab === 'mapa' ? (
                <HotelMapDesigner floors={floors} rooms={rooms} bookings={bookings} onRoomUpdated={loadBranchData} selectedBranchId={selectedBranchId} />
            ) : activeSubTab === 'floors' ? (
                <FloorManager branchId={selectedBranchId} onFloorUpdated={loadBranchData} />
            ) : activeSubTab === 'calendario' ? (
                <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm flex flex-col h-[calc(100vh-180px)] overflow-hidden">
                    {/* Calendar Header */}
                    <div className="p-8 border-b border-hairline flex justify-between items-center bg-surface-soft/30">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                className="w-10 h-10 border border-hairline hover:bg-canvas text-secondary rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h3 className="text-2xl font-bold text-secondary capitalize tracking-tight">
                                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                className="w-10 h-10 border border-hairline hover:bg-canvas text-secondary rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-warning"></span> <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Reservada</span></div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary"></span> <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Ocupada</span></div>
                        </div>
                    </div>

                    {/* Calendar Content Placeholder - Reuse existing logic but with new theme */}
                    <div className="flex-1 overflow-auto relative">
                        {/* El contenido del calendario se hereda del logic anterior pero con estilos de border-hairline y bg-canvas */}
                        <div className="min-w-full">
                            <TapeChart rooms={rooms} bookings={bookings} onBookingClick={setSelectedBooking} />
                        </div>
                    </div>
                </div>
            ) : activeSubTab === 'canales' ? (
                <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden">
                    <ChannelInbox rooms={rooms} branches={branches} selectedBranchId={selectedBranchId} />
                </div>
            ) : activeSubTab === 'historial' ? (
                <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-hairline bg-surface-soft/30">
                        <h3 className="text-xl font-bold text-secondary flex items-center gap-3 tracking-tight">
                            <History size={22} className="text-primary" /> Historial de Reservas
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-hairline text-[11px] font-bold text-accent uppercase tracking-widest bg-surface-soft/10">
                                    <th className="px-8 py-5">Huésped</th>
                                    <th className="px-8 py-5">Habitación</th>
                                    <th className="px-8 py-5">Periodo</th>
                                    <th className="px-8 py-5 text-right">Monto</th>
                                    <th className="px-8 py-5 text-center">Recibo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                                {historyBookings.map(booking => (
                                    <tr key={booking.id} className="hover:bg-surface-soft/40 transition-all duration-300 group">
                                        <td className="px-8 py-5">
                                            <p className="font-bold text-secondary text-[14px]">{booking.guest?.full_name || 'Huésped Nexus'}</p>
                                            <p className="text-[11px] font-bold text-accent opacity-50 uppercase tracking-widest mt-0.5">{booking.guest?.phone || 'Sin contacto'}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="bg-surface-soft text-secondary px-3 py-1.5 rounded-full text-[11px] font-bold border border-hairline">
                                                HAB. {booking.room?.number}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-accent">
                                                <span>{format(new Date(booking.check_in), "dd MMM", { locale: es })}</span>
                                                <ChevronRight size={10} />
                                                <span>{format(new Date(booking.check_out), "dd MMM", { locale: es })}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-bold text-secondary text-[15px]">
                                            ${booking.total_price?.toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <button
                                                onClick={() => handlePrintHistory(booking)}
                                                className="w-10 h-10 flex items-center justify-center text-accent hover:text-primary hover:bg-primary/5 rounded-full transition-all border border-transparent hover:border-primary/10"
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {historyBookings.length === 0 && (
                            <div className="py-24 text-center bg-surface-soft/10">
                                <History size={48} className="mx-auto text-accent/20 mb-4" />
                                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Sin registros históricos</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeSubTab === 'cinta' || activeSubTab === 'calendario' ? (
                <div className="h-[calc(100vh-180px)] bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden">
                    <TapeChart
                        rooms={rooms}
                        bookings={bookings}
                        onBookingClick={setSelectedBooking}
                    />
                </div>
            ) : activeSubTab === 'limpieza' ? (
                <div className="h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar bg-canvas rounded-[32px] border border-hairline shadow-sm">
                    <HousekeepingApp selectedBranchId={selectedBranchId} />
                </div>
            ) : activeSubTab === 'crm' ? (
                <div className="h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar bg-canvas rounded-[32px] border border-hairline shadow-sm">
                    <GuestCRM selectedBranchId={selectedBranchId} />
                </div>
            ) : activeSubTab === 'analitica' ? (
                <div className="h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar bg-canvas rounded-[32px] border border-hairline shadow-sm">
                    <HotelAnalytics selectedBranchId={selectedBranchId} />
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
                    onBookingUpdated={loadBranchData}
                    onEdit={(booking) => {
                        setPreSelectedBooking(booking);
                        setIsNewReservationModalOpen(true);
                    }}
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
        </div>
    );
};

export default HotelManagement;
