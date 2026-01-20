import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Settings, Wallet, LayoutGrid, Filter, Calendar, MapPin, Home, TrendingUp, Clock, DollarSign, Package, ChevronLeft, ChevronRight, X, Eye, EyeOff } from 'lucide-react';
import OrderCard from './OrderCard';
import MenuManagement from './MenuManagement';
import ShiftManagement from './ShiftManagement';

const RestaurantManagement = ({ orders, onStatusChange, onEdit, onDelete, onPrint }) => {
    const [activeSubTab, setActiveSubTab] = useState('board');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        date: 'today'
    });
    const [showPaidTotal, setShowPaidTotal] = useState(false);

    const subMenuItems = [
        { id: 'board', label: 'Monitor de Pedidos', icon: LayoutGrid, description: 'Vista de pedidos en tiempo real' },
        { id: 'menu', label: 'Gestión de Carta', icon: Settings, description: 'Administrar productos y menú' },
        { id: 'turnos', label: 'Cajas y Turnos', icon: Wallet, description: 'Control de turnos y caja' },
    ];

    // Filtrar pedidos según los filtros activos
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // Filtro por estado
            if (filters.status !== 'all' && order.status !== filters.status) return false;

            // Filtro por tipo
            if (filters.type !== 'all' && order.type !== filters.type) return false;

            // Filtro por fecha (simplificado para demo)
            if (filters.date === 'today') {
                const today = new Date().toDateString();
                const orderDate = new Date(order.created_at).toDateString();
                if (today !== orderDate) return false;
            }

            return true;
        });
    }, [orders, filters]);

    // Calcular estadísticas en tiempo real
    const stats = useMemo(() => {
        const activeOrders = orders.filter(o => o.status !== 'pagado' && o.status !== 'cancelado');
        const todayOrders = orders.filter(o => {
            const today = new Date().toDateString();
            const orderDate = new Date(o.created_at).toDateString();
            return today === orderDate;
        });
        const todayRevenue = todayOrders
            .filter(o => o.status === 'pagado')
            .reduce((sum, o) => sum + (o.total_price || 0), 0);

        const preparationTimes = orders
            .filter(o => o.preparation_time_seconds)
            .map(o => o.preparation_time_seconds);
        const avgPrepTime = preparationTimes.length > 0
            ? Math.round(preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length / 60)
            : 0;

        return {
            activeOrders: activeOrders.length,
            todayOrders: todayOrders.length,
            todayRevenue,
            avgPrepTime
        };
    }, [orders]);

    return (
        <div className="flex-1 flex overflow-hidden bg-gray-50/50">
            {/* Sidebar Izquierdo */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarCollapsed ? '80px' : '320px' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="bg-white border-r border-gray-200 shadow-lg flex flex-col overflow-hidden relative"
            >
                {/* Toggle Collapse Button */}
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-3 top-6 z-10 w-6 h-6 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-secondary/90 transition-colors"
                >
                    {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Header del Sidebar */}
                <div className="p-6 border-b border-gray-200">
                    <motion.div
                        animate={{ opacity: isSidebarCollapsed ? 0 : 1 }}
                        className="flex items-center gap-3"
                    >
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Utensils size={20} className="text-primary" />
                        </div>
                        {!isSidebarCollapsed && (
                            <div>
                                <h3 className="text-sm font-black text-secondary">Restaurante</h3>
                                <p className="text-[10px] text-gray-500">Gestión Operativa</p>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Navegación Principal */}
                <nav className="p-4 space-y-2 border-b border-gray-200">
                    {subMenuItems.map((item) => (
                        <motion.button
                            key={item.id}
                            onClick={() => setActiveSubTab(item.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeSubTab === item.id
                                ? 'bg-secondary text-white shadow-lg'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <item.icon size={20} className="shrink-0" />
                            {!isSidebarCollapsed && (
                                <div className="flex-1 text-left">
                                    <p className="text-xs font-bold">{item.label}</p>
                                    <p className={`text-[9px] ${activeSubTab === item.id ? 'text-white/70' : 'text-gray-400'}`}>
                                        {item.description}
                                    </p>
                                </div>
                            )}
                        </motion.button>
                    ))}
                </nav>

                {/* Filtros - Solo visible en la vista de pedidos */}
                {activeSubTab === 'board' && !isSidebarCollapsed && (
                    <div className="p-4 border-b border-gray-200 space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter size={14} className="text-secondary" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Filtros</h4>
                        </div>

                        {/* Filtro por Estado */}
                        <div>
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Estado</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20 bg-gray-50"
                            >
                                <option value="all">Todos</option>
                                <option value="nuevo">Nuevos</option>
                                <option value="fabricacion">En Fabricación</option>
                                <option value="despachado">Despachados</option>
                                <option value="pagado">Pagados</option>
                            </select>
                        </div>

                        {/* Filtro por Tipo */}
                        <div>
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Tipo</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setFilters({ ...filters, type: 'all' })}
                                    className={`p-2 rounded-lg text-[10px] font-bold transition-all ${filters.type === 'all'
                                        ? 'bg-secondary text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, type: 'mesa' })}
                                    className={`p-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${filters.type === 'mesa'
                                        ? 'bg-secondary text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Utensils size={12} />
                                    Mesa
                                </button>
                            </div>
                            <button
                                onClick={() => setFilters({ ...filters, type: 'domicilio' })}
                                className={`w-full mt-2 p-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${filters.type === 'domicilio'
                                    ? 'bg-secondary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Home size={12} />
                                Domicilio
                            </button>
                        </div>

                        {/* Limpiar Filtros */}
                        {(filters.status !== 'all' || filters.type !== 'all') && (
                            <button
                                onClick={() => setFilters({ status: 'all', type: 'all', date: 'today' })}
                                className="w-full p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
                            >
                                <X size={12} />
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                )}

                {/* Estadísticas en Tiempo Real */}
                {!isSidebarCollapsed && (
                    <div className="p-4 flex-1 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={14} className="text-secondary" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Estadísticas</h4>
                        </div>

                        <div className="space-y-3">
                            {/* Pedidos Activos */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Package size={14} className="text-blue-600" />
                                    <span className="text-[9px] font-bold text-blue-600 uppercase">Pedidos Activos</span>
                                </div>
                                <p className="text-2xl font-black text-blue-700">{stats.activeOrders}</p>
                            </div>

                            {/* Ventas del Día */}
                            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <DollarSign size={14} className="text-green-600" />
                                    <span className="text-[9px] font-bold text-green-600 uppercase">Ventas Hoy</span>
                                </div>
                                <p className="text-2xl font-black text-green-700">
                                    ${stats.todayRevenue.toLocaleString()}
                                </p>
                                <p className="text-[9px] text-green-600 mt-1">{stats.todayOrders} pedidos</p>
                            </div>

                            {/* Tiempo Promedio */}
                            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock size={14} className="text-orange-600" />
                                    <span className="text-[9px] font-bold text-orange-600 uppercase">Tiempo Promedio</span>
                                </div>
                                <p className="text-2xl font-black text-orange-700">{stats.avgPrepTime} min</p>
                            </div>
                        </div>
                    </div>
                )}
            </motion.aside>

            {/* Contenido Principal */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeSubTab === 'board' && (
                        <motion.div
                            key="board"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full p-8 overflow-x-auto"
                        >
                            <div className="flex gap-6 h-full min-w-[1200px]">
                                {['nuevo', 'fabricacion', 'despachado', 'pagado'].map((status) => (
                                    <div key={status} className="flex-1 flex flex-col bg-gray-200/40 rounded-3xl p-4 border border-gray-300/20">
                                        <h2 className="uppercase text-[10px] font-black tracking-[0.2em] text-secondary/60 mb-5 px-2 flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${status === 'nuevo' ? 'bg-blue-500' : status === 'fabricacion' ? 'bg-warning' : status === 'despachado' ? 'bg-purple-500' : 'bg-success'}`} />
                                            {status}
                                            <span className="bg-white text-secondary px-2 py-0.5 rounded-md text-[10px] font-black shadow-sm border border-gray-100/50 ml-auto">
                                                {filteredOrders.filter(o => o.status === status).length}
                                            </span>
                                        </h2>
                                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                                            {(() => {
                                                const ordersInStatus = filteredOrders
                                                    .filter(o => o.status === status)
                                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                                                const isCompactView = ordersInStatus.length > 2;

                                                return ordersInStatus.map(order => (
                                                    <OrderCard
                                                        key={order.id}
                                                        order={order}
                                                        onStatusChange={onStatusChange}
                                                        onEdit={onEdit}
                                                        onDelete={onDelete}
                                                        onPrint={onPrint}
                                                        isCompact={isCompactView}
                                                    />
                                                ));
                                            })()}
                                        </div>
                                        {status === 'pagado' && (
                                            <div
                                                onClick={() => setShowPaidTotal(!showPaidTotal)}
                                                className="mt-4 pt-3 border-t border-gray-300/20 bg-white/50 rounded-xl p-3 flex justify-between items-center group cursor-pointer hover:bg-white transition-all shadow-sm"
                                            >
                                                <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Total Pagado</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-success text-sm">
                                                        {showPaidTotal
                                                            ? `$${filteredOrders.filter(o => o.status === 'pagado').reduce((sum, o) => sum + (o.total_price || 0), 0).toLocaleString()}`
                                                            : '••••••'}
                                                    </span>
                                                    {showPaidTotal ? <EyeOff size={14} className="text-gray-400 group-hover:text-secondary" /> : <Eye size={14} className="text-gray-400 group-hover:text-secondary" />}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeSubTab === 'menu' && (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full overflow-y-auto"
                        >
                            <MenuManagement />
                        </motion.div>
                    )}

                    {activeSubTab === 'turnos' && (
                        <motion.div
                            key="turnos"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full overflow-y-auto"
                        >
                            <ShiftManagement orders={orders} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default RestaurantManagement;
