import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAdminLog } from '../hooks/useAdminLog';
import { Search, CheckCircle2, XCircle, Building2, Server, Power, Loader2, Plus, Trash2, Edit2, Save, X, TrendingUp, Clock, Activity, LayoutGrid, RefreshCw, ScrollText } from 'lucide-react';
import { sileo } from 'sileo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

const ACTION_STYLE = {
    CREATE:         'bg-emerald-100 text-emerald-700',
    UPDATE:         'bg-blue-100 text-blue-700',
    DELETE:         'bg-red-100 text-red-700',
    MODULE_TOGGLE:  'bg-purple-100 text-purple-700',
    SUSPEND:        'bg-orange-100 text-orange-700',
    ACTIVATE:       'bg-teal-100 text-teal-700',
};

const MODULE_STYLE = {
    saas:       'bg-slate-100 text-slate-600',
    reservas:   'bg-blue-50 text-blue-600',
    usuarios:   'bg-indigo-50 text-indigo-600',
    restaurante:'bg-orange-50 text-orange-600',
    rooms:      'bg-cyan-50 text-cyan-600',
    billing:    'bg-emerald-50 text-emerald-600',
    productos:  'bg-amber-50 text-amber-600',
};

const IS_OWNER = (email) => email === 'fercho028890@gmail.com';

export default function SaasAdminPanel() {
    const { user } = useAuth();
    const { log } = useAdminLog();
    const [organizations, setOrganizations] = useState([]);
    const [orgMetrics, setOrgMetrics] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('list');
    const [pendingWipeId, setPendingWipeId] = useState(null);

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

    // Logs tab state
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logOrgFilter, setLogOrgFilter] = useState('');
    const [logModuleFilter, setLogModuleFilter] = useState('');
    const [logSearch, setLogSearch] = useState('');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') fetchLogs();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false });

            if (orgError) throw orgError;
            setOrganizations(orgData || []);

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('organization_id, total, total_price, status, created_at')
                .eq('status', 'pagado');

            if (orderError) throw orderError;

            const metrics = (orderData || []).reduce((acc, order) => {
                const orgId = order.organization_id;
                if (!acc[orgId]) {
                    acc[orgId] = { totalOrders: 0, totalRevenue: 0, lastActivity: null };
                }
                acc[orgId].totalOrders += 1;
                acc[orgId].totalRevenue += (order.total || order.total_price || 0);
                const orderDate = new Date(order.created_at);
                if (!acc[orgId].lastActivity || orderDate > new Date(acc[orgId].lastActivity)) {
                    acc[orgId].lastActivity = order.created_at;
                }
                return acc;
            }, {});

            setOrgMetrics(metrics);
        } catch (error) {
            console.error('Error fetching orgs or metrics:', error);
            sileo.error({ title: 'Error de Datos', description: 'No se pudieron cargar los inquilinos o sus métricas.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const { data, error } = await supabase
                .from('admin_activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            sileo.error({ title: 'Error cargando logs', description: err.message });
        } finally {
            setLogsLoading(false);
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
                    status: fd.get('status') || 'active',
                })
                .eq('id', editingOrg.id);
            if (error) throw error;
            sileo.success({ title: 'Tenant actualizado', description: `"${fd.get('name')}" guardado correctamente.` });
            log({
                action: 'UPDATE', module: 'saas', entity_type: 'organization', entity_id: editingOrg.id,
                description: `Datos de organización actualizados: "${fd.get('name')}"`,
                organization_id: editingOrg.id, organization_name: editingOrg.name,
                old_value: { name: editingOrg.name, contact_email: editingOrg.contact_email, status: editingOrg.status },
                new_value: { name: fd.get('name'), contact_email: fd.get('contact_email'), status: fd.get('status') },
            });
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
        setOrganizations(prev => prev.filter(o => o.id !== org.id));
        log({
            action: 'DELETE', module: 'saas', entity_type: 'organization', entity_id: org.id,
            description: `Organización "${org.name}" eliminada de la plataforma`,
            organization_id: org.id, organization_name: org.name,
            old_value: { name: org.name, status: org.status, modules: org.active_modules },
        });
        try {
            const { error } = await supabase.rpc('delete_saas_tenant', { p_org_id: org.id });
            if (error) throw error;
            sileo.success({ title: 'Tenant eliminado', description: `"${org.name}" fue eliminado de la plataforma.` });
        } catch (err) {
            fetchOrganizations();
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

            setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, active_modules: newModules } : o));

            const { error } = await supabase
                .from('organizations')
                .update({ active_modules: newModules })
                .eq('id', org.id);

            if (error) throw error;
            sileo.success({ title: 'Plan Actualizado', description: `Módulo ${isRemoving ? 'removido' : 'habilitado'} para ${org.name}.` });

            log({
                action: 'MODULE_TOGGLE', module: 'saas', entity_type: 'organization', entity_id: org.id,
                description: `Módulo "${moduleId}" ${isRemoving ? 'removido de' : 'habilitado para'} ${org.name}`,
                organization_id: org.id, organization_name: org.name,
                old_value: { modules: currentModules },
                new_value: { modules: newModules },
            });

            supabase.from('global_logs').insert([{
                organization_id: org.id,
                action_type: 'MODULE_TOGGLED',
                description: `Superadmin ${isRemoving ? 'retiró' : 'concedió'} el módulo ${moduleId} al inquilino ${org.name}.`
            }]).then();

        } catch (error) {
            console.error('Error en Toggle:', error);
            sileo.error({ title: 'Error', description: 'El cambio no pudo guardarse remotamente.' });
            fetchOrganizations();
        }
    };

    const handleToggleStatus = async (org) => {
        const currentStatus = org.status || 'active';
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        try {
            setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, status: newStatus } : o));
            const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', org.id);
            if (error) throw error;
            sileo.success({ title: 'Estado Alterado', description: `${org.name} quedó ${newStatus === 'active' ? 'Activado' : 'Suspendido'}.` });
            log({
                action: newStatus === 'active' ? 'ACTIVATE' : 'SUSPEND',
                module: 'saas', entity_type: 'organization', entity_id: org.id,
                description: `Organización "${org.name}" ${newStatus === 'active' ? 'activada' : 'suspendida'}`,
                organization_id: org.id, organization_name: org.name,
                old_value: { status: currentStatus },
                new_value: { status: newStatus },
            });
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            sileo.error({ title: 'Error', description: 'No se pudo cambiar el estado en la base de datos.' });
            fetchOrganizations();
        }
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setCreating(true);
        try {
            const { error } = await supabase.rpc('create_saas_tenant', {
                p_empresa_nombre: formData.name,
                p_admin_email: formData.email,
                p_admin_password: formData.password,
                p_modulos: formData.modules
            });

            if (error) throw error;

            sileo.success({ title: 'Tenant Creado', description: 'La nueva organización ha sido inicializada con éxito.' });
            log({
                action: 'CREATE', module: 'saas', entity_type: 'organization',
                description: `Nuevo tenant creado: "${formData.name}" (${formData.email})`,
                new_value: { name: formData.name, email: formData.email, modules: formData.modules },
            });
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
        (org.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredLogs = logs.filter(l => {
        const matchOrg = !logOrgFilter || l.organization_id === logOrgFilter;
        const matchModule = !logModuleFilter || l.module === logModuleFilter;
        const matchSearch = !logSearch ||
            (l.description || '').toLowerCase().includes(logSearch.toLowerCase()) ||
            (l.user_email || '').toLowerCase().includes(logSearch.toLowerCase()) ||
            (l.organization_name || '').toLowerCase().includes(logSearch.toLowerCase());
        return matchOrg && matchModule && matchSearch;
    });

    const totalTenants = organizations.length;
    const activeTenants = organizations.filter(o => o.status === 'active' || !o.status).length;
    const hotelPacks = organizations.filter(o => (o.active_modules || []).includes('hotel')).length;
    const totalGlobalRevenue = Object.values(orgMetrics).reduce((sum, m) => sum + m.totalRevenue, 0);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-6">

            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-2xl w-fit shadow-inner mb-2">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                >
                    Inquilinos
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                >
                    Panorama Global
                </button>
                {IS_OWNER(user?.email) && (
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                    >
                        <ScrollText size={12} /> Logs
                    </button>
                )}
            </div>

            {/* Header / Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Server size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Tenants</p>
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
                        <Activity size={14} className="text-primary" /> Ingresos Globales
                    </p>
                    <h3 className="text-2xl font-black text-white mt-1">${totalGlobalRevenue.toLocaleString()}</h3>
                </div>
            </div>

            {/* ── LOGS TAB ─────────────────────────────────────────── */}
            {activeTab === 'logs' && IS_OWNER(user?.email) && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
                    <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                        <div>
                            <h2 className="text-xl font-black text-secondary tracking-tight flex items-center gap-2">
                                <ScrollText size={20} className="text-primary" /> Logs de Actividad Admin
                            </h2>
                            <p className="text-sm font-medium text-gray-500">Auditoría completa de acciones sobre inquilinos, reservas y usuarios.</p>
                        </div>
                        <button
                            onClick={fetchLogs}
                            disabled={logsLoading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={logsLoading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 bg-gray-50/30">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar descripción, correo..."
                                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-secondary focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all w-64"
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                            />
                        </div>
                        <select
                            value={logOrgFilter}
                            onChange={e => setLogOrgFilter(e.target.value)}
                            className="py-2 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-secondary focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                        >
                            <option value="">Todas las organizaciones</option>
                            {organizations.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                        <select
                            value={logModuleFilter}
                            onChange={e => setLogModuleFilter(e.target.value)}
                            className="py-2 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-secondary focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                        >
                            <option value="">Todos los módulos</option>
                            {['saas', 'reservas', 'usuarios', 'restaurante', 'rooms', 'billing', 'productos'].map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {(logSearch || logOrgFilter || logModuleFilter) && (
                            <button
                                onClick={() => { setLogSearch(''); setLogOrgFilter(''); setLogModuleFilter(''); }}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-secondary hover:bg-gray-100 transition-colors"
                            >
                                <X size={12} /> Limpiar
                            </button>
                        )}
                        <span className="ml-auto text-xs font-bold text-gray-400 self-center">
                            {filteredLogs.length} registros
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        {logsLoading ? (
                            <div className="p-16 flex flex-col items-center justify-center text-gray-400 gap-3">
                                <Loader2 size={28} className="animate-spin text-primary" />
                                <p className="font-bold text-sm">Cargando logs...</p>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="p-16 text-center text-gray-400 font-bold text-sm">
                                {logs.length === 0 ? 'Sin registros de actividad aún.' : 'No hay registros para los filtros activos.'}
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Organización</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Módulo</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Acción</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredLogs.map(entry => (
                                        <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <p className="text-xs font-bold text-secondary">
                                                    {format(new Date(entry.created_at), "dd/MM/yy", { locale: es })}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400">
                                                    {format(new Date(entry.created_at), "HH:mm:ss", { locale: es })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="text-xs font-bold text-secondary truncate max-w-[130px]">
                                                    {entry.organization_name || '—'}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="text-xs font-bold text-secondary truncate max-w-[160px]">
                                                    {entry.user_name || entry.user_email || '—'}
                                                </p>
                                                <p className="text-[10px] font-medium text-gray-400 truncate max-w-[160px]">
                                                    {entry.user_name ? entry.user_email : ''}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${MODULE_STYLE[entry.module] || 'bg-gray-100 text-gray-500'}`}>
                                                    {entry.module}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${ACTION_STYLE[entry.action] || 'bg-gray-100 text-gray-500'}`}>
                                                    {entry.action}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 max-w-xs">
                                                <p className="text-xs font-medium text-gray-600 line-clamp-2">
                                                    {entry.description}
                                                </p>
                                                {entry.entity_id && (
                                                    <p className="text-[10px] font-bold text-gray-300 mt-0.5 font-mono">
                                                        {entry.entity_type} · {entry.entity_id.split('-')[0]}…
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── DASHBOARD TAB ──────────────────────────────────────── */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium">
                        <h3 className="text-lg font-black text-secondary uppercase tracking-tight mb-6 flex items-center gap-2">
                            <TrendingUp className="text-primary" size={20} /> Top 5 Empresas (Ventas)
                        </h3>
                        <div className="space-y-6">
                            {organizations
                                .map(org => ({ ...org, revenue: orgMetrics[org.id]?.totalRevenue || 0 }))
                                .sort((a, b) => b.revenue - a.revenue)
                                .slice(0, 5)
                                .map((org) => (
                                    <div key={org.id} className="relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-black text-secondary">{org.name}</span>
                                            <span className="text-xs font-bold text-gray-500">${org.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${totalGlobalRevenue > 0 ? (org.revenue / totalGlobalRevenue) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium">
                        <h3 className="text-lg font-black text-secondary uppercase tracking-tight mb-6 flex items-center gap-2">
                            <LayoutGrid className="text-indigo-500" size={20} /> Distribución de Módulos
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {ALL_MODULES.map(mod => {
                                const count = organizations.filter(o => (o.active_modules || []).includes(mod.id)).length;
                                return (
                                    <div key={mod.id} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${mod.color}`}></div>
                                            <span className="text-[10px] font-black text-gray-500 uppercase">{mod.label}</span>
                                        </div>
                                        <span className="text-sm font-black text-secondary">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── LIST TAB ───────────────────────────────────────────── */}
            {activeTab === 'list' && (
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
                                    placeholder="Buscar por nombre, correo o ID..."
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
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Rendimiento (Orders/Sum)</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado & Acciones</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Módulos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredOrgs.map((org) => {
                                        const rawD = org.created_at;
                                        const createdAtStr = rawD ? format(new Date(rawD), "dd 'de' MMMM, yyyy", { locale: es }) : 'Desconocido';
                                        const isActive = org.status === 'active';
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
                                                            <p className="text-[10px] font-bold text-gray-300 mt-1 uppercase">ID: {org.id.split('-')[0]}... • {createdAtStr}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-5">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-secondary">${(orgMetrics[org.id]?.totalRevenue || 0).toLocaleString()}</span>
                                                            <span className="text-[10px] font-bold text-gray-400">({orgMetrics[org.id]?.totalOrders || 0} pedidos)</span>
                                                        </div>
                                                        {orgMetrics[org.id]?.lastActivity && (
                                                            <p className="text-[9px] font-bold text-blue-500 uppercase flex items-center gap-1">
                                                                <Clock size={10} /> Activo: {format(new Date(orgMetrics[org.id].lastActivity), "HH:mm, dd/MM", { locale: es })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleToggleStatus(org)}
                                                                className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 border rounded-lg transition-all w-max ${isActive ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                                                            >
                                                                <Power size={14} /> {isActive ? 'Suspender' : 'Activar'}
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingOrg(org); setIsEditModalOpen(true); }}
                                                                className="p-1.5 border border-gray-200 text-gray-400 hover:text-secondary rounded-lg transition-all"
                                                                title="Editar Datos"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>

                                                            {IS_OWNER(user?.email) && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (pendingWipeId !== org.id) {
                                                                            setPendingWipeId(org.id);
                                                                            sileo.warning({ title: '¿Limpiar datos?', description: `Clic de nuevo para purgar TODOS los pedidos y contabilidad de "${org.name}".` });
                                                                            setTimeout(() => setPendingWipeId(null), 4000);
                                                                            return;
                                                                        }
                                                                        setPendingWipeId(null);
                                                                        try {
                                                                            const { error } = await supabase.rpc('wipe_tenant_data', { p_org_id: org.id });
                                                                            if (error) throw error;
                                                                            sileo.success({ title: 'Limpieza Completada', description: `Se han purgado todos los módulos de ${org.name}.` });
                                                                            fetchOrganizations();
                                                                        } catch (err) {
                                                                            sileo.error({ title: 'Fallo en la Limpieza', description: err.message });
                                                                        }
                                                                    }}
                                                                    className={`p-1.5 border rounded-lg transition-all ${pendingWipeId === org.id ? 'bg-amber-500 text-white border-amber-500 animate-pulse' : 'border-amber-200 text-amber-500 hover:bg-amber-50'}`}
                                                                    title="LIMPIEZA TOTAL (SuperUser)"
                                                                >
                                                                    <RefreshCw size={14} />
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleDeleteOrg(org)}
                                                                className={`p-1.5 border rounded-lg transition-all ${pendingDeleteId === org.id ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'border-red-200 text-red-500 hover:bg-red-50'}`}
                                                                title="Eliminar Organización"
                                                            >
                                                                <Trash2 size={14} />
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
                                                                    {isLicensed ? <CheckCircle2 size={14} className="text-green-400" /> : <XCircle size={14} />}
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
            )}

            {/* Modal Editar Tenant */}
            {isEditModalOpen && editingOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setIsEditModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black text-secondary">Actualizar Información (SaaS)</h3>
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
                                    name="status"
                                    defaultValue={editingOrg.status || 'active'}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-secondary"
                                >
                                    <option value="active">Activo</option>
                                    <option value="suspended">Suspendido</option>
                                    <option value="cancelled">Cancelado</option>
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
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
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
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                                            );
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
