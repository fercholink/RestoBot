import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Calendar, Users, Building2, TrendingUp, DollarSign, 
    ArrowRight, Filter, Download, RefreshCw, PieChart, 
    ChevronDown, Search, BarChart3, Wallet, Clock
} from 'lucide-react';
import { sileo } from 'sileo';

const SalesReportsAdvanced = () => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    
    // Filters
    const [period, setPeriod] = useState('today'); // today, week, month, custom
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [filterCashier, setFilterCashier] = useState('all');
    const [filterBranch, setFilterBranch] = useState('all');

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [period, dateRange, filterCashier, filterBranch]);

    const fetchInitialData = async () => {
        try {
            // Fetch unique branches and cashiers for filters
            const { data: branchData } = await supabase.from('orders').select('branch_name').not('branch_name', 'is', null);
            const uniqueBranches = [...new Set((branchData || []).map(o => o.branch_name))].sort();
            setBranches(uniqueBranches);

            const { data: cashierData } = await supabase.from('orders').select('cashier_name').not('cashier_name', 'is', null);
            const uniqueCashiers = [...new Set((cashierData || []).map(o => o.cashier_name))].sort();
            setCashiers(uniqueCashiers);
        } catch (error) {
            console.error('Error fetching initial filter data:', error);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let start = dateRange.start;
            let end = dateRange.end;

            if (period === 'today') {
                const today = new Date();
                start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
                end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
            } else if (period === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                start = weekAgo.toISOString();
                end = new Date().toISOString();
            } else if (period === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                start = monthAgo.toISOString();
                end = new Date().toISOString();
            }

            let query = supabase
                .from('orders')
                .select('*')
                .eq('status', 'pagado')
                .gte('created_at', start)
                .lte('created_at', end);

            if (filterCashier !== 'all') {
                query = query.eq('cashier_name', filterCashier);
            }
            if (filterBranch !== 'all') {
                query = query.eq('branch_name', filterBranch);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching report data:', error);
            sileo.error({ title: "Error de Reporte", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = orders.reduce((sum, o) => sum + (o.total || o.total_price || 0), 0);
        const cashSales = orders.filter(o => o.payment_method === 'efectivo').reduce((sum, o) => sum + (o.total || o.total_price || 0), 0);
        const digitalSales = total - cashSales;
        const avgOrder = orders.length > 0 ? total / orders.length : 0;

        return {
            total,
            cashSales,
            digitalSales,
            avgOrder,
            count: orders.length
        };
    }, [orders]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filter Section */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex flex-wrap gap-2">
                        {['today', 'week', 'month', 'custom'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p 
                                    ? 'bg-secondary text-white shadow-lg' 
                                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                            >
                                {p === 'today' ? 'Hoy' : p === 'week' ? '7 Días' : p === 'month' ? '30 Días' : 'Personalizado'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full lg:w-auto">
                        <div className="relative group">
                            <Users size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={filterCashier}
                                onChange={(e) => setFilterCashier(e.target.value)}
                                className="w-full lg:w-48 pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-secondary outline-none focus:ring-2 focus:ring-secondary/5 transition-all appearance-none"
                            >
                                <option value="all">Todos los Cajeros</option>
                                {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                        </div>

                        <div className="relative group">
                            <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={filterBranch}
                                onChange={(e) => setFilterBranch(e.target.value)}
                                className="w-full lg:w-48 pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-secondary outline-none focus:ring-2 focus:ring-secondary/5 transition-all appearance-none"
                            >
                                <option value="all">Todas las Sedes</option>
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                        </div>

                        {period === 'custom' && (
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="date" 
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-secondary outline-none" 
                                />
                                <ArrowRight size={14} className="text-gray-300" />
                                <input 
                                    type="date" 
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-secondary outline-none" 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium group hover:border-primary/20 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                            <TrendingUp size={24} />
                        </div>
                        {loading && <RefreshCw size={14} className="animate-spin text-gray-300" />}
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Ventas</p>
                    <h3 className="text-3xl font-black text-secondary tracking-tighter">${stats.total.toLocaleString()}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
                        En {stats.count} pedidos realizados
                    </p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium group hover:border-success/20 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-4 bg-success/10 rounded-2xl text-success group-hover:scale-110 transition-transform">
                            <Wallet size={24} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Efectivo Recaudado</p>
                    <h3 className="text-3xl font-black text-secondary tracking-tighter">${stats.cashSales.toLocaleString()}</h3>
                    <p className="text-[10px] text-success font-black mt-2 uppercase tracking-tighter">
                        {stats.total > 0 ? Math.round((stats.cashSales / stats.total) * 100) : 0}% del total
                    </p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium group hover:border-blue-100 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-4 bg-blue-50 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                            <PieChart size={24} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ventas Digitales</p>
                    <h3 className="text-3xl font-black text-secondary tracking-tighter">${stats.digitalSales.toLocaleString()}</h3>
                    <p className="text-[10px] text-blue-500 font-black mt-2 uppercase tracking-tighter">
                        {stats.total > 0 ? Math.round((stats.digitalSales / stats.total) * 100) : 0}% (Nequi, Tarjetas)
                    </p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium group hover:border-orange-100 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-4 bg-orange-50 rounded-2xl text-orange-500 group-hover:scale-110 transition-transform">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
                    <h3 className="text-3xl font-black text-secondary tracking-tighter">${Math.round(stats.avgOrder).toLocaleString()}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
                        Valor medio por cliente
                    </p>
                </div>
            </div>

            {/* Recent Orders List in Report */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-secondary tracking-tight">Detalle de Transacciones</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Listado según filtros aplicados</p>
                    </div>
                    <button className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:text-secondary transition-all">
                        <Download size={20} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha/Hora</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente / Mesa</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Cajero / Sede</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Método</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.slice(0, 20).map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-secondary font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-secondary font-black truncate max-w-[150px]">{order.customer_name || 'Sin nombre'}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{order.table_number || 'Mostrador'}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-secondary font-bold">{order.cashier_name || 'Cajero'}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic">{order.branch_name || 'Sede Principal'}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                                            order.payment_method === 'efectivo' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-500'
                                        }`}>
                                            {order.payment_method}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-secondary">
                                        ${(order.total || order.total_price || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No hay ventas registradas para estos filtros</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {orders.length > 20 && (
                    <div className="p-6 bg-gray-50 flex justify-center border-t border-gray-100">
                        <button className="text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">Ver todos los registros</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesReportsAdvanced;
