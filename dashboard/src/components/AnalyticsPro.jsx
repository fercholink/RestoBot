import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Users, DollarSign, Package,
    Clock, Award, Calendar, BarChart3, PieChart, Activity,
    RefreshCw, ChevronDown, WifiOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { useOfflineSync } from '../hooks/useOfflineSync';

const AnalyticsPro = () => {
    const { user } = useAuth();
    const { isOnline } = useOfflineSync();
    const organizationId = user?.organization_id;
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [fromCache, setFromCache] = useState(false);
    const [analyticsData, setAnalyticsData] = useState({
        kpis: [],
        topProducts: [],
        hourlyTraffic: [],
        saleChannels: { mesa: 0, domicilio: 0, habitacion: 0 },
        inventoryByCategory: [],
        projection: 0
    });

    useEffect(() => {
        if (organizationId) fetchAnalytics();

        // 🟢 Realtime Subscription for Live Updates
        const productChannel = supabase
            .channel(`realtime-analytics-${organizationId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'products', 
                filter: `organization_id=eq.${organizationId}` 
            }, () => fetchAnalytics())
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders', 
                filter: `organization_id=eq.${organizationId}` 
            }, () => fetchAnalytics())
            .subscribe();

        return () => {
            supabase.removeChannel(productChannel);
        };
    }, [timeRange, organizationId]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate = new Date();
            let prevStartDate = new Date();

            if (timeRange === '24h') {
                startDate.setHours(now.getHours() - 24);
                prevStartDate.setHours(startDate.getHours() - 24);
            } else if (timeRange === '7d') {
                startDate.setDate(now.getDate() - 7);
                prevStartDate.setDate(startDate.getDate() - 7);
            } else if (timeRange === '30d') {
                startDate.setDate(now.getDate() - 30);
                prevStartDate.setDate(startDate.getDate() - 30);
            } else { // Año
                startDate.setFullYear(now.getFullYear() - 1);
                prevStartDate.setFullYear(startDate.getFullYear() - 1);
            }

            // 1. Fetch current period orders
            const { data: currentOrders, error: currentError } = await supabase
                .from('orders')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString());

            if (currentError) throw currentError;

            // 2. Fetch previous period orders (for growth calculation)
            const { data: prevOrders } = await supabase
                .from('orders')
                .select('total')
                .eq('organization_id', organizationId)
                .gte('created_at', prevStartDate.toISOString())
                .lte('created_at', startDate.toISOString());

            // 3. Fetch current period items (for top products)
            const { data: currentItems } = await supabase
                .from('order_items')
                .select('product_name, quantity, price')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString());

            // 4. Fetch Inventory Categories and all Products
            const { data: cats } = await supabase
                .from('categories')
                .select('id, name')
                .eq('organization_id', organizationId);
            
            const { data: allProds } = await supabase
                .from('products')
                .select('name, category_id, stock')
                .eq('organization_id', organizationId);

            const inventoryByCategory = (cats || []).map(cat => {
                const prodsInCat = (allProds || []).filter(p => p.category_id === cat.id);
                const totalStock = prodsInCat.reduce((sum, p) => sum + (p.stock || 0), 0);
                return {
                    name: cat.name,
                    count: prodsInCat.length,
                    stock: totalStock,
                    products: prodsInCat
                };
            }).filter(item => item.count > 0).sort((a, b) => b.stock - a.stock);

            // --- PROCESS DATA ---
            const paidOrders = currentOrders.filter(o => o.is_paid || o.status === 'pagado');
            const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const prevRevenue = (prevOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);
            
            const revenueGrowth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;
            const orderGrowth = (prevOrders?.length || 0) === 0 ? 100 : ((paidOrders.length - prevOrders.length) / prevOrders.length) * 100;
            
            // Ticket Promedio
            const avgTicket = paidOrders.length === 0 ? 0 : totalRevenue / paidOrders.length;
            const prevAvgTicket = (prevOrders?.length || 0) === 0 ? 0 : prevRevenue / prevOrders.length;
            const ticketGrowth = prevAvgTicket === 0 ? 0 : ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100;

            // Hourly Traffic (Heatmap)
            const hourMap = {};
            // Initialize hours
            [11, 12, 13, 14, 18, 19, 20, 21, 22].forEach(h => {
                const label = h > 12 ? `${h-12}pm` : h === 12 ? '12pm' : `${h}am`;
                hourMap[label] = 0;
            });

            currentOrders.forEach(o => {
                const hour = new Date(o.created_at).getHours();
                const label = hour > 12 ? `${hour-12}pm` : hour === 12 ? '12pm' : `${hour}am`;
                if (hourMap[label] !== undefined) hourMap[label]++;
            });
            
            const maxTraffic = Math.max(...Object.values(hourMap), 1);
            const hourlyTraffic = Object.entries(hourMap).map(([hour, count]) => ({
                hour,
                volume: (count / maxTraffic) * 100
            }));

            // Top Products
            const productMap = {};
            (currentItems || []).forEach(item => {
                if (!productMap[item.product_name]) productMap[item.product_name] = { sales: 0, revenue: 0 };
                productMap[item.product_name].sales += item.quantity;
                productMap[item.product_name].revenue += (item.quantity * item.price);
            });

            const topProducts = Object.entries(productMap)
                .map(([name, data]) => ({ name, sales: data.sales, revenue: data.revenue }))
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 5);

            // Sale Channels
            const channels = paidOrders.reduce((acc, o) => {
                const type = o.type || 'mesa';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, { mesa: 0, domicilio: 0, habitacion: 0 });

            // Projection (Simplified: monthly estimate based on daily avg of selected period)
            const daysInPeriod = Math.max(1, (now - startDate) / (1000 * 60 * 60 * 24));
            const dailyAvg = totalRevenue / daysInPeriod;
            const projectedMonth = dailyAvg * 30;

            setAnalyticsData({
                kpis: [
                    { label: 'Ingresos Totales', value: `$${totalRevenue.toLocaleString('es-CO')}`, change: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`, trend: revenueGrowth >= 0 ? 'up' : 'down', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Pedidos Realizados', value: paidOrders.length.toString(), change: `${orderGrowth >= 0 ? '+' : ''}${orderGrowth.toFixed(1)}%`, trend: orderGrowth >= 0 ? 'up' : 'down', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Ticket Promedio', value: `$${avgTicket.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, change: `${ticketGrowth >= 0 ? '+' : ''}${ticketGrowth.toFixed(1)}%`, trend: ticketGrowth >= 0 ? 'up' : 'down', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
                    { label: 'Cajeros Activos', value: (new Set(currentOrders.map(o => o.user_id))).size.toString(), change: 'Estable', trend: 'neutral', icon: Users, color: 'text-amber-500', bg: 'bg-amber-50' },
                ],
                topProducts,
                hourlyTraffic,
                saleChannels: channels,
                inventoryByCategory,
                projection: projectedMonth
            });

        } catch (error) {
            console.warn('[Analytics] Fallo red, leyendo caché local:', error.message);
            // Fallback offline: calcular KPIs desde IndexedDB
            try {
                const localOrders = organizationId
                    ? await db.orders.where('organization_id').equals(organizationId).toArray()
                    : await db.orders.toArray();
                const localProds  = organizationId
                    ? await db.products.where('organization_id').equals(organizationId).toArray()
                    : await db.products.toArray();
                const localCats   = organizationId
                    ? await db.categories.where('organization_id').equals(organizationId).toArray()
                    : await db.categories.toArray();

                const paid = localOrders.filter(o => o.is_paid || o.status === 'pagado');
                const totalRevenue = paid.reduce((s, o) => s + (o.total || o.total_price || 0), 0);
                const avgTicket    = paid.length ? totalRevenue / paid.length : 0;

                const inventoryByCategory = localCats.map(cat => {
                    const prodsInCat = localProds.filter(p => p.category_id === cat.id);
                    return { name: cat.name, count: prodsInCat.length, stock: prodsInCat.reduce((s, p) => s + (p.stock || 0), 0), products: prodsInCat };
                }).filter(c => c.count > 0).sort((a, b) => b.stock - a.stock);

                const channels = paid.reduce((acc, o) => { const t = o.type || 'mesa'; acc[t] = (acc[t] || 0) + 1; return acc; }, { mesa: 0, domicilio: 0, habitacion: 0 });

                setFromCache(true);
                setAnalyticsData({
                    kpis: [
                        { label: 'Ingresos (caché)', value: `$${totalRevenue.toLocaleString('es-CO')}`, change: 'Sin conexión', trend: 'neutral', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { label: 'Pedidos (caché)',  value: paid.length.toString(),                     change: 'Sin conexión', trend: 'neutral', icon: Package,    color: 'text-blue-500',    bg: 'bg-blue-50' },
                        { label: 'Ticket Promedio',  value: `$${avgTicket.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, change: 'Sin conexión', trend: 'neutral', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
                        { label: 'Productos',        value: localProds.length.toString(),               change: 'Sin conexión', trend: 'neutral', icon: Users,      color: 'text-amber-500',   bg: 'bg-amber-50' },
                    ],
                    topProducts: [],
                    hourlyTraffic: [],
                    saleChannels: channels,
                    inventoryByCategory,
                    projection: 0,
                });
            } catch (dbErr) {
                console.error('[Analytics] También falló IndexedDB:', dbErr);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                <RefreshCw size={48} className="text-primary animate-spin mb-4" />
                <p className="text-sm font-black text-secondary tracking-widest uppercase">Procesando Inteligencia de Datos...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-50/50">
            {/* Banner modo offline */}
            {(!isOnline || fromCache) && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-5 py-3 mb-6 text-xs font-bold">
                    <WifiOff size={15} />
                    <span>Mostrando datos del caché local — conéctate para actualizar las métricas en tiempo real.</span>
                </div>
            )}
            {/* Header con Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-secondary tracking-tight">Smart Analytics</h2>
                    <p className="text-xs md:text-sm font-bold text-accent uppercase tracking-widest">Dashboards de Decisión Estratégica</p>
                </div>
                <div className="flex gap-1 md:gap-2 bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-inner overflow-x-auto max-w-full">
                    {[
                        { id: '24h', label: '24 Horas' },
                        { id: '7d', label: '7 Días' },
                        { id: '30d', label: 'Mes' },
                        { id: 'year', label: 'Año' }
                    ].map((range) => (
                        <button
                            key={range.id}
                            onClick={() => setTimeRange(range.id)}
                            className={`px-4 md:px-6 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${timeRange === range.id ? 'bg-secondary text-white shadow-lg scale-105' : 'text-accent hover:bg-white/50'}`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- SECCIÓN DE INVENTARIO (NUEVA: AL INICIO) --- */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm mb-8 overflow-hidden group">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg md:text-xl font-black text-secondary flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-500">
                            <Package size={24} />
                        </div>
                        Auditoría de Inventario por Categoría
                    </h3>
                    <div className="p-2 bg-gray-50 rounded-xl text-accent hidden md:block">
                        <span className="text-[10px] font-black uppercase tracking-widest">{analyticsData.inventoryByCategory.length} Categorías Activas</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {analyticsData.inventoryByCategory.length === 0 ? (
                        <div className="col-span-full py-10 text-center text-accent font-black uppercase text-xs tracking-widest bg-gray-50 rounded-3xl border border-dashed border-gray-200">Sin datos de catálogo</div>
                    ) : (
                        analyticsData.inventoryByCategory.map((cat, idx) => (
                            <div key={idx} className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 hover:bg-white hover:border-primary/20 hover:shadow-xl transition-all group/cat relative overflow-hidden">
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-secondary tracking-tight">{cat.name}</span>
                                        <span className="text-[9px] font-black font-mono text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full w-fit mt-1">{cat.stock} UNIDADES</span>
                                    </div>
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-accent text-[10px] font-black">
                                        {cat.count} Items
                                    </div>
                                </div>
                                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar relative z-10">
                                    {cat.products.map((p, pIdx) => (
                                        <div key={pIdx} className="flex justify-between items-center group/p">
                                            <span className="text-[10px] font-bold text-gray-500 truncate mr-2 group-hover/p:text-secondary group-hover/p:translate-x-0.5 transition-all">{p.name}</span>
                                            <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${p.stock <= 5 ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-secondary'}`}>
                                                {p.stock}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* Decoración sutil de fondo */}
                                <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover/cat:scale-125 transition-transform duration-700 pointer-events-none">
                                    <Package size={120} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                {analyticsData.kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                        <div className="flex justify-between items-start mb-2 md:mb-4 relative z-10">
                            <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${kpi.bg} group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={18} className={kpi.color} />
                            </div>
                            <div className={`flex items-center gap-0.5 md:gap-1 text-[8px] md:text-[10px] font-black px-2 py-1 rounded-full ${kpi.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : kpi.trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-accent'}`}>
                                {kpi.trend === 'up' ? <TrendingUp size={10} /> : kpi.trend === 'down' ? <TrendingDown size={10} /> : null}
                                {kpi.change}
                            </div>
                        </div>
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-accent mb-0.5 md:mb-1 truncate relative z-10">{kpi.label}</p>
                        <h3 className="text-lg md:text-2xl font-black text-secondary truncate relative z-10">{kpi.value}</h3>
                        
                        <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-700`}>
                            <kpi.icon size={100} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Gráfica de Tráfico por Hora */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative group">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <div>
                            <h3 className="text-md md:text-lg font-black text-secondary tracking-tight">Flujo de Demanda Operativa</h3>
                            <p className="text-[10px] md:text-xs font-bold text-accent uppercase tracking-widest italic opacity-60">Heatmap de carga por franjas horarias</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                            <Activity className="text-primary animate-pulse" size={14} />
                            <span className="text-[10px] font-black text-primary uppercase">Live Sync</span>
                        </div>
                    </div>
                    <div className="h-40 md:h-56 flex items-end gap-1.5 md:gap-3 px-1 md:px-4">
                        {analyticsData.hourlyTraffic.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group/bar">
                                <div
                                    className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t-xl transition-all duration-700 group-hover/bar:brightness-110 group-hover/bar:shadow-[0_-5px_15px_rgba(var(--primary-rgb),0.3)] relative"
                                    style={{ height: `${Math.max(item.volume, 5)}%` }}
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-secondary text-white text-[8px] font-black px-2 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 whitespace-nowrap z-10 shadow-xl border border-white/10">
                                        {Math.round(item.volume)}% Carga
                                    </div>
                                </div>
                                <span className="text-[7px] md:text-[9px] font-black text-accent mt-3 md:mt-4 uppercase tracking-tighter">{item.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking de Productos */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                    <h3 className="text-md md:text-lg font-black text-secondary mb-6 md:mb-8 flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                            <Award size={20} />
                        </div>
                        Best Sellers
                    </h3>
                    <div className="space-y-5 md:space-y-7">
                        {analyticsData.topProducts.length === 0 ? (
                            <p className="text-center py-20 text-gray-300 font-black uppercase text-[10px] tracking-widest">Sin datos de ventas</p>
                        ) : (
                            analyticsData.topProducts.map((product, idx) => (
                                <div key={idx} className="flex items-center gap-4 group/item cursor-pointer">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border transition-colors ${idx === 0 ? 'bg-primary text-white border-primary shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100 group-hover/item:border-secondary group-hover/item:text-secondary'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-end mb-1.5">
                                            <p className="text-[10px] font-black text-secondary uppercase tracking-tighter truncate group-hover/item:translate-x-1 transition-transform">{product.name}</p>
                                            <span className="text-[9px] font-black text-accent whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-full">{product.sales} vtas</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden p-[1px] border border-gray-100">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' : 'bg-secondary/40'}`}
                                                style={{ width: `${(product.sales / analyticsData.topProducts[0].sales) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center opacity-60">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Resumen de Ventas</span>
                        <ChevronDown size={14} className="text-gray-400" />
                    </div>
                </div>

                {/* Ranking de Inventario por Categoría */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                    <h3 className="text-md md:text-lg font-black text-secondary mb-6 md:mb-8 flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500">
                            <Package size={20} />
                        </div>
                        Distribución de Inventario
                    </h3>
                    <div className="space-y-5 md:space-y-7">
                        {analyticsData.inventoryByCategory.length === 0 ? (
                            <p className="text-center py-20 text-gray-300 font-black uppercase text-[10px] tracking-widest">Sin datos de inventario</p>
                        ) : (
                            analyticsData.inventoryByCategory.slice(0, 5).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 group/inv cursor-pointer">
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 group-hover/inv:border-primary/30 transition-all">
                                        <div className="text-[8px] font-black text-primary leading-none mb-1">STK</div>
                                        <div className="text-sm font-black text-secondary leading-none">{item.stock}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-end mb-1.5">
                                            <p className="text-[10px] font-black text-secondary uppercase tracking-tighter truncate">{item.name}</p>
                                            <span className="text-[9px] font-black text-accent whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-full">{item.count} Prods</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden p-[1px] border border-gray-100">
                                            <div
                                                className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                                                style={{ width: `${Math.min(100, (item.stock / 500) * 100)}%` }} // Base 500 units for scale
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center opacity-60">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Auditoría de Stock de Catálogo</span>
                    </div>
                </div>
            </div>

            {/* Proyecciones y Canales */}
            <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-secondary p-8 md:p-10 rounded-[2.5rem] shadow-premium text-white flex flex-col justify-between overflow-hidden relative min-h-[220px] group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-3 bg-white/10 rounded-2xl border border-white/5 backdrop-blur-md">
                                <TrendingUp className="text-primary" size={24} />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Predicción Financiera</h3>
                        </div>
                        <p className="text-xs font-semibold text-white/40 mb-10 max-w-[280px] leading-relaxed uppercase tracking-tighter">Proyección mensual estimada bajo tendencia actual de crecimiento.</p>
                        <div className="text-4xl md:text-5xl font-black tracking-tighter mb-4 group-hover:scale-105 transition-transform origin-left duration-700">
                            ${analyticsData.projection.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase bg-white/5 w-fit px-4 py-2 rounded-full border border-white/5 shadow-inner">
                            <Activity size={14} /> Est. Confianza 85%
                        </div>
                    </div>
                    {/* Background SVG Decoration */}
                    <BarChart3 size={240} className="absolute -right-20 -bottom-20 text-white/[0.04] rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-10 group">
                    <div className="w-40 h-40 rounded-full border-[15px] border-primary flex items-center justify-center relative shadow-inner group-hover:rotate-6 transition-transform duration-700">
                        {/* Fake pie chart using clip path */}
                        <div className="absolute inset-0 border-[15px] border-secondary/20 rounded-full" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)' }} />
                        <div className="text-center relative z-20">
                            <div className="text-3xl font-black text-secondary leading-none">
                                {Math.round((analyticsData.saleChannels.mesa / (Object.values(analyticsData.saleChannels).reduce((a, b) => a + b, 0) || 1)) * 100)}%
                            </div>
                            <div className="text-[9px] font-black text-accent uppercase tracking-widest mt-1">Directo</div>
                        </div>
                    </div>
                    <div className="flex-1 w-full space-y-6">
                        <div>
                            <h4 className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4">Arquitectura de Ingresos</h4>
                            <div className="space-y-4">
                                {Object.entries(analyticsData.saleChannels).map(([channel, count], idx) => {
                                    const total = Object.values(analyticsData.saleChannels).reduce((a, b) => a + b, 0) || 1;
                                    const percentage = Math.round((count / total) * 100);
                                    return (
                                        <div key={channel} className="space-y-1.5 group/ch">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-purple-500'}`} />
                                                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">{channel}</span>
                                                </div>
                                                <span className="text-xs font-black text-secondary">{percentage}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-purple-500'}`} 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPro;
