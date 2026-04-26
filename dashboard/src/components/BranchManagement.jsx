import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Plus, Edit2, Power, Search, Save, X, FileText, Globe, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sileo } from 'sileo';

const BranchManagement = () => {
    const { user: currentUser } = useAuth();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [orgConfig, setOrgConfig] = useState(null);

    useEffect(() => {
        if (currentUser) {
            fetchBranches();
            fetchOrgConfig();
        }
    }, [currentUser]);

    const fetchOrgConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('tenant_accounting_config')
                .select('*')
                .eq('organization_id', currentUser.organization_id)
                .maybeSingle();
            
            if (error) throw error;
            setOrgConfig(data);
        } catch (error) {
            console.error('Error fetching org config:', error);
        }
    };

    const handleImportOrgData = () => {
        if (!orgConfig) {
            sileo.info({ title: 'Configuración no encontrada', description: 'Primero configura los datos de tu empresa en el módulo de Contabilidad.' });
            return;
        }

        // Obtener el formulario y rellenar los campos
        const form = document.querySelector('form');
        if (form) {
            const fields = {
                name: orgConfig.business_name || '',
                city: orgConfig.city || '',
                phone: orgConfig.phone || '',
                address: orgConfig.address || '',
                nit: orgConfig.document_number || '',
            };

            Object.entries(fields).forEach(([name, value]) => {
                const input = form.querySelector(`[name="${name}"]`);
                if (input) input.value = value;
            });
            
            sileo.success({ title: 'Datos importados', description: 'Se han cargado los datos de la empresa correctamente.' });
        }
    };

    const fetchBranches = async () => {
        setLoading(true);
        try {
            // RLS maneja el aislamiento multi-tenant a nivel de BD
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            setBranches(data || []);
        } catch (error) {
            console.error('Error fetching branches:', error);
            sileo.error({ title: 'Error de conexión', description: 'No se pudieron cargar las sedes.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBranch = async (e) => {
        e.preventDefault();
        setSaving(true);
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
            booking_property_id: formData.get('booking_property_id'),
            booking_machine_id: formData.get('booking_machine_id'),
            booking_machine_password: formData.get('booking_machine_password'),
            active: true,
            organization_id: currentUser?.organization_id || null
        };

        try {
            if (editingBranch) {
                const { error } = await supabase
                    .from('branches')
                    .update(branchData)
                    .eq('id', editingBranch.id);
                if (error) throw error;
                sileo.success({ title: 'Sede actualizada', description: `"${branchData.name}" guardada correctamente.` });
            } else {
                const { error } = await supabase
                    .from('branches')
                    .insert([branchData]);
                if (error) throw error;
                sileo.success({ title: 'Sede creada', description: `"${branchData.name}" fue agregada al sistema.` });
            }
            setShowModal(false);
            setEditingBranch(null);
            fetchBranches();
        } catch (error) {
            sileo.error({ title: 'Error al guardar', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (branch) => {
        // Doble-clic para confirmar
        if (pendingDeleteId !== branch.id) {
            setPendingDeleteId(branch.id);
            sileo.warning({ title: 'Confirmar eliminación', description: `Haz clic en eliminar nuevamente para borrar "${branch.name}".` });
            setTimeout(() => setPendingDeleteId(null), 3500);
            return;
        }
        setPendingDeleteId(null);
        try {
            const { error } = await supabase.from('branches').delete().eq('id', branch.id);
            if (error) throw error;
            sileo.success({ title: 'Sede eliminada', description: `"${branch.name}" fue eliminada.` });
            fetchBranches();
        } catch (error) {
            sileo.error({ title: 'Error al eliminar', description: error.message });
        }
    };

    const toggleStatus = async (branch) => {
        try {
            const { error } = await supabase
                .from('branches')
                .update({ active: !branch.active })
                .eq('id', branch.id);
            if (error) throw error;
            setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, active: !b.active } : b));
            sileo.success({
                title: branch.active ? 'Sede desactivada' : 'Sede activada',
                description: `"${branch.name}" quedó ${branch.active ? 'inactiva' : 'activa'}.`
            });
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
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
                    onClick={() => { 
                        setEditingBranch(null); 
                        setShowModal(true);
                        // Trigger auto-import if orgConfig is available
                        if (orgConfig) {
                            setTimeout(() => handleImportOrgData(), 200);
                        }
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-premium hover:brightness-110 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                    Nueva Sucursal
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="font-bold">Cargando sucursales...</span>
                </div>
            ) : filteredBranches.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold">
                    {searchTerm ? 'No se encontraron sedes con ese criterio.' : 'No hay sedes registradas aún.'}
                </div>
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
                                    <button
                                        onClick={() => handleDelete(branch)}
                                        className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border ${
                                            pendingDeleteId === branch.id
                                                ? 'bg-red-500 text-white border-red-500 animate-pulse'
                                                : 'bg-gray-50 text-red-400 hover:bg-red-50 hover:text-red-600 border-gray-100'
                                        }`}
                                        title="Eliminar sede"
                                    >
                                        <Trash2 size={14} />
                                        {pendingDeleteId === branch.id ? '¿Seguro?' : 'Eliminar'}
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
                                <h3 className="text-2xl font-black tracking-tight">{editingBranch ? 'Editar Sede' : 'Nueva Sede'}</h3>
                                <p className="text-white/60 text-xs font-medium mt-1">Datos de facturación y contacto</p>
                            </div>
                            <div className="flex items-center gap-2 relative z-10">
                                {!editingBranch && orgConfig && (
                                    <button 
                                        type="button"
                                        onClick={handleImportOrgData}
                                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5"
                                        title="Copiar datos de la empresa principal"
                                    >
                                        <RefreshCw size={12} /> Importar Empresa
                                    </button>
                                )}
                                <button onClick={() => { setShowModal(false); setEditingBranch(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <Building2 className="absolute -right-8 -bottom-8 text-white/5 w-40 h-40" />
                        </div>
                        <form onSubmit={handleSaveBranch} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                <div className="col-span-2 pt-4 pb-2 border-b border-gray-100 mb-2">
                                    <h4 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                        <Globe size={14} className="text-blue-500" /> Conectividad Booking.com
                                    </h4>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Property ID</label>
                                    <input name="booking_property_id" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm" defaultValue={editingBranch?.booking_property_id} placeholder="Ej. 1234567" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Machine Account ID</label>
                                    <input name="booking_machine_id" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm" defaultValue={editingBranch?.booking_machine_id} placeholder="Username" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Machine Password</label>
                                    <input name="booking_machine_password" type="password" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm" defaultValue={editingBranch?.booking_machine_password} placeholder="••••••••" />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-primary text-white py-4 rounded-xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingBranch(null); }}
                                    className="px-8 py-4 bg-gray-100 text-secondary rounded-xl font-black hover:bg-gray-200 transition-all text-sm uppercase tracking-widest"
                                >
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
