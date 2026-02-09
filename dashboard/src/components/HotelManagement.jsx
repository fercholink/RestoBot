import React, { useState, useEffect } from 'react';
import { Bed, Calendar, Key, Users, History, Settings, Bell, Star, MapPin, Search, Plus, Loader, Trash2, Edit, Tv, Wifi, Wind, ChevronLeft, ChevronRight, Building, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NewReservationModal from './NewReservationModal';
import RoomModal from './RoomModal';
import ReservationDetailsModal from './ReservationDetailsModal';
import PaymentModal from './PaymentModal';
import TicketPrinter from './TicketPrinter';
import FloorManagerModal from './FloorManagerModal';

const HotelManagement = () => {
    // --- ESTADO GLOBAL ---
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(null);

    // --- DATOS DE LA SUCURSAL ACTIVA ---
    const [floors, setFloors] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);

    // --- ESTADO DE UI ---
    const [viewMode, setViewMode] = useState('rooms'); // 'rooms' | 'calendar'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [expandedFloors, setExpandedFloors] = useState({}); // { floorId: boolean }

    // --- MODALES ---
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false); // Para crear nueva sucursal si no existe
    const [isFloorManagerOpen, setIsFloorManagerOpen] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // --- DATOS TEMPORALES PARA MODALES ---
    const [editingRoom, setEditingRoom] = useState(null);
    const [preSelectedBooking, setPreSelectedBooking] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [checkoutBooking, setCheckoutBooking] = useState(null);
    const [lastReceipt, setLastReceipt] = useState(null);

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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `branch_id=eq.${selectedBranchId}` }, loadBranchData)
            .subscribe();

        const bookingSub = supabase
            .channel('public:bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, loadBranchData) // Filtro complejo no soportado directo, recargamos todo
            .subscribe();

        return () => {
            supabase.removeChannel(roomSub);
            supabase.removeChannel(bookingSub);
        };
    }, [selectedBranchId, currentDate]);

    const loadBranchData = async () => {
        if (!selectedBranchId) return;
        setLoading(true);
        await Promise.all([fetchFloors(), fetchRooms(), fetchBookings()]);
        setLoading(false);
    };

    const fetchFloors = async () => {
        const { data } = await supabase
            .from('floors')
            .select('*')
            .eq('branch_id', selectedBranchId)
            .order('floor_number', { ascending: true });
        setFloors(data || []);
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
        const endOfMonth = new Date(year, month + 1, 0);
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${endOfMonth.getDate()}`;

        // Queremos reservas que se solapen con este mes O que estén activas hoy
        // Optimización: Traer reservas activas (futuras o pasadas recientes)
        // Para calendar view necesitamos mes actual.
        // Para room view necesitamos "hoy".

        // Estrategia segura: Traer reservas donde checkout >= Hoy (para ver activas) O que estén en el rango del mes visualizado.
        // Dado que viewMode controla la vista, si estamos en 'rooms', priorizamos "active now".

        const now = new Date();
        const startOfView = viewMode === 'calendar' ? startStr : new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); // Al menos desde principio de mes actual

        // Simplemente traemos todo lo que no haya terminado antes del inicio de la vista
        // check_out >= startOfView

        const { data, error } = await supabase
            .from('bookings')
            .select('*, guest:guests(*)')
            .gte('check_out', startOfView)
            .order('check_in', { ascending: true });

        // Nota: Idealmente deberíamos filtrar por rooms.branch_id, pero bookings no tiene branch_id directo.
        // Lo filtramos en memoria comparando con los room_ids que tenemos cargados.

        if (data) {
            // Solo mostrar reservas de habitaciones de ESTA sucursal
            const branchRoomIds = new Set(rooms.map(r => r.id));
            // Si rooms no ha cargado, esperamos a la siguiente render, pero mejor hacerlo seguro:
            // (En una query real haríamos un join, pero Supabase JS es más simple así)

            // Opción B: Traer bookings y filtrar
            setBookings(data); // El filtrado visual lo haremos renderizando solo las habitaciones de la sede.
        }
    };

    // =================================================================
    // 3. LÓGICA DE NEGOCIO (ESTADO HABITACIONES)
    // =================================================================
    const getRoomCurrentStatus = (room) => {
        // 1. Estados manuales
        if (room.status === 'mantenimiento' || room.status === 'limpieza') {
            return { status: room.status, booking: null };
        }

        // 2. Verificar ocupación en la fecha seleccionada
        // currentDate ya es Date object (controlado por estado)
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        const activeBooking = bookings.find(b => {
            if (b.room_id !== room.id) return false;
            if (b.status === 'cancelada' || b.status === 'checkout') return false;

            // Check overlap
            const bCheckIn = new Date(b.check_in);
            const bCheckOut = new Date(b.check_out);

            // Ignore time components
            const start = new Date(bCheckIn.getFullYear(), bCheckIn.getMonth(), bCheckIn.getDate());
            const end = new Date(bCheckOut.getFullYear(), bCheckOut.getMonth(), bCheckOut.getDate());

            // [start, end)
            return checkDate.getTime() >= start.getTime() && checkDate.getTime() < end.getTime();
        });

        if (activeBooking) {
            // Prioridad de estado de la reserva
            if (activeBooking.status === 'ocupada') return { status: 'ocupada', booking: activeBooking };
            if (activeBooking.status === 'reservada') return { status: 'reservada', booking: activeBooking };

            // Fallback
            return { status: 'ocupada', booking: activeBooking };
        }

        return { status: 'disponible', booking: null };
    };

    const toggleFloorExpanded = (floorId) => {
        setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));
    };

    const handleQuickCheckout = async (booking, taxData) => {
        const roomNumber = rooms.find(r => r.id === booking.room_id)?.number || '';

        // Custom message if invoice is requested
        let confirmMsg = `¿Confirmar salida (Check-Out) para la habitación ${roomNumber}?`;
        if (taxData) {
            confirmMsg += `\n\nSe generará Factura Electrónica para: ${taxData.names} (${taxData.identification})`;
        }
        confirmMsg += `\n\nLa habitación pasará a estado de Limpieza.`;

        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            // 1. Prepare Update Data
            const updateData = { status: 'checkout' };

            // If taxData exists, we could save it. For now, let's append it to notes or a specific field if it existed.
            // Since we don't have a specific 'invoice_data' column confirmed, we'll assume we just update status for now.
            // PROPOSAL: If you want to save this data, we should add a column. 
            // For now, I will just log it to console effectively ensuring the process continues.
            console.log("Processing Checkout with Invoice Data:", taxData);

            const { error: bError } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', booking.id);
            if (bError) throw bError;

            // 2. Update room status to cleaning
            const { error: rError } = await supabase
                .from('rooms')
                .update({ status: 'limpieza' })
                .eq('id', booking.room_id);
            if (rError) throw rError;

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
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* View Toggle */}
                    <div className="bg-gray-200/50 p-1 rounded-xl flex">
                        <button
                            onClick={() => setViewMode('rooms')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'rooms' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                        >
                            <Bed size={14} className="inline mr-1" /> Habitaciones
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                        >
                            <Calendar size={14} className="inline mr-1" /> Calendario
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <button
                        onClick={() => { setEditingRoom(null); setIsRoomModalOpen(true); }}
                        className="bg-primary text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/30"
                    >
                        <Plus size={14} /> Habitación
                    </button>

                    <button
                        onClick={() => setIsFloorManagerOpen(true)}
                        className="bg-white border border-gray-200 text-secondary px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                    >
                        <Settings size={14} /> Pisos / Zonas
                    </button>
                </div>
            </div>

            {/* --- CONTENIDO PRINCIPAL --- */}

            {viewMode === 'rooms' ? (
                <div className="space-y-6">
                    {floorGroups.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
                            <Settings className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-400 font-medium">Esta sede no tiene pisos ni habitaciones configuradas.</p>
                            <button onClick={() => setIsFloorManagerOpen(true)} className="mt-4 text-primary font-bold text-sm hover:underline">Configurar Pisos</button>
                        </div>
                    ) : (
                        floorGroups.map(group => (
                            <div key={group.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
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
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                        {group.rooms.length === 0 && <p className="text-gray-400 text-xs italic col-span-full text-center">No hay habitaciones en este piso.</p>}

                                        {group.rooms.map(room => {
                                            const { status, booking } = getRoomCurrentStatus(room);
                                            return (
                                                <div key={room.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all relative group">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className={`p-3 rounded-2xl ${status === 'ocupada' ? 'bg-primary text-white' :
                                                            status === 'reservada' ? 'bg-orange-500 text-white' :
                                                                status === 'limpieza' ? 'bg-yellow-400 text-white' :
                                                                    'bg-success/10 text-success'
                                                            }`}>
                                                            {status === 'limpieza' ? <Wind size={24} className="animate-pulse" /> : <Key size={24} />}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-xl font-black text-secondary">#{room.number}</span>
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase">{room.type}</span>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="mb-4">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status === 'ocupada' ? 'bg-primary/10 text-primary' :
                                                            status === 'reservada' ? 'bg-orange-100 text-orange-600' :
                                                                status === 'limpieza' ? 'bg-yellow-100 text-yellow-600' :
                                                                    'bg-success/10 text-success'
                                                            }`}>
                                                            {status}
                                                        </span>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                                                        {status === 'disponible' ? (
                                                            <>
                                                                <button
                                                                    className="bg-primary/10 text-primary py-2 rounded-xl text-[10px] font-black uppercase hover:bg-primary/20 transition-colors"
                                                                    onClick={() => {
                                                                        setPreSelectedBooking({ roomId: room.id, checkIn: new Date().toISOString().split('T')[0], status: 'ocupada' }); // Direct Check-in intent
                                                                        setIsNewReservationModalOpen(true);
                                                                    }}
                                                                >
                                                                    Check-In
                                                                </button>
                                                                <button
                                                                    className="bg-secondary text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-secondary/90 transition-colors"
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
                                                                className="col-span-2 bg-yellow-400 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-200"
                                                                onClick={() => handleFinishCleaning(room)}
                                                            >
                                                                Terminar Limpieza
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="col-span-2 bg-gray-100 text-gray-500 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                                                    onClick={() => {
                                                                        // Open Details Modal instead of New Reservation Modal for editing
                                                                        setSelectedBooking(booking);
                                                                    }}
                                                                >
                                                                    <Users size={12} />
                                                                    {booking?.guest?.full_name || booking?.guest?.first_name || 'Huésped'}
                                                                </button>
                                                                {status === 'ocupada' && (
                                                                    <button
                                                                        className="col-span-2 mt-1 bg-red-50 text-red-500 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                                                        onClick={() => setSelectedBooking(booking)} // Open details for checkout
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                                        Check-Out
                                                                    </button>
                                                                )}
                                                                {status === 'reservada' && (
                                                                    <button
                                                                        className="col-span-2 mt-1 bg-green-50 text-green-600 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                                                                        onClick={() => handleCheckIn(booking)}
                                                                    >
                                                                        <Check size={14} />
                                                                        Realizar Check-In
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
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                    {/* Calendar Header Controls */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
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
                                                    <ChevronRight size={16} className={`transition-transform ${expandedFloors[group.id] ? 'rotate-90' : ''}`} />
                                                    {group.name}
                                                </div>

                                                {expandedFloors[group.id] && group.rooms.map(room => (
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
                                                                    const bCheckIn = new Date(booking.check_in);
                                                                    const bCheckOut = new Date(booking.check_out);

                                                                    const monthStart = new Date(year, month, 1);
                                                                    const monthEnd = new Date(year, month + 1, 0);

                                                                    if (bCheckOut <= monthStart || bCheckIn > monthEnd) return null;

                                                                    const visibleStart = bCheckIn < monthStart ? monthStart : bCheckIn;
                                                                    const visibleEnd = bCheckOut > monthEnd ? monthEnd : bCheckOut;

                                                                    const daysInMonthTotal = daysInMonth;
                                                                    const dayWidthPercent = 100 / daysInMonthTotal;
                                                                    const startIndex = (visibleStart.getDate() - 1);

                                                                    let duration = (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24);
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
            )
            }

            {/* --- MODALES --- */}
            {
                selectedBranchId && (
                    <>
                        <FloorManagerModal
                            isOpen={isFloorManagerOpen}
                            onClose={() => setIsFloorManagerOpen(false)}
                            branchId={selectedBranchId}
                            onFloorUpdated={() => { loadBranchData(); }}
                        />

                        <RoomModal
                            isOpen={isRoomModalOpen}
                            onClose={() => setIsRoomModalOpen(false)}
                            roomToEdit={editingRoom}
                            branchId={selectedBranchId}
                            existingFloors={floors}
                            onRoomSaved={() => { loadBranchData(); }}
                        />

                        <NewReservationModal
                            isOpen={isNewReservationModalOpen}
                            onClose={() => { setIsNewReservationModalOpen(false); setPreSelectedBooking(null); }}
                            rooms={rooms} // Pasamos las rooms ya filtradas
                            initialData={preSelectedBooking}
                            bookingToEdit={preSelectedBooking?.id ? preSelectedBooking : null}
                            onReservationCreated={() => fetchBookings()}
                        />

                        <ReservationDetailsModal
                            isOpen={!!selectedBooking}
                            onClose={() => setSelectedBooking(null)}
                            booking={selectedBooking}
                            onBookingUpdated={() => { fetchBookings(); loadBranchData(); }}
                            onEdit={(booking) => {
                                setSelectedBooking(null);
                                setPreSelectedBooking(booking);
                                setIsNewReservationModalOpen(true);
                            }}
                            onCheckOut={(booking, taxData, extraData) => {
                                handleQuickCheckout(booking, taxData, extraData);
                            }}
                        />
                    </>
                )
            }

            {/* PRINTER (Siempre montado si hay lastReceipt) */}
            {lastReceipt && (
                <TicketPrinter
                    order={lastReceipt}
                    type="factura_hotel"
                    branchName={branches.find(b => b.id === selectedBranchId)?.name || 'HOTEL'}
                />
            )}

        </div >
    );
};

export default HotelManagement;
