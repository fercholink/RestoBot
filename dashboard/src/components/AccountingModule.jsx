import { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, FileText, Receipt, PieChart,
    Calculator, AlertCircle, Briefcase,
    RefreshCw, CheckCircle, Building2, Download,
    CreditCard, ChevronRight, Wallet, FileSpreadsheet,
    Users, GitBranch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ElectronicInvoicing from './accounting/ElectronicInvoicing';
import TenantAccountingConfig from './accounting/TenantAccountingConfig';
import ThirdPartiesDirectory from './accounting/ThirdPartiesDirectory';
import Payroll from './accounting/Payroll';
import LegalReports from './accounting/LegalReports';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_LABEL = {
    mesa:       { label: 'Restaurante',    color: 'text-blue-600',   bg: 'bg-blue-50' },
    domicilio:  { label: 'Domicilio',      color: 'text-orange-500', bg: 'bg-orange-50' },
    habitacion: { label: 'Hotel',          color: 'text-purple-600', bg: 'bg-purple-50' },
    cargohab:   { label: 'Cargo Hab.',     color: 'text-indigo-500', bg: 'bg-indigo-50' },
    gasto:      { label: 'Gasto / Egreso', color: 'text-rose-500',   bg: 'bg-rose-50' },
};
const getOrderType = (order) => {
    if (order.type && TYPE_LABEL[order.type]) return order.type;
    if (order.table_number?.startsWith('HAB-')) return 'habitacion';
    return 'mesa';
};
const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
};

// ─── Quick-shortcut config ─────────────────────────────────────────────────────
const SHORTCUTS = [
    { id: 'invoicing',     label: 'Facturación DIAN', icon: Receipt,         color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { id: 'third_parties', label: 'Directorio DIAN',  icon: Users,           color: 'bg-blue-50   text-blue-600   border-blue-100' },
    { id: 'payroll',       label: 'Nómina',           icon: Briefcase,       color: 'bg-amber-50  text-amber-600  border-amber-100' },
    { id: 'reports',       label: 'Informes Legales', icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'config',        label: 'Estructura Empresa', icon: Building2,     color: 'bg-gray-50   text-gray-600   border-gray-200' },
];

const SUB_LABEL = {
    summary:       'Resumen Diario',
    invoicing:     'Facturación DIAN',
    third_parties: 'Directorio DIAN',
    payroll:       'Nómina Electrónica',
    reports:       'Informes Legales',
    config:        'Estructura Empresa',
};

// ─── Componente principal ─────────────────────────────────────────────────────
const AccountingModule = ({ orders: liveOrders = [], activeSubTab = 'summary', setActiveSubTab }) => {
    const { user } = useAuth();
    const orgId      = user?.organization_id;
    const userBranch = user?.branch?.id || null;

    const [stats, setStats] = useState({
        totalIncome: 0, totalExpenses: 0, balance: 0,
        invoicesEmitted: 0, paidOrders: 0, pendingToInvoice: 0,
        paymentMethods: {}, loading: true
    });
    const [todayOrders, setTodayOrders]     = useState([]);
    const [loadingTable, setLoadingTable]   = useState(false);
    const [branches, setBranches]           = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(userBranch || 'all');
    const [dateRange, setDateRange]         = useState({
        start: new Date().toISOString().split('T')[0],
        end:   new Date().toISOString().split('T')[0]
    });

    // ─── Cargar sucursales de la org ─────────────────────────────────────────
    useEffect(() => {
        if (!orgId) return;
        supabase
            .from('branches')
            .select('id, name')
            .eq('organization_id', orgId)
            .then(({ data }) => {
                if (data) setBranches(data);
            });
    }, [orgId]);

    useEffect(() => {
        if (activeSubTab === 'summary') fetchDailyData();
    }, [activeSubTab, dateRange, selectedBranch]);

    // ─── Fetch consolidado ───────────────────────────────────────────────────
    const fetchDailyData = useCallback(async () => {
        if (!orgId) return;
        setStats(prev => ({ ...prev, loading: true }));
        setLoadingTable(true);

        const startISO = new Date(dateRange.start + 'T00:00:00').toISOString();
        const endISO   = new Date(dateRange.end   + 'T23:59:59').toISOString();
        const todayOnly = isToday(dateRange.start) && isToday(dateRange.end);

        try {
            // ── 1. PEDIDOS ────────────────────────────────────────────────────
            let orders = [];

            if (todayOnly && liveOrders.length > 0) {
                // Reutilizar pedidos ya cargados en App.jsx (evita query extra)
                orders = liveOrders.filter(o =>
                    !selectedBranch || selectedBranch === 'all'
                        ? true
                        : o.branch_id === selectedBranch
                );
            } else {
                let q = supabase
                    .from('orders')
                    .select('id, customer_name, table_number, total, total_price, is_paid, factus_doc_number, payment_method, created_at, status, type, branch_id')
                    .gte('created_at', startISO)
                    .lte('created_at', endISO)
                    .order('created_at', { ascending: false });

                if (selectedBranch && selectedBranch !== 'all') {
                    q = q.eq('branch_id', selectedBranch);
                }

                const { data, error } = await q;
                if (error) console.error('[Accounting] orders error:', error);
                orders = data || [];
            }

            // ── 2. CARGOS A HABITACIÓN ────────────────────────────────────────
            let chargesQ = supabase
                .from('room_charges')
                .select('id, amount, description, created_at, bookings(id, guests(full_name), rooms(branch_id))')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            const { data: chargesData } = await chargesQ;
            const formattedCharges = (chargesData || [])
                .filter(c => {
                    if (!selectedBranch || selectedBranch === 'all') return true;
                    return c.bookings?.rooms?.branch_id === selectedBranch;
                })
                .map(c => ({
                    id: `cargohab-${c.id}`,
                    customer_name: c.bookings?.guests?.full_name || 'Huésped Hotel',
                    table_number:  c.description || 'Cargo Extra',
                    type:          'cargohab',
                    total:         c.amount,
                    is_paid:       false,
                    created_at:    c.created_at,
                    status:        'cargado'
                }));

            // ── 3. EGRESOS / GASTOS ────────────────────────────────────────────
            const { data: expensesData } = await supabase
                .from('accounting_entries')
                .select('id, date, reference, description, created_at, accounting_entry_items(credit)')
                .eq('journal_type', 'egreso')
                .eq('organization_id', orgId)
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            const formattedExpenses = (expensesData || []).map(e => {
                const exTotal = (e.accounting_entry_items || []).reduce((s, i) => s + (i.credit || 0), 0);
                return {
                    id:            `egreso-${e.id}`,
                    customer_name: 'PROVEEDORES / GASTOS',
                    table_number:  e.reference ? `Ref: ${e.reference}` : 'Gasto Manual',
                    type:          'gasto',
                    total:         -Math.abs(exTotal),
                    is_paid:       true,
                    created_at:    e.created_at,
                    status:        'pagado'
                };
            });

            // ── 4. CONSOLIDAR ─────────────────────────────────────────────────
            const allMovements = [...orders, ...formattedCharges, ...formattedExpenses]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const paid = orders.filter(o => o.is_paid === true || o.status === 'pagado');
            const totalIncome   = paid.reduce((s, o) => s + (o.total || o.total_price || 0), 0);
            const totalExpenses = formattedExpenses.reduce((s, e) => s + Math.abs(e.total), 0);

            const paymentMethods = paid.reduce((acc, o) => {
                const m = o.payment_method || 'Sin especificar';
                acc[m] = (acc[m] || 0) + (o.total || o.total_price || 0);
                return acc;
            }, {});

            setStats({
                totalIncome,
                totalExpenses,
                balance: totalIncome - totalExpenses,
                invoicesEmitted:   paid.filter(o => o.factus_doc_number).length,
                paidOrders:        paid.length,
                pendingToInvoice:  paid.filter(o => !o.factus_doc_number && getOrderType(o) !== 'habitacion').length,
                paymentMethods,
                loading: false
            });
            setTodayOrders(allMovements);

        } catch (err) {
            console.error('[Accounting] Error resumen diario:', err);
            setStats(prev => ({ ...prev, loading: false }));
        } finally {
            setLoadingTable(false);
        }
    }, [orgId, dateRange, selectedBranch, liveOrders]);

    // ─── Export CSV ───────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        if (!todayOrders.length) {
            sileo.warning({ title: 'Sin datos', description: 'No hay movimientos para exportar.' });
            return;
        }
        const headers = ['Hora', 'Cliente', 'Referencia', 'Tipo', 'Estado', 'Monto COP'];
        const rows = todayOrders.map(o => {
            const t = getOrderType(o);
            const tInfo = TYPE_LABEL[t] || TYPE_LABEL.mesa;
            const amount = o.total || o.total_price || 0;
            return [
                new Date(o.created_at).toLocaleTimeString('es-CO'),
                (o.customer_name || 'Sin nombre').replace(/,/g, ' '),
                (o.table_number  || `#${o.id}`).replace(/,/g, ' '),
                tInfo.label,
                o.status || (o.is_paid ? 'Pagado' : 'Pendiente'),
                t === 'gasto' ? `-${Math.abs(amount)}` : amount
            ].join(',');
        });
        const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `Movimientos_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        sileo.success({ title: 'Exportado', description: `${todayOrders.length} movimientos descargados.` });
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent animate-in fade-in duration-1000">

            {/* ── Breadcrumb / Header ─── */}
            <div className="bg-canvas border-b border-hairline px-8 py-5 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-canvas/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Wallet size={20} className="text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-[2px]">
                            <span>Portal Contable</span>
                            <ChevronRight size={10} />
                            <span className="text-secondary">{SUB_LABEL[activeSubTab] || activeSubTab}</span>
                        </div>
                        <h2 className="text-lg font-black text-secondary tracking-tighter mt-0.5">ESTADO FINANCIERO</h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {activeSubTab === 'summary' && (
                        <button
                            onClick={handleExportCSV}
                            disabled={!todayOrders.length}
                            className="h-11 flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-secondary bg-canvas border border-hairline px-6 rounded-full hover:shadow-airbnb transition-all disabled:opacity-40 active:scale-95"
                        >
                            <Download size={15} />
                            EXPORTAR DATA
                        </button>
                    )}
                    <button
                        onClick={fetchDailyData}
                        disabled={stats.loading}
                        className="w-11 h-11 flex items-center justify-center text-white bg-secondary rounded-full hover:shadow-airbnb hover:rotate-180 transition-all duration-700 disabled:opacity-50 active:scale-90"
                    >
                        <RefreshCw size={18} className={stats.loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Contenido dinámico ─── */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                {/* ══ RESUMEN DIARIO ══════════════════════════════════════════ */}
                {activeSubTab === 'summary' && (
                    <div className="max-w-[1600px] mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                        
                        {/* Accesos rápidos a sub-módulos */}
                        {setActiveSubTab && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                {SHORTCUTS.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setActiveSubTab(s.id)}
                                        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] border border-hairline transition-all hover:shadow-airbnb hover:-translate-y-1 active:scale-95 group ${s.color}`}
                                    >
                                        <div className="p-3 bg-white/50 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
                                            <s.icon size={24} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-center">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Filtros + Sucursal */}
                        <div className="bg-canvas p-8 rounded-[40px] shadow-sm border border-hairline flex flex-col xl:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-secondary rounded-[24px] flex items-center justify-center text-white shadow-airbnb">
                                    <Calculator size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-secondary tracking-tighter">ANÁLISIS DE FLUJO</h3>
                                    <p className="text-[11px] font-bold text-accent uppercase tracking-[2px] mt-1">
                                        FILTRANDO POR PERÍODO Y SEDE
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 justify-center">
                                {/* Selector de sucursal */}
                                {branches.length > 1 && (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black text-accent uppercase tracking-widest ml-1">Sede / Branch</span>
                                        <div className="bg-surface-soft px-4 py-3 rounded-full border border-hairline flex items-center gap-2 hover:shadow-sm transition-all">
                                            <GitBranch size={14} className="text-secondary" />
                                            <select
                                                value={selectedBranch}
                                                onChange={e => setSelectedBranch(e.target.value)}
                                                className="bg-transparent text-[11px] font-black text-secondary outline-none uppercase tracking-widest cursor-pointer"
                                            >
                                                <option value="all">Consolidado Total</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Rango de fechas */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black text-accent uppercase tracking-widest ml-1">Periodo Contable</span>
                                    <div className="flex items-center gap-1 bg-surface-soft p-1.5 rounded-full border border-hairline hover:shadow-sm transition-all">
                                        <input
                                            type="date"
                                            value={dateRange.start}
                                            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                            className="bg-transparent text-[11px] font-black text-secondary outline-none px-4 py-1.5 rounded-full hover:bg-canvas transition-all"
                                        />
                                        <ChevronRight size={14} className="text-hairline" />
                                        <input
                                            type="date"
                                            value={dateRange.end}
                                            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                            className="bg-transparent text-[11px] font-black text-secondary outline-none px-4 py-1.5 rounded-full hover:bg-canvas transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={fetchDailyData}
                                    disabled={stats.loading}
                                    className="xl:mt-5 px-10 py-4 bg-secondary text-white rounded-full font-black text-[12px] uppercase tracking-widest shadow-airbnb hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    {stats.loading ? <RefreshCw size={16} className="animate-spin" /> : <Calculator size={16} />}
                                    CALCULAR
                                </button>
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Ingresos */}
                            <div className="bg-canvas p-8 rounded-[32px] border border-hairline shadow-sm hover:shadow-airbnb transition-all group overflow-hidden relative">
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                        <TrendingUp size={24} />
                                    </div>
                                    <p className="text-[11px] font-black text-accent uppercase tracking-[2px] mb-2">Ingresos Brutos</p>
                                    <h3 className="text-3xl font-black text-secondary tracking-tighter leading-none">${stats.totalIncome.toLocaleString('es-CO')}</h3>
                                    <div className="mt-4 pt-4 border-t border-hairline/50">
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                            {stats.paidOrders} REGISTROS
                                        </span>
                                    </div>
                                </div>
                                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                                    <TrendingUp size={120} />
                                </div>
                            </div>

                            {/* Egresos */}
                            <div className="bg-canvas p-8 rounded-[32px] border border-hairline shadow-sm hover:shadow-airbnb transition-all group overflow-hidden relative">
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                        <AlertCircle size={24} />
                                    </div>
                                    <p className="text-[11px] font-black text-accent uppercase tracking-[2px] mb-2">Gastos / Costos</p>
                                    <h3 className="text-3xl font-black text-secondary tracking-tighter leading-none">${stats.totalExpenses.toLocaleString('es-CO')}</h3>
                                    <div className="mt-4 pt-4 border-t border-hairline/50">
                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                            OPERACIONALES
                                        </span>
                                    </div>
                                </div>
                                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                                    <AlertCircle size={120} />
                                </div>
                            </div>

                            {/* Balance */}
                            <div className={`bg-canvas p-8 rounded-[32px] border shadow-sm hover:shadow-airbnb transition-all group overflow-hidden relative ${stats.balance >= 0 ? 'border-hairline' : 'border-rose-200 bg-rose-50/20'}`}>
                                <div className="relative z-10">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm ${stats.balance >= 0 ? 'bg-secondary text-white' : 'bg-rose-500 text-white'}`}>
                                        <Calculator size={24} />
                                    </div>
                                    <p className="text-[11px] font-black text-accent uppercase tracking-[2px] mb-2">Utilidad Estimada</p>
                                    <h3 className={`text-3xl font-black tracking-tighter leading-none ${stats.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ${stats.balance.toLocaleString('es-CO')}
                                    </h3>
                                    <div className="mt-4 pt-4 border-t border-hairline/50">
                                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${stats.balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            Balance Neto
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Cumplimiento DIAN */}
                            <div className="bg-canvas p-8 rounded-[32px] border border-hairline shadow-sm hover:shadow-airbnb transition-all group overflow-hidden relative">
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                        <Receipt size={24} />
                                    </div>
                                    <p className="text-[11px] font-black text-accent uppercase tracking-[2px] mb-2">Facturación Electrónica</p>
                                    <h3 className="text-3xl font-black text-secondary tracking-tighter leading-none">{stats.invoicesEmitted} / {stats.paidOrders}</h3>
                                    
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-black text-accent uppercase tracking-widest">PROGRESO DIAN</span>
                                            <span className="text-[10px] font-black text-secondary">{((stats.invoicesEmitted / (stats.paidOrders || 1)) * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-surface-soft rounded-full overflow-hidden border border-hairline p-[1px]">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-1000"
                                                style={{ width: `${(stats.invoicesEmitted / (stats.paidOrders || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Medios de pago + Banner Premium */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-canvas p-10 rounded-[40px] border border-hairline shadow-sm hover:shadow-airbnb transition-all">
                                <div className="flex justify-between items-center mb-10">
                                    <div>
                                        <h3 className="text-2xl font-black text-secondary tracking-tighter">RECAUDO POR CANAL</h3>
                                        <p className="text-[10px] font-bold text-accent uppercase tracking-[2px] mt-1">Sinfonía de métodos de pago</p>
                                    </div>
                                    <div className="w-12 h-12 bg-surface-soft rounded-full flex items-center justify-center border border-hairline">
                                        <PieChart className="text-secondary" size={24} />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {Object.entries(stats.paymentMethods).length === 0 ? (
                                        <div className="py-20 text-center opacity-30 flex flex-col items-center">
                                            <Receipt size={40} />
                                            <p className="text-[11px] font-black uppercase tracking-widest mt-4">Sin datos de recaudo</p>
                                        </div>
                                    ) : (
                                        Object.entries(stats.paymentMethods)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([method, amount], idx) => (
                                                <div key={method} className="group/item">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-accent'}`} />
                                                            <span className="text-[11px] font-black text-secondary uppercase tracking-widest">{method}</span>
                                                        </div>
                                                        <span className="text-sm font-black text-secondary">${amount.toLocaleString('es-CO')}</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-surface-soft rounded-full overflow-hidden border border-hairline p-[1px] group-hover/item:border-accent transition-all">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-primary' : 'bg-secondary/50'}`}
                                                            style={{ width: `${(amount / stats.totalIncome) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                                <div className="mt-10 pt-8 border-t border-hairline flex justify-between items-center">
                                    <span className="text-[10px] font-black text-accent uppercase tracking-[3px]">Consolidado Total</span>
                                    <span className="text-3xl font-black text-secondary tracking-tighter">${stats.totalIncome.toLocaleString('es-CO')}</span>
                                </div>
                            </div>

                            <div className="bg-secondary p-10 rounded-[40px] shadow-premium relative overflow-hidden flex flex-col justify-between text-white group">
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-white/10 rounded-[24px] flex items-center justify-center mb-8 border border-white/10 backdrop-blur-md group-hover:scale-110 transition-transform">
                                        <Building2 size={32} className="text-primary" />
                                    </div>
                                    <h3 className="text-4xl font-black tracking-tighter leading-[0.9]">Métricas de Salud</h3>
                                    <p className="text-white/60 text-[12px] font-bold uppercase tracking-[2px] mt-4 leading-relaxed max-w-sm">
                                        El balance operacional refleja una utilidad de 
                                        <span className={`mx-2 font-black text-xl underline decoration-2 underline-offset-4 ${stats.balance >= 0 ? 'text-primary' : 'text-rose-400'}`}>
                                            ${Math.abs(stats.balance).toLocaleString('es-CO')}
                                        </span>
                                        para este periodo.
                                    </p>
                                </div>
                                
                                <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
                                    <div className="bg-white/10 rounded-[24px] p-6 backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-all">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Ticket Promedio</p>
                                        <p className="text-3xl font-black tracking-tighter">
                                            ${(stats.totalIncome / (stats.paidOrders || 1)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="bg-white/10 rounded-[24px] p-6 backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-all">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Efectividad DIAN</p>
                                        <p className="text-3xl font-black tracking-tighter">
                                            {((stats.invoicesEmitted / (stats.paidOrders || 1)) * 100).toFixed(0)}%
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute -right-20 -bottom-20 opacity-[0.05] rotate-12 group-hover:rotate-0 transition-all duration-1000">
                                    <Building2 size={320} />
                                </div>
                            </div>
                        </div>

                        {/* Listado de movimientos Premium */}
                        <div className="bg-canvas rounded-[40px] border border-hairline shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-hairline flex justify-between items-center bg-canvas">
                                <div>
                                    <h3 className="text-2xl font-black text-secondary tracking-tighter">BITÁCORA FINANCIERA</h3>
                                    <p className="text-[10px] text-accent font-bold uppercase tracking-[3px] mt-1">
                                        {todayOrders.length} REGISTROS ENCONTRADOS
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-surface-soft px-4 py-2 rounded-full border border-hairline text-[10px] font-black text-secondary uppercase tracking-widest">
                                        {dateRange.start} → {dateRange.end}
                                    </div>
                                    <FileText className="text-accent" size={28} />
                                </div>
                            </div>

                            {loadingTable ? (
                                <div className="flex flex-col items-center justify-center py-32 text-accent">
                                    <RefreshCw className="animate-spin mb-4" size={40} />
                                    <span className="text-[11px] font-black uppercase tracking-widest">PROCESANDO LIBROS...</span>
                                </div>
                            ) : todayOrders.length === 0 ? (
                                <div className="text-center py-32 opacity-20">
                                    <FileText size={80} className="mx-auto mb-6" />
                                    <p className="text-sm font-black uppercase tracking-[4px]">Sin movimientos registrados</p>
                                </div>
                            ) : (
                                <div className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                                        {todayOrders.map(order => {
                                            const t     = getOrderType(order);
                                            const tInfo = TYPE_LABEL[t] || TYPE_LABEL.mesa;
                                            const amount = order.total || order.total_price || 0;
                                            return (
                                                <div 
                                                    key={order.id} 
                                                    className="bg-canvas rounded-[32px] border border-hairline p-6 hover:shadow-airbnb transition-all group flex flex-col justify-between min-h-[180px] relative overflow-hidden"
                                                >
                                                    <div className="relative z-10">
                                                        <div className="flex justify-between items-start mb-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                                                                    {new Date(order.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-accent/50 uppercase">ID: {order.id.toString().slice(-8)}</span>
                                                            </div>
                                                            {order.status === 'cargado' ? (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                                                    <Briefcase size={12} /> Aplicado
                                                                </span>
                                                            ) : order.type === 'gasto' ? (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                                                    <AlertCircle size={12} /> Egreso
                                                                </span>
                                                            ) : (order.is_paid === true || order.status === 'pagado') ? (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                                                    <CheckCircle size={12} /> Cobrado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-warning bg-warning/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                                                    <AlertCircle size={12} /> Pendiente
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mb-4">
                                                            <p className="text-lg font-black text-secondary leading-tight tracking-tighter truncate group-hover:text-primary transition-colors">
                                                                {order.customer_name || 'Huésped / Cliente'}
                                                            </p>
                                                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest mt-1 opacity-60">
                                                                Ref: {order.table_number || `#${order.id.toString().slice(-6)}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-auto pt-5 border-t border-hairline/50 relative z-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${tInfo.bg.replace('bg-', 'bg-')}`} />
                                                            <span className={`text-[10px] font-black uppercase tracking-[2px] ${tInfo.color}`}>
                                                                {tInfo.label}
                                                            </span>
                                                        </div>
                                                        <span className={`text-xl font-black tracking-tighter ${t === 'gasto' ? 'text-rose-600' : (order.is_paid ? 'text-emerald-600' : 'text-accent')}`}>
                                                            {t === 'gasto' ? '-' : ''}${Math.abs(amount).toLocaleString('es-CO')}
                                                        </span>
                                                    </div>
                                                    {/* Background icon decoration */}
                                                    <div className="absolute -right-6 -bottom-6 opacity-[0.02] group-hover:scale-125 transition-transform duration-700 pointer-events-none">
                                                        {t === 'gasto' ? <AlertCircle size={140} /> : <TrendingUp size={140} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Liquidación Final */}
                                    <div className="mt-12 bg-emerald-500 rounded-[32px] p-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-premium group overflow-hidden relative">
                                        <div className="relative z-10 flex items-center gap-6 text-white">
                                            <div className="w-16 h-16 bg-white/20 rounded-[24px] flex items-center justify-center border border-white/10 backdrop-blur-md group-hover:rotate-12 transition-transform">
                                                <TrendingUp size={32} />
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-black uppercase tracking-[3px] opacity-60">Balance Operativo Final</span>
                                                <span className="block text-xl font-black tracking-tighter mt-1">Total Ingresos Liquidados</span>
                                            </div>
                                        </div>
                                        <div className="relative z-10 text-center md:text-right">
                                            <span className="text-4xl font-black text-white tracking-tighter leading-none">
                                                ${stats.totalIncome.toLocaleString('es-CO')}
                                            </span>
                                            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Pesos Colombianos (COP)</p>
                                        </div>
                                        {/* Decorative circle */}
                                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══ SUB-MÓDULOS ═════════════════════════════════════════════ */}
                {activeSubTab === 'invoicing'     && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
                        <ElectronicInvoicing />
                    </div>
                )}
                {activeSubTab === 'config'        && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
                        <TenantAccountingConfig />
                    </div>
                )}
                {activeSubTab === 'third_parties' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
                        <ThirdPartiesDirectory />
                    </div>
                )}
                {activeSubTab === 'payroll'       && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
                        <Payroll />
                    </div>
                )}
                {activeSubTab === 'reports'       && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
                        <LegalReports />
                    </div>
                )}

            </div>
        </div>
    );
};

export default AccountingModule;
