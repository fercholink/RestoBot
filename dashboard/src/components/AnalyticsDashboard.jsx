import React, { useState } from 'react';
import { TrendingUp, Users, DollarSign, Clock, Building, CreditCard, Wallet, ArrowUpRight, ArrowDownRight, Award, Zap, ChevronRight, BarChart3, MapPin } from 'lucide-react';

const BRANCH_DETAILS = {
    'Sede Norte': {
        sales: '$450,000',
        ticket: '$32,500',
        orders: '120',
        time: '15 min',
        cash: '$280,000',
        transfer: '$170,000',
        topCaja: 'Caja 01 - Norte',
        transactions: 120,
        color: '#ff4757'
    },
    'Sede Sur': {
        sales: '$380,000',
        ticket: '$38,000',
        orders: '95',
        time: '22 min',
        cash: '$200,000',
        transfer: '$180,000',
        topCaja: 'Caja Principal - Sur',
        transactions: 95,
        color: '#5352ed'
    },
    'Sede Centro': {
        sales: '$420,000',
        ticket: '$35,000',
        orders: '110',
        time: '19 min',
        cash: '$270,000',
        transfer: '$150,000',
        topCaja: 'Caja Rápida - Centro',
        transactions: 110,
        color: '#2ed573'
    }
};

const AnalyticsDashboard = () => {
    const [selectedBranch, setSelectedBranch] = useState(Object.keys(BRANCH_DETAILS)[0]);
    const branch = BRANCH_DETAILS[selectedBranch];

    const stats = [
        { id: 1, label: 'Ventas Sede', value: branch.sales, change: '+12%', positive: true, icon: DollarSign },
        { id: 2, label: 'Ticket Promedio', value: branch.ticket, change: '+5%', positive: true, icon: TrendingUp },
        { id: 3, label: 'Pedidos Hoy', value: branch.orders, change: '+8 pedidos', positive: true, icon: CreditCard },
        { id: 4, label: 'Tiempo Prep.', value: branch.time, change: '-2 min', positive: true, icon: Clock },
    ];

    const branchRanking = Object.keys(BRANCH_DETAILS).map(name => ({
        name,
        sales: parseInt(BRANCH_DETAILS[name].sales.replace('$', '').replace(',', '')),
        color: BRANCH_DETAILS[name].color
    })).sort((a, b) => b.sales - a.sales);

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-500">
            {/* Cabecera de Selección y Título */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tight">Visto: {selectedBranch}</h2>
                        <p className="text-xs font-medium text-gray-400">Datos actualizados hace 2 minutos</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl">
                    {Object.keys(BRANCH_DETAILS).map((name) => (
                        <button
                            key={name}
                            onClick={() => setSelectedBranch(name)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedBranch === name
                                    ? 'bg-white text-primary shadow-sm scale-105'
                                    : 'text-gray-400 hover:text-secondary'
                                }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resumen Superior Dinámico */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.id} className="bg-white p-6 rounded-3xl shadow-premium border border-gray-100 group hover:border-primary/20 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-gray-50 rounded-2xl text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <stat.icon size={22} />
                            </div>
                            <span className={`text-[10px] font-black flex items-center gap-1 ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
                                {stat.change}
                                {stat.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            </span>
                        </div>
                        <div className="mt-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-secondary tracking-tight">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel Detallado de la Sede */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Ranking General (Contexto) */}
                    <div className="bg-white p-8 rounded-3xl shadow-premium border border-gray-100">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-secondary tracking-tight flex items-center gap-2">
                                    <BarChart3 size={20} className="text-primary" />
                                    Ranking de Restaurantes
                                </h3>
                                <p className="text-xs font-medium text-gray-400">Volumen de ventas acumulado hoy</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {branchRanking.map((b, index) => (
                                <button
                                    key={b.name}
                                    onClick={() => setSelectedBranch(b.name)}
                                    className={`w-full text-left space-y-2 p-3 rounded-2xl transition-all ${selectedBranch === b.name ? 'bg-primary/5 ring-1 ring-primary/10 scale-[1.02]' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                                                {index + 1}
                                            </span>
                                            <span className={`font-bold ${selectedBranch === b.name ? 'text-primary' : 'text-secondary'}`}>{b.name}</span>
                                        </div>
                                        <span className="font-black text-secondary">${b.sales.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${(b.sales / branchRanking[0].sales) * 100}%`,
                                                backgroundColor: b.color
                                            }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Detalle de Flujo de Caja (Específico de Sede) */}
                <div className="bg-secondary text-white p-8 rounded-3xl shadow-premium relative overflow-hidden flex flex-col">
                    <div className="relative z-10 flex-1">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-2 h-8 bg-primary rounded-full transition-all duration-500" />
                            <h3 className="text-xl font-black tracking-tight line-clamp-1">{selectedBranch}</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group hover:bg-white/10 transition-all">
                                <div className="flex items-center gap-3 mb-4 text-primary">
                                    <Wallet size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Efectivo</span>
                                </div>
                                <p className="text-3xl font-black">{branch.cash}</p>
                            </div>

                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group hover:bg-white/10 transition-all">
                                <div className="flex items-center gap-3 mb-4 text-blue-400">
                                    <CreditCard size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Digital / Banco</span>
                                </div>
                                <p className="text-3xl font-black">{branch.transfer}</p>
                            </div>
                        </div>

                        <div className="mt-12 pt-8 border-t border-white/10">
                            <div className="flex items-center gap-3 text-primary mb-3">
                                <Zap size={20} fill="currentColor" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Caja más Activa</span>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
                                <p className="text-sm font-black text-white">{branch.topCaja}</p>
                                <p className="text-[10px] text-primary font-black uppercase mt-1 tracking-wider">{branch.transactions} tickets procesados</p>
                            </div>
                        </div>
                    </div>

                    {/* Decoración abstracta de fondo */}
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none opacity-50" />
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
