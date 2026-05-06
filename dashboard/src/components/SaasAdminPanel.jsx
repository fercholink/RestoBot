import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAdminLog } from '../hooks/useAdminLog';
import { Search, Building2, Server, Power, Loader2, Plus, Trash2, Edit2, X, TrendingUp, Clock, Activity, LayoutGrid, RefreshCw, ScrollText, Mail, Hotel, CheckCircle2, XCircle } from 'lucide-react';
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
    CREATE:         'bg-emerald-50 text-emerald-700 border-emerald-100',
    UPDATE:         'bg-blue-50 text-blue-700 border-blue-100',
    DELETE:         'bg-red-50 text-red-700 border-red-100',
    MODULE_TOGGLE:  'bg-purple-50 text-purple-700 border-purple-100',
    SUSPEND:        'bg-orange-50 text-orange-700 border-orange-100',
    ACTIVATE:       'bg-teal-50 text-teal-700 border-teal-100',
};

const MODULE_STYLE = {
    saas:       'bg-slate-50 text-slate-600 border-slate-100',
    reservas:   'bg-blue-50 text-blue-600 border-blue-100',
    usuarios:   'bg-indigo-50 text-indigo-600 border-indigo-100',
    restaurante:'bg-orange-50 text-orange-600 border-orange-100',
    rooms:      'bg-cyan-50 text-cyan-600 border-cyan-100',
    billing:    'bg-emerald-50 text-emerald-600 border-emerald-100',
    productos:  'bg-amber-50 text-amber-600 border-amber-100',
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
    const [newOrg, setNewOrg] = useState({ name: '', admin_email: '', admin_password: '', hotel_pack: false });

    // Modal Editar
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [saving, setSaving] = useState(false);

    // Eliminar con confirmación
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
    }, [activeTab]);

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
            sileo.error({ title: 'Error de Datos', description: 'No se pudieron cargar los inquilinos.' });
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
        const name = fd.get('name');
        const email = fd.get('contact_email');
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ name, contact_email: email })
                .eq('id', editingOrg.id);

            if (error) throw error;
            sileo.success({ title: 'Tenant actualizado', description: `"${name}" guardado correctamente.` });
            log({
                action: 'UPDATE', module: 'saas', entity_type: 'organization', entity_id: editingOrg.id,
                description: `Datos de organización actualizados: "${name}"`,
                organization_id: editingOrg.id, organization_name: name,
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
            sileo.warning({ title: 'Confirmar eliminación', description: `Clic de nuevo para borrar "${org.name}".` });
            setTimeout(() => setPendingDeleteId(null), 3500);
            return;
        }
        setPendingDeleteId(null);
        try {
            // Limpiar dependencias con FK directa a organizations antes de llamar al RPC.
            // Esto cubre tablas que el RPC legacy no maneja (guests, tenant_accounting_config).
            await supabase.from('guests').update({ organization_id: null }).eq('organization_id', org.id);
            await supabase.from('tenant_accounting_config').delete().eq('organization_id', org.id);

            const { error } = await supabase.rpc('delete_saas_tenant', { p_org_id: org.id });
            if (error) throw error;
            sileo.success({ title: 'Tenant eliminado', description: `"${org.name}" fue eliminado.` });
            log({
                action: 'DELETE', module: 'saas', entity_type: 'organization', entity_id: org.id,
                description: `Organización "${org.name}" eliminada de la plataforma`,
            });
            fetchOrganizations();
        } catch (err) {
            sileo.error({ title: 'Error al eliminar', description: err.message });
        }
    };

    const toggleModule = async (orgId, moduleId) => {
        const org = organizations.find(o => o.id === orgId);
        const currentModules = org?.active_modules || [];
        const isRemoving = currentModules.includes(moduleId);
        const newModules = isRemoving ? currentModules.filter(m => m !== moduleId) : [...currentModules, moduleId];

        try {
            const { error } = await supabase
                .from('organizations')
                .update({ active_modules: newModules })
                .eq('id', orgId);

            if (error) throw error;
            sileo.success({ title: 'Módulo Actualizado', description: `${moduleId} ${isRemoving ? 'removido' : 'habilitado'}.` });
            log({
                action: 'MODULE_TOGGLE', module: 'saas', entity_type: 'organization', entity_id: orgId,
                description: `Módulo "${moduleId}" ${isRemoving ? 'removido' : 'habilitado'} para ${org?.name}`,
            });
            fetchOrganizations();
        } catch (err) {
            sileo.error({ title: 'Error', description: err.message });
        }
    };

    const toggleActive = async (orgId, currentStatus) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        try {
            const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', orgId);
            if (error) throw error;
            sileo.success({ title: 'Estado Alterado', description: `Tenant ${newStatus === 'active' ? 'Activado' : 'Suspendido'}.` });
            log({
                action: newStatus === 'active' ? 'ACTIVATE' : 'SUSPEND',
                module: 'saas', entity_type: 'organization', entity_id: orgId,
            });
            fetchOrganizations();
        } catch (err) {
            sileo.error({ title: 'Error', description: err.message });
        }
    };

    const handleAddOrganization = async (e) => {
        e.preventDefault();
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setCreating(true);
        try {
            const { error } = await supabase.rpc('create_saas_tenant', {
                p_empresa_nombre: newOrg.name,
                p_admin_email: newOrg.admin_email,
                p_admin_password: 'Password123!', // Pass default or generate
                p_modulos: newOrg.hotel_pack ? ['hotel', 'restaurante', 'usuarios'] : ['restaurante', 'usuarios']
            });

            if (error) throw error;

            sileo.success({ title: 'Tenant Creado', description: 'La nueva organización ha sido inicializada.' });
            setIsAddModalOpen(false);
            setNewOrg({ name: '', admin_email: '', hotel_pack: false });
            fetchOrganizations();
        } catch (err) {
            sileo.error({ title: 'Operación Fallida', description: err.message });
        } finally {
            isSubmittingRef.current = false;
            setCreating(false);
        }
    };

    const filteredOrgs = organizations.filter(org =>
        (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredLogs = logs.filter(l => {
        const matchOrg = !logOrgFilter || l.organization_id === logOrgFilter;
        const matchModule = !logModuleFilter || l.module === logModuleFilter;
        const matchSearch = !logSearch || (l.description || '').toLowerCase().includes(logSearch.toLowerCase());
        return matchOrg && matchModule && matchSearch;
    });

    const totalTenants = organizations.length;
    const activeTenants = organizations.filter(o => o.status === 'active' || !o.status).length;
    const hotelPacks = organizations.filter(o => (o.active_modules || []).includes('hotel')).length;
    const totalGlobalRevenue = Object.values(orgMetrics).reduce((sum, m) => sum + m.totalRevenue, 0);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-8 pb-24">

            {/* View Toggle */}
            <div className="flex bg-surface-soft p-1.5 rounded-[20px] w-fit border border-hairline shadow-sm mb-2">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-8 py-3 rounded-[16px] text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'list' ? 'bg-canvas text-secondary shadow-airbnb border border-hairline' : 'text-accent hover:text-secondary'}`}
                >
                    Inquilinos
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-8 py-3 rounded-[16px] text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-canvas text-secondary shadow-airbnb border border-hairline' : 'text-accent hover:text-secondary'}`}
                >
                    Panorama Global
                </button>
                {IS_OWNER(user?.email) && (
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-8 py-3 rounded-[16px] text-[11px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'logs' ? 'bg-canvas text-secondary shadow-airbnb border border-hairline' : 'text-accent hover:text-secondary'}`}
                    >
                        <ScrollText size={14} className="text-primary" /> Auditoría
                    </button>
                )}
            </div>

            {/* Header / Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-canvas rounded-[24px] p-6 border border-hairline shadow-sm flex items-center gap-5 group hover:shadow-airbnb transition-all duration-300">
                    <div className="w-14 h-14 rounded-[18px] bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform">
                        <Server size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1">Total Tenants</p>
                        <h3 className="text-3xl font-bold text-secondary tracking-tight">{loading ? '-' : totalTenants}</h3>
                    </div>
                </div>
                <div className="bg-canvas rounded-[24px] p-6 border border-hairline shadow-sm flex items-center gap-5 group hover:shadow-airbnb transition-all duration-300">
                    <div className="w-14 h-14 rounded-[18px] bg-success/5 flex items-center justify-center text-success border border-success/10 group-hover:scale-110 transition-transform">
                        <Power size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1">Activos</p>
                        <h3 className="text-3xl font-bold text-secondary tracking-tight">{loading ? '-' : activeTenants}</h3>
                    </div>
                </div>
                <div className="bg-canvas rounded-[24px] p-6 border border-hairline shadow-sm flex items-center gap-5 group hover:shadow-airbnb transition-all duration-300">
                    <div className="w-14 h-14 rounded-[18px] bg-blue-500/5 flex items-center justify-center text-blue-500 border border-blue-500/10 group-hover:scale-110 transition-transform">
                        <Building2 size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1">Hotelería</p>
                        <h3 className="text-3xl font-bold text-secondary tracking-tight">{loading ? '-' : hotelPacks}</h3>
                    </div>
                </div>
                <div className="bg-secondary rounded-[24px] p-6 border border-hairline shadow-airbnb flex flex-col justify-center relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-primary" /> Ingresos Globales
                        </p>
                        <h3 className="text-3xl font-bold text-white tracking-tight">${totalGlobalRevenue.toLocaleString()}</h3>
                    </div>
                    <TrendingUp size={80} className="absolute -right-4 -bottom-4 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>

            {/* ── LOGS TAB ─────────────────────────────────────────── */}
            {activeTab === 'logs' && IS_OWNER(user?.email) && (
                <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden flex flex-col min-h-[700px]">
                    <div className="p-8 md:p-10 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-soft/30">
                        <div>
                            <span className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1 block">Trazabilidad Centralizada</span>
                            <h2 className="text-2xl font-bold text-secondary tracking-tight flex items-center gap-3">
                                <ScrollText size={24} className="text-primary" /> Auditoría de Operaciones SaaS
                            </h2>
                        </div>
                        <button
                            onClick={fetchLogs}
                            disabled={logsLoading}
                            className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-hairline bg-canvas text-[11px] font-bold text-secondary uppercase tracking-widest hover:bg-surface-soft transition-all disabled:opacity-50 shadow-sm active:scale-95"
                        >
                            <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
                            Sincronizar Logs
                        </button>
                    </div>

                    <div className="px-8 py-5 border-b border-hairline flex flex-wrap gap-4 bg-surface-soft/10">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar actividad..."
                                className="pl-11 pr-4 py-2.5 bg-canvas border border-hairline rounded-[12px] text-[13px] font-bold text-secondary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all w-72 shadow-sm"
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                            />
                        </div>
                        <select
                            value={logOrgFilter}
                            onChange={e => setLogOrgFilter(e.target.value)}
                            className="py-2.5 px-4 bg-canvas border border-hairline rounded-[12px] text-[12px] font-bold text-secondary focus:outline-none focus:ring-4 shadow-sm cursor-pointer"
                        >
                            <option value="">Todas las organizaciones</option>
                            {organizations.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                        <select
                            value={logModuleFilter}
                            onChange={e => setLogModuleFilter(e.target.value)}
                            className="py-2.5 px-4 bg-canvas border border-hairline rounded-[12px] text-[12px] font-bold text-secondary focus:outline-none focus:ring-4 shadow-sm cursor-pointer"
                        >
                            <option value="">Todos los módulos</option>
                            {['saas', 'reservas', 'usuarios', 'restaurante', 'rooms', 'billing', 'productos'].map(m => (
                                <option key={m} value={m}>{m.toUpperCase()}</option>
                            ))}
                        </select>
                        <div className="ml-auto flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                            <Activity size={12} className="text-primary" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{filteredLogs.length} Registros</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        {logsLoading ? (
                            <div className="p-32 flex flex-col items-center justify-center text-accent gap-6">
                                <Loader2 size={40} className="animate-spin text-primary" />
                                <p className="font-bold text-[11px] uppercase tracking-widest">Compilando historial...</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-soft/30 border-b border-hairline">
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Fecha</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Organización</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Módulo</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Acción</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {filteredLogs.map(entry => (
                                        <tr key={entry.id} className="hover:bg-surface-soft/40 transition-all duration-300 group">
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <p className="text-[13px] font-bold text-secondary">{format(new Date(entry.created_at), "dd MMM, HH:mm", { locale: es })}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-[13px] font-bold text-secondary truncate max-w-[150px]">{entry.organization_name || 'Global'}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${MODULE_STYLE[entry.module] || 'bg-canvas text-accent'}`}>{entry.module}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${ACTION_STYLE[entry.action] || 'bg-canvas text-accent'}`}>{entry.action}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-[13px] font-medium text-secondary line-clamp-2">{entry.description}</p>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-canvas rounded-[32px] p-10 border border-hairline shadow-sm hover:shadow-airbnb transition-all duration-500 group">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-xl font-bold text-secondary tracking-tight flex items-center gap-3">
                                <TrendingUp className="text-primary" size={24} /> Performance por Inquilino
                            </h3>
                            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                                <Activity size={18} className="text-primary animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-8">
                            {organizations
                                .map(org => ({ ...org, revenue: orgMetrics[org.id]?.totalRevenue || 0 }))
                                .sort((a, b) => b.revenue - a.revenue)
                                .slice(0, 5)
                                .map((org) => (
                                    <div key={org.id} className="relative group/item">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-surface-soft flex items-center justify-center border border-hairline text-[11px] font-bold text-secondary group-hover/item:bg-primary group-hover/item:text-white transition-colors">
                                                    {(org.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[14px] font-bold text-secondary">{org.name}</span>
                                            </div>
                                            <span className="text-[14px] font-bold text-secondary tracking-tight">${org.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-surface-soft h-3 rounded-full overflow-hidden border border-hairline shadow-inner">
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

                    <div className="bg-canvas rounded-[32px] p-10 border border-hairline shadow-sm hover:shadow-airbnb transition-all duration-500 group">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-xl font-bold text-secondary tracking-tight flex items-center gap-3">
                                <LayoutGrid className="text-indigo-500" size={24} /> Market Share de Módulos
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {ALL_MODULES.map(mod => {
                                const count = organizations.filter(o => (o.active_modules || []).includes(mod.id)).length;
                                return (
                                    <div key={mod.id} className="p-6 bg-surface-soft/40 rounded-[24px] flex items-center justify-between border border-hairline hover:bg-canvas transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${mod.color}`}></div>
                                            <span className="text-[11px] font-bold text-accent uppercase tracking-widest">{mod.label}</span>
                                        </div>
                                        <span className="text-[18px] font-bold text-secondary">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── LIST TAB ───────────────────────────────────────────── */}
            {activeTab === 'list' && (
                <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 md:p-10 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-soft/30">
                        <div>
                            <span className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1 block">Panel de Control B2B</span>
                            <h2 className="text-2xl font-bold text-secondary tracking-tight">Gestión Inquilinos</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o ID..."
                                    className="w-full pl-12 pr-4 py-3.5 bg-canvas border border-hairline rounded-full text-[14px] font-bold text-secondary placeholder:text-accent/40 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-secondary text-white font-bold px-8 py-3.5 rounded-full flex items-center justify-center gap-3 transition-all hover:shadow-airbnb active:scale-95 text-[13px] uppercase tracking-widest"
                            >
                                <Plus size={20} /> Nuevo Cliente
                            </button>
                        </div>
                    </div>

                    <div className="p-0 overflow-x-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-32 flex flex-col items-center justify-center text-accent gap-6">
                                <Loader2 size={40} className="animate-spin text-primary" />
                                <p className="font-bold text-[11px] uppercase tracking-widest">Sincronizando...</p>
                            </div>
                        ) : filteredOrgs.length === 0 ? (
                            <div className="p-32 text-center bg-surface-soft/20">
                                <Building2 className="mx-auto text-accent/20 mb-6" size={64} />
                                <p className="font-bold text-[13px] text-accent uppercase tracking-widest">Sin inquilinos</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-soft/30 border-b border-hairline">
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Organización</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Rendimiento</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Módulos</th>
                                        <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-accent">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {filteredOrgs.map((org) => {
                                        const metrics = orgMetrics[org.id] || { totalRevenue: 0, totalOrders: 0 };
                                        const isActive = org.status === 'active' || !org.status;
                                        return (
                                            <tr key={org.id} className="hover:bg-surface-soft/40 transition-all duration-300 group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-[14px]">
                                                            {(org.name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-bold text-secondary">{org.name}</p>
                                                            <p className="text-[11px] font-bold text-accent opacity-50 uppercase tracking-widest truncate max-w-[200px]">{org.contact_email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <p className="text-[14px] font-bold text-secondary">${metrics.totalRevenue.toLocaleString()}</p>
                                                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest">{metrics.totalOrders} pedidos</p>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-wrap gap-2 max-w-[300px]">
                                                        {ALL_MODULES.map(mod => {
                                                            const hasMod = (org.active_modules || []).includes(mod.id);
                                                            return (
                                                                <button
                                                                    key={mod.id}
                                                                    onClick={() => toggleModule(org.id, mod.id)}
                                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${hasMod ? 'bg-secondary text-white border-secondary' : 'bg-canvas text-accent border-hairline hover:border-accent'}`}
                                                                >
                                                                    {mod.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => toggleActive(org.id, org.status)}
                                                            className={`p-2.5 rounded-full border transition-all ${isActive ? 'bg-canvas text-danger border-hairline hover:bg-danger/5' : 'bg-success text-white border-success hover:bg-success-dark'}`}
                                                            title={isActive ? "Suspender" : "Activar"}
                                                        >
                                                            <Power size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingOrg(org); setIsEditModalOpen(true); }}
                                                            className="p-2.5 rounded-full border border-hairline bg-canvas text-accent hover:text-secondary shadow-sm transition-all"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOrg(org)}
                                                            className={`p-2.5 rounded-full border transition-all ${pendingDeleteId === org.id ? 'bg-danger text-white border-danger animate-pulse' : 'bg-canvas text-accent border-hairline hover:text-danger hover:bg-danger/5'}`}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
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

            {/* MODAL CREAR */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-secondary/40 backdrop-blur-md">
                    <div className="bg-canvas w-full max-w-lg rounded-[32px] border border-hairline shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="p-8 border-b border-hairline flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-secondary tracking-tight">Nuevo Inquilino B2B</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-surface-soft flex items-center justify-center text-accent transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddOrganization} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-accent uppercase tracking-widest ml-4">Nombre Organización</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                                        <input
                                            type="text" required
                                            className="w-full pl-12 pr-4 py-4 bg-surface-soft border border-hairline rounded-[20px] text-[15px] font-bold text-secondary focus:outline-none focus:border-primary/30"
                                            placeholder="Hotel Continental..."
                                            value={newOrg.name}
                                            onChange={e => setNewOrg({...newOrg, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-accent uppercase tracking-widest ml-4">Admin Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                                        <input
                                            type="email" required
                                            className="w-full pl-12 pr-4 py-4 bg-surface-soft border border-hairline rounded-[20px] text-[15px] font-bold text-secondary focus:outline-none focus:border-primary/30"
                                            placeholder="admin@hotel.com"
                                            value={newOrg.admin_email}
                                            onChange={e => setNewOrg({...newOrg, admin_email: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="p-6 bg-surface-soft rounded-[24px] border border-hairline flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Hotel size={24} className="text-blue-500" />
                                        <span className="text-[14px] font-bold text-secondary">Paquete Hotelero Full</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNewOrg({...newOrg, hotel_pack: !newOrg.hotel_pack})}
                                        className={`w-14 h-8 rounded-full relative transition-all ${newOrg.hotel_pack ? 'bg-primary' : 'bg-accent/20'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${newOrg.hotel_pack ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit" disabled={creating}
                                className="w-full py-5 bg-secondary text-white rounded-[20px] font-bold text-[14px] uppercase tracking-[2px] shadow-airbnb transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                Provisionar Inquilino
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR */}
            {isEditModalOpen && editingOrg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-secondary/40 backdrop-blur-md">
                    <div className="bg-canvas w-full max-w-lg rounded-[32px] border border-hairline shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-hairline flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-secondary tracking-tight">Editar Organización</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-surface-soft flex items-center justify-center text-accent transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditOrg} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-accent uppercase tracking-widest ml-4">Nombre Empresa</label>
                                    <input
                                        name="name" type="text" required
                                        defaultValue={editingOrg.name}
                                        className="w-full px-6 py-4 bg-surface-soft border border-hairline rounded-[20px] text-[15px] font-bold text-secondary focus:outline-none focus:border-primary/30"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-accent uppercase tracking-widest ml-4">Email Contacto</label>
                                    <input
                                        name="contact_email" type="email" required
                                        defaultValue={editingOrg.contact_email}
                                        className="w-full px-6 py-4 bg-surface-soft border border-hairline rounded-[20px] text-[15px] font-bold text-secondary focus:outline-none focus:border-primary/30"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit" disabled={saving}
                                className="w-full py-5 bg-secondary text-white rounded-[20px] font-bold text-[14px] uppercase tracking-[2px] shadow-airbnb transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
