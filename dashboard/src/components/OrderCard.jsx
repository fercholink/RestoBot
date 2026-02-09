import React from 'react';
import { Package, MapPin, User, Clock, CheckCircle2, Truck, Rocket, CreditCard, Utensils, X, Plus, Edit2, Trash2, Printer, MessageCircle, Hotel } from 'lucide-react';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusIcons = {
    nuevo: { icon: Rocket, color: 'text-blue-500', bg: 'bg-blue-50' },
    fabricacion: { icon: Clock, color: 'text-warning', bg: 'bg-orange-50' },
    despachado: { icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50' },
    pagado: { icon: CheckCircle2, color: 'text-success', bg: 'bg-green-50' },
};

const OrderCard = ({ order, onStatusChange, onEdit, onDelete, onPrint, isCompact = false, isMinimal = false }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [elapsed, setElapsed] = React.useState('');

    React.useEffect(() => {
        // El tiempo solo se detiene definitivamente cuando el pedido está pagado
        if (order.status === 'pagado') {
            const diff = order.preparation_time_seconds || 0;
            if (diff === 0) {
                setElapsed('N/A');
                return;
            }
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            setElapsed(`${mins}m ${secs.toString().padStart(2, '0')}s`);
            return;
        }

        const updateTimer = () => {
            try {
                if (!order.created_at) {
                    setElapsed("--:--");
                    return;
                }

                const now = new Date();
                const created = parseISO(order.created_at);

                let diff = differenceInSeconds(now, created);

                if (diff < 0) diff = 0;

                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                setElapsed(`${mins}m ${secs.toString().padStart(2, '0')}s`);
            } catch (e) {
                console.error("Timer error:", e);
                setElapsed("--:--");
            }
        };

        // Actualizar inmediatamente y luego cada segundo
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [order.created_at, order.status, order.preparation_time_seconds]);

    const Icon = statusIcons[order.status]?.icon || Package;

    // Vista Minimalista (Solo ID y número) para ahorrar espacio
    if (isMinimal && !isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="bg-white rounded-lg p-2 shadow-sm border border-gray-100/50 mb-1 flex items-center justify-between cursor-pointer hover:bg-gray-50 hover:border-primary/20 transition-all select-none"
                title="Clic para ver detalles"
            >
                <div className="flex items-center gap-1.5 ">
                    <div className="bg-success/10 p-1 rounded-md text-success">
                        <CheckCircle2 size={12} />
                    </div>
                    <span className="text-[10px] font-black text-secondary">#{order.id}</span>
                </div>
                <span className="text-[9px] font-bold text-gray-400 truncate max-w-[60px]">
                    ${(order.total || order.total_price || 0).toLocaleString()}
                </span>
            </div>
        );
    }

    // Vista compacta para pedidos pagados
    if (order.status === 'pagado' && !isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100/50 hover:border-success/30 hover:shadow-md transition-all mb-2 cursor-pointer group flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <div className="bg-success/10 p-1.5 rounded-lg text-success">
                        <CheckCircle2 size={14} />
                    </div>
                    <span className="text-xs font-black text-secondary uppercase tracking-wider">
                        Pedido #{order.id}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                        {order.customer_name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border bg-success/10 text-success border-success/10">
                        <Clock size={10} />
                        <span className="text-[10px] font-black font-mono">{elapsed}</span>
                    </div>
                    <span className="text-[10px] font-black text-primary">${order.total || order.total_price}</span>
                    <div className="bg-gray-50 text-gray-400 p-1 rounded-md">
                        <Plus size={10} />
                    </div>
                </div>
            </div>
        );
    }

    // Vista compacta para estados activos (cuando hay muchos items)
    if (isCompact && !isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100/50 hover:border-primary/30 hover:shadow-md transition-all mb-2 cursor-pointer group flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${statusIcons[order.status]?.bg}`}>
                        <Icon size={14} className={statusIcons[order.status]?.color} />
                    </div>
                    <span className="text-xs font-black text-secondary uppercase tracking-wider">
                        Pedido #{order.id}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border ${order.status === 'pagado' ? 'bg-success/10 text-success border-success/10' : 'bg-primary/10 text-primary border-primary/10'}`}>
                        <Clock size={10} className={order.status === 'pagado' ? '' : 'animate-pulse'} />
                        <span className="text-[10px] font-black font-mono">{elapsed}</span>
                    </div>
                    <div className="bg-gray-50 text-gray-400 p-1 rounded-md">
                        <Plus size={10} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:border-primary/20 transition-all mb-3 group ring-1 ring-black/5 relative">
            {/* Boton para colapsar si está pagado o forzado compacto */}
            {(order.status === 'pagado' || isCompact) && (
                <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                    className="absolute top-2 right-2 text-gray-300 hover:text-secondary p-1 z-20"
                >
                    <X size={12} />
                </button>
            )}

            {/* Botones de acción rápida (Edición/Borrado) */}
            {(order.status === 'nuevo' || order.status === 'fabricacion') && (
                <div className="absolute top-3 right-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                        onClick={() => onPrint(order)}
                        className="p-1 bg-white border border-gray-100 text-accent hover:text-blue-500 hover:border-blue-200 rounded-md shadow-sm transition-all"
                        title="Imprimir Comanda"
                    >
                        <Printer size={12} />
                    </button>
                    <button
                        onClick={() => onEdit(order)}
                        className="p-1 bg-white border border-gray-100 text-accent hover:text-primary hover:border-primary/30 rounded-md shadow-sm transition-all"
                        title="Editar Pedido"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button
                        onClick={() => onDelete(order.id)}
                        className="p-1 bg-white border border-gray-100 text-accent hover:text-red-500 hover:border-red-200 rounded-md shadow-sm transition-all"
                        title="Eliminar Pedido"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}

            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${statusIcons[order.status]?.bg}`}>
                        <Icon size={16} className={statusIcons[order.status]?.color} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-secondary text-sm">Pedido</h3>
                            <span className="text-primary font-black text-sm">${order.total || order.total_price}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><Package size={12} /> # {order.id}</span>
                            <span className="flex items-center gap-1">
                                {order.table_number && order.table_number !== 'DOMICILIO' ? <Utensils size={12} /> : <MapPin size={12} />}
                                {order.table_number && order.table_number !== 'DOMICILIO' ? `Mesa ${order.table_number}` : 'Domicilio'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`${order.status === 'pagado' ? 'bg-success/10 text-success border-success/10' : 'bg-primary/10 text-primary border-primary/10'} px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border`}>
                    <Clock size={10} className={order.status === 'pagado' ? '' : 'animate-pulse'} />
                    <span className="text-[10px] font-black font-mono">{elapsed}</span>
                </div>
            </div>

            {/* Visual Indicator for Pre-Paid Orders */}
            {order.is_paid && order.status !== 'pagado' && (
                <div className="mb-2 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-center border border-emerald-200">
                    Pedido Pagado 💰
                </div>
            )}


            <div className="space-y-2 mb-3">
                {order.items?.map((item, idx) => (
                    <div key={idx} className="border-b border-gray-50 pb-1.5 last:border-0">
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-secondary"><span className="text-primary font-black">{item.quantity}x</span> {item.product_name}</span>
                            <span className="text-secondary/70 font-black">${((item.price || item.unit_price) * item.quantity).toLocaleString()}</span>
                        </div>
                        {item.customizations && (
                            <div className="pl-4 mt-0.5 space-y-0.5">
                                {item.customizations.excluded_ingredients?.map(ing => (
                                    <div key={ing} className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1">
                                        <X size={8} strokeWidth={4} /> Sin {ing}
                                    </div>
                                ))}
                                {item.customizations.added_extras?.map(extra => (
                                    <div key={extra.name} className="text-[8px] font-black text-success uppercase flex items-center gap-1">
                                        <Plus size={8} strokeWidth={4} /> {extra.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {order.customer_name && (
                <div className="bg-gray-50 rounded-lg p-2 mb-3 flex items-center gap-2 border border-gray-100/50">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border shadow-sm">
                        <User size={12} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-secondary truncate">{order.customer_name || 'Cliente'}</p>
                        <div className="flex items-center gap-1 text-[8px] font-bold text-accent truncate">
                            {order.customer_phone && <MessageCircle size={8} className="text-green-500" />}
                            {order.customer_phone}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-1.5">
                {order.status === 'nuevo' && (
                    <button
                        onClick={() => onStatusChange(order.id, 'fabricacion')}
                        className="flex-1 bg-warning/10 text-warning hover:bg-warning hover:text-white font-black py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all border border-warning/20 shadow-sm"
                    >
                        Preparar
                    </button>
                )}
                {order.status === 'fabricacion' && (
                    <button
                        onClick={() => onStatusChange(order.id, 'despachado')}
                        className="flex-1 bg-purple-500 text-white hover:bg-purple-600 font-black py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-md shadow-purple-500/20"
                    >
                        Despachar
                    </button>
                )}
                {(order.status === 'despachado' || order.status === 'fabricacion') && (
                    <>
                        {(order.table_number && (order.table_number.toString().startsWith('HAB') || order.type === 'habitacion')) ? (
                            <button
                                onClick={() => onStatusChange(order.id, 'pagado', { method: 'cargo_habitacion', reference: order.table_number })}
                                className="flex-1 bg-white hover:bg-orange-500 hover:text-white text-orange-600 border-2 border-orange-500/30 font-black py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                                title="Cargar a cuenta de habitación"
                            >
                                <Hotel size={12} />
                                Cargar Hab
                            </button>
                        ) : (
                            <button
                                onClick={() => onStatusChange(order.id, 'pagado')}
                                className="flex-1 bg-white hover:bg-success hover:text-white text-success border-2 border-success/30 font-black py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                            >
                                <CreditCard size={10} />
                                {order.is_paid ? 'Cerrar' : 'Pagado'}
                            </button>
                        )}
                    </>
                )}
                <button
                    onClick={() => onPrint(order)}
                    className="aspect-square bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-secondary p-2 rounded-lg transition-all border border-gray-100 flex items-center justify-center group/print shadow-sm"
                    title="Imprimir Ticket"
                >
                    <Printer size={14} className="group-hover/print:scale-110 transition-transform" />
                </button>
            </div>
            {order.status === 'pagado' && order.preparation_time_seconds > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-50 text-center text-[8px] font-black text-success/50 uppercase tracking-widest">
                    {Math.floor(order.preparation_time_seconds / 60)}m {order.preparation_time_seconds % 60}s
                </div>
            )}
        </div>
    );
};

export default OrderCard;
