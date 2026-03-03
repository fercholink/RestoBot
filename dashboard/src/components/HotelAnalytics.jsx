import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    TrendingUp, Star, Users, DollarSign, Bed,
    Activity, RefreshCw
} from 'lucide-react';

const SOURCE_LABELS = {
    directo:       { label: 'Directo / WhatsApp', color: 'bg-emerald-400' },
    'booking.com': { label: 'Booking.com',          color: 'bg-blue-400' },
    airbnb:        { label: 'Airbnb',               color: 'bg-primary' },
    expedia:       { label: 'Expedia',              color: 'bg-yellow-400' },
    telefono:      { label: 'Teléfono',             color: 'bg-violet-400' },
    agencia:       { label: 'Agencia',              color: 'bg-amber-400' },
    otro:          { label: 'Otro',                 color: 'bg-gray-300' },
};
const SOURCE_COLOR = (src) => SOURCE_LABELS[src]?.color || 'bg-slate-400';
const SOURCE_LABEL = (src) => SOURCE_LABELS[src]?.label || src;

const HotelAnalytics = ({ selectedBranchId }) => {
    const [metrics, setMetrics]       = useState(null);
    const [roomStats, setRoomStats]   = useState({ disponible: 0, ocupada: 0, reservada: 0, limpieza: 0, mantenimiento: 0, total: 0 });
    const [sources, setSources]       = useState([]);   // [{ source, count, pct }]
    const [loading, setLoading]       = useState(true);

    const fetchAll = useCallback(async () => {
        if (!selectedBranchId) return;
        setLoading(true);
        try {
            // 1. KPIs desde la vista
            const { data: metricsData } = await supabase
                .from('hotel_metrics_view')
                .select('*')
                .eq('branch_id', selectedBranchId)
                .maybeSingle();

            setMetrics(metricsData || null);

            // 2. Rooms del branch para distribución de estados
            const { data: roomsData } = await supabase
                .from('rooms')
                .select('id, status')
                .eq('branch_id', selectedBranchId);

            const rooms = roomsData || [];
            const roomIds = rooms.map(r => r.id);
            const rs = { disponible: 0, ocupada: 0, reservada: 0, limpieza: 0, mantenimiento: 0, total: rooms.length };
            rooms.forEach(r => { if (rs[r.status] !== undefined) rs[r.status]++; });
            setRoomStats(rs);

            // 3. Fuentes de reserva de bookings del branch
            if (roomIds.length > 0) {
                const { data: bkData } = await supabase
                    .from('bookings')
                    .select('source')
                    .in('room_id', roomIds)
                    .neq('status', 'cancelada');

                const bk = bkData || [];
                const counts = bk.reduce((acc, b) => {
                    const s = b.source || 'directo';
                    acc[s] = (acc[s] || 0) + 1;
                    return acc;
                }, {});
                const total = bk.length || 1;
                const sorted = Object.entries(counts)
                    .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
                    .sort((a, b) => b.count - a.count);
                setSources(sorted);
            }
        } catch (error) {
            console.error('Error fetching hotel analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const kpis = [
        {
            label: 'Ocupación',
            value: metrics ? `${Number(metrics.occupancy_rate || 0).toFixed(1)}%` : '—',
            icon: Bed,
            color: 'text-primary',
            bg: 'bg-red-50',
            desc: 'Habitaciones ocupadas / total',
        },
        {
            label: 'ADR',
            value: metrics ? `$${Math.round(metrics.adr || 0).toLocaleString('es-CO')}` : '—',
            icon: DollarSign,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            desc: 'Tarifa promedio diaria',
        },
        {
            label: 'RevPAR',
            value: metrics ? `$${Math.round(metrics.revpar || 0).toLocaleString('es-CO')}` : '—',
            icon: TrendingUp,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            desc: 'Ingreso por hab. disponible',
        },
        {
            label: 'Ocupadas',
            value: metrics ? `${metrics.occupied_rooms || 0} / ${metrics.total_rooms || 0}` : '—',
            icon: Users,
            color: 'text-violet-500',
            bg: 'bg-violet-50',
            desc: 'Habitaciones con huéspedes hoy',
        },
    ];

    const roomStatusBars = [
        { key: 'disponible',   label: 'Libre',       color: 'bg-emerald-400' },
        { key: 'ocupada',      label: 'Ocupada',     color: 'bg-primary' },
        { key: 'reservada',    label: 'Reservada',   color: 'bg-blue-400' },
        { key: 'limpieza',     label: 'Limpieza',    color: 'bg-amber-400' },
        { key: 'mantenimiento',label: 'Mantenimiento',color: 'bg-violet-400' },
    ];

    if (loading) return (
        <div className="flex-1 flex items-center justify-center py-20">
            <Activity className="animate-spin text-primary" size={32} />
        </div>
    );

    const occupancyRate = metrics ? Number(metrics.occupancy_rate || 0) : 0;

    return (
        <div className="flex-1 space-y-6 animate-in fade-in duration-500">

            {/* Encabezado con refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-secondary">Analítica Hotelera</h2>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">KPIs en tiempo real desde la base de datos</p>
                </div>
                <button
                    onClick={fetchAll}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-black text-gray-400 hover:text-primary shadow-sm transition-all"
                >
                    <RefreshCw size={14} /> Actualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${kpi.bg} group-hover:scale-110 transition-transform`}>
                                    <kpi.icon size={20} className={kpi.color} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-secondary tracking-tight mb-1">{kpi.value}</h3>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{kpi.label}</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1 italic">{kpi.desc}</p>
                        </div>
                        <kpi.icon className="absolute -right-4 -bottom-4 text-gray-50 opacity-50 group-hover:scale-125 transition-transform" size={100} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Distribución de habitaciones — datos reales */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-secondary">Estado del Inventario</h3>
                            <p className="text-xs font-bold text-gray-400">Distribución actual de habitaciones</p>
                        </div>
                        <div className="px-4 py-2 bg-secondary text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                            {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}
                        </div>
                    </div>

                    {/* Barras de estado */}
                    <div className="flex items-end gap-3 h-40">
                        {roomStatusBars.map(({ key, label, color }) => {
                            const count = roomStats[key] || 0;
                            const pct   = roomStats.total > 0 ? Math.round((count / roomStats.total) * 100) : 0;
                            return (
                                <div key={key} className="flex-1 flex flex-col items-center group">
                                    <div className="w-full flex flex-col items-center justify-end h-32 relative">
                                        {count > 0 && (
                                            <div
                                                className={`w-full rounded-t-2xl ${color} shadow-sm transition-all duration-700 relative`}
                                                style={{ height: `${Math.max(pct * 1.2, 10)}px` }}
                                            >
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-secondary text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {count} hab. ({pct}%)
                                                </div>
                                            </div>
                                        )}
                                        {count === 0 && (
                                            <div className="w-full rounded-t-2xl bg-gray-100 h-2" />
                                        )}
                                    </div>
                                    <p className="text-[8px] font-black text-secondary uppercase mt-2 text-center">{label}</p>
                                    <p className="text-[9px] font-black text-gray-400">{count}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Gauge de ocupación */}
                    <div className="mt-6 pt-5 border-t border-gray-50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-secondary uppercase tracking-widest">Tasa de Ocupación</span>
                            <span className="text-lg font-black text-primary">{occupancyRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                    occupancyRate >= 80 ? 'bg-primary' :
                                    occupancyRate >= 50 ? 'bg-amber-400' :
                                    'bg-emerald-400'
                                }`}
                                style={{ width: `${occupancyRate}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] font-black text-gray-300 mt-1">
                            <span>0%</span><span>50%</span><span>100%</span>
                        </div>
                    </div>
                </div>

                {/* Revenue Card */}
                <div className="bg-secondary p-8 rounded-[2.5rem] shadow-premium text-white flex flex-col justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <Star className="text-primary mb-4" size={32} />
                        <h3 className="text-xl font-black mb-1">Revenue</h3>
                        <p className="text-xs font-medium text-white/50 mb-6">Métricas clave de la sucursal</p>
                        <div className="space-y-4">
                            <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black uppercase text-primary mb-1">ADR</p>
                                <p className="text-xl font-black text-white">
                                    ${Math.round(metrics?.adr || 0).toLocaleString('es-CO')}
                                </p>
                                <p className="text-[9px] text-white/50">Tarifa promedio por noche ocupada</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black uppercase text-blue-400 mb-1">RevPAR</p>
                                <p className="text-xl font-black text-white">
                                    ${Math.round(metrics?.revpar || 0).toLocaleString('es-CO')}
                                </p>
                                <p className="text-[9px] text-white/50">Por habitación disponible</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fuentes de reserva — datos reales */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-secondary mb-1">Fuentes de Reserva</h3>
                <p className="text-xs font-bold text-gray-400 mb-6">Distribución real de las reservas activas</p>

                {sources.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sin datos de reservas aún.</p>
                ) : (
                    <div className="space-y-3">
                        {sources.map(({ source, count, pct }) => (
                            <div key={source} className="flex items-center gap-4">
                                <div className="w-32 shrink-0">
                                    <p className="text-[10px] font-black text-secondary uppercase truncate">{SOURCE_LABEL(source)}</p>
                                </div>
                                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${SOURCE_COLOR(source)} transition-all duration-700 flex items-center pl-2`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <div className="w-20 text-right shrink-0">
                                    <span className="text-sm font-black text-secondary">{pct}%</span>
                                    <span className="text-[10px] text-gray-400 ml-1">({count})</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HotelAnalytics;
