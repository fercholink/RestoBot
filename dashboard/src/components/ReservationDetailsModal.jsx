import React from 'react';
import { X, Calendar, User, CreditCard, Trash2, LogOut, Edit, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ReservationDetailsModal = ({ isOpen, onClose, booking, onBookingUpdated, onEdit, onCheckOut }) => {
    if (!isOpen || !booking) return null;

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de cancelar esta reserva? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', booking.id);

            if (error) throw error;
            onBookingUpdated();
            onClose();
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Error al cancelar reserva: ' + error.message);
        }
    };

    const handleCheckOut = async () => {
        try {
            // Logic for Checkout (can be expanded later with billing)
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'finalizada' }) // Or whatever status determines history
                .eq('id', booking.id);

            if (error) throw error;
            onBookingUpdated();
            if (error) throw error;
            onBookingUpdated();
            onClose();
        } catch (error) {
            console.error('Error checking out:', error);
        }
    };

    // --- CARGAR CONSUMOS EXTRA ---
    const [roomCharges, setRoomCharges] = React.useState([]);
    const [loadingCharges, setLoadingCharges] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && booking) {
            fetchRoomCharges();
        }
    }, [isOpen, booking]);

    const fetchRoomCharges = async () => {
        setLoadingCharges(true);
        try {
            const { data, error } = await supabase
                .from('room_charges')
                .select('*')
                .eq('booking_id', booking.id);
            if (error) throw error;
            setRoomCharges(data || []);
        } catch (error) {
            console.error("Error fetching room charges:", error);
        } finally {
            setLoadingCharges(false);
        }
    };



    // --- FACTURACIÓN ELECTRÓNICA ---
    const [isElectronic, setIsElectronic] = React.useState(false);
    const [taxData, setTaxData] = React.useState({
        document_type: '13', // Cédula de Ciudadanía por defecto
        identification: '',
        names: '',
        email: '',
        type_person: '1' // Persona Natural por defecto
    });

    React.useEffect(() => {
        if (isOpen && booking && booking.guest) {
            // Auto-fill available data
            setTaxData(prev => ({
                ...prev,
                identification: booking.guest.document_id || prev.identification,
                names: booking.guest.full_name || prev.names,
                email: booking.guest.email || prev.email
            }));
        }
    }, [isOpen, booking]);

    // Calculate totals
    const start = new Date(booking.check_in);
    const end = new Date(booking.check_out);
    let nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (nights < 1) nights = 1;

    const accommodationTotal = booking.total_price || 0;
    const chargesTotal = roomCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const grandTotal = accommodationTotal + chargesTotal;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-secondary p-6 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        Reserva #{booking.id.toString().slice(0, 4)}
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Guest Info */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-lg">
                                {booking.guest?.full_name?.charAt(0)}
                            </div>
                            <div>
                                <p className="font-black text-secondary text-lg leading-tight">{booking.guest?.full_name}</p>
                                <p className="text-xs text-gray-400 font-bold uppercase">Huésped</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/50">
                            <div>
                                <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Documento</span>
                                <span className="text-xs font-bold text-secondary">{booking.guest?.document_id || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Teléfono</span>
                                <span className="text-xs font-bold text-secondary">{booking.guest?.phone || 'N/A'}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Email</span>
                                <span className="text-xs font-bold text-secondary">{booking.guest?.email || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stay Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-bold uppercase">Entrada</span>
                            <div className="flex items-center gap-2 text-secondary font-bold">
                                <Calendar size={14} className="text-primary" />
                                {new Date(booking.check_in).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-bold uppercase">Salida</span>
                            <div className="flex items-center gap-2 text-secondary font-bold">
                                <Calendar size={14} className="text-primary" />
                                {new Date(booking.check_out).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Alojamiento ({nights} noches)</span>
                            <span className="font-bold">${accommodationTotal.toLocaleString()}</span>
                        </div>

                        {roomCharges.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-gray-200 border-dashed">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consumos / Extras</p>
                                {roomCharges.map(charge => (
                                    <div key={charge.id} className="flex justify-between items-center text-xs text-gray-500">
                                        <span>{charge.description}</span>
                                        <span className="font-bold">${charge.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-xs font-bold text-gray-600 pt-1">
                                    <span>Subtotal Extras</span>
                                    <span>${chargesTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                            <span className="text-sm font-black text-secondary uppercase">Total a Pagar</span>
                            <span className="text-xl font-black text-primary">${grandTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Section: ELECTRONIC INVOICING */}
                    {booking.status === 'ocupada' && (
                        <div className="pt-2 border-t border-gray-100">
                            <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                <div
                                    onClick={() => setIsElectronic(!isElectronic)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${isElectronic ? 'bg-secondary' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isElectronic ? 'left-7' : 'left-1'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className={isElectronic ? 'text-secondary' : 'text-gray-400'} />
                                    <span className="text-xs font-black uppercase tracking-widest text-secondary">¿Requiere Factura Electrónica?</span>
                                </div>
                            </label>

                            {isElectronic && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={taxData.type_person}
                                            onChange={(e) => setTaxData({ ...taxData, type_person: e.target.value })}
                                            className="bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                        >
                                            <option value="1">Natural</option>
                                            <option value="2">Jurídica</option>
                                        </select>
                                        <select
                                            value={taxData.document_type}
                                            onChange={(e) => setTaxData({ ...taxData, document_type: e.target.value })}
                                            className="bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                        >
                                            <option value="13">Cédula</option>
                                            <option value="31">NIT</option>
                                        </select>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="No. Identificación / NIT"
                                        value={taxData.identification}
                                        onChange={(e) => setTaxData({ ...taxData, identification: e.target.value })}
                                        className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nombre / Razón Social"
                                        value={taxData.names}
                                        onChange={(e) => setTaxData({ ...taxData, names: e.target.value })}
                                        className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email para facturación"
                                        value={taxData.email}
                                        onChange={(e) => setTaxData({ ...taxData, email: e.target.value })}
                                        className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                        {booking.status !== 'checkout' && (
                            <button
                                onClick={() => {
                                    onEdit(booking);
                                    onClose();
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-secondary py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors"
                            >
                                <Edit size={16} /> Modificar
                            </button>
                        )}
                        {booking.status === 'reservada' && (
                            <button
                                onClick={handleDelete}
                                className="bg-red-50 hover:bg-red-100 text-red-500 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors"
                            >
                                <Trash2 size={16} /> Cancelar
                            </button>
                        )}
                    </div>

                    {/* Check-in / Check-out Actions */}
                    {booking.status === 'reservada' && (
                        <button
                            onClick={async () => {
                                try {
                                    const { error } = await supabase
                                        .from('bookings')
                                        .update({ status: 'ocupada' }) // 'ocupada' reflects active stay
                                        .eq('id', booking.id);

                                    if (error) throw error;
                                    onBookingUpdated();
                                    onClose();
                                } catch (error) {
                                    console.error('Error checking in:', error);
                                    alert('Error al realizar check-in: ' + error.message);
                                }
                            }}
                            className="w-full bg-secondary text-white py-4 rounded-xl font-black text-xs uppercase shadow-premium hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} className="rotate-180" /> Realizar Check-in
                        </button>
                    )}

                    {booking.status === 'ocupada' && (
                        <button
                            onClick={() => {
                                // Pass tax data if electronic, plus charges and total for receipt
                                onCheckOut(booking, isElectronic ? taxData : null, { roomCharges, grandTotal, accommodationTotal });
                            }}
                            className="w-full bg-primary text-white py-4 rounded-xl font-black text-xs uppercase shadow-premium hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> {isElectronic ? 'Facturar y Salir' : 'Finalizar Estadía'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReservationDetailsModal;
