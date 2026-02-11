import React, { useState, useEffect } from 'react';
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
    const [floorLayout, setFloorLayout] = useState('vertical'); // 'vertical' | 'horizontal'
    const [expandedFloors, setExpandedFloors] = useState({}); // { floorId: boolean }

    // --- MODALES ---
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false); // Para crear nueva sucursal si no existe
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // --- DATOS TEMPORALES PARA MODALES ---
    const [editingRoom, setEditingRoom] = useState(null);
    const [preSelectedBooking, setPreSelectedBooking] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [checkoutBooking, setCheckoutBooking] = useState(null);
    const [lastReceipt, setLastReceipt] = useState(null);
    const [historyBookings, setHistoryBookings] = useState([]);

    // =================================================================
    // 1. INICIALIZACIÓN: CARGAR SUCURSALES
    // =================================================================
    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .order('id', { ascending: true });

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
        } finally {
            setLoading(false);
        }
    };

    const createDefaultBranch = async () => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .insert([{ name: 'Sede Principal', city: 'Ciudad Principal' }])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setBranches([data]);
                setSelectedBranchId(data.id);
            }
        } catch (error) {
            console.error("Error creando sucursal por defecto:", error);
            alert("Error crítico: No se pudo inicializar la sucursal del hotel.");
        }
    };

    // =================================================================
    // 2. CARGAR DATOS DE SUCURSAL ACTIVA
    // =================================================================
    useEffect(() => {
        if (!selectedBranchId) return;

        loadBranchData();

        // Suscripciones en tiempo real
        const roomSub = supabase
            .channel('public:rooms')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `branch_id=eq.${selectedBranchId}` }, () => {
                console.log("Realtime: Rooms updated");
                loadBranchData();
            })
            .subscribe();

        const bookingSub = supabase
            .channel('public:bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                console.log("Realtime: Bookings updated");
                loadBranchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(roomSub);
            supabase.removeChannel(bookingSub);
        };
    }, [selectedBranchId, currentDate, activeSubTab]); // Added activeSubTab dependency

    const loadBranchData = async () => {
        if (!selectedBranchId) return;
        // Don't set global loading true to avoid full screen flicker on background updates
        // setLoading(true); 
        await Promise.all([fetchFloors(), fetchRooms(), fetchBookings()]);
        // setLoading(false);
    };

    const fetchFloors = async () => {
        try {
            const { data, error } = await supabase
                .from('floors')
                .select('*')
                .eq('branch_id', selectedBranchId)
                .order('floor_number', { ascending: true });

            if (error) throw error;
            setFloors(data || []);
        } catch (error) {
            console.error("Error fetching floors:", error);
            // Optional: alert/notify user
        }
    };

    const fetchRooms = async () => {
        const { data } = await supabase
            .from('rooms')
            .select('*')
            .eq('branch_id', selectedBranchId)
            .order('number', { ascending: true });
        setRooms(data || []);
    };

    const fetchBookings = async () => {
        // Lógica de calendario (Mes actual)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;

        // Estrategia segura: Traer reservas activas
        const now = new Date();
        const startOfView = activeSubTab === 'calendario' ? startStr : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data, error } = await supabase
            .from('bookings')
            .select('*, guest:guests(*)')
            .gte('check_out', startOfView)
            .order('check_in', { ascending: true });

        if (data) {
            setBookings(data);
        }
    };

    const fetchHistoryBookings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, guest:guests(*), room:rooms(number, type, branch_id)')
                .eq('status', 'checkout')
                .order('check_out', { ascending: false })
                .limit(50); // Últimos 50 checkouts

            if (error) throw error;

            if (data) {
                // Filter by branch
                const filtered = data.filter(b => b.room?.branch_id === selectedBranchId);
                setHistoryBookings(filtered);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    // =================================================================
    // 3. LÓGICA DE NEGOCIO (ESTADO HABITACIONES)
    // =================================================================
    const getRoomCurrentStatus = (room) => {
        // 1. Estados manuales (Prioridad absoluta)
        if (room.status === 'mantenimiento' || room.status === 'limpieza') {
            return { status: room.status, booking: null };
        }

        // 2. Verificar ocupación en la fecha seleccionada
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        const activeBooking = bookings.find(b => {
            if (b.room_id !== room.id) return false;
            // Filter out finished/cancelled
            if (b.status === 'cancelada' || b.status === 'checkout') return false;

            // Safe Parse "YYYY-MM-DD" to Local Date
            // Supabase returns YYYY-MM-DD or ISO. We take the YYYY-MM-DD part.
            const parseDate = (dateStr) => {
                if (!dateStr) return new Date(0); // Invalid
                const part = dateStr.split('T')[0];
                const [y, m, d] = part.split('-').map(Number);
                return new Date(y, m - 1, d); // Local Midnight
            };

            const start = parseDate(b.check_in);
            const end = parseDate(b.check_out);

            // Logic: [start, end)
            // Occupied from Check-In day (inclusive) up to Check-Out day (exclusive)
            return checkDate.getTime() >= start.getTime() && checkDate.getTime() < end.getTime();
        });

        if (activeBooking) {
            // Prioridad de estado de la reserva
            if (activeBooking.status === 'ocupada') return { status: 'ocupada', booking: activeBooking };
            if (activeBooking.status === 'reservada') return { status: 'reservada', booking: activeBooking };

            return { status: 'ocupada', booking: activeBooking };
        }

        // Default
        return { status: 'disponible', booking: null };
    };

    const toggleFloorExpanded = (floorId) => {
        setExpandedFloors(prev => ({
            ...prev,
            [floorId]: !prev[floorId]
        }));
    };

    const handleQuickCheckout = async (booking, taxData, extraData) => {
        if (!booking) return;

        // Don't set global loading true to avoid full screen flicker
        // setLoading(true);
        try {
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

            // 4. Generate Receipt Data for Printing
            const currentBranch = branches.find(b => b.id === selectedBranchId);
            const roomNumber = rooms.find(r => r.id === booking.room_id)?.number || '';

            // Calculate nights for receipt detail
            const start = new Date(booking.check_in);
            const end = new Date(booking.check_out);
            let nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            if (nights < 1) nights = 1;

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
                id: booking.id, // Consecutivo
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
                subtotal: extraData?.grandTotal || booking.total_price || 0, // Simplified for now
                total_price: extraData?.grandTotal || booking.total_price || 0,
                payment_method: 'Efectivo', // This should technically come from PaymentModal

                // Electronic Invoice Mocks
                cufe: taxData ? '8e4f2a5b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4' : null,
                qr_code: taxData ? 'QR_DATA' : null
            };

            console.log("Generating Receipt:", receiptData);
            setLastReceipt(receiptData);

            await loadBranchData(); // Refresh all data
            setSelectedBooking(null); // Close modal
        } catch (error) {
            console.error("Error en checkout:", error);
            alert("Error al procesar salida: " + error.message);
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
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
            {/* --- HEADER: SUCURSALES Y CONTROLES --- */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight mb-2">Administración de Hotel</h2>

                    {/* Branch Selector */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${selectedBranchId === branch.id
                                    ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/30'
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-secondary/30 hover:text-secondary'
                                    }`}
                            >
                                <Building size={14} />
                                {branch.name}
                            </button>
                        ))}
                        <button
                            className="w-8 h-8 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-colors"
                            title="Añadir Nueva Sede"
                            onClick={() => alert("Función para crear nueva sede (Próximamente)")}
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Date Picker */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden md:inline">Fecha:</span>
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-sm hover:border-gray-300 transition-all"
                                value={currentDate.toISOString().split('T')[0]} // YYYY-MM-DD
                                onChange={(e) => {
                                    // Set local date correctly from input string
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                        // new Date(y, m-1, d) ensures local time midnight
                                        const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                        setCurrentDate(newDate);
                                    }
                                }}
                            />
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="bg-gray-100 p-2 rounded-xl text-xs font-bold text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                            title="Ir a Hoy"
                        >
                            HOY
                        </button>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setFloorLayout('vertical')}
                                className={`p-1.5 rounded-lg transition-all ${floorLayout === 'vertical' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Vista Vertical"
                            >
                                <LayoutList size={16} />
                            </button>
                            <button
                                onClick={() => setFloorLayout('horizontal')}
                                className={`p-1.5 rounded-lg transition-all ${floorLayout === 'horizontal' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Vista Horizontal"
                            >
                                <Columns size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* Action Buttons */}
                    <button
                        onClick={() => { setEditingRoom(null); setIsRoomModalOpen(true); }}
                        className="bg-primary text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/30"
                    >
                        <Plus size={14} /> Habitación
                    </button>
                    {/* Floor Manager moved to Sidebar */}
                </div>
            </div>

            {/* --- CONTENIDO PRINCIPAL --- */}

            {activeSubTab === 'habitaciones' ? (
                <div className={`transition-all duration-300 ${floorLayout === 'horizontal' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start' : 'space-y-6'}`}>
                    {floorGroups.length === 0 ? (
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
                                    <div className={`p-4 grid gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${floorLayout === 'horizontal'
                                        ? 'grid-cols-2 xl:grid-cols-3'
                                        : 'grid-cols-2 mobile:grid-cols-3 tablet:grid-cols-4 laptop:grid-cols-5 desktop:grid-cols-6'
                                        }`}>
                                        {group.rooms.length === 0 && <p className="text-gray-400 text-xs italic col-span-full text-center">No hay habitaciones en este piso.</p>}

                                        {group.rooms.map(room => {
                                            const { status, booking } = getRoomCurrentStatus(room);
                                            return (
                                                <div key={room.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all relative group h-full flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className={`p-1.5 rounded-xl ${status === 'ocupada' ? 'bg-primary text-white' :
                                                                status === 'reservada' ? 'bg-orange-500 text-white' :
                                                                    status === 'limpieza' ? 'bg-yellow-400 text-white' :
                                                                        'bg-success/10 text-success'
                                                                }`}>
                                                                {status === 'limpieza' ? <Wind size={14} className="animate-pulse" /> : <Key size={14} />}
                                                            </div>
                                                            <div className="text-right">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingRoom(room); setIsRoomModalOpen(true); }}
                                                                    className="absolute top-2 right-2 text-gray-300 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Editar"
                                                                >
                                                                    <Edit size={12} />
                                                                </button>
                                                                <span className="block text-lg font-black text-secondary">#{room.number}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mb-2">
                                                            {status === 'limpieza' && (
                                                                <div className="flex flex-col items-center justify-center h-full">
                                                                    <div className="bg-yellow-100 p-2 rounded-full mb-1 animate-pulse">
                                                                        <Hash size={16} className="text-yellow-500" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase text-yellow-600">Limpieza</span>
                                                                    {room.features?.cleaning_start && (
                                                                        <div className="mt-1">
                                                                            <CleaningTimer startTime={room.features.cleaning_start} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="block text-center text-[9px] text-gray-400 font-bold uppercase mt-1 truncate">{room.type}</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="pt-2 border-t border-gray-100 grid grid-cols-1 gap-1">
                                                        {status === 'disponible' ? (
                                                            <>
                                                                <button
                                                                    className="w-full bg-primary/10 text-primary py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-colors"
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0], status: 'ocupada' }); // Direct Check-in intent
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                >
                                                                    Check-In
                                                                </button>
                                                                <button
                                                                    className="w-full bg-secondary text-white py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-secondary/90 transition-colors"
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0] });
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                >
                                                                    Reservar
                                                                </button>
                                                            </>
                                                        ) : status === 'limpieza' ? (
                                                            <button
                                                                className="w-full bg-yellow-400 text-white py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-yellow-500 transition-colors shadow-sm"
                                                                onClick={() => handleFinishCleaning(room)}
                                                            >
                                                                Listo
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="w-full bg-gray-100 text-gray-500 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 truncate"
                                                                    onClick={() => setSelectedBooking(booking)}
                                                                >
                                                                    <Users size={10} />
                                                                    <span className="truncate">{booking?.guest?.first_name || 'Huésped'}</span>
                                                                </button>
                                                                {status === 'ocupada' && (
                                                                    <button
                                                                        className="w-full mt-1 bg-red-50 text-red-500 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                                                                        onClick={() => setSelectedBooking(booking)}
                                                                    >
                                                                        Check-Out
                                                                    </button>
                                                                )}
                                                                {status === 'reservada' && (
                                                                    <button
                                                                        className="w-full mt-1 bg-blue-50 text-blue-600 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCheckIn(booking);
                                                                        }}
                                                                    >
                                                                        Check-In
                                                                    </button>
                                                                )}
                                                            </>
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
                    <div className="flex-1 overflow-hidden relative flex flex-col">
                        {(() => {
                            const year = currentDate.getFullYear();
                            const month = currentDate.getMonth();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

                            return (
                                <>
                                    {/* Days Header */}
                                    <div className="flex bg-white border-b border-gray-300 shadow-sm z-20">
                                        <div className="w-48 flex-shrink-0 p-3 font-bold text-gray-500 border-r border-gray-300 bg-gray-100 flex items-center justify-center">
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
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {floorGroups.map(group => (
                                            <React.Fragment key={group.id}>
                                                {/* Floor Header Row */}
                                                <div
                                                    className="bg-gray-200 border-b border-gray-300 py-2 px-4 sticky top-0 z-10 w-full font-black text-xs text-gray-700 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-gray-300 transition-colors"
                                                    onClick={() => toggleFloorExpanded(group.id)}
                                                >
                                                    <ChevronRight size={16} className={`transition-transform ${expandedFloors[group.id] !== false ? 'rotate-90' : ''}`} />
                                                    {group.name}
                                                </div>

                                                {expandedFloors[group.id] !== false && group.rooms.map(room => (
                                                    <div key={room.id} className="flex border-b border-gray-300 hover:bg-gray-50 transition-colors h-[50px]">
                                                        {/* Room Name Column */}
                                                        <div className="w-48 flex-shrink-0 p-2 font-bold text-secondary border-r border-gray-300 bg-white flex flex-col justify-center shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-0">
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
                                                                .filter(b => b.room_id === room.id && b.status !== 'cancelada')
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
        </div>
    );
};

export default HotelManagement;
