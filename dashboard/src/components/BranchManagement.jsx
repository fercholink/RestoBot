import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Users, Plus, Edit2, Trash2, Power, CheckCircle2, XCircle, Search, Save, X, FileText, Smartphone, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BranchManagement = () => {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);

    // Initial Load
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
            setBranches(data || []);
        } catch (error) {
            console.error('Error fetching branches:', error);
            // Fallback to empty or toast
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBranch = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const branchData = {
            name: formData.get('name'),
            address: formData.get('address'),
            city: formData.get('city'),
            phone: formData.get('phone'),
            nit: formData.get('nit'),
            resolution: formData.get('resolution'),
            resolution_date: formData.get('resolution_date') || null,
            resolution_range: formData.get('resolution_range'),
            resolution_prefix: formData.get('resolution_prefix'),
            invoice_footer: formData.get('invoice_footer'),
            active: true
        };

        try {
            if (editingBranch) {
                const { error } = await supabase
                    .from('branches')
                    .update(branchData)
                    .eq('id', editingBranch.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('branches')
                    .insert([branchData]);
                if (error) throw error;
            }
            setShowModal(false);
            fetchBranches();
        } catch (error) {
            alert('Error al guardar sucursal: ' + error.message);
        }
    };

    const handleDeleteBranch = async (id) => {
        if (!confirm('¿Está seguro de desactivar esta sucursal?')) return;
        try {
            const { error } = await supabase
                .from('branches')
                .update({ active: false })
                .eq('id', id);
            if (error) throw error;
            fetchBranches();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const toggleStatus = async (branch) => {
        try {
            const { error } = await supabase
                .from('branches')
                .update({ active: !branch.active })
                .eq('id', branch.id);
            if (error) throw error;
            fetchBranches();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar sede..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => { setEditingBranch(null); setShowModal(true); }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-premium hover:brightness-110 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                    Nueva Sucursal
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Cargando sucursales...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBranches.map((branch) => (
                        <div
                            key={branch.id}
                            className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-premium transition-all duration-300 ${!branch.active ? 'opacity-70 grayscale-[0.3]' : ''}`}
                        >
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className={`p-3 rounded-2xl ${branch.active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                                        <Building2 size={24} />
                                    </div>
                                    <button
                                        onClick={() => toggleStatus(branch)}
                                        className={`p-2 rounded-xl transition-all ${branch.active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                                        title={branch.active ? 'Desactivar Sede' : 'Activar Sede'}
                                    >
                                        <Power size={18} />
                                    </button>
                                </div>

                                <div>
                                    <h3 className="text-xl font-black text-secondary tracking-tight">{branch.name}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-medium">
                                        <MapPin size={12} />
                                        {branch.address} - {branch.city || 'Ciudad Principal'}
                                    </div>
                                </div>

                                {/* Info Legal Compacta */}
                                <div className="bg-gray-50 rounded-xl p-3 text-[10px] space-y-1 border border-gray-100">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-400">NIT:</span>
                                        <span className="font-black text-secondary">{branch.nit || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-400">Resolución:</span>
                                        <span className="font-black text-secondary truncate max-w-[120px]" title={branch.resolution}>{branch.resolution || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between text-primary font-bold">
                                        <span>Prefijo:</span>
                                        <span>{branch.resolution_prefix || 'POS'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 text-xs font-bold text-gray-500">
                                    <Phone size={12} className="text-primary/60" />
                                    {branch.phone}
                                </div>

                                <div className="pt-4 flex gap-2">
                                    <button
                                        onClick={() => { setEditingBranch(branch); setShowModal(true); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-secondary hover:bg-gray-100 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-gray-100"
                                    >
                                        <Edit2 size={14} />
                                        Editar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Sede */}
            {showModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in fade-in duration-200 my-8">
                        <div className="bg-secondary p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black tracking-tight">{editingBranch ? 'Configuración Legal' : 'Nueva Sede'}</h3>
                                <p className="text-white/60 text-xs font-medium mt-1">Datos de facturación y contacto</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                            <Building2 className="absolute -right-8 -bottom-8 text-white/5 w-40 h-40" />
                        </div>
                        <form onSubmit={handleSaveBranch} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Datos Básicos */}
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Nombre Comercial</label>
                                    <input name="name" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" defaultValue={editingBranch?.name} required placeholder="Ej. Restaurante Sede Norte" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Ciudad</label>
                                    <input name="city" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" defaultValue={editingBranch?.city} placeholder="Ciudad" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Teléfono</label>
                                    <input name="phone" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" defaultValue={editingBranch?.phone} placeholder="+57..." />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Dirección Física</label>
                                    <input name="address" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" defaultValue={editingBranch?.address} placeholder="Dirección completa" />
                                </div>

                                {/* Separador Legal */}
                                <div className="col-span-2 pt-4 pb-2 border-b border-gray-100 mb-2">
                                    <h4 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={14} className="text-primary" /> Información Tributaria (DIAN)
                                    </h4>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">NIT / Rut</label>
                                    <input name="nit" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm" defaultValue={editingBranch?.nit} placeholder="900.000.000-1" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Resolución DIAN</label>
                                    <input name="resolution" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm" defaultValue={editingBranch?.resolution} placeholder="No. 1876000..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Fecha Resolución</label>
                                    <input name="resolution_date" type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" defaultValue={editingBranch?.resolution_date} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Prefijo (Ej. POS)</label>
                                    <input name="resolution_prefix" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-black text-sm uppercase" defaultValue={editingBranch?.resolution_prefix} placeholder="POS / HTL" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Rango de Numeración</label>
                                    <input name="resolution_range" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" defaultValue={editingBranch?.resolution_range} placeholder="Del 1 al 10000" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Pie de Página Factura</label>
                                    <textarea name="invoice_footer" rows="2" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs" defaultValue={editingBranch?.invoice_footer} placeholder="Gracias por su compra..." />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button type="submit" className="flex-1 bg-primary text-white py-4 rounded-xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Save size={18} />
                                    Guardar Cambios
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 bg-gray-100 text-secondary rounded-xl font-black hover:bg-gray-200 transition-all text-sm uppercase tracking-widest">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchManagement;
