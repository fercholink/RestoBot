import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Building2, Users, ArrowUpRight, ArrowDownRight, Activity, DollarSign, PieChart, Briefcase, Zap, Globe } from 'lucide-react';

const CorporateIntelligence = ({ orders = [] }) => {
    const [realTimePulse, setRealTimePulse] = useState(orders.length);

    // Simular pulso de datos en tiempo real
    useEffect(() => {
        const interval = setInterval(() => {
            setRealTimePulse(prev => prev + (Math.random() > 0.7 ? 1 : 0));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const metrics = [
        { label: 'Ingresos Totales (Red)', value: '$124.500.000', change: '+12.5%', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Utilidad Neta Esperada', value: '$42.180.000', change: '+8.2%', icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Ticket Promedio Global', value: '$48.500', change: '-2.1%', icon: PieChart, color: 'text-sky-500', bg: 'bg-sky-500/10' },
        { label: 'Transacciones Activas', value: realTimePulse, change: '+5', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    const branchPerformance = [
        { name: 'Sede Norte (Montería)', sales: 45000000, profit: 12000000, efficiency: '94%', trend: 'up' },
        { name: 'Sede Sur (Montería)', sales: 32000000, profit: 8500000, efficiency: '88%', trend: 'up' },
        { name: 'Sede Cartagena (Playa)', sales: 28500000, profit: 7200000, efficiency: '82%', trend: 'down' },
        { name: 'Hamburguesas Express', sales: 19000000, profit: 5100000, efficiency: '91%', trend: 'up' },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 lg:p-10 pt-0 space-y-8 animate-in fade-in duration-500">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-premium group hover:scale-[1.02] transition-all cursor-pointer overflow-hidden relative">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${m.bg} rounded-bl-[4rem] group-hover:scale-110 transition-transform`}></div>
                        <div className="relative z-10">
                            <div className={`${m.bg} ${m.color} w-10 h-10 rounded-2xl flex items-center justify-center mb-4`}>
                                <m.icon size={20} />
                            </div>
                            <h3 className="text-accent font-black text-[10px] uppercase tracking-widest mb-1">{m.label}</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-black text-secondary tracking-tight">{m.value}</span>
                                <span className={`text-[10px] font-black flex items-center mb-1 ${m.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {m.change.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {m.change}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Branch Performance - Estado de Resultados Comparativo */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-premium p-8">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-xl font-black text-secondary tracking-tight">Rendimiento por Establecimiento</h2>
                            <p className="text-xs font-bold text-accent uppercase tracking-widest">Estado de resultados consolidado por sede</p>
                        </div>
                        <button className="text-[10px] font-black text-primary border border-primary/20 bg-primary/5 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors uppercase tracking-widest">Ver Detalles Full</button>
                    </div>

                    <div className="space-y-6">
                        {branchPerformance.map((branch, i) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-accent group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Building2 size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-secondary">{branch.name}</p>
                                            <p className="text-[10px] font-bold text-accent">Eficiencia Op: {branch.efficiency}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-secondary">${branch.sales.toLocaleString()}</p>
                                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 justify-end">
                                            <ArrowUpRight size={12} /> Consolidando
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-primary h-full transition-all duration-1000"
                                        style={{ width: `${(branch.sales / 50000000) * 100}%` }}
                                    ></div>
                                    <div
                                        className="bg-secondary h-full opacity-30 transition-all duration-1000"
                                        style={{ width: `${(branch.profit / branch.sales) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-2 px-1">
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-accent">
                                        <div className="w-2 h-2 rounded-full bg-primary" /> Ventas
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-accent">
                                        <div className="w-2 h-2 rounded-full bg-secondary" /> Margen Utilidad
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Intelligent Insights */}
                <div className="space-y-8">
                    {/* Panel Inteligente de Alertas */}
                    <div className="bg-secondary rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                        <h3 className="text-lg font-black tracking-tight mb-4 flex items-center gap-2">
                            <Zap className="text-primary fill-primary" size={20} /> Smart Insights
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/15 transition-colors">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Oportunidad de Venta</p>
                                <p className="text-xs font-bold leading-relaxed">
                                    "Sede Norte presenta alta demanda en **Hamburguesas**. Sugerimo inyectar más stock de pan fresco para el turno nocturno."
                                </p>
                            </div>
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/15 transition-colors">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Alerta de Margen</p>
                                <p className="text-xs font-bold leading-relaxed">
                                    "Costos operativos en **Sede Cartagena** subieron 5%. Revisar consumos de energía y personal."
                                </p>
                            </div>
                        </div>
                        <button className="w-full mt-6 py-3 bg-white text-secondary font-black text-xs rounded-xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest shadow-xl">Generar Reporte IA</button>
                    </div>

                    {/* Quick Financial Overview */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium p-8">
                        <h3 className="text-sm font-black text-secondary border-b border-gray-100 pb-4 mb-4 uppercase tracking-widest flex items-center gap-2">
                            <Briefcase size={16} className="text-primary" /> Salud Financiera Consolidada
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-accent">Costos Totales</span>
                                <span className="font-black text-secondary">$82.320.000</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-accent">Impuestos Previstos</span>
                                <span className="font-black text-secondary">$15.200.000</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-accent">Nómina Global</span>
                                <span className="font-black text-secondary">$18.500.000</span>
                            </div>
                            <div className="pt-2 border-t border-gray-100 mt-2 flex justify-between items-center">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">EBITDA Estimado</span>
                                <span className="text-lg font-black text-emerald-500">$54.210.000</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CorporateIntelligence;
