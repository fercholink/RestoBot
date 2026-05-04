import React from 'react';
import { X, Calendar, User, CreditCard, Trash2, LogOut, Edit, FileText, Share2 } from 'lucide-react';
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
                .select('*, orders(order_items(*))')
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-canvas rounded-[24px] shadow-airbnb border border-hairline w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
                <div className="bg-canvas border-b border-hairline p-6 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-secondary flex items-center gap-2">
                        Reserva #{booking.id.toString().slice(0, 4)}
                    </h3>
                    <button onClick={onClose} className="text-accent hover:text-secondary transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Detalles */}
                    <div className="space-y-6">
                        {/* Guest Info */}
                        <div className="bg-surface-soft p-4 rounded-[16px] border border-hairline space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                    {booking.guest?.full_name?.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-secondary text-lg leading-tight">{booking.guest?.full_name}</p>
                                    <p className="text-[11px] text-accent font-bold uppercase tracking-widest">Huésped</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-hairline">
                                <div>
                                    <span className="text-[10px] text-accent font-bold uppercase block mb-0.5">Documento</span>
                                    <span className="text-xs font-bold text-secondary">{booking.guest?.document_id || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-accent font-bold uppercase block mb-0.5">Teléfono</span>
                                    <span className="text-xs font-bold text-secondary">{booking.guest?.phone || 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[10px] text-accent font-bold uppercase block mb-0.5">Email</span>
                                    <span className="text-xs font-bold text-secondary">{booking.guest?.email || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stay Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[11px] text-accent font-bold uppercase tracking-widest">Entrada</span>
                                <div className="flex items-center gap-2 text-secondary font-bold">
                                    <Calendar size={14} className="text-primary" />
                                    {new Date(booking.check_in).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[11px] text-accent font-bold uppercase tracking-widest">Salida</span>
                                <div className="flex items-center gap-2 text-secondary font-bold">
                                    <Calendar size={14} className="text-primary" />
                                    {new Date(booking.check_out).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </div> {/* Fin Columna Izquierda */}

                    {/* Columna Derecha: Totales y Acciones */}
                    <div className="space-y-6">
                        <div className="bg-surface-soft border border-hairline p-4 rounded-[16px] space-y-2">
                            <div className="flex justify-between items-center text-xs text-accent">
                                <span>Alojamiento ({nights} noches)</span>
                                <span className="font-bold text-secondary">${accommodationTotal.toLocaleString()}</span>
                            </div>

                            {roomCharges.length > 0 && (
                                <div className="space-y-1 pt-2 border-t border-hairline border-dashed">
                                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Consumos / Extras</p>
                                    {roomCharges.map(charge => (
                                        <div key={charge.id} className="flex justify-between items-center text-xs text-accent">
                                            <span>{charge.description}</span>
                                            <span className="font-bold text-secondary">${charge.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center text-xs font-bold text-secondary pt-1">
                                        <span>Subtotal Extras</span>
                                        <span>${chargesTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2 border-t border-hairline mt-2">
                                <span className="text-sm font-bold text-secondary uppercase tracking-widest">Total a Pagar</span>
                                <span className="text-xl font-bold text-primary">${grandTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Section: ELECTRONIC INVOICING */}
                        {booking.status === 'ocupada' && (
                            <div className="pt-2 border-t border-hairline">
                                <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                    <div
                                        onClick={() => setIsElectronic(!isElectronic)}
                                        className={`w-12 h-6 rounded-full transition-all relative ${isElectronic ? 'bg-secondary' : 'bg-surface-soft border border-hairline'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isElectronic ? 'left-7' : 'left-1 bg-accent'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileText size={18} className={isElectronic ? 'text-secondary' : 'text-accent'} />
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">¿Requiere Factura Electrónica?</span>
                                    </div>
                                </label>

                                {isElectronic && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={taxData.type_person}
                                                onChange={(e) => setTaxData({ ...taxData, type_person: e.target.value })}
                                                className="bg-surface-soft border border-hairline rounded-[16px] px-3 py-3 text-xs font-bold outline-none focus:border-primary/50"
                                            >
                                                <option value="1">Natural</option>
                                                <option value="2">Jurídica</option>
                                            </select>
                                            <select
                                                value={taxData.document_type}
                                                onChange={(e) => setTaxData({ ...taxData, document_type: e.target.value })}
                                                className="bg-surface-soft border border-hairline rounded-[16px] px-3 py-3 text-xs font-bold outline-none focus:border-primary/50"
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
                                            className="w-full bg-surface-soft border border-hairline rounded-[16px] px-4 py-3 text-xs font-bold outline-none focus:border-primary/50"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Nombre / Razón Social"
                                            value={taxData.names}
                                            onChange={(e) => setTaxData({ ...taxData, names: e.target.value })}
                                            className="w-full bg-surface-soft border border-hairline rounded-[16px] px-4 py-3 text-xs font-bold outline-none focus:border-primary/50"
                                        />
                                        <input
                                            type="email"
                                            placeholder="Email para facturación"
                                            value={taxData.email}
                                            onChange={(e) => setTaxData({ ...taxData, email: e.target.value })}
                                            className="w-full bg-surface-soft border border-hairline rounded-[16px] px-4 py-3 text-xs font-bold outline-none focus:border-primary/50"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-hairline">
                            <button
                                onClick={() => {
                                    const link = `${window.location.origin}/?id=${booking.id}`;
                                    navigator.clipboard.writeText(link);
                                    alert('Link de Check-in copiado al portapapeles');
                                }}
                                className="bg-surface-soft hover:bg-canvas text-secondary py-3 rounded-full font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-hairline shadow-sm"
                            >
                                <Share2 size={16} /> Link Check-in
                            </button>
                            {booking.status !== 'checkout' && (
                                <button
                                    onClick={() => {
                                        onEdit(booking);
                                        onClose();
                                    }}
                                    className="bg-surface-soft hover:bg-canvas text-secondary py-3 rounded-full font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-hairline shadow-sm"
                                >
                                    <Edit size={16} /> Modificar
                                </button>
                            )}
                            {booking.status === 'reservada' && (
                                <button
                                    onClick={handleDelete}
                                    className="col-span-2 bg-danger/10 hover:bg-danger/20 text-danger py-3 rounded-full font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors mt-1"
                                >
                                    <Trash2 size={16} /> Cancelar Reserva
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
                                className="w-full bg-secondary text-white py-4 rounded-full font-bold text-[11px] tracking-widest uppercase shadow-airbnb hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
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
                                className="w-full bg-primary text-white py-4 rounded-full font-bold text-[11px] tracking-widest uppercase shadow-airbnb hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                            >
                                <LogOut size={18} /> {isElectronic ? 'Facturar y Salir' : 'Finalizar Estadía'}
                            </button>
                        )}
                    </div> {/* Fin Columna Derecha */}
                </div>
            </div>
        </div>
    );
};

export default ReservationDetailsModal;
