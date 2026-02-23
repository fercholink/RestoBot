import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Save, X, Plus, AlertCircle, Trash2, Power } from 'lucide-react';

const BranchResolutionsModal = ({ branch, onClose }) => {
    const [resolutions, setResolutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (branch) fetchResolutions();
    }, [branch]);

    const fetchResolutions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('branch_resolutions')
                .select('*')
                .eq('branch_id', branch.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setResolutions(data || []);
        } catch (error) {
            console.error('Error fetching resolutions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveResolution = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const resData = {
            branch_id: branch.id,
            resolution_number: formData.get('resolution_number'),
            prefix: formData.get('prefix'),
            start_range: parseInt(formData.get('start_range'), 10),
            end_range: parseInt(formData.get('end_range'), 10),
            current_number: parseInt(formData.get('current_number'), 10),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            is_active: formData.get('is_active') === 'on'
        };

        try {
            // Si la nueva es activa, desactivar las demás en la UI y DB
            if (resData.is_active) {
                await supabase
                    .from('branch_resolutions')
                    .update({ is_active: false })
                    .eq('branch_id', branch.id);
            }

            const { error } = await supabase
                .from('branch_resolutions')
                .insert([resData]);

            if (error) throw error;

            setShowForm(false);
            fetchResolutions();
        } catch (error) {
            alert('Error al guardar resolución: ' + error.message);
        }
    };

    const toggleActive = async (res) => {
        try {
            // Desactivar todas primero si estamos activando esta
            if (!res.is_active) {
                await supabase
                    .from('branch_resolutions')
                    .update({ is_active: false })
                    .eq('branch_id', branch.id);
            }

            const { error } = await supabase
                .from('branch_resolutions')
                .update({ is_active: !res.is_active })
                .eq('id', res.id);

            if (error) throw error;
            fetchResolutions();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const deleteResolution = async (id) => {
        if (!confirm('¿Está seguro de eliminar esta resolución?')) return;
        try {
            const { error } = await supabase
                .from('branch_resolutions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchResolutions();
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in fade-in duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-secondary to-gray-900 p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <FileText size={24} className="text-primary" />
                            Resoluciones DIAN - {branch?.name}
                        </h3>
                        <p className="text-white/60 text-xs mt-1">Gestión de consecutivos y autorizaciones</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {!showForm ? (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Historial de Resoluciones</h4>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-premium hover:brightness-110 transition-all flex items-center gap-2"
                                >
                                    <Plus size={16} /> Nueva Resolución
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-10 opacity-50 font-bold">Cargando...</div>
                            ) : resolutions.length === 0 ? (
                                <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-2xl">
                                    <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500 font-bold text-sm">No hay resoluciones registradas</p>
                                    <p className="text-xs text-gray-400">Agregue una resolución para empezar a facturar legalmente.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {resolutions.map(res => (
                                        <div key={res.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${res.is_active ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200 opacity-70'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h5 className="font-black text-secondary text-lg">Res. {res.resolution_number}</h5>
                                                        {res.is_active && (
                                                            <span className="bg-primary/10 text-primary text-[10px] uppercase font-black px-2 py-0.5 rounded-lg tracking-widest">Activa</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400 font-bold">Vigencia: {res.start_date} al {res.end_date}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => toggleActive(res)}
                                                        className={`p-2 rounded-xl transition-colors ${res.is_active ? 'bg-gray-100 text-gray-400' : 'bg-success/10 text-success hover:bg-success/20'}`}
                                                        title={res.is_active ? 'Desactivar' : 'Marcar como Activa'}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteResolution(res.id)}
                                                        className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                                                <div>
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Prefijo</p>
                                                    <p className="font-black text-secondary text-sm">{res.prefix}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Rangos Autorizados</p>
                                                    <p className="font-black text-secondary text-sm">{res.start_range} - {res.end_range}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Siguiente Factura</p>
                                                    <p className="font-black text-primary text-sm">{res.prefix}-{res.current_number}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <form onSubmit={handleSaveResolution} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            <h4 className="font-black text-secondary mb-4 flex items-center gap-2">
                                <Plus size={18} className="text-primary" />
                                Agregar Nueva Resolución
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Número de Resolución DIAN</label>
                                    <input name="resolution_number" required type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" placeholder="Ej. 18760000001" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Prefijo</label>
                                    <input name="prefix" required type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold uppercase" placeholder="POS" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Número Inicial / Actual</label>
                                    <input name="current_number" required type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" placeholder="1" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Rango Inicial Autorizado</label>
                                    <input name="start_range" required type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" placeholder="1" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Rango Final Autorizado</label>
                                    <input name="end_range" required type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" placeholder="10000" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Fecha de Inicio</label>
                                    <input name="start_date" required type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Fecha de Fin (Vencimiento)</label>
                                    <input name="end_date" required type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" />
                                </div>

                                <div className="col-span-2 mt-2 bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-secondary text-sm">Hacer Principal</p>
                                        <p className="text-xs text-secondary/60">Marcar esta resolución como la activa para facturación en caja.</p>
                                    </div>
                                    <label className="relative flex items-center cursor-pointer">
                                        <input type="checkbox" name="is_active" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 mt-6 border-t border-gray-100">
                                <button type="submit" className="flex-1 bg-secondary text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all">
                                    Guardar y Aplicar
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-secondary rounded-xl font-black uppercase text-sm tracking-widest hover:bg-gray-200 transition-all">
                                    Volver
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BranchResolutionsModal;
