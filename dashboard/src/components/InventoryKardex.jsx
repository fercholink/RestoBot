import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    X, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Settings, 
    ShoppingBag, 
    RefreshCcw, 
    Trash2,
    Calendar,
    User as UserIcon,
    History
} from 'lucide-react';

const reasonIcons = {
    venta: { icon: ShoppingBag, color: 'text-red-500', bg: 'bg-red-50', label: 'Venta' },
    compra: { icon: ArrowUpCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Compra' },
    ajuste: { icon: Settings, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Ajuste Manual' },
    devolucion: { icon: RefreshCcw, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Devolución' },
    desperdicio: { icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Desperdicio' }
};

const InventoryKardex = ({ product, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (product?.id) {
            fetchLogs();
        }
    }, [product]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_logs')
                .select('*')
                .eq('product_id', product.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching inventory logs:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!product) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in fade-in duration-300">
                {/* Header */}
                <div className="p-8 border-b flex justify-between items-center bg-gradient-to-r from-secondary to-gray-900 text-white">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <History size={24} className="text-primary" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight">Kardex de Inventario</h2>
                        </div>
                        <p className="text-white/60 text-sm font-bold ml-11 uppercase tracking-widest">
                            {product.name}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 hover:bg-white/10 rounded-full transition-all group"
                    >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-secondary font-black animate-pulse">Cargando historial...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <History size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-secondary font-black text-lg">Sin movimientos</h3>
                            <p className="text-gray-400 text-sm max-w-xs">No se han registrado movimientos de stock para este producto todavía.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Resumen Superior */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock Actual</p>
                                    <p className="text-3xl font-black text-secondary">{product.stock || 0}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Entradas (Hist.)</p>
                                    <p className="text-3xl font-black text-green-500">
                                        {logs.filter(l => l.quantity_changed > 0).reduce((sum, l) => sum + l.quantity_changed, 0)}
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Salidas (Hist.)</p>
                                    <p className="text-3xl font-black text-red-500">
                                        {Math.abs(logs.filter(l => l.quantity_changed < 0).reduce((sum, l) => sum + l.quantity_changed, 0))}
                                    </p>
                                </div>
                            </div>

                            {/* Tabla de Movimientos */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha y Hora</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Cambio</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stock Final</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {logs.map((log) => {
                                            const reason = reasonIcons[log.reason] || reasonIcons.ajuste;
                                            const Icon = reason.icon;
                                            return (
                                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-gray-300" />
                                                            <span className="text-xs font-bold text-secondary">
                                                                {format(parseISO(log.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg ${reason.bg}`}>
                                                                <Icon size={14} className={reason.color} />
                                                            </div>
                                                            <span className="text-xs font-black text-secondary">{reason.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-xs font-black ${log.quantity_changed > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-black text-secondary bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                                            {log.new_stock}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-full bg-secondary/10 flex items-center justify-center">
                                                                <UserIcon size={10} className="text-secondary" />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-400 italic">Sistemas</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="bg-secondary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                    >
                        Cerrar Historial
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InventoryKardex;
