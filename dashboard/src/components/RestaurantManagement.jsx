import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Settings, Wallet, LayoutGrid, Filter, Calendar, MapPin, Home, TrendingUp, Clock, DollarSign, Package, ChevronLeft, ChevronRight, X, Eye, EyeOff, Truck } from 'lucide-react';
import OrderCard from './OrderCard';
import MenuManagement from './MenuManagement';
import ShiftManagement from './ShiftManagement';

import { useAuth } from '../context/AuthContext';

const RestaurantManagement = ({
    orders,
    onStatusChange,
    onEdit,
    onDelete,
    onPrint,
    autoAdvance,
    onToggleAutoAdvance,
    activeSubTab: propActiveSubTab,
    setActiveSubTab: propSetActiveSubTab
}) => {
    const { user } = useAuth();
    // Usar estado local solo si no se proveen props (fallback)
    const [localActiveSubTab, setLocalActiveSubTab] = useState(user?.role === 'cajero' ? 'turnos' : 'board');

    const activeSubTab = propActiveSubTab || localActiveSubTab;
    const setActiveSubTab = propSetActiveSubTab || setLocalActiveSubTab;
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // DEBUG: Confirmar qué llega realmente
    console.log('RestMan received orders:', orders.length);

    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        date: 'all' // Default to all to show orders regardless of timezone issues
    });
    const [showPaidTotal, setShowPaidTotal] = useState(false);
    const [shouldAutoOpenShift, setShouldAutoOpenShift] = useState(false);

    React.useEffect(() => {
        const handleOpenShiftModal = () => {
            setActiveSubTab('turnos');
            setShouldAutoOpenShift(true);
            // Reset after a delay to allow consuming the prop
            setTimeout(() => setShouldAutoOpenShift(false), 2000);
        };
        window.addEventListener('open-shift-modal', handleOpenShiftModal);
        return () => window.removeEventListener('open-shift-modal', handleOpenShiftModal);
    }, []);

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
            .filter(o => o.status === 'pagado' || o.is_paid)
            .reduce((sum, o) => sum + (o.total || o.total_price || 0), 0);

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
            {/* Sidebar Izquierdo ELIMINADO - Ahora controlado por Sidebar Principal */}

            {/* Filtros Flotantes / Barra Superior (Opcional, si queremos mantener filtros) */}
            {activeSubTab === 'board' && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    {/* Aquí podríamos poner botones de filtro compactos o un dropdown */}
                </div>
            )}

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

                                                // Lógica Especial para Fabricación (Dividir Mesa vs Domicilio)
                                                if (status === 'fabricacion') {
                                                    const mesaOrders = ordersInStatus.filter(o => o.table_number && o.table_number !== 'DOMICILIO');
                                                    const domicilioOrders = ordersInStatus.filter(o => !o.table_number || o.table_number === 'DOMICILIO');

                                                    return (
                                                        <div className="flex h-full gap-2">
                                                            {/* Columna Izquierda: Mesas */}
                                                            <div className="flex-1 flex flex-col bg-white/40 rounded-xl p-2 min-w-[200px]">
                                                                <div className="flex items-center gap-1 mb-2 text-[9px] font-black text-secondary/70 uppercase tracking-wider pb-1 border-b border-secondary/10">
                                                                    <Utensils size={10} /> Mesas
                                                                </div>
                                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                                    {mesaOrders.map(order => (
                                                                        <OrderCard
                                                                            key={order.id}
                                                                            order={order}
                                                                            onStatusChange={onStatusChange}
                                                                            onEdit={onEdit}
                                                                            onDelete={onDelete}
                                                                            onPrint={onPrint}
                                                                        />
                                                                    ))}
                                                                    {mesaOrders.length === 0 && <div className="text-[9px] text-gray-400 text-center py-4">Sin pedidos</div>}
                                                                </div>
                                                            </div>

                                                            {/* Divisor Vertical */}
                                                            <div className="w-px bg-secondary/10 my-2"></div>

                                                            {/* Columna Derecha: Domicilios */}
                                                            <div className="flex-1 flex flex-col bg-white/40 rounded-xl p-2 min-w-[200px]">
                                                                <div className="flex items-center gap-1 mb-2 text-[9px] font-black text-secondary/70 uppercase tracking-wider pb-1 border-b border-secondary/10">
                                                                    <Truck size={10} /> Domicilios
                                                                </div>
                                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                                    {domicilioOrders.map(order => (
                                                                        <OrderCard
                                                                            key={order.id}
                                                                            order={order}
                                                                            onStatusChange={onStatusChange}
                                                                            onEdit={onEdit}
                                                                            onDelete={onDelete}
                                                                            onPrint={onPrint}
                                                                        />
                                                                    ))}
                                                                    {domicilioOrders.length === 0 && <div className="text-[9px] text-gray-400 text-center py-4">Sin domicilios</div>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Vista Normal para otros estados
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
                                                        isMinimal={status === 'pagado'}
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
                                                            ? `$${filteredOrders.filter(o => o.status === 'pagado').reduce((sum, o) => sum + (o.total || o.total_price || 0), 0).toLocaleString()}`
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
                            <ShiftManagement orders={orders} onPrint={onPrint} autoOpen={shouldAutoOpenShift} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default RestaurantManagement;
