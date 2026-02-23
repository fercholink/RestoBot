import React, { useState } from 'react';
import { Inbox, UploadCloud, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { sileo } from 'sileo';
import factusService from '../../services/factusService';

const ReceptionDocuments = () => {
    const [cufes, setCufes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [history, setHistory] = useState([
        // Mock data to show intent
        { id: 1, type: '030', desc: 'Acuse de Recibo', status: 'success', date: '2023-11-20', cufe: 'CUFE-123456789' }
    ]);

    const handleEmitEvent = async (eventCode, eventName) => {
        if (!cufes.trim()) {
            return sileo.error({ title: 'Faltan datos', description: 'Por favor ingresa un CUFE o CUNE de la factura.' });
        }

        setProcessing(true);
        const loadingToast = sileo.loading({ title: 'Emitiendo evento...', description: `Enviando el evento ${eventName} a la DIAN.` });

        try {
            // Ejemplo de Payload de Factus para enviar eventos (Acuses, Recibo bien, Aceptación expresa)
            const payload = {
                document_reference: cufes.trim(), // CUFE o XML
                event_type_id: eventCode, // ej: "030", "032", "033"
            };

            // Simulación o llamada real
            // await factusService.emitEvent(payload);
            await new Promise(r => setTimeout(r, 1500));

            sileo.success({ title: '¡Éxito!', description: `El evento ${eventName} fue emitido exitosamente.` });
            setHistory(prev => [{
                id: Date.now(),
                type: eventCode,
                desc: eventName,
                status: 'success',
                date: new Date().toLocaleDateString('es-CO'),
                cufe: cufes.trim().substring(0, 20) + '...'
            }, ...prev]);
            setCufes('');
        } catch (error) {
            console.error('Error en evento RADIAN:', error);
            sileo.error({ title: 'Error Factus', description: error.message || 'Error emitiendo el evento.' });
        } finally {
            setProcessing(false);
            loadingToast.close();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grow overflow-hidden animate-in fade-in max-h-full">
            <h2 className="text-xl font-black text-secondary mb-1">Recepción de Documentos y Acuses</h2>
            <p className="text-xs text-gray-400 font-medium mb-8 max-w-2xl">
                Envía los eventos requeridos por la DIAN (Acuse de recibo, Recibo del servicio, Aceptación expresa) para que los costos a crédito sean deducibles de renta.
            </p>

            <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* Sección Formulario */}
                <div className="flex-1 flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                        CUFE del documento (Factura Electrónica)
                    </label>
                    <textarea
                        value={cufes}
                        onChange={(e) => setCufes(e.target.value)}
                        placeholder="Pega el CUFE de la factura aquí..."
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-mono focus:border-blue-500 focus:bg-white transition-all h-32 resize-none outline-none"
                    ></textarea>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <button
                            disabled={processing}
                            onClick={() => handleEmitEvent('030', 'Acuse de Recibo')}
                            className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-2xl transition-all border border-purple-100 disabled:opacity-50 hover:-translate-y-1 active:scale-95"
                        >
                            <span className="text-xl font-black mb-1">Paso 1</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Acuse de Recibo</span>
                        </button>
                        <button
                            disabled={processing}
                            onClick={() => handleEmitEvent('032', 'Recibo del bien/servicio')}
                            className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-2xl transition-all border border-orange-100 disabled:opacity-50 hover:-translate-y-1 active:scale-95"
                        >
                            <span className="text-xl font-black mb-1">Paso 2</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-center">Recibo de<br />Bienes/Servicios</span>
                        </button>
                        <button
                            disabled={processing}
                            onClick={() => handleEmitEvent('033', 'Aceptación Expresa')}
                            className="flex flex-col items-center justify-center p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl transition-all border border-emerald-100 disabled:opacity-50 hover:-translate-y-1 active:scale-95"
                        >
                            <span className="text-xl font-black mb-1">Paso 3</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-center">Aceptación<br />Expresa</span>
                        </button>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="text-xs font-black uppercase text-blue-900 mb-1">Validación Automática DIAN</p>
                            <p className="text-[10px] text-blue-700/80 font-medium">
                                Recuerda que los eventos deben emitirse en el orden estricto (Paso 1 → Paso 2 → Paso 3). Al enviar estos eventos a través de nuestra API, la factura de tu proveedor queda convertida legalmente en título valor, y su costo se puede deducir de tu impuesto de renta.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sección Historial */}
                <div className="w-full md:w-80 flex flex-col border border-gray-100 rounded-3xl overflow-hidden bg-gray-50/30">
                    <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-secondary">Historial Eventos</span>
                        <Clock size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {history.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-black text-secondary">{item.desc}</span>
                                    <CheckCircle size={14} className="text-emerald-500" />
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono break-all line-clamp-2" title={item.cufe}>
                                    {item.cufe}
                                </div>
                                <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between border-t border-gray-50 pt-2">
                                    <span>{item.date}</span>
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">Cód. {item.type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionDocuments;
