import React, { useState } from 'react';
import { X, Banknote, Landmark, CheckCircle2, FileText, ChevronDown } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, onConfirm, orderId, totalPrice }) => {
    const [method, setMethod] = useState('efectivo');
    const [reference, setReference] = useState('');
    const [isElectronic, setIsElectronic] = useState(false);

    // Datos Tributarios (Factus / DIAN)
    const [taxData, setTaxData] = useState({
        document_type: '13', // Cédula de Ciudadanía por defecto
        identification: '',
        names: '',
        email: '',
        type_person: '1' // Persona Natural por defecto
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(orderId, method, reference, isElectronic ? taxData : null);
        onClose();
        setReference('');
        setMethod('efectivo');
        setIsElectronic(false);
    };

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
                    <div className="text-center bg-primary/5 p-6 rounded-2xl border border-primary/10">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total a Pagar</p>
                        <h3 className="text-4xl font-black text-secondary tracking-tighter">${totalPrice}</h3>
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
                            <button
                                type="button"
                                onClick={() => setMethod('transferencia')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${method === 'transferencia'
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-gray-100 bg-white text-accent hover:border-gray-200'
                                    }`}
                            >
                                <Landmark size={24} />
                                <span className="text-xs font-black uppercase">Bancos</span>
                            </button>
                        </div>
                    </div>

                    {method === 'transferencia' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Número de Comprobante</label>
                            <input
                                type="text"
                                required
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none"
                                placeholder="Ej: 982374123"
                            />
                        </div>
                    )}

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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Tipo de Persona</label>
                                        <select
                                            value={taxData.type_person}
                                            onChange={(e) => setTaxData({ ...taxData, type_person: e.target.value })}
                                            className="w-full bg-gray-100 border-none rounded-xl p-3 text-xs font-black text-secondary outline-none focus:ring-2 focus:ring-secondary/20 appearance-none"
                                        >
                                            <option value="1">Natural</option>
                                            <option value="2">Jurídica</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Tipo Identificación</label>
                                        <select
                                            value={taxData.document_type}
                                            onChange={(e) => setTaxData({ ...taxData, document_type: e.target.value })}
                                            className="w-full bg-gray-100 border-none rounded-xl p-3 text-xs font-black text-secondary outline-none focus:ring-2 focus:ring-secondary/20 appearance-none"
                                        >
                                            <option value="13">Cédula</option>
                                            <option value="31">NIT</option>
                                            <option value="22">Cédula Extranjería</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Número de Identificación</label>
                                    <input
                                        type="text"
                                        required={isElectronic}
                                        value={taxData.identification}
                                        onChange={(e) => setTaxData({ ...taxData, identification: e.target.value })}
                                        className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-secondary focus:bg-white transition-all outline-none"
                                        placeholder="Ej: 1012345678"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Nombre / Razón Social</label>
                                    <input
                                        type="text"
                                        required={isElectronic}
                                        value={taxData.names}
                                        onChange={(e) => setTaxData({ ...taxData, names: e.target.value })}
                                        className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-secondary focus:bg-white transition-all outline-none"
                                        placeholder="Ej: Juan Perez o Empresa SAS"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1">Email Tributario</label>
                                    <input
                                        type="email"
                                        required={isElectronic}
                                        value={taxData.email}
                                        onChange={(e) => setTaxData({ ...taxData, email: e.target.value })}
                                        className="w-full bg-gray-100 border-2 border-transparent rounded-xl p-3 text-sm font-bold focus:border-secondary focus:bg-white transition-all outline-none"
                                        placeholder="ejemplo@correo.com"
                                    />
                                </div>
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
        </div>
    );
};

export default PaymentModal;
