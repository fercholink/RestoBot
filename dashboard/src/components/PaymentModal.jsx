import React, { useState, useEffect } from 'react';
import { X, Banknote, Landmark, CheckCircle2, FileText, ChevronDown, Hotel, Search, Plus, Users, LayoutList, Split } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';
import ThirdPartyModal from './accounting/ThirdPartyModal';

const PaymentModal = ({ isOpen, onClose, onConfirm, orderId, totalPrice, order }) => {
    const [method, setMethod] = useState('efectivo');
    const [reference, setReference] = useState('');
    const [isElectronic, setIsElectronic] = useState(false);
    const [tipAmount, setTipAmount] = useState(0);
    
    // Split Bill State
    const [splitMode, setSplitMode] = useState(null); // 'equal' or 'items' or null
    const [numSplits, setNumSplits] = useState(2);
    const [selectedItems, setSelectedItems] = useState([]);
    const [currentSplitTotal, setCurrentSplitTotal] = useState(totalPrice);

    // Hotel Charge State
    const [activeBookings, setActiveBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState('');
    const [loadingBookings, setLoadingBookings] = useState(false);

    // Datos Tributarios (Factus / DIAN)
    const [thirdParties, setThirdParties] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedThirdParty, setSelectedThirdParty] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isThirdPartyModalOpen, setIsThirdPartyModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchActiveBookings();
            fetchThirdParties();
            setMethod('efectivo');
            setReference('');
            setSelectedBooking('');
            setSelectedThirdParty(null);
            setSearchTerm('');
            setIsDropdownOpen(false);
            setIsElectronic(false);
            setIsThirdPartyModalOpen(false);
            setTipAmount(0);

            // Reset split
            setSplitMode(null);
            setNumSplits(2);
            setSelectedItems([]);
            setCurrentSplitTotal(totalPrice);
        }
    }, [isOpen]);

    useEffect(() => {
        if (splitMode === 'equal') {
            setCurrentSplitTotal(totalPrice / numSplits);
        } else if (splitMode === 'items') {
            const sum = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            setCurrentSplitTotal(sum);
        } else {
            setCurrentSplitTotal(totalPrice);
        }
    }, [splitMode, numSplits, selectedItems, totalPrice]);

    const toggleItemSelection = (item) => {
        const index = selectedItems.findIndex(i => i.id === item.id);
        if (index > -1) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const handleThirdPartySaved = (newTp) => {
        fetchThirdParties();
        setSelectedThirdParty(newTp);
        setIsThirdPartyModalOpen(false);
        setIsDropdownOpen(false);
        setSearchTerm('');
    };

    const fetchThirdParties = async () => {
        try {
            const { data, error } = await supabase
                .from('third_parties')
                .select('id, document_number, verification_digit, business_name, first_name, last_name, document_type')
                .eq('is_client', true);
            if (error) throw error;
            setThirdParties(data || []);
        } catch (error) {
            console.error('Error fetching third parties:', error);
        }
    };

    const fetchActiveBookings = async () => {
        setLoadingBookings(true);
        try {
            // Fetch bookings that are currently 'ocupada'
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    room:rooms(number, type),
                    guest:guests(full_name)
                `)
                .eq('status', 'ocupada');

            if (error) throw error;
            setActiveBookings(data || []);
        } catch (error) {
            console.error("Error fetching hotel bookings:", error);
        } finally {
            setLoadingBookings(false);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation for Hotel Charge
        if (method === 'cargo_habitacion' && !selectedBooking) {
            sileo.error({ title: 'Campo requerido', description: 'Seleccione una habitación para el cargo.' });
            return;
        }

        if (isElectronic && !selectedThirdParty) {
            sileo.error({ title: 'Campo requerido', description: 'Seleccione un tercero para la factura electrónica.' });
            return;
        }

        // If Hotel Charge, we pass bookingId as reference
        const finalRef = method === 'cargo_habitacion' ? selectedBooking : reference;

        // Pasamos el ID del tercero en lugar del objeto manual
        onConfirm(orderId, method, finalRef, isElectronic ? { third_party_id: selectedThirdParty.id } : null, splitMode ? { type: splitMode, amount: currentSplitTotal, items: selectedItems } : null, tipAmount || 0);
        onClose();
    };

    const filteredThirdParties = thirdParties.filter(tp =>
        (tp.business_name && tp.business_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tp.first_name && tp.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tp.last_name && tp.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tp.document_number.includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-lg my-auto overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tight">Confirmar Pago</h2>
                        <p className="text-xs font-bold text-accent uppercase tracking-widest mt-1">Pedido #{orderId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="text-center bg-primary/5 p-6 rounded-2xl border border-primary/10 relative overflow-hidden">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                            {splitMode ? 'Diferencia a Pagar' : 'Total a Pagar'}
                        </p>
                        <h3 className="text-4xl font-black text-secondary tracking-tighter">${currentSplitTotal.toLocaleString()}</h3>
                        {tipAmount > 0 && (
                            <div className="mt-2 pt-2 border-t border-primary/10 space-y-0.5">
                                <p className="text-[10px] text-gray-400 font-bold">Consumo: ${currentSplitTotal.toLocaleString()} + Propina: ${tipAmount.toLocaleString()}</p>
                                <p className="text-sm font-black text-secondary">Gran total: ${(currentSplitTotal + tipAmount).toLocaleString()}</p>
                            </div>
                        )}
                        {splitMode && !tipAmount && (
                            <p className="text-[10px] font-bold text-accent mt-1 italic">Viene de un total de ${totalPrice.toLocaleString()}</p>
                        )}
                    </div>

                    {/* Split Bill UI */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1 flex justify-between items-center">
                            <span>División de Cuenta</span>
                            {splitMode && (
                                <button type="button" onClick={() => setSplitMode(null)} className="text-rose-500 hover:text-rose-600 transition-colors">Cancelar</button>
                            )}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSplitMode('equal')}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${splitMode === 'equal' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                            >
                                <Users size={18} />
                                <span className="text-[10px] font-black uppercase tracking-wider">Por Partes</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSplitMode('items')}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${splitMode === 'items' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                            >
                                <LayoutList size={18} />
                                <span className="text-[10px] font-black uppercase tracking-wider">Por Productos</span>
                            </button>
                        </div>

                        {splitMode === 'equal' && (
                            <div className="bg-gray-50 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Número de Personas</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" min="2" max="10" step="1" 
                                        value={numSplits} 
                                        onChange={(e) => setNumSplits(parseInt(e.target.value))}
                                        className="flex-1 accent-secondary"
                                    />
                                    <span className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-black text-secondary">{numSplits}</span>
                                </div>
                                <p className="text-[10px] text-accent font-bold italic text-center">Cada persona paga ${(totalPrice / numSplits).toLocaleString()}</p>
                            </div>
                        )}

                        {splitMode === 'items' && order?.items && (
                            <div className="bg-gray-50 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto custom-scrollbar">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Seleccionar Productos para cobrar</label>
                                <div className="space-y-2">
                                    {order.items.map((item, idx) => {
                                        const isSelected = selectedItems.some(i => i.id === item.id);
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => toggleItemSelection(item)}
                                                className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${isSelected ? 'bg-secondary text-white border-secondary' : 'bg-white text-secondary border-gray-100 hover:border-gray-200'}`}
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="text-xs font-bold">{item.product_name}</span>
                                                    <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-accent'}`}>Cant: {item.quantity}</span>
                                                </div>
                                                <span className="text-xs font-black">${(item.price * item.quantity).toLocaleString()}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Método de Pago</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setMethod('efectivo')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${method === 'efectivo'
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-gray-100 bg-white text-accent hover:border-gray-200'
                                    }`}
                            >
                                <Banknote size={24} />
                                <span className="text-xs font-black uppercase">Efectivo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('nequi')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${method === 'nequi'
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-gray-100 bg-white text-accent hover:border-gray-200'
                                    }`}
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Nequi_Colombia_logo.svg" alt="Nequi" className="h-6 opacity-80" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                <span style={{ display: 'none' }}>📱</span>
                                <span className="text-xs font-black uppercase">Nequi / Davi</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('tarjeta')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${method === 'tarjeta'
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-gray-100 bg-white text-accent hover:border-gray-200'
                                    }`}
                            >
                                <div className="flex gap-1">
                                    <div className="w-4 h-4 rounded-full bg-red-500/80" />
                                    <div className="w-4 h-4 rounded-full bg-yellow-400/80 -ml-2" />
                                </div>
                                <span className="text-xs font-black uppercase">Datáfono</span>
                            </button>

                            {/* HOTEL CHARGE OPTION */}
                            <button
                                type="button"
                                onClick={() => setMethod('cargo_habitacion')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${method === 'cargo_habitacion'
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-gray-100 bg-white text-accent hover:border-gray-200'
                                    }`}
                            >
                                <Hotel size={24} />
                                <span className="text-xs font-black uppercase text-center">Cargo a Habitación</span>
                            </button>
                        </div>
                    </div>

                    {method === 'transferencia' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Número de Comprobante</label>
                            <input
                                type="text"
                                required={method === 'transferencia'}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none"
                                placeholder="Ej: 982374123"
                            />
                        </div>
                    )}

                    {/* HOTEL ROOM SELECTION */}
                    {method === 'cargo_habitacion' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Seleccionar Habitación</label>
                            {loadingBookings ? (
                                <div className="p-3 text-xs text-center text-gray-400 bg-gray-50 rounded-xl">Cargando habitaciones...</div>
                            ) : activeBookings.length === 0 ? (
                                <div className="p-3 text-xs text-center text-orange-500 bg-orange-50 rounded-xl border border-orange-100 font-bold">
                                    No hay habitaciones ocupadas actualmente.
                                </div>
                            ) : (
                                <select
                                    required={method === 'cargo_habitacion'}
                                    value={selectedBooking}
                                    onChange={(e) => setSelectedBooking(e.target.value)}
                                    className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none"
                                >
                                    <option value="">-- Seleccionar Habitación --</option>
                                    {activeBookings.map(booking => (
                                        <option key={booking.id} value={booking.id}>
                                            Hab {booking.room?.number} - {booking.guest?.full_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* ── Propina Voluntaria (Ley 1935/2018) ── */}
                    <div className="space-y-3 border-t border-gray-100 pt-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-secondary/60 uppercase tracking-widest">
                                Propina Voluntaria — Máx 10% (Ley 1935/2018)
                            </p>
                            {tipAmount > 0 && (
                                <button type="button" onClick={() => setTipAmount(0)} className="text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors">
                                    Quitar
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[0, 5, 8, 10].map(pct => {
                                const amt = pct === 0 ? 0 : Math.round(totalPrice * pct / 100);
                                const isSelected = pct === 0 ? tipAmount === 0 : tipAmount === amt && amt > 0;
                                return (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => setTipAmount(amt)}
                                        className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${isSelected ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                    >
                                        {pct === 0 ? 'Sin propina' : `${pct}%`}
                                    </button>
                                );
                            })}
                        </div>
                        {tipAmount > 0 && (
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Propina (para el personal):</span>
                                <span className="text-sm font-black text-amber-700">${tipAmount.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Sección de Facturación Electrónica */}
                    <div className="pt-4 border-t border-gray-100">
                        <label className="flex items-center gap-3 cursor-pointer group">
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
                            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Tercero Contable (Receptor DIAN)</label>

                                {selectedThirdParty ? (
                                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black uppercase">{selectedThirdParty.document_type}</span>
                                                <span className="text-sm font-bold text-secondary font-mono">{selectedThirdParty.document_number}{selectedThirdParty.verification_digit ? `-${selectedThirdParty.verification_digit}` : ''}</span>
                                            </div>
                                            <p className="text-secondary font-black capitalize mt-1">
                                                {selectedThirdParty.business_name || `${selectedThirdParty.first_name} ${selectedThirdParty.last_name}`.trim()}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedThirdParty(null)}
                                            className="text-rose-500 hover:bg-rose-100 p-2 rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
                                            placeholder="Buscar por nombre, razón social o NIT/CC..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setIsDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                        />

                                        {isDropdownOpen && searchTerm.length > 0 && (
                                            <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredThirdParties.length > 0 ? (
                                                    <ul className="py-2">
                                                        {filteredThirdParties.map(tp => (
                                                            <li
                                                                key={tp.id}
                                                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                                onClick={() => {
                                                                    setSelectedThirdParty(tp);
                                                                    setIsDropdownOpen(false);
                                                                    setSearchTerm('');
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-black uppercase">{tp.document_type}</span>
                                                                    <span className="text-xs font-mono font-bold text-gray-500">{tp.document_number}</span>
                                                                </div>
                                                                <div className="text-sm font-black text-secondary mt-0.5">
                                                                    {tp.business_name || `${tp.first_name} ${tp.last_name}`.trim()}
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="p-4 text-center">
                                                        <p className="text-xs text-gray-500 mb-3">No se encontraron terceros.</p>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsThirdPartyModalOpen(true);
                                                            }}
                                                            className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-colors flex items-center gap-2 mx-auto shadow-sm active:scale-95"
                                                        >
                                                            <Plus size={14} /> Crear Nuevo Cliente
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-secondary text-white font-black py-4 rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <CheckCircle2 size={20} className="text-success" />
                        {isElectronic ? 'GENERAR FACTURA Y PAGAR' : 'FINALIZAR Y PAGAR'}
                    </button>
                </form>
            </div>

            {/* Quick Add Third Party Modal */}
            {isThirdPartyModalOpen && (
                <ThirdPartyModal
                    isOpen={isThirdPartyModalOpen}
                    onClose={() => setIsThirdPartyModalOpen(false)}
                    onSaved={handleThirdPartySaved}
                    initialDocNumber={/^\d+$/.test(searchTerm) ? searchTerm : ''}
                />
            )}
        </div>
    );
};

export default PaymentModal;
