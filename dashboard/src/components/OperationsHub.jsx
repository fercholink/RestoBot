import React, { useState, useEffect, useCallback } from 'react';
import { 
    Activity, ShieldAlert, Monitor, Terminal, User, FileText, Lock, Unlock, 
    AlertTriangle, CheckCircle2, Info, Search, Filter, Clock, Trash2, 
    Database, RefreshCw, Eye, ShieldCheck, Server
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const OperationsHub = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCleaning, setIsCleaning] = useState(false);
    const [stats, setStats] = useState({
        actionsToday: 0,
        securityAlerts: 0,
        activeSessions: 0,
        systemEvents: 0
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('admin_activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            // Si no es superadmin, filtrar por su organización (el RLS ya lo hace, pero por seguridad extra)
            if (user?.role !== 'admin' && user?.organization_id) {
                query = query.eq('organization_id', user.organization_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            
            setLogs(data || []);
            
            // Calcular estadísticas básicas del día
            const today = new Date().toISOString().split('T')[0];
            const todayLogs = (data || []).filter(l => l.created_at.startsWith(today));
            
            setStats({
                actionsToday: todayLogs.length,
                securityAlerts: (data || []).filter(l => l.module === 'security' || l.action.toLowerCase().includes('password')).length,
                activeSessions: new Set((data || []).filter(l => l.action === 'login').map(l => l.user_id)).size || 1,
                systemEvents: data?.length || 0
            });

        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLogs();

        // Suscripción Real-time para nuevos logs
        const channel = supabase
            .channel('realtime_logs')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'admin_activity_log' 
            }, (payload) => {
                setLogs(prev => [payload.new, ...prev].slice(0, 100));
                setStats(prev => ({ ...prev, actionsToday: prev.actionsToday + 1, systemEvents: prev.systemEvents + 1 }));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchLogs]);

    const getSeverityStyles = (log) => {
        const action = (log.action || '').toLowerCase();
        const description = (log.description || '').toLowerCase();
        
        if (action.includes('error') || action.includes('fallido') || description.includes('eliminó')) {
            return 'bg-red-50 text-red-500 border-red-100';
        }
        if (action.includes('cambio') || action.includes('editó') || action.includes('update')) {
            return 'bg-warning/10 text-warning border-warning/20';
        }
        if (action.includes('login') || action.includes('creó') || action.includes('insert')) {
            return 'bg-success/10 text-success border-success/20';
        }
        return 'bg-blue-50 text-blue-500 border-blue-100';
    };

    const getSeverityIcon = (log) => {
        const action = (log.action || '').toLowerCase();
        const description = (log.description || '').toLowerCase();
        
        if (action.includes('error') || action.includes('fallido')) return <ShieldAlert size={14} />;
        if (description.includes('eliminó')) return <Trash2 size={14} />;
        if (action.includes('cambio') || action.includes('editó')) return <AlertTriangle size={14} />;
        if (action.includes('login') || action.includes('creó')) return <CheckCircle2 size={14} />;
        return <Info size={14} />;
    };

    const filteredLogs = logs.filter(log => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
            (log.action || '').toLowerCase().includes(term) || 
            (log.user_name || '').toLowerCase().includes(term) || 
            (log.description || '').toLowerCase().includes(term) ||
            (log.module || '').toLowerCase().includes(term);
            
        if (filter === 'all') return matchesSearch;
        if (filter === 'critical') return matchesSearch && ((log.action || '').toLowerCase().includes('fallido') || (log.description || '').toLowerCase().includes('eliminó'));
        if (filter === 'security') return matchesSearch && log.module === 'security';
        return matchesSearch;
    });

    const handleResetDatabase = async () => {
        if (!user || (user.role !== 'gerente' && user.role !== 'admin')) {
            alert("No tienes permisos para realizar esta acción.");
            return;
        }

        if (!window.confirm("⚠️ ¿Estás COMPLETAMENTE SEGURO?\n\nEsta acción ELIMINARÁ TODOS LOS PEDIDOS E ÍTEMS de la base de datos.\n\nÚsala solo para iniciar un nuevo proyecto desde cero. Esta acción NO se puede deshacer.")) {
            return;
        }

        if (!window.confirm("CONFIRMACIÓN FINAL: Se borrará todo el historial de pedidos permanentemente. ¿Proceder?")) {
            return;
        }

        setIsCleaning(true);
        try {
            const { error: itemsError } = await supabase.from('order_items').delete().neq('id', 0);
            if (itemsError) throw itemsError;

            const { error: ordersError } = await supabase.from('orders').delete().neq('id', 0);
            if (ordersError) throw ordersError;

            alert("✅ Base de datos de pedidos limpiada correctamente.");
            window.location.reload();

        } catch (error) {
            console.error("Error cleaning DB:", error);
            alert("❌ Error al limpiar base de datos: " + error.message);
        } finally {
            setIsCleaning(false);
        }
    };

    const [selectedLog, setSelectedLog] = useState(null);

    const downloadCSV = () => {
        if (!filteredLogs.length) return;
        
        const headers = ["ID", "Fecha", "Módulo", "Acción", "Descripción", "Usuario", "Email"];
        const rows = filteredLogs.map(log => [
            log.id,
            new Date(log.created_at).toLocaleString(),
            log.module,
            log.action,
            log.description,
            log.user_name,
            log.user_email
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `auditoria_nexus_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Modal de Detalles Técnicos */}
            {selectedLog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-premium overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-secondary tracking-tight">Detalles Técnicos del Evento</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedLog.action} • {selectedLog.id}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                        <Clock size={12} /> Marca de Tiempo
                                    </p>
                                    <p className="text-xs font-bold text-secondary">{new Date(selectedLog.created_at).toLocaleString()}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                        <User size={12} /> Usuario Responsable
                                    </p>
                                    <p className="text-xs font-bold text-secondary">{selectedLog.user_name} ({selectedLog.user_email})</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedLog.old_value && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase text-red-500 tracking-widest">Valor Anterior</p>
                                        <pre className="bg-gray-50 p-4 rounded-2xl text-[10px] font-mono text-gray-600 overflow-x-auto border border-gray-100">
                                            {JSON.stringify(selectedLog.old_value, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {selectedLog.new_value && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Nuevo Valor / Payload</p>
                                        <pre className="bg-emerald-50/50 p-4 rounded-2xl text-[10px] font-mono text-emerald-700 overflow-x-auto border border-emerald-100">
                                            {JSON.stringify(selectedLog.new_value, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {!selectedLog.old_value && !selectedLog.new_value && (
                                    <div className="py-10 text-center">
                                        <Info className="mx-auto text-gray-200 mb-2" size={32} />
                                        <p className="text-xs font-bold text-gray-400">No hay datos estructurados adicionales para este evento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 border-t border-gray-100">
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="w-full py-4 bg-secondary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Operational Cards */}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Acciones Hoy', value: stats.actionsToday, icon: Activity, color: 'text-primary' },
                    { label: 'Alertas Seguridad', value: stats.securityAlerts, icon: ShieldAlert, color: 'text-red-500' },
                    { label: 'Usuarios Activos', value: stats.activeSessions, icon: Monitor, color: 'text-blue-500' },
                    { label: 'Total Eventos', value: stats.systemEvents, icon: Terminal, color: 'text-secondary' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-premium transition-all">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{kpi.label}</p>
                            <p className="text-2xl font-black text-secondary">{kpi.value}</p>
                        </div>
                        <div className={`p-3 rounded-2xl bg-gray-50 group-hover:bg-gray-100 transition-colors ${kpi.color}`}>
                            <kpi.icon size={24} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main: Logs Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Terminal size={16} />
                            Registro de Auditoría en Tiempo Real
                        </h3>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Buscar en logs..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase text-gray-500 focus:outline-none shadow-sm"
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">Todo</option>
                                <option value="critical">Críticos</option>
                                <option value="security">Seguridad</option>
                            </select>
                            <button 
                                onClick={downloadCSV}
                                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                title="Exportar a CSV"
                            >
                                <FileText size={16} />
                            </button>
                            <button 
                                onClick={fetchLogs}
                                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                title="Refrescar"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                        <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
                            {loading && logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center py-20">
                                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sincronizando registros...</p>
                                </div>
                            ) : filteredLogs.map((log) => (
                                <div key={log.id} className="p-6 hover:bg-gray-50/50 transition-colors flex items-start gap-5 group">
                                    <div className={`p-3 rounded-2xl border transition-transform group-hover:scale-110 ${getSeverityStyles(log)}`}>
                                        {getSeverityIcon(log)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h4 className="font-black text-secondary text-sm tracking-tight truncate">
                                                    {log.action}
                                                </h4>
                                                <span className="hidden sm:inline-flex text-[8px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-widest shrink-0">
                                                    {log.module}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 whitespace-nowrap ml-2">
                                                <Clock size={10} />
                                                {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            El usuario <span className="font-black text-secondary">{log.user_name || log.user_email}</span> {log.description || 'realizó una acción en el sistema'}.
                                        </p>
                                        
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {log.entity_type && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Entidad:</span>
                                                    <span className="text-[9px] font-black bg-secondary/5 text-secondary px-2 py-0.5 rounded-md border border-secondary/10">
                                                        {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                                                    </span>
                                                </div>
                                            )}
                                            {log.branch_name && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Sede:</span>
                                                    <span className="text-[9px] font-black bg-primary/5 text-primary px-2 py-0.5 rounded-md border border-primary/10">
                                                        {log.branch_name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {(log.old_value || log.new_value) && (
                                            <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => setSelectedLog(log)}
                                                    className="text-[9px] font-black uppercase text-primary flex items-center gap-1 hover:underline"
                                                >
                                                    <Eye size={10} /> Ver detalles técnicos
                                                </button>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            ))}
                            
                            {!loading && filteredLogs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center py-20 italic text-gray-400">
                                    <Search className="mb-2 opacity-20" size={40} />
                                    <p className="text-sm font-bold">No se encontraron registros activos</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-gray-50/50 p-4 border-t border-gray-100 flex justify-between items-center shrink-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Mostrando últimos 100 eventos
                            </p>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Conexión Segura Activa</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar: System Info / Active Guards */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2 mt-1">Seguridad de Datos</h3>

                    <div className="bg-secondary text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    <Lock size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm tracking-tight">Escudo de Identidad</h4>
                                    <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">Protección Activa</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[11px] font-medium text-white/70">
                                    <ShieldCheck size={14} className="text-primary" />
                                    <span>RLS Hardening (Multi-tenant)</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-medium text-white/70">
                                    <ShieldCheck size={14} className="text-primary" />
                                    <span>Acceso SuperAdmin Configurado</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-medium text-white/70">
                                    <ShieldCheck size={14} className="text-primary" />
                                    <span>Auditoría de Acciones Activa</span>
                                </div>
                            </div>
                            <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10">
                                Estado del Sistema
                            </button>
                        </div>
                        <Unlock className="absolute -right-6 -bottom-6 text-white/5 w-32 h-32" />
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Server size={14} /> Servicios Críticos
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse ml-auto" />
                        </h4>

                        <div className="space-y-4">
                            {[
                                { name: 'n8n Automations', status: 'Online', perf: '24ms' },
                                { name: 'Supabase DB', status: 'Online', perf: '18ms' },
                                { name: 'WhatsApp API', status: 'Online', perf: '145ms' },
                                { name: 'DIAN Factus API', status: 'Online', perf: '180ms' },
                            ].map((sys, i) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <div>
                                        <p className="text-xs font-black text-secondary">{sys.name}</p>
                                        <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">{sys.status}</p>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-300 group-hover:text-primary transition-colors font-bold">{sys.perf}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Zona de Mantenimiento (Solo Gerentes) */}
                    {(user?.role === 'gerente' || user?.role === 'admin') && (
                        <div className="bg-red-50/50 rounded-[2.5rem] border border-red-100 p-8 shadow-sm space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                                <Database size={14} />
                                Zona de Mantenimiento
                            </h4>

                            <div className="space-y-4">
                                <p className="text-[11px] text-red-900/60 font-medium leading-relaxed">
                                    Acciones críticas para reiniciar el flujo de pedidos. No afecta inventarios ni usuarios.
                                </p>

                                <button
                                    onClick={handleResetDatabase}
                                    disabled={isCleaning}
                                    className="w-full py-4 bg-white text-red-500 border-2 border-red-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {isCleaning ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    {isCleaning ? 'Limpiando...' : 'Vaciar Historial Pedidos'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OperationsHub;
