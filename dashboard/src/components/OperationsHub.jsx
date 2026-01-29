import React, { useState } from 'react';
import { Activity, ShieldAlert, Monitor, Terminal, User, FileText, Lock, Unlock, AlertTriangle, CheckCircle2, Info, Search, Filter, Clock, Trash2, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MOCK_LOGS = [
    { id: 1, type: 'security', action: 'Cambio de Contraseña', user: 'Admin Principal', target: 'Juan Cajero', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), severity: 'warning' },
    { id: 2, type: 'config', action: 'Edición de Precio', user: 'Maria Admin', target: 'Hamburguesa Especial', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), severity: 'info' },
    { id: 3, type: 'access', action: 'Intento de Login Fallido', user: 'Desconocido', target: 'admin@restobot.com', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), severity: 'critical' },
    { id: 4, type: 'staff', action: 'Nuevo Usuario Creado', user: 'Admin Principal', target: 'Pedro Personal', timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), severity: 'success' },
];

const OperationsHub = () => {
    const [logs, setLogs] = useState(MOCK_LOGS);
    const [filter, setFilter] = useState('all');

    const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.severity === filter);

    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'success': return 'bg-success/10 text-success border-success/20';
            case 'info': return 'bg-blue-50 text-blue-500 border-blue-100';
            case 'warning': return 'bg-warning/10 text-warning border-warning/20';
            case 'critical': return 'bg-red-50 text-red-500 border-red-100';
            default: return 'bg-gray-50 text-gray-500 border-gray-100';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'success': return <CheckCircle2 size={14} />;
            case 'info': return <Info size={14} />;
            case 'warning': return <AlertTriangle size={14} />;
            case 'critical': return <ShieldAlert size={14} />;
            default: return <Activity size={14} />;
        }
    };

    const { user } = useAuth();
    const [isCleaning, setIsCleaning] = useState(false);

    const handleResetDatabase = async () => {
        if (!user || (user.role !== 'gerente' && user.role !== 'admin')) {
            alert("No tienes permisos para realizar esta acción.");
            return;
        }

        if (!window.confirm("⚠️ ¿Estás COMPLETAMENTE SEGURO?\n\nEsta acción ELIMINARÁ TODOS LOS PEDIDOS E ÍTEMS de la base de datos.\n\nÚsala solo para iniciar un nuevo proyecto desde cero. Esta acción NO se puede deshacer.")) {
            return;
        }

        // Doble confirmación
        if (!window.confirm("CONFIRMACIÓN FINAL: Se borrará todo el historial de pedidos permanentemente. ¿Proceder?")) {
            return;
        }

        setIsCleaning(true);
        try {
            // 1. Eliminar items primero (aunque cascade debería manejarlo, es más seguro explícito)
            const { error: itemsError } = await supabase
                .from('order_items')
                .delete()
                .neq('id', 0); // Hack para borrar todo si RLS lo permite

            if (itemsError) throw itemsError;

            // 2. Eliminar pedidos
            const { error: ordersError } = await supabase
                .from('orders')
                .delete()
                .neq('id', 0);

            if (ordersError) throw ordersError;

            alert("✅ Base de datos de pedidos limpiada correctamente. El sistema está listo para un nuevo proyecto.");

            // Opcional: Recargar o limpiar estado local si fuera necesario
            window.location.reload();

        } catch (error) {
            console.error("Error cleaning DB:", error);
            alert("❌ Error al limpiar base de datos: " + error.message);
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* KPI Operational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Acciones Hoy', value: '42', icon: Activity, color: 'text-primary' },
                    { label: 'Alertas Seguridad', value: '03', icon: ShieldAlert, color: 'text-red-500' },
                    { label: 'Accesos Activos', value: '08', icon: Monitor, color: 'text-blue-500' },
                    { label: 'Eventos Sistema', value: '156', icon: Terminal, color: 'text-secondary' },
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
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Terminal size={16} />
                            Registro de Auditoría (Logs)
                        </h3>
                        <div className="flex gap-2">
                            <select
                                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase text-gray-500 focus:outline-none"
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">Filtro: Todo</option>
                                <option value="critical">Críticos</option>
                                <option value="warning">Advertencias</option>
                                <option value="success">Normal</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
                        <div className="divide-y divide-gray-50">
                            {filteredLogs.map((log) => (
                                <div key={log.id} className="p-6 hover:bg-gray-50/50 transition-colors flex items-start gap-5">
                                    <div className={`p-3 rounded-2xl border ${getSeverityStyles(log.severity)}`}>
                                        {getSeverityIcon(log.severity)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-black text-secondary text-sm tracking-tight">{log.action}</h4>
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                <Clock size={10} />
                                                hace 15 min
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            El usuario <span className="font-black text-secondary">{log.user}</span> realizó esta acción sobre <span className="font-black text-primary">{log.target}</span>.
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-widest">{log.type}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredLogs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center py-20 italic text-gray-400">
                                <Search className="mb-2 opacity-20" size={40} />
                                <p className="text-sm font-bold">No se encontraron registros con este filtro</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: System Info / Active Guards */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2 mt-1">Sistemas de Seguridad</h3>

                    <div className="bg-secondary text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    <Lock size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm">Escudo de Identidad</h4>
                                    <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">Activo (MFA Simulado)</p>
                                </div>
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed font-medium">
                                Protegiendo contra fuerza bruta y cambios de contraseñas no autorizados.
                            </p>
                            <button className="w-full py-3 bg-white text-secondary rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all">
                                Configurar Alertas
                            </button>
                        </div>
                        <Unlock className="absolute -right-6 -bottom-6 text-white/5 w-32 h-32" />
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            Estado del Servidor
                            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                        </h4>

                        {[
                            { name: 'n8n Workflow API', status: 'Online', perf: '12ms' },
                            { name: 'PostgreSQL DB', status: 'Online', perf: '24ms' },
                            { name: 'Dashboard Assets', status: 'Online', perf: '8ms' },
                        ].map((sys, i) => (
                            <div key={i} className="flex justify-between items-center group">
                                <div>
                                    <p className="text-xs font-black text-secondary">{sys.name}</p>
                                    <p className="text-[10px] text-success font-bold">{sys.status}</p>
                                </div>
                                <span className="text-[10px] font-mono text-gray-300 group-hover:text-primary transition-colors">{sys.perf}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Zona de Mantenimiento (Solo Gerentes) */}
                {(user?.role === 'gerente' || user?.role === 'admin') && (
                    <div className="bg-red-50 rounded-[2.5rem] border border-red-100 p-8 shadow-sm space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                            <Database size={14} />
                            Zona de Mantenimiento
                        </h4>

                        <div className="space-y-4">
                            <p className="text-xs text-red-900/60 font-medium leading-relaxed">
                                Acciones destructivas para reiniciar el sistema. Úsese con extrema precaución.
                            </p>

                            <button
                                onClick={handleResetDatabase}
                                disabled={isCleaning}
                                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                            >
                                {isCleaning ? <Activity className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                {isCleaning ? 'Limpiando...' : 'Resetear Pedidos'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperationsHub;
