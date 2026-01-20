import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Users, DollarSign, Package, Clock, Award, Calendar, BarChart3, PieChart, Activity } from 'lucide-react';

const AnalyticsPro = () => {
    const [timeRange, setTimeRange] = useState('7d');

    // Datos simulados para analítica premium
    const kpis = [
        { label: 'Ingresos Totales', value: '$4.280.000', change: '+12.5%', trend: 'up', icon: DollarSign, color: 'text-success', bg: 'bg-green-50' },
        { label: 'Pedidos Realizados', value: '184', change: '+5.2%', trend: 'up', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: 'Ticket Promedio', value: '$23.260', change: '-2.1%', trend: 'down', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
        { label: 'Cajeros Activos', value: '6', change: 'Estable', trend: 'neutral', icon: Users, color: 'text-warning', bg: 'bg-orange-50' },
    ];

    const topProducts = [
        { name: 'Hamburguesa XL', sales: 42, revenue: '$1.050.000', growth: 15 },
        { name: 'Salchipapa Especial', sales: 38, revenue: '$760.000', growth: 12 },
        { name: 'Perro Caliente Suizo', sales: 25, revenue: '$450.000', growth: -5 },
        { name: 'Gaseosa 350ml', sales: 60, revenue: '$300.000', growth: 8 },
    ];

    const hourlyTraffic = [
        { hour: '11am', volume: 20 }, { hour: '12pm', volume: 45 }, { hour: '1pm', volume: 65 },
        { hour: '2pm', volume: 40 }, { hour: '6pm', volume: 55 }, { hour: '7pm', volume: 85 },
        { hour: '8pm', volume: 100 }, { hour: '9pm', volume: 75 }, { hour: '10pm', volume: 30 },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-50/50">
            {/* Header con Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-secondary tracking-tight">Smart Analytics</h2>
                    <p className="text-xs md:text-sm font-medium text-accent">Rendimiento en tiempo real</p>
                </div>
                <div className="flex gap-1 md:gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto max-w-full">
                    {['24h', '7d', '30d', 'Año'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 md:px-4 py-1.5 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${timeRange === range ? 'bg-secondary text-white shadow-md' : 'text-accent hover:bg-gray-50'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start mb-2 md:mb-4">
                            <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${kpi.bg}`}>
                                <kpi.icon size={16} className={kpi.color} />
                            </div>
                            <div className={`flex items-center gap-0.5 md:gap-1 text-[8px] md:text-[10px] font-black ${kpi.trend === 'up' ? 'text-success' : kpi.trend === 'down' ? 'text-red-500' : 'text-accent'}`}>
                                {kpi.trend === 'up' ? <TrendingUp size={10} /> : kpi.trend === 'down' ? <TrendingDown size={10} /> : null}
                                {kpi.change}
                            </div>
                        </div>
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-accent mb-0.5 md:mb-1 truncate">{kpi.label}</p>
                        <h3 className="text-lg md:text-2xl font-black text-secondary truncate">{kpi.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Gráfica de Tráfico por Hora */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <div>
                            <h3 className="text-md md:text-lg font-black text-secondary">Flujo de Pedidos</h3>
                            <p className="text-[10px] md:text-xs font-bold text-accent italic">Horas pico (Heatmap)</p>
                        </div>
                        <Activity className="text-primary animate-pulse" size={20} />
                    </div>
                    <div className="h-40 md:h-48 flex items-end gap-1.5 md:gap-3 px-1 md:px-4">
                        {hourlyTraffic.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group">
                                <div
                                    className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t-lg transition-all duration-500 group-hover:brightness-110 relative"
                                    style={{ height: `${item.volume}%` }}
                                >
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-secondary text-white text-[8px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {item.volume}%
                                    </div>
                                </div>
                                <span className="text-[7px] md:text-[9px] font-bold text-accent mt-2 md:mt-3 uppercase">{item.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking de Productos */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-md md:text-lg font-black text-secondary mb-4 md:mb-6 flex items-center gap-2">
                        <Award className="text-warning" size={20} />
                        Top Productos
                    </h3>
                    <div className="space-y-4 md:space-y-6">
                        {topProducts.map((product, idx) => (
                            <div key={idx} className="flex items-center gap-3 md:gap-4">
                                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-50 flex items-center justify-center text-[10px] md:text-xs font-black border">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-end mb-1">
                                        <p className="text-[10px] md:text-[11px] font-black text-secondary truncate">{product.name}</p>
                                        <span className="text-[9px] md:text-[10px] font-bold text-accent">{product.sales} vtas</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-primary' : 'bg-secondary'}`}
                                            style={{ width: `${(product.sales / 60) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Nueva sección: Ingresos Proyectados */}
            <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-secondary p-6 md:p-8 rounded-3xl shadow-premium text-white flex flex-col justify-between overflow-hidden relative min-h-[160px]">
                    <div className="relative z-10">
                        <TrendingUp className="text-primary mb-2" size={32} />
                        <h3 className="text-xl font-black mb-1">Proyección Mensual</h3>
                        <p className="text-xs font-medium text-white/60 mb-8">Basado en el rendimiento de los últimos 7 días</p>
                        <div className="text-4xl font-black tracking-tight mb-2">$18.420.000</div>
                        <div className="flex items-center gap-2 text-xs font-black text-primary uppercase">
                            <TrendingUp size={16} /> Est. Crecimiento +15%
                        </div>
                    </div>
                    {/* Background SVG Decoration */}
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BarChart3 size={160} />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-8">
                    <div className="w-32 h-32 rounded-full border-[12px] border-primary flex items-center justify-center relative shadow-inner">
                        <div className="absolute inset-0 border-[12px] border-gray-100 rounded-full" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)' }} />
                        <div className="text-center">
                            <div className="text-2xl font-black text-secondary">72%</div>
                            <div className="text-[8px] font-black text-accent uppercase">Mesa</div>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <h4 className="text-sm font-black text-secondary uppercase tracking-widest">Canales de Venta</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                    <span className="text-[10px] font-black text-accent uppercase">Mesa (Local)</span>
                                </div>
                                <span className="text-xs font-black text-secondary">72%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-secondary" />
                                    <span className="text-[10px] font-black text-accent uppercase">Domicilio</span>
                                </div>
                                <span className="text-xs font-black text-secondary">28%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPro;
