import React, { useState, useEffect } from 'react';
import {
    Landmark, TrendingUp, FileText, Receipt, PieChart,
    Calculator, AlertCircle, Briefcase, FileSpreadsheet,
    ChevronRight, RefreshCw, CheckCircle, Building2, Users
} from 'lucide-react';
import ElectronicInvoicing from './accounting/ElectronicInvoicing';
import TenantAccountingConfig from './accounting/TenantAccountingConfig';
import ThirdPartiesDirectory from './accounting/ThirdPartiesDirectory';
import Payroll from './accounting/Payroll';
import LegalReports from './accounting/LegalReports';
import { supabase } from '../lib/supabase';

// ─── Helpers de tipo de pedido ───────────────────────────────────────────────
const TYPE_LABEL = {
    mesa: { label: 'Restaurante', color: 'text-blue-600' },
    domicilio: { label: 'Domicilio', color: 'text-orange-500' },
    habitacion: { label: 'Hotel', color: 'text-purple-600' },
    cargohab: { label: 'Cargo a Hab.', color: 'text-indigo-500' },
    gasto: { label: 'Gasto / Egreso', color: 'text-rose-500' },
};
const getOrderType = (order) => {
    if (order.type && TYPE_LABEL[order.type]) return order.type;
    if (order.table_number?.startsWith('HAB-')) return 'habitacion';
    return 'mesa';
};

// ─── Componente principal ─────────────────────────────────────────────────────
const AccountingModule = ({ activeSubTab = 'summary', setActiveSubTab }) => {
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        invoicesEmitted: 0,
        paidOrders: 0,
        pendingToInvoice: 0,
        paymentMethods: {},
        loading: true
    });
    const [todayOrders, setTodayOrders] = useState([]);
    const [loadingTable, setLoadingTable] = useState(false);
    
    // Filtros de fecha
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (activeSubTab === 'summary') fetchDailyData();
    }, [activeSubTab, dateRange]);

    const fetchDailyData = async () => {
        setStats(prev => ({ ...prev, loading: true }));
        setLoadingTable(true);

        const todayStart = new Date(dateRange.start + 'T00:00:00');
        const todayEnd = new Date(dateRange.end + 'T23:59:59');

        try {
            // 1. Obtener órdenes e ingresos (Pedidos y Reservas facturadas hoy)
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, customer_name, table_number, total, is_paid, factus_doc_number, payment_method, created_at, status')
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString())
                .order('created_at', { ascending: false });

            if (ordersError) {
                console.error("Error fetching orders:", ordersError);
            }

            const orders = ordersData || [];

            // 2. Obtener cargos a habitaciones generados hoy
            const { data: chargesData } = await supabase
                .from('room_charges')
                .select('id, amount, description, created_at, bookings(id, guests(full_name))')
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString());

            const formattedCharges = (chargesData || []).map(c => ({
                id: `cargohab - ${c.id} `,
                customer_name: c.bookings?.guests?.full_name || 'Huésped Hotel',
                table_number: c.description || 'Cargo Extra',
                type: 'cargohab',
                total: c.amount,
                is_paid: false,
                created_at: c.created_at,
                status: 'cargado'
            }));

            // 3. Obtener egresos/compras realizados hoy
            const { data: expensesData } = await supabase
                .from('accounting_entries')
                .select('id, date, reference, description, created_at, accounting_entry_items(credit)')
                .eq('journal_type', 'egreso')
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString());

            const formattedExpenses = (expensesData || []).map(e => {
                const exTotal = (e.accounting_entry_items || []).reduce((sum, item) => sum + (item.credit || 0), 0);
                return {
                    id: `egreso - ${e.id} `,
                    customer_name: 'PROVEEDORES / GASTOS',
                    table_number: e.reference ? `Ref: ${e.reference} ` : 'Gasto Manual',
                    type: 'gasto',
                    total: -Math.abs(exTotal), // Negative to indicate outflow
                    is_paid: true,
                    created_at: e.created_at,
                    status: 'pagado'
                }
            });

            // Consolidar todos los movimientos y ordenar por hora
            const allMovements = [...orders, ...formattedCharges, ...formattedExpenses]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Estadísticas (Aplica solo para ingresos/orders por ahora)
            const paid = orders.filter(o => o.is_paid === true || o.status === 'pagado');
            const totalIncome = paid.reduce((sum, o) => sum + (o.total || o.total_price || 0), 0);
            const totalExpenses = formattedExpenses.reduce((sum, e) => sum + Math.abs(e.total), 0);

            // Desglose por medio de pago
            const paymentMethods = paid.reduce((acc, o) => {
                const method = o.payment_method || 'Sin especificar';
                acc[method] = (acc[method] || 0) + (o.total || o.total_price || 0);
                return acc;
            }, {});

            setStats({
                totalIncome,
                totalExpenses,
                balance: totalIncome - totalExpenses,
                invoicesEmitted: paid.filter(o => o.factus_doc_number).length,
                paidOrders: paid.length,
                pendingToInvoice: paid.filter(o => !o.factus_doc_number && getOrderType(o) !== 'habitacion').length,
                paymentMethods,
                loading: false
            });
            setTodayOrders(allMovements);
        } catch (err) {
            console.error('Error cargando resumen diario:', err);
            setStats(prev => ({ ...prev, loading: false }));
        } finally {
            setLoadingTable(false);
        }
    };

    const subMenuItems = [
        { id: 'summary', label: 'Resumen Diario', icon: PieChart },
        { id: 'invoicing', label: 'Facturación DIAN', icon: Receipt },
        { id: 'third_parties', label: 'Directorio DIAN', icon: Users },
        { id: 'payroll', label: 'Nómina Electrónica', icon: Briefcase },
        { id: 'reports', label: 'Informes Legales', icon: FileSpreadsheet },
        { id: 'config', label: 'Estructura Empresa', icon: Building2 },
    ];

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">

            {/* ── Sub-Header ─────────────────────────────────────────────── */}
            <div className="bg-white border-b border-gray-100 px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tight">Ecosistema Contable</h2>
                        <div className="flex items-center gap-1 text-[10px] text-accent font-bold uppercase tracking-widest">
                            Finanzas <ChevronRight size={10} /> {subMenuItems.find(t => t.id === activeSubTab)?.label}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl border border-gray-200 shadow-inner overflow-x-auto max-w-full">
                    {subMenuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSubTab(item.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === item.id
                                ? 'bg-secondary text-white shadow-lg scale-[1.02]'
                                : 'text-accent hover:bg-white/50'
                                }`}
                        >
                            <item.icon size={14} />
                            <span className="hidden lg:inline">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Contenido dinámico ─────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                {/* ══════════ RESUMEN DIARIO ══════════ */}
                {activeSubTab === 'summary' && (
                    <>
                        {/* Título + Filtros + botón actualizar */}
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-secondary rounded-2xl text-white shadow-lg">
                                    <Calculator size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-secondary tracking-tight">Análisis de Resultados</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Consolidado operacional y financiero
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 flex-1 md:flex-none">
                                    <div className="flex flex-col px-2">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Desde</span>
                                        <input 
                                            type="date" 
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                            className="bg-transparent text-xs font-black text-secondary outline-none rounded-md"
                                        />
                                    </div>
                                    <div className="w-px h-8 bg-gray-200 mx-1" />
                                    <div className="flex flex-col px-2">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Hasta</span>
                                        <input 
                                            type="date" 
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                            className="bg-transparent text-xs font-black text-secondary outline-none rounded-md"
                                        />
                                    </div>
                                </div>
                                
                                <button
                                    onClick={fetchDailyData}
                                    disabled={stats.loading}
                                    className="h-14 flex items-center gap-2 text-xs font-black text-white bg-secondary px-6 py-2 rounded-2xl hover:shadow-xl transition-all disabled:opacity-50 active:scale-95"
                                >
                                    <RefreshCw size={14} className={stats.loading ? 'animate-spin' : ''} />
                                    Procesar Informe
                                </button>
                            </div>
                        </div>

                        {/* Métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                             {/* Ingresos */}
                             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform"><TrendingUp size={20} /></div>
                                     {stats.loading && <RefreshCw size={13} className="animate-spin text-gray-300 pointer-events-none" />}
                                 </div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ventas Totales</p>
                                 <h3 className="text-2xl font-black text-secondary">
                                     ${stats.totalIncome.toLocaleString('es-CO')}
                                 </h3>
                                 <div className="mt-2 flex items-center gap-2">
                                     <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{stats.paidOrders} pedidos</span>
                                 </div>
                             </div>
 
                             {/* Gastos */}
                             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform"><AlertCircle size={20} /></div>
                                 </div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Egresos / Gastos</p>
                                 <h3 className="text-2xl font-black text-secondary">
                                     ${stats.totalExpenses.toLocaleString('es-CO')}
                                 </h3>
                                 <div className="mt-2 flex items-center gap-2">
                                     <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">Costos Operativos</span>
                                 </div>
                             </div>
 
                             {/* Balance */}
                             <div className={`bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group ${stats.balance >= 0 ? 'border-emerald-100' : 'border-rose-100'}`}>
                                 <div className="flex justify-between items-start mb-4">
                                     <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform ${stats.balance >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                         <Calculator size={20} />
                                     </div>
                                 </div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Balance Operativo</p>
                                 <h3 className={`text-2xl font-black ${stats.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                     ${stats.balance.toLocaleString('es-CO')}
                                 </h3>
                                 <p className="text-[10px] text-gray-400 mt-1 font-bold">Utilidad Bruta Est.</p>
                             </div>
 
                             {/* Facturas DIAN */}
                             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform"><Receipt size={20} /></div>
                                 </div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cumplimiento DIAN</p>
                                 <h3 className="text-2xl font-black text-secondary">{stats.invoicesEmitted} / {stats.paidOrders}</h3>
                                 <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-purple-500 transition-all duration-1000" 
                                            style={{ width: `${(stats.invoicesEmitted / (stats.paidOrders || 1)) * 100}%` }}
                                        />
                                    </div>
                                 </div>
                             </div>
                        </div>

                        {/* Desglose de Medios de Pago */}
                        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative group hover:shadow-premium transition-all">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-black text-secondary tracking-tight">Ventas por Medio de Pago</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Distribución de recaudo</p>
                                    </div>
                                    <PieChart className="text-primary group-hover:rotate-12 transition-transform" size={24} />
                                </div>
                                <div className="space-y-4">
                                    {Object.entries(stats.paymentMethods).length === 0 ? (
                                        <p className="text-center py-10 text-gray-400 font-bold uppercase tracking-widest text-xs">Sin datos de recaudo</p>
                                    ) : (
                                        Object.entries(stats.paymentMethods).sort((a,b) => b[1] - a[1]).map(([method, amount], idx) => (
                                            <div key={method} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-black text-accent uppercase tracking-wider">{method}</span>
                                                    <span className="text-sm font-black text-secondary">${amount.toLocaleString('es-CO')}</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                    <div 
                                                        className={`h-full rounded-full ${idx === 0 ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' : 'bg-secondary/40'}`} 
                                                        style={{ width: `${(amount / stats.totalIncome) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Recaudado</span>
                                    <span className="text-xl font-black text-secondary">${stats.totalIncome.toLocaleString('es-CO')}</span>
                                </div>
                            </div>

                            <div className="bg-secondary p-8 rounded-[2rem] shadow-premium relative overflow-hidden flex flex-col justify-between text-white min-h-[280px]">
                                <div className="relative z-10">
                                    <div className="p-3 bg-white/10 w-fit rounded-2xl mb-4 border border-white/10 backdrop-blur-md">
                                        <TrendingUp size={24} className="text-primary" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight mb-2">Resumen Operativo</h3>
                                    <p className="text-white/60 text-xs font-medium leading-relaxed max-w-[240px]">
                                        Tu negocio ha generado un balance de 
                                        <span className={`mx-1 font-black ${stats.balance >= 0 ? 'text-primary' : 'text-rose-400'}`}>
                                            ${Math.abs(stats.balance).toLocaleString('es-CO')}
                                        </span> 
                                        {stats.balance >= 0 ? 'en utilidad bruta' : 'en pérdida operativa'} durante el periodo seleccionado.
                                    </p>
                                </div>
                                <div className="relative z-10 flex gap-4 mt-8">
                                    <div className="bg-white/10 rounded-2xl p-4 flex-1 backdrop-blur-sm border border-white/5">
                                        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Ticket Promedio</p>
                                        <p className="text-xl font-black">${(stats.totalIncome / (stats.paidOrders || 1)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="bg-white/10 rounded-2xl p-4 flex-1 backdrop-blur-sm border border-white/5">
                                        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Eficiencia IVA</p>
                                        <p className="text-xl font-black">{((stats.invoicesEmitted / (stats.paidOrders || 1)) * 100).toFixed(0)}%</p>
                                    </div>
                                </div>
                                <Building2 size={180} className="absolute -right-20 -bottom-10 text-white/[0.03] rotate-12" />
                            </div>
                        </div>

                        {/* Tabla de movimientos reales */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-base font-black text-secondary">Movimientos de Hoy</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                        Registros de la jornada actual
                                    </p>
                                </div>
                                <FileText className="text-gray-300" size={20} />
                            </div>

                            {loadingTable ? (
                                <div className="flex items-center justify-center py-16 text-gray-300">
                                    <RefreshCw className="animate-spin" size={28} />
                                </div>
                            ) : todayOrders.length === 0 ? (
                                <div className="text-center py-16">
                                    <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Sin movimientos hoy</p>
                                    <p className="text-xs text-gray-300 mt-1">
                                        Los pedidos del día aparecerán aquí automáticamente
                                    </p>
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {todayOrders.map(order => {
                                            const t = getOrderType(order);
                                            const tInfo = TYPE_LABEL[t] || TYPE_LABEL.mesa;
                                            const amount = order.total || order.total_price || 0;
                                            return (
                                                <div key={order.id} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition-colors hover:shadow-sm flex flex-col justify-between">
                                                    <div>
                                                        {/* Header: Time and Status */}
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                                {new Date(order.created_at).toLocaleTimeString('es-CO', {
                                                                    hour: '2-digit', minute: '2-digit'
                                                                })}
                                                            </span>
                                                            {order.status === 'cargado' ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                                    <Briefcase size={9} /> Aplicado
                                                                </span>
                                                            ) : order.type === 'gasto' ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                                                                    <CheckCircle size={9} /> Pagado
                                                                </span>
                                                            ) : (order.is_paid === true || order.status === 'pagado') ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                                    <CheckCircle size={9} /> Cobrado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                                                                    <AlertCircle size={9} /> Pendiente
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Body: Customer, Type, value */}
                                                        <div className="mb-2">
                                                            <p className="text-sm font-black text-secondary leading-tight line-clamp-2">{order.customer_name || 'Sin nombre'}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{order.table_number || `#${order.id} `}</p>
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-100/80">
                                                        <span className={`text - [10px] font - black uppercase tracking - wider ${tInfo.color} `}>
                                                            {tInfo.label}
                                                        </span>
                                                        <span className={`text - lg font - black leading - none ${order.type === 'gasto' ? 'text-rose-500' :
                                                            order.is_paid ? 'text-emerald-600' : 'text-gray-400'
                                                            } `}>
                                                            {order.type === 'gasto' ? '-' : ''}${Math.abs(amount).toLocaleString('es-CO')}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Total Footer */}
                                    <div className="mt-8 pt-6 border-t border-gray-200 border-dashed flex flex-col md:flex-row justify-between items-center gap-4 bg-emerald-50/30 p-4 rounded-2xl">
                                        <div className="flex items-center gap-3 text-emerald-700">
                                            <div className="p-2 bg-emerald-100 rounded-lg">
                                                <TrendingUp size={20} />
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-black uppercase tracking-widest opacity-80">
                                                    Resumen de caja
                                                </span>
                                                <span className="block text-sm font-bold">
                                                    Total Ingresos Cobrados Hoy
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-black text-emerald-600">
                                            ${stats.totalIncome.toLocaleString('es-CO')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ══════════ FACTURACIÓN DIAN ══════════ */}
                {activeSubTab === 'invoicing' && <ElectronicInvoicing />}

                {/* ══════════ ESTUCTURA EMPRESA (CORE COLOMBIANO) ══════════ */}
                {activeSubTab === 'config' && <TenantAccountingConfig />}

                {/* ══════════ DIRECTORIO DE TERCEROS ══════════ */}
                {activeSubTab === 'third_parties' && <ThirdPartiesDirectory />}

                {/* ══════════ NÓMINA ══════════ */}
                {activeSubTab === 'payroll' && <Payroll />}

                {/* ══════════ INFORMES ══════════ */}
                {activeSubTab === 'reports' && <LegalReports />}

            </div>
        </div>
    );
};

export default AccountingModule;
