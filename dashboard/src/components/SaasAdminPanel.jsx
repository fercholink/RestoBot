import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Search, CheckCircle2, XCircle, Building2, Server, Power, Loader2, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { sileo } from 'sileo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Lista oficial de módulos que el SaaS ofrece comercialmente
const ALL_MODULES = [
    { id: 'restaurante', label: 'Restaurante / POS', color: 'bg-orange-500' },
    { id: 'hotel', label: 'Gestión Hotelera', color: 'bg-blue-500' },
    { id: 'financiero', label: 'Facturación Electrónica', color: 'bg-emerald-500' },
    { id: 'usuarios', label: 'Roles y Personal', color: 'bg-indigo-500' },
    { id: 'sedes', label: 'Multi-Sedes', color: 'bg-pink-500' },
    { id: 'marketing', label: 'Mkt / IA Studio', color: 'bg-purple-500' },
    { id: 'qr_tools', label: 'Pedidos QR', color: 'bg-cyan-500' },
    { id: 'operaciones', label: 'Seguridad y Logs', color: 'bg-slate-700' },
];

export default function SaasAdminPanel() {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal Crear
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', modules: [] });

    // Modal Editar
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [saving, setSaving] = useState(false);

    // Eliminar con doble-clic
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    // Guard sincrónico para evitar múltiples envíos del formulario de creación
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrganizations(data || []);
        } catch (error) {
            console.error('Error fetching orgs:', error);
            sileo.error({ title: 'Acceso Denegado', description: 'Ocurrió un error cargando la BBDD Global.' });
        } finally {
            setLoading(false);
        }
    };

    const handleEditOrg = async (e) => {
        e.preventDefault();
        setSaving(true);
        const fd = new FormData(e.target);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: fd.get('name'),
                    contact_email: fd.get('contact_email'),
                    subscription_status: fd.get('subscription_status') || null,
                })
                .eq('id', editingOrg.id);
            if (error) throw error;
            sileo.success({ title: 'Tenant actualizado', description: `"${fd.get('name')}" guardado correctamente.` });
            setIsEditModalOpen(false);
            setEditingOrg(null);
            fetchOrganizations();
        } catch (err) {
            sileo.error({ title: 'Error al guardar', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOrg = async (org) => {
        if (pendingDeleteId !== org.id) {
            setPendingDeleteId(org.id);
            sileo.warning({ title: 'Confirmar eliminación', description: `Haz clic en "Eliminar" nuevamente para borrar "${org.name}".` });
            setTimeout(() => setPendingDeleteId(null), 3500);
            return;
        }
        setPendingDeleteId(null);
        // Optimistic: quitar de la lista de inmediato
        setOrganizations(prev => prev.filter(o => o.id !== org.id));
        try {
            const { error } = await supabase.rpc('delete_saas_tenant', { p_org_id: org.id });
            if (error) throw error;
            sileo.success({ title: 'Tenant eliminado', description: `"${org.name}" fue eliminado de la plataforma.` });
        } catch (err) {
            fetchOrganizations(); // revertir si falló
            sileo.error({ title: 'Error al eliminar', description: err.message });
        }
    };

    const handleToggleModule = async (org, moduleId) => {
        try {
            const currentModules = org.active_modules || [];
            let newModules = [...currentModules];
            const isRemoving = newModules.includes(moduleId);
            
            if (isRemoving) {
                newModules = newModules.filter(m => m !== moduleId);
            } else {
                newModules.push(moduleId);
            }

            // Ocupación optimista UI
            setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, active_modules: newModules } : o));

            const { error } = await supabase
                .from('organizations')
                .update({ active_modules: newModules })
                .eq('id', org.id);

            if (error) throw error;
            sileo.success({ title: 'Plan Actualizado', description: `Módulo ${isRemoving ? 'removido' : 'habilitado'} para ${org.name}.` });
            
            // Insertar auditoria silenciosa
            supabase.from('global_logs').insert([{
                organization_id: org.id,
                action_type: 'MODULE_TOGGLED',
                description: `Superadmin ${isRemoving ? 'retiró' : 'concedió'} el módulo ${moduleId} al inquilino ${org.name}.`
            }]).then();

        } catch (error) {
            console.error('Error en Toggle:', error);
            sileo.error({ title: 'Error', description: 'El cambio no pudo guardarse remotamente.' });
            fetchOrganizations(); // revert
        }
    };

    const handleToggleStatus = async (org) => {
        const newStatus = org.status === 'activo' ? 'inactivo' : 'activo';
        try {
            setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, status: newStatus } : o));
            const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', org.id);
            if (error) throw error;
            sileo.success({ title: 'Estado Alterado', description: `${org.name} quedó ${newStatus}.` });
        } catch (error) {
            sileo.error({ title: 'Falló corte', description: 'No se pudo cambiar estado.' });
            fetchOrganizations(); // revert
        }
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setCreating(true);
        try {
            const { data, error } = await supabase.rpc('create_saas_tenant', {
                p_empresa_nombre: formData.name,
                p_admin_email: formData.email,
                p_admin_password: formData.password,
                p_modulos: formData.modules
            });

            if (error) throw error;

            sileo.success({ title: 'Tenant Creado', description: 'La nueva organización ha sido inicializada con éxito.' });
            setIsAddModalOpen(false);
            setFormData({ name: '', email: '', password: '', modules: [] });
            fetchOrganizations();
        } catch (err) {
            console.error('Error al crear tenant:', err);
            sileo.error({ title: 'Operación Fallida', description: err.message || 'Error desconocido creando cliente.' });
        } finally {
            isSubmittingRef.current = false;
            setCreating(false);
        }
    };

    const handleFormModuleToggle = (modId) => {
        setFormData(prev => ({
            ...prev,
            modules: prev.modules.includes(modId) 
                ? prev.modules.filter(m => m !== modId)
                : [...prev.modules, modId]
        }));
    };

    const filteredOrgs = organizations.filter(org => 
        (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (org.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Contadores para métricas top
    const totalTenants = organizations.length;
    const activeTenants = organizations.filter(o => o.status !== 'inactivo').length;
    const hotelPacks = organizations.filter(o => (o.active_modules || []).includes('hotel')).length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-6">
            
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Server size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Tenants (Organizaciones)</p>
                        <h3 className="text-2xl font-black text-secondary">{loading ? '-' : totalTenants}</h3>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Power size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Tenants Activos</p>
                        <h3 className="text-2xl font-black text-secondary">{loading ? '-' : activeTenants}</h3>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Módulos Hoteleros</p>
                        <h3 className="text-2xl font-black text-secondary">{loading ? '-' : hotelPacks}</h3>
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-secondary to-[#1a202c] rounded-2xl p-5 border border-gray-800 shadow-lg flex flex-col justify-center">
                    <p className="text-xs font-bold text-white/50 uppercase flex items-center gap-2">
                        <ShieldCheck size={14} className="text-primary"/> Acceso Root
                    </p>
                    <h3 className="text-lg font-black text-white mt-1">Super Admin Panel</h3>
                </div>
            </div>

            {/* Listado de Tenants */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
                <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tight">Gestión Inquilinos (Multi-Tenant)</h2>
                        <p className="text-sm font-medium text-gray-500">Activa o suspende clientes y asígnales características de forma granular.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o correo..."
                                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium text-secondary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-primary hover:bg-primary-dark text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors w-full sm:w-auto flex-shrink-0"
                        >
                            <Plus size={18} /> Nuevo Cliente
                        </button>
                    </div>
                </div>

                <div className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                            <Loader2 size={32} className="animate-spin text-primary" />
                            <p className="font-bold">Sincronizando Plataforma B2B...</p>
                        </div>
                    ) : filteredOrgs.length === 0 ? (
                        <div className="p-20 text-center text-gray-400 font-bold">No se encontraron clientes inquilinos.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Organización (Tenant)</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Plan & Facturación</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-1/2">Suma de Módulos (Feature Flags)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrgs.map((org) => {
                                    const rawD = org.created_at;
                                    const createdAtStr = rawD ? format(new Date(rawD), "dd 'de' MMMM, yyyy", { locale: es }) : 'Desconocido';
                                    const isActive = org.status !== 'inactivo';
                                    const myModules = org.active_modules || [];

                                    return (
                                        <tr key={org.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0 ${isActive ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-300'}`}>
                                                        {(org.name || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-black text-secondary truncate max-w-[180px]">{org.name}</h4>
                                                            {isActive ? (
                                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Activo
                                                                </span>
                                                            ) : (
                                                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Suspendido
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-bold text-gray-400 mt-0.5 truncate max-w-[200px]">{org.contact_email || 'Sin correo'}</p>
                                                        <p className="text-[10px] font-bold text-gray-300 mt-1 uppercase">Creado: {createdAtStr}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-xs font-black text-secondary bg-gray-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-2 w-max">
                                                        Suscripción: {org.subscription_status || 'En Trial'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleStatus(org)}
                                                        className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 border rounded-lg transition-all w-max ${isActive ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' }`}
                                                    >
                                                        <Power size={14}/> {isActive ? 'Suspender' : 'Restaurar'}
                                                    </button>
                                                    <div className="flex gap-1.5 mt-1">
                                                        <button
                                                            onClick={() => { setEditingOrg(org); setIsEditModalOpen(true); }}
                                                            className="text-xs font-bold flex items-center gap-1 px-3 py-1.5 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        >
                                                            <Edit2 size={12}/> Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOrg(org)}
                                                            className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 border rounded-lg transition-all ${pendingDeleteId === org.id ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'border-red-200 text-red-500 hover:bg-red-50'}`}
                                                        >
                                                            <Trash2 size={12}/> {pendingDeleteId === org.id ? '¿Seguro?' : 'Eliminar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-5">
                                                <div className="bg-white border text-secondary border-gray-200 p-4 rounded-2xl flex flex-wrap gap-2 group-hover:border-primary/20 transition-colors">
                                                    {ALL_MODULES.map(mod => {
                                                        const isLicensed = myModules.includes(mod.id);
                                                        return (
                                                            <button
                                                                key={mod.id}
                                                                onClick={() => handleToggleModule(org, mod.id)}
                                                                className={`
                                                                    relative px-3 py-1.5 rounded-lg text-xs font-black tracking-tight border transition-all duration-300 flex items-center gap-1.5 overflow-hidden
                                                                    ${isLicensed 
                                                                        ? `bg-gray-800 text-white border-transparent shadow-md hover:ring-2 hover:ring-gray-800/30 hover:bg-gray-900` 
                                                                        : `bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600`}
                                                                `}
                                                            >
                                                                {isLicensed && <span className={`absolute left-0 top-0 bottom-0 w-1 ${mod.color}`}></span>}
                                                                {isLicensed ? <CheckCircle2 size={14} className="text-green-400"/> : <XCircle size={14}/>}
                                                                <span>{mod.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal Editar Tenant */}
            {isEditModalOpen && editingOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setIsEditModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black text-secondary">Editar Tenant</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Modifica los datos del cliente.</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditOrg} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Empresa</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    defaultValue={editingOrg.name}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Correo de Contacto</label>
                                <input
                                    name="contact_email"
                                    type="email"
                                    defaultValue={editingOrg.contact_email}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                    placeholder="contacto@empresa.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Estado de Suscripción</label>
                                <select
                                    name="subscription_status"
                                    defaultValue={editingOrg.subscription_status || ''}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                >
                                    <option value="">En Trial</option>
                                    <option value="activo">Activo</option>
                                    <option value="suspendido">Suspendido</option>
                                    <option value="vencido">Vencido</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Creación Nuevo Inquilino */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !creating && setIsAddModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black text-secondary">Añadir Nuevo Cliente</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Se creará la cuenta administradora, organización y sede central.</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateTenant} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Empresa</label>
                                    <input 
                                        type="text" 
                                        required 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                        placeholder="Ej: Hotel Las Gaviotas"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Correo Administrador</label>
                                        <input 
                                            type="email" 
                                            required 
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                            placeholder="admin@hotel.com"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Segura</label>
                                        <input 
                                            type="password" 
                                            required 
                                            minLength={8}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={e => setFormData({...formData, password: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Módulos Iniciales Contratados</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {ALL_MODULES.map(mod => {
                                            const isSelected = formData.modules.includes(mod.id);
                                            return (
                                                <button
                                                    type="button"
                                                    key={mod.id}
                                                    onClick={() => handleFormModuleToggle(mod.id)}
                                                    className={`p-3 rounded-xl border text-sm font-bold transition-all flex items-center gap-2 text-left
                                                        ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}
                                                    `}
                                                >
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-600' : 'border-gray-300'}`}>
                                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                    </div>
                                                    <span className="truncate">{mod.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    {creating ? 'Provisionando Sistema...' : 'Crear y Aprobar Tenant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
