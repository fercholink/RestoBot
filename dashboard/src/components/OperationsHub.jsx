import React, { useState, useEffect, useCallback } from 'react';
import { 
    Activity, ShieldAlert, Monitor, Terminal, User, FileText, Lock, Unlock, 
    AlertTriangle, CheckCircle2, Info, Search, Filter, Clock, Trash2, 
    Database, RefreshCw, Eye, ShieldCheck, Server, X
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-secondary/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-canvas w-full max-w-2xl rounded-[24px] shadow-airbnb overflow-hidden flex flex-col max-h-[85vh] border border-hairline">
                        <div className="p-8 border-b border-hairline flex justify-between items-center bg-surface-soft/30">
                            <div>
                                <span className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1 block">Trazabilidad Técnica</span>
                                <h3 className="text-xl font-bold text-secondary tracking-tight">{selectedLog.action}</h3>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-3 hover:bg-white rounded-full transition-all border border-hairline shadow-sm group">
                                <X size={20} className="text-accent group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold uppercase text-accent tracking-widest flex items-center gap-2">
                                        <Clock size={14} className="text-primary" /> Fecha y Hora
                                    </p>
                                    <p className="text-[13px] font-bold text-secondary">{new Date(selectedLog.created_at).toLocaleString()}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold uppercase text-accent tracking-widest flex items-center gap-2">
                                        <User size={14} className="text-primary" /> Operador
                                    </p>
                                    <p className="text-[13px] font-bold text-secondary truncate">{selectedLog.user_name} <span className="text-accent font-medium opacity-60">({selectedLog.user_email})</span></p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {selectedLog.old_value && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                                            <p className="text-[11px] font-bold uppercase text-danger tracking-widest">Valor Previo</p>
                                        </div>
                                        <div className="relative group">
                                            <pre className="bg-danger/5 p-6 rounded-[20px] text-[12px] font-mono text-danger/80 overflow-x-auto border border-danger/10 shadow-inner">
                                                {JSON.stringify(selectedLog.old_value, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                                {selectedLog.new_value && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-success" />
                                            <p className="text-[11px] font-bold uppercase text-success tracking-widest">Estado Actualizado</p>
                                        </div>
                                        <div className="relative group">
                                            <pre className="bg-success/5 p-6 rounded-[20px] text-[12px] font-mono text-success/80 overflow-x-auto border border-success/10 shadow-inner">
                                                {JSON.stringify(selectedLog.new_value, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                                {!selectedLog.old_value && !selectedLog.new_value && (
                                    <div className="py-16 text-center bg-surface-soft/30 rounded-[24px] border border-hairline border-dashed">
                                        <Info className="mx-auto text-accent/20 mb-4" size={48} />
                                        <p className="text-[13px] font-bold text-accent uppercase tracking-widest">No hay metadatos adicionales</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-8 bg-surface-soft/30 border-t border-hairline">
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="w-full py-4 bg-secondary text-white rounded-full font-bold text-[11px] uppercase tracking-widest shadow-airbnb active:scale-[0.98] transition-all"
                            >
                                Cerrar Detalles
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Operational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Acciones Hoy', value: stats.actionsToday, icon: Activity, color: 'text-primary', bg: 'bg-primary/5' },
                    { label: 'Alertas Seguridad', value: stats.securityAlerts, icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/5' },
                    { label: 'Usuarios Activos', value: stats.activeSessions, icon: Monitor, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                    { label: 'Eventos Globales', value: stats.systemEvents, icon: Terminal, color: 'text-secondary', bg: 'bg-secondary/5' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-canvas p-6 rounded-[24px] border border-hairline shadow-sm flex items-center justify-between group hover:shadow-airbnb hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">{kpi.label}</p>
                            <p className="text-3xl font-bold text-secondary tracking-tight">{kpi.value}</p>
                        </div>
                        <div className={`w-14 h-14 rounded-[18px] ${kpi.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${kpi.color} border border-hairline`}>
                            <kpi.icon size={28} />
                        </div>
                    </div>
                ))}
            </div>              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main: Logs Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Terminal size={18} className="text-primary" />
                            </div>
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">
                                Registro de Auditoría en Tiempo Real
                            </h3>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                <input 
                                    type="text"
                                    placeholder="Buscar en logs..."
                                    className="w-full pl-11 pr-4 py-3 bg-surface-soft border border-hairline rounded-[16px] text-[12px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm placeholder:text-accent/50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="bg-surface-soft border border-hairline rounded-[16px] px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-secondary focus:outline-none shadow-sm cursor-pointer"
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">Todo</option>
                                <option value="critical">Críticos</option>
                                <option value="security">Seguridad</option>
                            </select>
                            <button 
                                onClick={downloadCSV}
                                className="p-3 bg-surface-soft border border-hairline rounded-[16px] text-accent hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                title="Exportar a CSV"
                            >
                                <FileText size={18} />
                            </button>
                            <button 
                                onClick={fetchLogs}
                                className="p-3 bg-surface-soft border border-hairline rounded-[16px] text-accent hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                title="Refrescar"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-canvas rounded-[32px] border border-hairline shadow-sm overflow-hidden min-h-[650px] flex flex-col">
                        <div className="divide-y divide-hairline flex-1 overflow-y-auto custom-scrollbar">
                            {loading && logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center py-32">
                                    <RefreshCw className="w-10 h-10 text-primary animate-spin mb-6" />
                                    <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Sincronizando flujo de auditoría...</p>
                                </div>
                            ) : filteredLogs.map((log) => (
                                <div key={log.id} className="p-8 hover:bg-surface-soft/50 transition-all duration-300 flex items-start gap-6 group relative">
                                    <div className={`w-12 h-12 shrink-0 rounded-[16px] border flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3 ${getSeverityStyles(log)}`}>
                                        {getSeverityIcon(log)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <h4 className="font-bold text-secondary text-[15px] tracking-tight truncate group-hover:text-primary transition-colors">
                                                    {log.action}
                                                </h4>
                                                <span className="hidden sm:inline-flex text-[9px] font-bold px-2 py-0.5 bg-surface-soft text-accent rounded-md uppercase tracking-widest border border-hairline shrink-0">
                                                    {log.module}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-wider whitespace-nowrap ml-4 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Clock size={12} className="text-primary" />
                                                {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true, locale: es })}
                                            </div>
                                        </div>
                                        <p className="text-[13px] text-accent leading-relaxed font-medium">
                                            El usuario <span className="font-bold text-secondary">{log.user_name || log.user_email}</span> {log.description || 'realizó una acción en el sistema'}.
                                        </p>
                                        
                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            {log.entity_type && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-accent/40 uppercase tracking-widest">Entidad:</span>
                                                    <span className="text-[10px] font-bold bg-surface-soft text-secondary px-2.5 py-1 rounded-full border border-hairline">
                                                        {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                                                    </span>
                                                </div>
                                            )}
                                            {log.branch_name && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-accent/40 uppercase tracking-widest">Sede:</span>
                                                    <span className="text-[10px] font-bold bg-primary/5 text-primary px-2.5 py-1 rounded-full border border-primary/10">
                                                        {log.branch_name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {(log.old_value || log.new_value) && (
                                            <div className="mt-4">
                                                <button 
                                                    onClick={() => setSelectedLog(log)}
                                                    className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all"
                                                >
                                                    <Eye size={12} /> Ver Auditoría Técnica
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute right-8 bottom-8 opacity-0 group-hover:opacity-10 transition-opacity">
                                        <Terminal size={48} className="text-secondary" />
                                    </div>
                                </div>
                            ))}
                            
                            {!loading && filteredLogs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center py-32 bg-surface-soft/20">
                                    <div className="p-6 bg-canvas rounded-full border border-hairline mb-6 shadow-sm">
                                        <Search className="text-accent/20" size={48} />
                                    </div>
                                    <p className="text-[13px] font-bold text-accent uppercase tracking-widest">No se encontraron registros activos</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-surface-soft/30 p-6 border-t border-hairline flex justify-between items-center shrink-0">
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest">
                                Mostrando últimos 100 eventos sincronizados
                            </p>
                            <div className="flex items-center gap-3 px-4 py-2 bg-canvas rounded-full border border-hairline shadow-sm">
                                <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <span className="text-[10px] font-bold text-success uppercase tracking-widest">Real-time Node: Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar: System Info / Active Guards */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-1 h-4 bg-primary rounded-full" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">Inteligencia de Datos</h3>
                    </div>

                    <div className="bg-secondary text-white rounded-[32px] p-8 shadow-airbnb relative overflow-hidden group">
                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/10 rounded-[18px] flex items-center justify-center border border-white/10 backdrop-blur-md group-hover:scale-110 transition-transform">
                                    <ShieldCheck size={28} className="text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-[17px] tracking-tight">Escudo de Identidad</h4>
                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">Protección en Tiempo Real</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-[12px] font-bold text-white/70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <span>RLS Hardening (Multi-tenant)</span>
                                </div>
                                <div className="flex items-center gap-3 text-[12px] font-bold text-white/70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <span>Políticas SuperAdmin Activas</span>
                                </div>
                                <div className="flex items-center gap-3 text-[12px] font-bold text-white/70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <span>Auditoría de Acciones Granular</span>
                                </div>
                            </div>
                            <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-[11px] uppercase tracking-widest transition-all border border-white/10 active:scale-95 shadow-sm">
                                Diagnóstico del Sistema
                            </button>
                        </div>
                        <Unlock className="absolute -right-12 -bottom-12 text-white/5 w-48 h-48 pointer-events-none group-hover:scale-125 transition-transform duration-700" />
                    </div>

                    <div className="bg-canvas rounded-[32px] border border-hairline p-8 shadow-sm space-y-8 hover:shadow-airbnb transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                                <Server size={14} className="text-primary" /> Servicios Críticos
                            </h4>
                            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full border border-success/20">
                                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                                <span className="text-[9px] font-bold text-success uppercase">Online</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {[
                                { name: 'n8n Automations', status: 'Online', perf: '24ms' },
                                { name: 'Supabase DB', status: 'Online', perf: '18ms' },
                                { name: 'WhatsApp API', status: 'Online', perf: '145ms' },
                                { name: 'DIAN Factus API', status: 'Online', perf: '180ms' },
                            ].map((sys, i) => (
                                <div key={i} className="flex justify-between items-center group cursor-default">
                                    <div>
                                        <p className="text-[13px] font-bold text-secondary group-hover:text-primary transition-colors">{sys.name}</p>
                                        <p className="text-[9px] text-accent font-bold uppercase tracking-widest mt-1">Status Nominal</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[11px] font-mono text-accent/40 group-hover:text-primary transition-colors font-bold">{sys.perf}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Zona de Mantenimiento (Solo Gerentes) */}
                    {(user?.role === 'gerente' || user?.role === 'admin') && (
                        <div className="bg-danger/5 rounded-[32px] border border-danger/10 p-8 shadow-sm space-y-6 group hover:bg-danger/[0.08] transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-danger/10 rounded-lg">
                                    <Database size={16} className="text-danger" />
                                </div>
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-danger">
                                    Zona de Mantenimiento
                                </h4>
                            </div>

                            <div className="space-y-6">
                                <p className="text-[12px] text-danger/70 font-bold leading-relaxed uppercase tracking-wider opacity-60">
                                    Acciones de purga para flujo de pedidos. No afecta inventarios.
                                </p>

                                <button
                                    onClick={handleResetDatabase}
                                    disabled={isCleaning}
                                    className="w-full py-4 bg-canvas text-danger border border-danger/20 rounded-full font-bold text-[11px] uppercase tracking-widest hover:bg-danger hover:text-white hover:border-danger active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-airbnb"
                                >
                                    {isCleaning ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                    {isCleaning ? 'Ejecutando Purga...' : 'Vaciar Historial de Pedidos'}
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
