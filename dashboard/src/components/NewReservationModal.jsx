import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, CreditCard, Search, Trash2, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

const NewReservationModal = ({ isOpen, onClose, onReservationCreated, rooms, initialData, bookingToEdit, branchId }) => {
    if (!isOpen) return null;

    // Helper to get local YYYY-MM-DD
    const getLocalDate = (date = new Date()) => {
        const offset = date.getTimezoneOffset();
        const d = new Date(date.getTime() - (offset * 60 * 1000));
        return d.toISOString().split('T')[0];
    };

    const [formData, setFormData] = useState({
        roomId: initialData?.roomId || '',
        guestName: '',
        guestDoc: '',
        guestPhone: '',
        guestEmail: '',
        checkIn: initialData?.checkIn || getLocalDate(),
        checkOut: getLocalDate(new Date(Date.now() + 86400000)),
        totalPrice: 0,
        status: initialData?.status || 'reservada', // 'reservada' | 'ocupada'
        notes: ''
    });

    const [loading, setLoading] = useState(false);
    const [existingGuest, setExistingGuest] = useState(null);
    const [pendingCancel, setPendingCancel] = useState(false);
    const [pendingCheckout, setPendingCheckout] = useState(false);

    // Effect to update formData when initialData OR bookingToEdit changes
    useEffect(() => {
        if (isOpen) {
            if (bookingToEdit) {
                // Formatting for edit mode - ensure we just get the YYYY-MM-DD part reliably
                setFormData({
                    roomId: bookingToEdit.room_id,
                    guestName: bookingToEdit.guest?.full_name || '',
                    guestDoc: bookingToEdit.guest?.document_id || '',
                    guestPhone: bookingToEdit.guest?.phone || '',
                    guestEmail: bookingToEdit.guest?.email || '',
                    // Assume DB stores ISO strings e.g. 2025-10-10T12:00:00
                    checkIn: bookingToEdit.check_in.split('T')[0],
                    checkOut: bookingToEdit.check_out.split('T')[0],
                    totalPrice: bookingToEdit.total_price,
                    notes: bookingToEdit.notes || ''
                });
                setExistingGuest(bookingToEdit.guest);
            } else {
                // New Mode
                setFormData({
                    roomId: initialData?.roomId || '',
                    guestName: '',
                    guestDoc: '',
                    guestPhone: '',
                    guestEmail: '',
                    checkIn: initialData?.checkIn || getLocalDate(),
                    checkOut: getLocalDate(new Date(Date.now() + 86400000)),
                    totalPrice: 0,
                    status: initialData?.status || 'reservada',
                    notes: ''
                });
                setExistingGuest(null);
            }
        }
    }, [initialData, bookingToEdit, isOpen]);

    // Cleanup when closing
    useEffect(() => {
        if (!isOpen) {
            // Optional: reset state here if needed, or rely on isOpen check
        }
    }, [isOpen]);

    // Auto-calculate price when room or dates change
    useEffect(() => {
        // Only auto-calc if room and dates are valid
        if (formData.roomId && formData.checkIn && formData.checkOut && rooms.length > 0) {
            const room = rooms.find(r => r.id === formData.roomId);
            if (room) {
                const start = new Date(formData.checkIn);
                const end = new Date(formData.checkOut);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const nights = diffDays > 0 ? diffDays : 0;

                if (nights > 0) {
                    setFormData(prev => ({ ...prev, totalPrice: room.base_price * nights }));
                }
            }
        }
    }, [formData.roomId, formData.checkIn, formData.checkOut, rooms]);

    const handleSearchGuest = async () => {
        if (!formData.guestDoc) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .eq('document_id', formData.guestDoc)
                .single();

            if (data) {
                setExistingGuest(data);
                setFormData(prev => ({
                    ...prev,
                    guestName: data.full_name,
                    guestPhone: data.phone || '',
                    guestEmail: data.email || ''
                }));
                // Feedback visual discreto o explícito
                // alert(`Huésped encontrado: ${data.full_name}`); 
            } else {
                setExistingGuest(null);
                sileo.warning({ title: 'Cliente no encontrado', description: 'No existe un huésped con ese documento. Complete los datos manualmente.' });
            }
        } catch (err) {
            console.error("Error buscando cliente:", err);
            sileo.error({ title: 'Error al buscar cliente', description: err.message });
            setExistingGuest(null);
        } finally {
            setLoading(false);
        }
    };

    const checkAvailability = async () => {
        const start = `${formData.checkIn}T00:00:00`;
        const end = `${formData.checkOut}T23:59:59`; // Cover the whole day just in case, but usually T12:00:00 comparison relies on strict date boundaries. 
        // Better logic: strict string comparison on date part or standard ISO overlap.

        // Let's use the exact T12:00:00 format we save with
        const rangeStart = `${formData.checkIn}T12:00:00`;
        const rangeEnd = `${formData.checkOut}T12:00:00`;

        let query = supabase
            .from('bookings')
            .select('id')
            .eq('room_id', formData.roomId)
            .neq('status', 'cancelada')
            .neq('status', 'checkout')
            // Overlap: (StartA < EndB) and (EndA > StartB)
            .lt('check_in', rangeEnd)
            .gt('check_out', rangeStart);

        if (bookingToEdit) {
            query = query.neq('id', bookingToEdit.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 0. Date Validation
            if (new Date(formData.checkOut) <= new Date(formData.checkIn)) {
                sileo.warning({ title: 'Fechas inválidas', description: 'La fecha de salida debe ser posterior a la fecha de entrada.' });
                setLoading(false);
                return;
            }

            // 0. Availability Check
            const isAvailable = await checkAvailability();
            if (!isAvailable) {
                sileo.error({ title: 'Habitación no disponible', description: 'Ya existe una reserva activa para esta habitación en las fechas seleccionadas.' });
                setLoading(false);
                return;
            }

            let guestId = existingGuest?.id || bookingToEdit?.guest_id;

            // 1. Create or Update Guest (UPSERT: si el documento ya existe lo actualiza)
            if (!guestId) {
                const { data: newGuest, error: guestError } = await supabase
                    .from('guests')
                    .upsert([{
                        full_name: formData.guestName,
                        document_id: formData.guestDoc,
                        phone: formData.guestPhone,
                        email: formData.guestEmail
                    }], { onConflict: 'document_id' })
                    .select()
                    .single();

                if (guestError) throw guestError;
                guestId = newGuest.id;
            } else {
                // Update existing guest info if changed
                await supabase.from('guests').update({
                    full_name: formData.guestName,
                    phone: formData.guestPhone,
                    email: formData.guestEmail
                }).eq('id', guestId);
            }

            // 2. Create or Update Booking
            const bookingPayload = {
                room_id: formData.roomId,
                guest_id: guestId,
                check_in: `${formData.checkIn}T12:00:00`,
                check_out: `${formData.checkOut}T12:00:00`,
                total_price: formData.totalPrice,
                notes: formData.notes,
                status: formData.status // Use dynamic status
            };

            if (bookingToEdit && bookingToEdit.id) {
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update(bookingPayload)
                    .eq('id', bookingToEdit.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('bookings')
                    .insert([bookingPayload]);
                if (insertError) throw insertError;
            }

            onReservationCreated();
            onClose();
        } catch (error) {
            console.error('Error saving reservation:', error);
            sileo.error({ title: 'Error al guardar reserva', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!bookingToEdit) return;
        if (!pendingCancel) {
            setPendingCancel(true);
            sileo.warning({ title: '¿Cancelar reserva?', description: 'Haz clic de nuevo en Cancelar Reserva para confirmar.' });
            setTimeout(() => setPendingCancel(false), 5000);
            return;
        }
        setPendingCancel(false);
        setLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelada' })
                .eq('id', bookingToEdit.id);

            if (error) throw error;
            sileo.success({ title: 'Reserva cancelada', description: 'La reserva fue cancelada correctamente.' });
            onReservationCreated();
            onClose();
        } catch (error) {
            console.error('Error canceling booking:', error);
            sileo.error({ title: 'Error al cancelar reserva', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        if (!bookingToEdit) return;
        if (!pendingCheckout) {
            setPendingCheckout(true);
            sileo.warning({ title: '¿Confirmar Check-Out?', description: 'Haz clic de nuevo en Check-Out para confirmar la salida del huésped.' });
            setTimeout(() => setPendingCheckout(false), 5000);
            return;
        }
        setPendingCheckout(false);
        setLoading(true);
        try {
            // Update booking status
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'checkout', check_out: new Date().toISOString() })
                .eq('id', bookingToEdit.id);

            if (error) throw error;

            // Mark room as cleaning?
            // Optional: Update room status to 'limpieza' if desired
            const room = rooms.find(r => r.id === bookingToEdit.room_id);
            const currentFeatures = room?.features || {};

            await supabase
                .from('rooms')
                .update({
                    status: 'limpieza',
                    features: {
                        ...currentFeatures,
                        cleaning_start: new Date().toISOString()
                    }
                })
                .eq('id', bookingToEdit.room_id);

            onReservationCreated(); // Refresh
            onClose();
        } catch (error) {
            console.error('Error processing checkout:', error);
            sileo.error({ title: 'Error en Check-Out', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        // Change from reserved to occupied
        if (!bookingToEdit) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'ocupada' })
                .eq('id', bookingToEdit.id);

            if (error) throw error;
            onReservationCreated();
            onClose();
        } catch (e) {
            sileo.error({ title: 'Error en Check-In', description: e.message });
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-canvas rounded-[24px] shadow-airbnb w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-hairline">
                <div className={`p-6 flex justify-between items-center ${formData.status === 'ocupada' ? 'bg-primary' : 'bg-secondary'}`}>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        {formData.status === 'ocupada' ? <Key className="text-white" /> : <Calendar className="text-white" />}
                        {bookingToEdit ? 'Editar Reserva' : (formData.status === 'ocupada' ? 'Nuevo Check-In' : 'Nueva Reserva')}
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Section: Dates & Room */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Estancia</h4>

                            <div className="bg-surface-soft p-1 rounded-full flex mb-4 border border-hairline">
                                <button
                                    type="button"
                                    className={`flex-1 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${formData.status === 'reservada' ? 'bg-canvas text-secondary shadow-sm border border-hairline' : 'text-accent hover:text-secondary'}`}
                                    onClick={() => setFormData({ ...formData, status: 'reservada' })}
                                >
                                    Reserva
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${formData.status === 'ocupada' ? 'bg-primary text-white shadow-airbnb' : 'text-accent hover:text-secondary'}`}
                                    onClick={() => setFormData({ ...formData, status: 'ocupada' })}
                                >
                                    Check-In
                                </button>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Habitación</label>
                                <select
                                    required
                                    className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                    value={formData.roomId}
                                    onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                                >
                                    <option value="">Seleccionar Habitación...</option>

                                    {Object.entries(rooms.reduce((acc, room) => {
                                        const floor = room.floor || 1;
                                        if (!acc[floor]) acc[floor] = [];
                                        acc[floor].push(room);
                                        return acc;
                                    }, {})).sort(([a], [b]) => Number(a) - Number(b)).map(([floor, floorRooms]) => (
                                        <optgroup key={floor} label={`Piso ${floor}`}>
                                            {floorRooms.sort((a, b) => a.number.localeCompare(b.number)).map(room => (
                                                <option key={room.id} value={room.id}>
                                                    {room.number} - {room.type} (${room.base_price?.toLocaleString()})
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Check-in</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                        value={formData.checkIn}
                                        onChange={e => setFormData({ ...formData, checkIn: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Check-out</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                        value={formData.checkOut}
                                        onChange={e => setFormData({ ...formData, checkOut: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Detalle</span>
                                    {formData.roomId && rooms.find(r => r.id === formData.roomId) && (
                                        <span className="text-xs font-bold text-gray-500">
                                            {Math.ceil((new Date(formData.checkOut) - new Date(formData.checkIn)) / (1000 * 60 * 60 * 24))} noche(s) x ${rooms.find(r => r.id === formData.roomId).base_price?.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-primary uppercase">Total Estimado</span>
                                    <span className="text-xl font-black text-secondary">${formData.totalPrice.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Section: Guest Info */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Huésped</h4>

                            <div className="relative">
                                <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Documento ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        required
                                        className="flex-1 bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                        value={formData.guestDoc}
                                        onChange={e => setFormData({ ...formData, guestDoc: e.target.value })}
                                        onBlur={handleSearchGuest} // Auto-search on blur
                                        placeholder="Cédula / Pasaporte"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearchGuest}
                                        className="bg-surface-soft text-secondary border border-hairline shadow-sm p-2.5 rounded-[16px] hover:bg-canvas transition-all"
                                        title="Buscar cliente existente"
                                    >
                                        <Search size={18} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                    value={formData.guestName}
                                    onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                        value={formData.guestPhone}
                                        onChange={e => setFormData({ ...formData, guestPhone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-accent mb-1 uppercase tracking-widest">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-canvas border border-hairline rounded-[16px] shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:border-primary transition-all"
                                        value={formData.guestEmail}
                                        onChange={e => setFormData({ ...formData, guestEmail: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-between items-center border-t border-hairline pt-6">
                        {bookingToEdit && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-danger bg-danger/10 hover:bg-danger/20 transition-all border border-danger/10"
                                >
                                    <Trash2 size={14} className="inline mr-1" /> General
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 ml-auto">
                            {bookingToEdit && formData.status === 'ocupada' && (
                                <button
                                    type="button"
                                    onClick={handleCheckOut}
                                    className="px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest text-white bg-secondary hover:bg-ink transition-all shadow-sm"
                                >
                                    Check-Out
                                </button>
                            )}

                            {bookingToEdit && formData.status === 'reservada' && (
                                <button
                                    type="button"
                                    onClick={handleCheckIn}
                                    className="px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest text-white bg-warning hover:opacity-90 transition-all shadow-sm"
                                >
                                    Check-In Ahora
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest text-accent hover:text-secondary hover:bg-surface-soft transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-primary text-white px-8 py-3 rounded-full font-bold text-[11px] uppercase tracking-widest shadow-airbnb hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Guardando...' : <><Save size={16} /> {bookingToEdit ? 'Actualizar' : 'Confirmar'}</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewReservationModal;
