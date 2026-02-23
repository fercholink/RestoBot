import React, { useRef, useEffect } from 'react';
import { Bell, BellDot, X, CheckCheck, Trash2, ShoppingBag, Hotel, Users, AlertTriangle } from 'lucide-react';
import { useRealtime } from '../context/RealtimeContext';

// Colores por tipo de notificación
const COLOR_MAP = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', border: 'border-green-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', border: 'border-amber-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', border: 'border-red-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500', border: 'border-purple-100' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500', border: 'border-teal-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-500', border: 'border-yellow-100' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', border: 'border-gray-100' },
};

// Iconos por tipo de entidad
const TYPE_ICON = {
    order: ShoppingBag,
    booking: Hotel,
    user: Users,
};

// Formateado de tiempo relativo
const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 5) return 'ahora mismo';
    if (diff < 60) return `hace ${diff}s`;
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
    return `hace ${Math.floor(diff / 3600)}h`;
};

const NotificationPanel = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, markAllRead, markRead, clearAll } = useRealtime();
    const panelRef = useRef(null);

    // Cerrar al hacer click fuera
    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen, onClose]);

    return (
        <div ref={panelRef} className="relative">
            {/* ── Botón de Campana ── */}
            <button
                onClick={onClose}
                className={`p-2.5 rounded-xl border border-gray-200 transition-all relative ${isOpen ? 'bg-secondary text-white border-secondary' : 'bg-white text-secondary hover:bg-gray-50'
                    }`}
                title="Notificaciones"
            >
                {unreadCount > 0 ? <BellDot size={18} className={isOpen ? 'text-white' : 'text-primary'} /> : <Bell size={18} />}
                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#f8fafc] px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* ── Panel Dropdown ── */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Header */}
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/80">
                        <div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-secondary">Notificaciones</h4>
                            {unreadCount > 0 && (
                                <p className="text-[9px] font-bold text-primary mt-0.5">{unreadCount} sin leer</p>
                            )}
                        </div>
                        <div className="flex gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="p-1.5 text-gray-400 hover:text-secondary hover:bg-gray-100 rounded-lg transition-all"
                                    title="Marcar todas como leídas"
                                >
                                    <CheckCheck size={14} />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAll}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Limpiar todas"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="max-h-[360px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-gray-300">
                                <Bell size={32} strokeWidth={1} className="mx-auto mb-2" />
                                <p className="text-[11px] font-bold">Sin notificaciones</p>
                                <p className="text-[9px] mt-1">Los cambios aparecerán aquí en tiempo real</p>
                            </div>
                        ) : (
                            notifications.map(notif => {
                                const colors = COLOR_MAP[notif.color] || COLOR_MAP.gray;
                                const Icon = TYPE_ICON[notif.type] || AlertTriangle;
                                return (
                                    <button
                                        key={notif.id}
                                        onClick={() => markRead(notif.id)}
                                        className={`w-full text-left p-4 border-b border-gray-50 transition-all flex gap-3 hover:bg-gray-50/60 ${!notif.read ? 'bg-primary/2' : ''
                                            }`}
                                    >
                                        {/* Icono */}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${colors.text}`}>
                                            <Icon size={16} />
                                        </div>

                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-[11px] font-black text-secondary leading-snug ${!notif.read ? 'text-secondary' : 'text-gray-500'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.read && (
                                                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${colors.dot}`} />
                                                )}
                                            </div>
                                            {notif.body && (
                                                <p className="text-[10px] text-gray-400 mt-0.5 font-medium truncate">{notif.body}</p>
                                            )}
                                            <p className="text-[9px] text-gray-300 mt-1 font-medium">{timeAgo(notif.timestamp)}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-50 text-center">
                            <p className="text-[9px] text-gray-400 font-medium">
                                📡 Tiempo real · Supabase Realtime
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationPanel;
