import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Settings, Wallet, LayoutGrid, Filter, Calendar, MapPin, Home, TrendingUp, Clock, DollarSign, Package, ChevronLeft, ChevronRight, X, Eye, EyeOff, Truck } from 'lucide-react';
import OrderCard from './OrderCard';
import MenuManagement from './MenuManagement';
import ShiftManagement from './ShiftManagement';
import TableMapDesigner from './TableMapDesigner';

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
    const role = user?.role || 'cajero';
    // Solo cajero necesita ver turnos, solo admin/gerente ven gestión de carta
    const isCajeroRole = role === 'cajero';
    const isManagerRole = role === 'admin' || role === 'gerente';
    // Cualquier rol que NO sea cajero ni admin/gerente solo ve el board
    const boardOnlyRole = !isCajeroRole && !isManagerRole;

    const defaultTab = isCajeroRole ? 'turnos' : 'board';
    // Usar estado local solo si no se proveen props (fallback)
    const [localActiveSubTab, setLocalActiveSubTab] = useState(defaultTab);

    const activeSubTab = propActiveSubTab || localActiveSubTab;
    const setActiveSubTab = propSetActiveSubTab || setLocalActiveSubTab;
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // DEBUG: Confirmar qué llega realmente
    console.log(`[RestMan] role="${role}", orders: ${orders.length}, boardOnly: ${boardOnlyRole}`);

    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        date: 'all' // Default to all to show orders regardless of timezone issues
    });
    const [showPaidTotal, setShowPaidTotal] = useState(false);
    const [shouldAutoOpenShift, setShouldAutoOpenShift] = useState(false);
    const [showPaidModal, setShowPaidModal] = useState(false);

    // Notificación de sonido para rol cocina cuando llegan pedidos nuevos
    const prevOrderCountRef = useRef(null);
    useEffect(() => {
        if (role !== 'cocina') return;
        const newCount = orders.filter(o => o.status === 'nuevo').length;
        if (prevOrderCountRef.current !== null && newCount > prevOrderCountRef.current) {
            try {
                // eslint-disable-next-line
                const AudioCtx = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
                const ctx = new AudioCtx();
                const playBeep = (freq, start, dur) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.frequency.value = freq;
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                    osc.start(ctx.currentTime + start);
                    osc.stop(ctx.currentTime + start + dur);
                };
                playBeep(880, 0,    0.12);
                playBeep(1100, 0.15, 0.12);
                playBeep(880, 0.3,  0.18);
            } catch (e) { /* AudioContext no disponible */ }
        }
        prevOrderCountRef.current = newCount;
    }, [orders, role]);

    React.useEffect(() => {
        const handleOpenShiftModal = () => {
            if (boardOnlyRole) return; // Roles sin caja no abren modal
            setActiveSubTab('turnos');
            setShouldAutoOpenShift(true);
            setTimeout(() => setShouldAutoOpenShift(false), 2000);
        };
        window.addEventListener('open-shift-modal', handleOpenShiftModal);
        return () => window.removeEventListener('open-shift-modal', handleOpenShiftModal);
    }, [boardOnlyRole]);

    // Sub-tabs filtradas por rol
    const allSubMenuItems = [
        { id: 'board', label: 'Monitor de Pedidos', icon: LayoutGrid, description: 'Vista de pedidos en tiempo real' },
        { id: 'mapa', label: 'Mapa de Mesas', icon: MapPin, description: 'Mapa interactivo de mesas' },
        { id: 'menu', label: 'Gestión de Carta', icon: Settings, description: 'Administrar productos y menú' },
        { id: 'turnos', label: 'Cajas y Turnos', icon: Wallet, description: 'Control de turnos y caja' },
    ];

    // boardOnlyRole solo ve board, cajero ve board+turnos, admin/gerente ve todo
    const subMenuItems = boardOnlyRole
        ? allSubMenuItems.filter(item => item.id === 'board')
        : isCajeroRole
            ? allSubMenuItems.filter(item => item.id !== 'menu')
            : allSubMenuItems;

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
        <div className="flex-1 flex overflow-hidden bg-transparent animate-in fade-in duration-700">
            {/* Contenido Principal */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeSubTab === 'board' && (
                        <motion.div
                            key="board"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: "circOut" }}
                            className="h-full p-6 md:p-8 overflow-y-auto custom-scrollbar"
                        >
                            <div className="flex justify-between items-center mb-8 px-2">
                                <div>
                                    <h1 className="text-3xl font-black text-secondary tracking-tighter leading-none">PEDIDOS EN VIVO</h1>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-full">
                                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                            <span className="text-[10px] font-bold text-success uppercase tracking-widest">Sincronizado</span>
                                        </div>
                                        <span className="text-[11px] text-accent font-bold uppercase tracking-widest">{stats.activeOrders} ACTIVOS AHORA</span>
                                    </div>
                                </div>
                                {role !== 'cocina' && role !== 'mesero' && (
                                    <button
                                        onClick={() => setShowPaidModal(true)}
                                        className="flex items-center gap-3 bg-canvas px-6 py-3.5 rounded-full shadow-sm border border-hairline text-[11px] font-bold uppercase tracking-widest text-secondary hover:shadow-airbnb hover:scale-105 active:scale-95 transition-all group"
                                    >
                                        <div className="bg-primary/10 p-2 rounded-full group-hover:bg-primary/20 transition-colors">
                                            <DollarSign size={16} className="text-primary" />
                                        </div>
                                        <span>HISTORIAL DE PAGOS</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col xl:flex-row gap-8 w-full items-start">
                                {['nuevo', 'fabricacion', 'despachado'].map((status) => (
                                    <div 
                                        key={status} 
                                        className={`${status === 'fabricacion' ? 'xl:flex-[2.5]' : 'xl:flex-1'} w-full flex flex-col bg-canvas rounded-[32px] p-6 border border-hairline min-w-0 h-fit transition-all duration-500 shadow-sm hover:shadow-airbnb group/col`}
                                    >
                                        <div className="flex items-center justify-between mb-6 px-2">
                                            <h2 className="uppercase text-[11px] font-black tracking-[3px] text-accent flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full shrink-0 shadow-[0_0_12px_rgba(0,0,0,0.1)] ${
                                                    status === 'nuevo' ? 'bg-primary shadow-primary/40 animate-pulse' : 
                                                    status === 'fabricacion' ? 'bg-warning shadow-warning/40' : 
                                                    'bg-violet-500 shadow-violet-500/40'
                                                }`} />
                                                {status}
                                            </h2>
                                            <span className="bg-surface-soft text-secondary px-3 py-1 rounded-full text-[10px] font-black shadow-sm border border-hairline">
                                                {filteredOrders.filter(o => o.status === status).length}
                                            </span>
                                        </div>

                                        <div className="space-y-5">
                                            {(() => {
                                                const ordersInStatus = filteredOrders
                                                    .filter(o => o.status === status)
                                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                                                if (status === 'fabricacion') {
                                                    const mesaOrders = ordersInStatus.filter(o => o.table_number && o.table_number !== 'DOMICILIO');
                                                    const domicilioOrders = ordersInStatus.filter(o => !o.table_number || o.table_number === 'DOMICILIO');

                                                    return (
                                                        <div className="flex flex-col 2xl:flex-row gap-6">
                                                            {/* Columna Mesas */}
                                                            <div className="flex-1 flex flex-col bg-surface-soft/50 rounded-[24px] p-4 border border-hairline">
                                                                <div className="flex items-center gap-2 mb-4 text-[9px] font-black text-accent uppercase tracking-[2px] pb-3 border-b border-hairline/50">
                                                                    <Utensils size={12} className="text-secondary" /> SERVICIO COMEDOR
                                                                </div>
                                                                <div className="space-y-4">
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
                                                                    {mesaOrders.length === 0 && (
                                                                        <div className="py-12 flex flex-col items-center justify-center opacity-30">
                                                                            <Utensils size={32} />
                                                                            <span className="text-[10px] font-bold mt-2 tracking-widest">VACÍO</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Columna Domicilios */}
                                                            <div className="flex-1 flex flex-col bg-surface-soft/50 rounded-[24px] p-4 border border-hairline">
                                                                <div className="flex items-center gap-2 mb-4 text-[9px] font-black text-accent uppercase tracking-[2px] pb-3 border-b border-hairline/50">
                                                                    <Truck size={12} className="text-secondary" /> ENTREGAS EXTERNAS
                                                                </div>
                                                                <div className="space-y-4">
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
                                                                    {domicilioOrders.length === 0 && (
                                                                        <div className="py-12 flex flex-col items-center justify-center opacity-30">
                                                                            <Truck size={32} />
                                                                            <span className="text-[10px] font-bold mt-2 tracking-widest">VACÍO</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-4">
                                                        {ordersInStatus.map(order => (
                                                            <OrderCard
                                                                key={order.id}
                                                                order={order}
                                                                onStatusChange={onStatusChange}
                                                                onEdit={onEdit}
                                                                onDelete={onDelete}
                                                                onPrint={onPrint}
                                                                isCompact={ordersInStatus.length > 3}
                                                            />
                                                        ))}
                                                        {ordersInStatus.length === 0 && (
                                                            <div className="py-20 text-center opacity-20 flex flex-col items-center">
                                                                <Package size={40} />
                                                                <span className="text-[10px] font-bold mt-4 tracking-[4px] uppercase">Sin Pendientes</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Modal Historial */}
                            <AnimatePresence>
                                {showPaidModal && (
                                    <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                            className="bg-canvas rounded-[40px] w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-hairline relative"
                                        >
                                            <div className="p-8 border-b border-hairline flex justify-between items-center bg-canvas">
                                                <div>
                                                    <h2 className="text-2xl font-black text-secondary tracking-tighter">HISTORIAL DE CIERRE</h2>
                                                    <p className="text-[10px] font-bold text-accent uppercase tracking-[2px] mt-1">Pedidos finalizados en el turno actual</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowPaidModal(false)}
                                                    className="w-12 h-12 bg-surface-soft hover:bg-canvas border border-hairline rounded-full flex items-center justify-center transition-all shadow-sm active:scale-90"
                                                >
                                                    <X size={20} className="text-secondary" />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-8 bg-surface-soft/30 custom-scrollbar">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                    {filteredOrders.filter(o => o.status === 'pagado').length === 0 ? (
                                                        <div className="col-span-full py-32 text-center flex flex-col items-center justify-center opacity-20">
                                                            <Wallet size={64} />
                                                            <p className="text-sm font-black uppercase tracking-[4px] mt-6">Sin registros de pago</p>
                                                        </div>
                                                    ) : (
                                                        filteredOrders
                                                            .filter(o => o.status === 'pagado')
                                                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                            .map(order => (
                                                                <OrderCard
                                                                    key={order.id}
                                                                    order={order}
                                                                    onStatusChange={onStatusChange}
                                                                    onEdit={onEdit}
                                                                    onDelete={onDelete}
                                                                    onPrint={onPrint}
                                                                    isMinimal={true}
                                                                />
                                                            ))
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-8 bg-canvas border-t border-hairline flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-accent tracking-[3px]">Total Recaudado</span>
                                                    <span className="text-3xl font-black text-success leading-none mt-2">
                                                        ${filteredOrders.filter(o => o.status === 'pagado').reduce((sum, o) => sum + (o.total || o.total_price || 0), 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => setShowPaidModal(false)}
                                                    className="px-10 py-4 bg-secondary text-white rounded-full font-black text-[12px] uppercase tracking-widest shadow-airbnb hover:scale-105 active:scale-95 transition-all"
                                                >
                                                    Cerrar Vista
                                                </button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {activeSubTab === 'menu' && (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4 }}
                            className="h-full overflow-y-auto custom-scrollbar"
                        >
                            <MenuManagement />
                        </motion.div>
                    )}

                    {activeSubTab === 'turnos' && (
                        <motion.div
                            key="turnos"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4 }}
                            className="h-full overflow-y-auto custom-scrollbar"
                        >
                            <ShiftManagement orders={orders} onPrint={onPrint} autoOpen={shouldAutoOpenShift} />
                        </motion.div>
                    )}

                    {activeSubTab === 'mapa' && (
                        <motion.div
                            key="mapa"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4 }}
                            className="h-full overflow-y-auto custom-scrollbar"
                        >
                            <TableMapDesigner orders={orders} />
                        </motion.div>
                    )}
                </AnimatePresence>
        </div>
    </div>
);
};

export default RestaurantManagement;
