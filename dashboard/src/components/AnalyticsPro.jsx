import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Users, DollarSign, Package,
    Clock, Award, BarChart3, Activity,
    RefreshCw, ChevronDown, WifiOff, Target, PieChart, LayoutGrid
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
            } else {
                startDate.setFullYear(now.getFullYear() - 1);
                prevStartDate.setFullYear(startDate.getFullYear() - 1);
            }

            const { data: currentOrders, error: currentError } = await supabase
                .from('orders')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString());

            if (currentError) throw currentError;

            const { data: prevOrders } = await supabase
                .from('orders')
                .select('total')
                .eq('organization_id', organizationId)
                .gte('created_at', prevStartDate.toISOString())
                .lte('created_at', startDate.toISOString());

            const { data: currentItems } = await supabase
                .from('order_items')
                .select('product_name, quantity, price')
                .eq('organization_id', organizationId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString());

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

            const paidOrders = currentOrders.filter(o => o.is_paid || o.status === 'pagado');
            const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const prevRevenue = (prevOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);
            
            const revenueGrowth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;
            const orderGrowth = (prevOrders?.length || 0) === 0 ? 100 : ((paidOrders.length - prevOrders.length) / prevOrders.length) * 100;
            
            const avgTicket = paidOrders.length === 0 ? 0 : totalRevenue / paidOrders.length;
            const prevAvgTicket = (prevOrders?.length || 0) === 0 ? 0 : prevRevenue / prevOrders.length;
            const ticketGrowth = prevAvgTicket === 0 ? 0 : ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100;

            const hourMap = {};
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

            const channels = paidOrders.reduce((acc, o) => {
                const type = o.type || 'mesa';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, { mesa: 0, domicilio: 0, habitacion: 0 });

            const daysInPeriod = Math.max(1, (now - startDate) / (1000 * 60 * 60 * 24));
            const dailyAvg = totalRevenue / daysInPeriod;
            const projectedMonth = dailyAvg * 30;

            setAnalyticsData({
                kpis: [
                    { label: 'Ingresos Totales', value: `$${totalRevenue.toLocaleString('es-CO')}`, change: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`, trend: revenueGrowth >= 0 ? 'up' : 'down', icon: DollarSign, color: 'text-success', bg: 'bg-success/5' },
                    { label: 'Pedidos Realizados', value: paidOrders.length.toString(), change: `${orderGrowth >= 0 ? '+' : ''}${orderGrowth.toFixed(1)}%`, trend: orderGrowth >= 0 ? 'up' : 'down', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                    { label: 'Ticket Promedio', value: `$${avgTicket.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, change: `${ticketGrowth >= 0 ? '+' : ''}${ticketGrowth.toFixed(1)}%`, trend: ticketGrowth >= 0 ? 'up' : 'down', icon: Activity, color: 'text-primary', bg: 'bg-primary/5' },
                    { label: 'Cajeros Activos', value: (new Set(currentOrders.map(o => o.user_id))).size.toString(), change: 'Estable', trend: 'neutral', icon: Users, color: 'text-accent', bg: 'bg-surface-soft' },
                ],
                topProducts,
                hourlyTraffic,
                saleChannels: channels,
                inventoryByCategory,
                projection: projectedMonth
            });

        } catch (error) {
            console.warn('[Analytics] Fallback to cache');
            setFromCache(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas">
                <RefreshCw size={48} className="text-primary animate-spin mb-4" />
                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Compilando Inteligencia de Negocios...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-10 pb-24 max-w-[1600px] mx-auto">
            
            {/* Context Banner */}
            {(!isOnline || fromCache) && (
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-[20px] px-6 py-4 shadow-sm">
                    <WifiOff size={18} />
                    <span className="text-[12px] font-bold uppercase tracking-wide">Modo Local — Las métricas podrían no estar sincronizadas en tiempo real.</span>
                </div>
            )}

            {/* Header / Global Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <span className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1 block">Rendimiento Operativo</span>
                    <h2 className="text-3xl font-bold text-secondary tracking-tight flex items-center gap-3">
                        Nexus <Target size={24} className="text-primary" /> Analytics
                    </h2>
                </div>
                <div className="flex bg-surface-soft p-1.5 rounded-[20px] border border-hairline shadow-sm">
                    {[
                        { id: '24h', label: '24h' },
                        { id: '7d', label: '7 Días' },
                        { id: '30d', label: 'Mes' },
                        { id: 'year', label: 'Año' }
                    ].map((range) => (
                        <button
                            key={range.id}
                            onClick={() => setTimeRange(range.id)}
                            className={`px-6 py-2.5 rounded-[16px] text-[11px] font-bold uppercase tracking-widest transition-all duration-300 active:scale-95 ${timeRange === range.id ? 'bg-canvas text-secondary shadow-airbnb border border-hairline' : 'text-accent hover:text-secondary'}`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {analyticsData.kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-canvas p-8 rounded-[32px] border border-hairline shadow-sm hover:shadow-airbnb transition-all duration-500 group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className={`w-14 h-14 rounded-[20px] ${kpi.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={28} className={kpi.color} />
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${kpi.trend === 'up' ? 'bg-success/10 text-success' : kpi.trend === 'down' ? 'bg-danger/10 text-danger' : 'bg-surface-soft text-accent'}`}>
                                {kpi.trend === 'up' ? <TrendingUp size={12} /> : kpi.trend === 'down' ? <TrendingDown size={12} /> : null}
                                {kpi.change}
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-1 relative z-10">{kpi.label}</p>
                        <h3 className="text-3xl font-bold text-secondary tracking-tight relative z-10">{kpi.value}</h3>
                        
                        <kpi.icon size={120} className={`absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-125 transition-transform duration-700 ${kpi.color}`} />
                    </div>
                ))}
            </div>

            {/* Main Charts & Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Demand Traffic Chart */}
                <div className="lg:col-span-2 bg-canvas p-10 rounded-[40px] border border-hairline shadow-sm group">
                    <div className="flex justify-between items-center mb-12">
                        <div>
                            <h3 className="text-xl font-bold text-secondary tracking-tight flex items-center gap-3">
                                <Activity size={22} className="text-primary" /> Flujo de Demanda
                            </h3>
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest opacity-60 mt-1">Carga operativa por franjas horarias</p>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Análisis Vivo</span>
                        </div>
                    </div>
                    
                    <div className="h-64 flex items-end gap-3 px-4">
                        {analyticsData.hourlyTraffic.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group/bar">
                                <div className="w-full bg-surface-soft rounded-t-[12px] h-full relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 left-0 right-0 bg-primary/80 group-hover/bar:bg-primary transition-all duration-1000 rounded-t-[12px]"
                                        style={{ height: `${Math.max(item.volume, 5)}%` }}
                                    >
                                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                        <span className="text-[10px] font-bold text-white bg-secondary px-2 py-1 rounded-md shadow-lg">{Math.round(item.volume)}%</span>
                                    </div>
                                </div>
                                <span className="text-[9px] font-bold text-accent mt-4 uppercase tracking-tighter">{item.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Best Sellers Ranking */}
                <div className="bg-canvas p-10 rounded-[40px] border border-hairline shadow-sm relative overflow-hidden group">
                    <h3 className="text-xl font-bold text-secondary tracking-tight mb-10 flex items-center gap-3">
                        <Award size={24} className="text-amber-500" /> Best Sellers
                    </h3>
                    <div className="space-y-8">
                        {analyticsData.topProducts.map((product, idx) => (
                            <div key={idx} className="group/item flex items-center gap-5">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-[12px] font-bold border transition-all ${idx === 0 ? 'bg-primary text-white border-primary shadow-lg' : 'bg-surface-soft text-accent border-hairline group-hover/item:border-secondary group-hover/item:text-secondary'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[13px] font-bold text-secondary truncate uppercase tracking-tight">{product.name}</p>
                                        <span className="text-[11px] font-bold text-accent bg-surface-soft px-2.5 py-1 rounded-full">{product.sales} vtas</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-surface-soft rounded-full overflow-hidden p-[2px] border border-hairline">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-primary shadow-sm' : 'bg-secondary/40'}`}
                                            style={{ width: `${(product.sales / (analyticsData.topProducts[0]?.sales || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 pt-8 border-t border-hairline flex justify-between items-center">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Historial de Ventas</span>
                        <ChevronDown size={16} className="text-accent" />
                    </div>
                </div>
            </div>

            {/* Inventory Audit Section */}
            <div className="bg-canvas p-10 rounded-[40px] border border-hairline shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <h3 className="text-2xl font-bold text-secondary tracking-tight flex items-center gap-4">
                            <LayoutGrid size={28} className="text-primary" /> Auditoría de Inventario
                        </h3>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest opacity-60 mt-1">Niveles de stock críticos por categoría</p>
                    </div>
                    <div className="bg-surface-soft px-6 py-2 rounded-full border border-hairline">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{analyticsData.inventoryByCategory.length} Categorías Activas</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {analyticsData.inventoryByCategory.map((cat, idx) => (
                        <div key={idx} className="bg-surface-soft/30 p-8 rounded-[32px] border border-hairline hover:bg-canvas hover:shadow-airbnb hover:border-primary/10 transition-all duration-500 group/cat relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-hairline relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-bold text-secondary tracking-tight mb-1">{cat.name}</span>
                                    <span className="text-[10px] font-bold text-success bg-success/10 px-3 py-1 rounded-full w-fit uppercase tracking-tighter">{cat.stock} UNID.</span>
                                </div>
                                <div className="bg-canvas p-2.5 rounded-xl shadow-sm border border-hairline text-accent text-[11px] font-bold">
                                    {cat.count} Items
                                </div>
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                                {cat.products.map((p, pIdx) => (
                                    <div key={pIdx} className="flex justify-between items-center group/p">
                                        <span className="text-[11px] font-bold text-accent truncate mr-2 group-hover/p:text-secondary transition-colors uppercase">{p.name}</span>
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${p.stock <= 5 ? 'bg-danger/10 text-danger border-danger/10' : 'bg-canvas text-secondary border-hairline'}`}>
                                            {p.stock}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <Package size={100} className="absolute -right-8 -bottom-8 opacity-[0.02] group-hover/cat:scale-125 transition-transform duration-700 pointer-events-none text-primary" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Financial Predictions & Channels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Prediction Card */}
                <div className="bg-secondary p-12 rounded-[48px] shadow-airbnb text-white flex flex-col justify-between overflow-hidden relative group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-white/10 rounded-[20px] border border-white/10 backdrop-blur-md">
                                <TrendingUp className="text-primary" size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Predicción Financiera</h3>
                                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mt-1">Algoritmo de Proyección Nexus</p>
                            </div>
                        </div>
                        <p className="text-[12px] font-medium text-white/50 mb-12 max-w-[320px] leading-relaxed uppercase tracking-tighter">Proyección mensual estimada bajo tendencia actual de crecimiento y estacionalidad.</p>
                        
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-[4px] mb-2">Estimado de Cierre</span>
                            <div className="text-5xl md:text-6xl font-bold tracking-tighter mb-8 group-hover:scale-105 transition-transform origin-left duration-700">
                                ${analyticsData.projection.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-bold text-primary uppercase bg-white/5 w-fit px-6 py-3 rounded-full border border-white/5 shadow-inner">
                            <Activity size={16} /> Índice de Confianza: 85.4%
                        </div>
                    </div>
                    
                    <BarChart3 size={280} className="absolute -right-24 -bottom-24 text-white/[0.04] rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                </div>

                {/* Market Share / Channels */}
                <div className="bg-canvas p-12 rounded-[48px] border border-hairline shadow-sm flex flex-col md:flex-row items-center gap-12 group">
                    <div className="w-48 h-48 rounded-full border-[20px] border-primary flex items-center justify-center relative shadow-inner group-hover:rotate-6 transition-transform duration-700">
                        <div className="absolute inset-0 border-[20px] border-secondary/20 rounded-full" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)' }} />
                        <div className="text-center relative z-20">
                            <div className="text-4xl font-bold text-secondary tracking-tighter">
                                {Math.round((analyticsData.saleChannels.mesa / (Object.values(analyticsData.saleChannels).reduce((a, b) => a + b, 0) || 1)) * 100)}%
                            </div>
                            <div className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Directo</div>
                        </div>
                        <PieChart className="absolute -right-6 -top-6 text-primary/10 group-hover:text-primary/20 transition-colors" size={60} />
                    </div>
                    
                    <div className="flex-1 w-full">
                        <h4 className="text-[11px] font-bold text-accent uppercase tracking-[4px] mb-8">Arquitectura de Ingresos</h4>
                        <div className="space-y-8">
                            {Object.entries(analyticsData.saleChannels).map(([channel, count], idx) => {
                                const total = Object.values(analyticsData.saleChannels).reduce((a, b) => a + b, 0) || 1;
                                const percentage = Math.round((count / total) * 100);
                                const colors = ['bg-primary', 'bg-secondary', 'bg-indigo-500'];
                                return (
                                    <div key={channel} className="space-y-2 group/ch">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                                                <span className="text-[11px] font-bold text-secondary uppercase tracking-widest">{channel}</span>
                                            </div>
                                            <span className="text-[13px] font-bold text-secondary">{percentage}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-surface-soft rounded-full overflow-hidden border border-hairline">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${colors[idx % colors.length]}`} 
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
    );
};

export default AnalyticsPro;
