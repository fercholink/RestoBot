import React, { useState, useEffect } from 'react';
import {
    Landmark, TrendingUp, FileText, Receipt, PieChart,
    Calculator, AlertCircle, Briefcase, FileSpreadsheet,
    ChevronRight, RefreshCw, CheckCircle
} from 'lucide-react';
import ElectronicInvoicing from './accounting/ElectronicInvoicing';
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
const AccountingModule = () => {
    const [activeSubTab, setActiveSubTab] = useState('summary');
    const [stats, setStats] = useState({
        totalIncome: 0,
        invoicesEmitted: 0,
        paidOrders: 0,
        pendingToInvoice: 0,
        loading: true
    });
    const [todayOrders, setTodayOrders] = useState([]);
    const [loadingTable, setLoadingTable] = useState(false);

    useEffect(() => {
        if (activeSubTab === 'summary') fetchDailyData();
    }, [activeSubTab]);

    const fetchDailyData = async () => {
        setStats(prev => ({ ...prev, loading: true }));
        setLoadingTable(true);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

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
                id: `cargohab-${c.id}`,
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
                    id: `egreso-${e.id}`,
                    customer_name: 'PROVEEDORES / GASTOS',
                    table_number: e.reference ? `Ref: ${e.reference}` : 'Gasto Manual',
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

            setStats({
                totalIncome,
                invoicesEmitted: paid.filter(o => o.factus_doc_number).length,
                paidOrders: paid.length,
                pendingToInvoice: paid.filter(o => !o.factus_doc_number).length,
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
        { id: 'payroll', label: 'Nómina Electrónica', icon: Briefcase },
        { id: 'reports', label: 'Informes Legales', icon: FileSpreadsheet },
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
                        {/* Título + botón actualizar */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-secondary">Resumen del Día</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {new Date().toLocaleDateString('es-CO', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={fetchDailyData}
                                disabled={stats.loading}
                                className="flex items-center gap-2 text-xs font-black text-secondary bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-secondary hover:shadow-sm transition-all disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={stats.loading ? 'animate-spin' : ''} />
                                Actualizar
                            </button>
                        </div>

                        {/* Métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {/* Ingresos */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600"><TrendingUp size={20} /></div>
                                    {stats.loading && <RefreshCw size={13} className="animate-spin text-gray-300 mt-1" />}
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ingresos del Día</p>
                                <h3 className="text-2xl font-black text-secondary">
                                    ${stats.totalIncome.toLocaleString('es-CO')}
                                </h3>
                                <p className="text-[10px] text-gray-400 mt-1">{stats.paidOrders} pedido{stats.paidOrders !== 1 ? 's' : ''} pagado{stats.paidOrders !== 1 ? 's' : ''}</p>
                            </div>

                            {/* Pedidos pagados */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-2xl bg-blue-100 text-blue-600"><Calculator size={20} /></div>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pedidos Pagados</p>
                                <h3 className="text-2xl font-black text-secondary">{stats.paidOrders}</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Total del día</p>
                            </div>

                            {/* Facturas DIAN */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-2xl bg-purple-100 text-purple-600"><CheckCircle size={20} /></div>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Facturas DIAN</p>
                                <h3 className="text-2xl font-black text-secondary">{stats.invoicesEmitted}</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Emitidas hoy</p>
                            </div>

                            {/* Sin facturar */}
                            <div className={`bg-white p-6 rounded-3xl border shadow-sm transition-colors ${stats.pendingToInvoice > 0
                                ? 'border-orange-200 border-l-4 border-l-orange-400'
                                : 'border-gray-100'
                                }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-2xl bg-orange-100 text-orange-500"><AlertCircle size={20} /></div>
                                    {stats.pendingToInvoice > 0 && (
                                        <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full mt-1">
                                            Por facturar
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sin Facturar</p>
                                <h3 className="text-2xl font-black text-secondary">{stats.pendingToInvoice}</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Pagados sin DIAN</p>
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
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{order.table_number || `#${order.id}`}</p>
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-100/80">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${tInfo.color}`}>
                                                            {tInfo.label}
                                                        </span>
                                                        <span className={`text-lg font-black leading-none ${order.type === 'gasto' ? 'text-rose-500' :
                                                            order.is_paid ? 'text-emerald-600' : 'text-gray-400'
                                                            }`}>
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

                {/* ══════════ NÓMINA ══════════ */}
                {activeSubTab === 'payroll' && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="p-5 rounded-full bg-primary/5 text-primary mb-6 animate-bounce">
                            <Briefcase size={48} />
                        </div>
                        <h3 className="text-xl font-black text-secondary mb-2">Nómina Electrónica</h3>
                        <p className="text-sm font-medium text-accent max-w-md text-center mb-8 px-6">
                            Liquidación automática bajo estándares legales. Generación de desprendibles y envío XML a la DIAN.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl px-8">
                            {['Empleados', 'Prestaciones', 'Aportes SS', 'XML Firmados'].map(tag => (
                                <div key={tag} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                                    <div className="text-xs font-black text-secondary uppercase">{tag}</div>
                                    <div className="text-[10px] font-bold text-accent">Configurable</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ══════════ INFORMES ══════════ */}
                {activeSubTab === 'reports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { title: 'Estado de Resultados (P&G)', desc: 'Utilidad y pérdida por periodo contable.' },
                            { title: 'Balance General', desc: 'Situación patrimonial de la empresa.' },
                            { title: 'Información Exógena', desc: 'Reporte para medios magnéticos DIAN.' },
                            { title: 'Libro Mayor y Balances', desc: 'Cuentas detalladas por PUC colombiano.' },
                        ].map((report, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-secondary uppercase tracking-tight mb-1">{report.title}</h4>
                                    <p className="text-xs text-accent font-medium">{report.desc}</p>
                                </div>
                                <button className="p-3 bg-gray-50 text-accent rounded-2xl group-hover:bg-secondary group-hover:text-white transition-all">
                                    <FileSpreadsheet size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};

export default AccountingModule;
