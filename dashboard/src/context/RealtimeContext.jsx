import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

/**
 * RealtimeContext — Hub Central de Actualizaciones en Tiempo Real
 * 
 * Gestiona suscripciones Realtime de Supabase para:
 *   - orders (pedidos)
 *   - bookings (reservas hotel)
 *   - profiles (cambios de usuario/rol)
 * 
 * Emite notificaciones in-app filtradas por ROL:
 *   - admin/gerente: TODAS las notificaciones
 *   - cajero: solo pedidos
 *   - recepcion: solo reservas
 *   - cocina: solo pedidos en fabricacion
 */

const RealtimeContext = createContext(null);

// Configuración de qué roles reciben qué notificaciones
const ROLE_NOTIFICATION_CONFIG = {
    admin: { orders: true, bookings: true, profiles: true },
    gerente: { orders: true, bookings: true, profiles: true },
    cajero: { orders: true, bookings: false, profiles: false },
    mesero: { orders: true, bookings: false, profiles: false },
    cocina: { orders: true, bookings: false, profiles: false },
    recepcion: { orders: false, bookings: true, profiles: false },
};

// Labels de estado para notificaciones
const ORDER_STATUS_LABELS = {
    nuevo: { label: 'Nuevo Pedido', color: 'blue', emoji: '🆕' },
    fabricacion: { label: 'En Preparación', color: 'amber', emoji: '👨‍🍳' },
    listo: { label: 'Listo para Entregar', color: 'green', emoji: '✅' },
    entregado: { label: 'Entregado', color: 'teal', emoji: '🛵' },
    pagado: { label: 'Pedido Pagado', color: 'purple', emoji: '💰' },
    cancelado: { label: 'Pedido Cancelado', color: 'red', emoji: '❌' },
};

const BOOKING_STATUS_LABELS = {
    pendiente: { label: 'Reserva Pendiente', color: 'yellow', emoji: '📋' },
    confirmada: { label: 'Reserva Confirmada', color: 'green', emoji: '✔️' },
    ocupada: { label: 'Huésped en Casa', color: 'blue', emoji: '🏨' },
    checkout: { label: 'Checkout Registrado', color: 'teal', emoji: '👋' },
    cancelada: { label: 'Reserva Cancelada', color: 'red', emoji: '❌' },
};

let notifIdCounter = 0;

export const RealtimeProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [ordersVersion, setOrdersVersion] = useState(0);   // Bump para re-fetch de pedidos
    const [bookingsVersion, setBookingsVersion] = useState(0); // Bump para re-fetch de reservas
    const channelsRef = useRef([]);
    const audioRef = useRef(null);

    // Obtener configuración de notificaciones del rol actual
    const getRoleConfig = useCallback(() => {
        const role = user?.role || 'cajero';
        return ROLE_NOTIFICATION_CONFIG[role] || ROLE_NOTIFICATION_CONFIG.cajero;
    }, [user?.role]);

    // Agregar una notificación al panel
    const addNotification = useCallback((notification) => {
        notifIdCounter += 1;
        const newNotif = {
            id: notifIdCounter,
            timestamp: new Date(),
            read: false,
            ...notification,
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Máximo 50 notifs
        setUnreadCount(prev => prev + 1);

        // Reproducir sonido (si hay)
        if (audioRef.current) {
            audioRef.current.play().catch(() => { }); // Silenciar errores de autoplay
        }
    }, []);

    // Marcar todas como leídas
    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    }, []);

    // Marcar una como leída
    const markRead = useCallback((id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    // Limpiar todas
    const clearAll = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
    }, []);

    // Manejar evento de cambio en ORDERS
    const handleOrderChange = useCallback((payload) => {
        const config = getRoleConfig();
        if (!config.orders) return;

        const role = user?.role || 'cajero';
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const record = newRecord || oldRecord;

        // Filtro para cocina: notificar en INSERT (nuevo pedido) y cuando pasa a "fabricacion"
        if (role === 'cocina') {
            if (eventType === 'INSERT') {
                // Siempre notificar cuando llega un nuevo pedido
            } else if (eventType === 'UPDATE' && newRecord?.status !== 'fabricacion' && newRecord?.status !== 'nuevo') {
                return; // Solo notificar cambios relevantes para cocina
            }
        }

        let title = '';
        let body = '';
        let type = 'order';
        let color = 'blue';

        if (eventType === 'INSERT') {
            const statusInfo = ORDER_STATUS_LABELS['nuevo'];
            title = `${statusInfo.emoji} Nuevo Pedido #${newRecord.order_number || newRecord.id}`;
            body = `Mesa ${newRecord.table_number || 'Domicilio'} · $${(newRecord.total || newRecord.total_price || 0).toLocaleString('es-CO')}`;
            color = statusInfo.color;
        } else if (eventType === 'UPDATE') {
            if (!newRecord.status || newRecord.status === oldRecord?.status) return; // Sin cambio de estado
            const statusInfo = ORDER_STATUS_LABELS[newRecord.status] || { label: newRecord.status, color: 'gray', emoji: '🔄' };
            title = `${statusInfo.emoji} Pedido #${newRecord.order_number || newRecord.id} — ${statusInfo.label}`;
            body = `Mesa ${newRecord.table_number || 'Domicilio'}`;
            color = statusInfo.color;
        } else if (eventType === 'DELETE') {
            title = `❌ Pedido #${oldRecord.order_number || oldRecord.id} Eliminado`;
            body = 'El pedido fue removido del sistema';
            color = 'red';
        }

        if (title) {
            addNotification({ title, body, type, color, entityId: record?.id, eventType });
        }

        // Señalizar que los pedidos cambiaron (componentes escuchan este valor)
        setOrdersVersion(v => v + 1);
    }, [user?.role, addNotification, getRoleConfig]);

    // Manejar evento de cambio en BOOKINGS (Reservas Hotel)
    const handleBookingChange = useCallback((payload) => {
        const config = getRoleConfig();
        if (!config.bookings) return;

        const { eventType, new: newRecord, old: oldRecord } = payload;
        const record = newRecord || oldRecord;

        let title = '';
        let body = '';
        let color = 'blue';

        if (eventType === 'INSERT') {
            title = `🏨 Nueva Reserva`;
            body = `Check-in: ${newRecord.check_in ? new Date(newRecord.check_in).toLocaleDateString('es-CO') : 'N/A'}`;
            color = 'green';
        } else if (eventType === 'UPDATE') {
            if (!newRecord.status || newRecord.status === oldRecord?.status) return;
            const statusInfo = BOOKING_STATUS_LABELS[newRecord.status] || { label: newRecord.status, color: 'gray', emoji: '🔄' };
            title = `${statusInfo.emoji} Reserva Actualizada — ${statusInfo.label}`;
            body = `Habitación ${newRecord.room_id || 'N/A'}`;
            color = statusInfo.color;
        } else if (eventType === 'DELETE') {
            title = `❌ Reserva Cancelada`;
            body = 'Una reserva fue removida del sistema';
            color = 'red';
        }

        if (title) {
            addNotification({ title, body, type: 'booking', color, entityId: record?.id, eventType });
        }

        setBookingsVersion(v => v + 1);
    }, [addNotification, getRoleConfig]);

    // Manejar evento de cambio en PROFILES (usuarios del sistema)
    const handleProfileChange = useCallback((payload) => {
        const config = getRoleConfig();
        if (!config.profiles) return;

        const { eventType, new: newRecord } = payload;

        let title = '';
        let body = '';

        if (eventType === 'INSERT') {
            title = `👤 Nuevo Usuario Registrado`;
            body = `${newRecord.full_name || 'Usuario'} · Rol: ${newRecord.role}`;
        } else if (eventType === 'UPDATE') {
            title = `✏️ Usuario Actualizado`;
            body = `${newRecord.full_name || 'Usuario'} · Rol: ${newRecord.role}`;
        } else if (eventType === 'DELETE') {
            title = `🗑️ Usuario Eliminado del Sistema`;
            body = '';
        }

        if (title) {
            addNotification({ title, body, type: 'user', color: 'purple', eventType });
        }
    }, [addNotification, getRoleConfig]);

    // Configurar suscripciones Realtime cuando el usuario esté disponible
    useEffect(() => {
        if (!user) return;

        // Limpiar canales anteriores
        channelsRef.current.forEach(ch => supabase.removeChannel(ch));
        channelsRef.current = [];

        const config = getRoleConfig();

        // Función de suscripción con manejo de errores silencioso
        const subscribeWithFallback = (channel, name) => {
            channel.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] ✅ Canal "${name}" activo`);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    // WebSocket no disponible en esta instancia self-hosted
                    // El polling automático en App.jsx cubre esta funcionalidad
                    console.warn(`[Realtime] ⚠️ Canal "${name}" no disponible (self-hosted). Usando polling.`);
                }
            });
            return channel;
        };

        // Canal de PEDIDOS
        if (config.orders) {
            const ordersChannel = subscribeWithFallback(
                supabase
                    .channel(`realtime-orders-${user.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                    }, handleOrderChange),
                'Orders'
            );
            channelsRef.current.push(ordersChannel);
        }

        // Canal de RESERVAS
        if (config.bookings) {
            const bookingsChannel = subscribeWithFallback(
                supabase
                    .channel(`realtime-bookings-${user.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'bookings',
                    }, handleBookingChange),
                'Bookings'
            );
            channelsRef.current.push(bookingsChannel);
        }

        // Canal de PERFILES (solo admin/gerente)
        if (config.profiles) {
            const profilesChannel = subscribeWithFallback(
                supabase
                    .channel(`realtime-profiles-${user.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'profiles',
                    }, handleProfileChange),
                'Profiles'
            );
            channelsRef.current.push(profilesChannel);
        }

        return () => {
            channelsRef.current.forEach(ch => supabase.removeChannel(ch));
            channelsRef.current = [];
        };
    }, [user?.id, user?.role]); // Re-suscribir si cambia el usuario o su rol


    const value = {
        notifications,
        unreadCount,
        markAllRead,
        markRead,
        clearAll,
        ordersVersion,    // Componentes pueden observar esto para re-fetch
        bookingsVersion,  // Idem para reservas
    };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
};

export const useRealtime = () => {
    const ctx = useContext(RealtimeContext);
    if (!ctx) throw new Error('useRealtime debe usarse dentro de RealtimeProvider');
    return ctx;
};

export default RealtimeContext;
