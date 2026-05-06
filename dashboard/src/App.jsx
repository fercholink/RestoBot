import React, { useState, useEffect, useRef } from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';
import { updateOrderStatus } from './api';
import { useAuth } from './context/AuthContext';
import { useRealtime } from './context/RealtimeContext';
import { supabase } from './lib/supabase';
import { logInventoryChange } from './lib/inventory';
import { getPollingInterval } from './config/roles';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import NewOrderModal from './components/NewOrderModal';
import PaymentModal from './components/PaymentModal';
import UserManagement from './components/UserManagement';
import AnalyticsPro from './components/AnalyticsPro';
import HotelManagement from './components/HotelManagement';
import RestaurantManagement from './components/RestaurantManagement';
import AccountingModule from './components/AccountingModule';
import MenuManagement from './components/MenuManagement';
import BranchManagement from './components/BranchManagement';
import ShiftManagement from './components/ShiftManagement';
import OperationsHub from './components/OperationsHub';
import TicketPrinter from './components/TicketPrinter';
import MarketingModule from './components/Marketing/MarketingModule';
import TableQRGenerator from './components/TableQRGenerator';
import NotificationPanel from './components/NotificationPanel';
import DigitalCheckIn from './components/DigitalCheckIn';
import SaasAdminPanel from './components/SaasAdminPanel';
import OfflineBanner from './components/OfflineBanner';
import { LayoutGrid, Filter, Plus, ShieldCheck, Wallet, Activity } from 'lucide-react';
import { Toaster, sileo } from 'sileo';
import { emitInvoiceForOrder } from './services/invoiceHelper';
import { useAdminLog } from './hooks/useAdminLog';
import { useOfflineSync } from './hooks/useOfflineSync';

import { db } from './lib/db';
import "./styles/sileo.css";

// Mock data para previsualizar antes de conectar n8n
const MOCK_ORDERS = [
  {
    id: 101,
    status: 'nuevo',
    type: 'mesa',
    table_id: '3',
    total_price: 35000,
    created_at: new Date().toISOString(),
    customer_name: 'Juan Perez',
    customer_phone: '+573001234567',
    items: [
      { quantity: 2, product_name: 'Hamburguesa Clásica', unit_price: 15000 },
      { quantity: 1, product_name: 'Gaseosa 350ml', unit_price: 5000 },
    ]
  },
  {
    id: 102,
    status: 'fabricacion',
    type: 'domicilio',
    total_price: 25000,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    customer_name: 'Maria Lopez',
    customer_phone: '+573119876543',
    items: [
      { quantity: 1, product_name: 'Salchipapa Pequeña', unit_price: 25000 },
    ]
  }
];

// Log de Auditoría: Detecta si la página se recarga por completo en el navegador
console.warn(`[Auditoría] 🚀 Nexus App Inicializada: ${new Date().toLocaleTimeString()} (Si ves esto al cambiar de pestaña, hay una recarga real)`);

function App() {
  const { user, loading } = useAuth();
  const { log: adminLog } = useAdminLog();
  const { ordersVersion } = useRealtime();

  // Restauramos el estado desde localStorage para evitar que se pierda la ubicación al recargar o volver de otra pestaña
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('nexus_active_tab') || 'analytics');

  // Guardar la pestaña activa cada vez que cambie
  useEffect(() => {
    localStorage.setItem('nexus_active_tab', activeTab);
  }, [activeTab]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);

  const [orders, setOrders] = useState([]);
  // Ref always pointing to the latest orders — used by the auto-advance interval
  // to avoid stale closures without adding [orders] to the effect's dependency array.
  const ordersRef = useRef([]);
  const advancingOrders = useRef(new Set());     // prevents duplicate auto-advance calls
  const pendingStatusUpdates = useRef(new Map()); // guards optimistic state from stale fetchOrders overwrites
  const [activeShift, setActiveShift] = useState(null); // Estado para el turno activo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeRestaurantSubTab, setActiveRestaurantSubTab] = useState(() => localStorage.getItem('nexus_rest_subtab') || (user?.role === 'cajero' ? 'turnos' : 'board'));
  const [activeHotelSubTab, setActiveHotelSubTab] = useState(() => localStorage.getItem('nexus_hotel_subtab') || 'habitaciones');
  const [activeAccountingSubTab, setActiveAccountingSubTab] = useState(() => localStorage.getItem('nexus_acc_subtab') || 'summary');

  // Persistir sub-pestañas
  useEffect(() => { localStorage.setItem('nexus_rest_subtab', activeRestaurantSubTab); }, [activeRestaurantSubTab]);
  useEffect(() => { localStorage.setItem('nexus_hotel_subtab', activeHotelSubTab); }, [activeHotelSubTab]);
  useEffect(() => { localStorage.setItem('nexus_acc_subtab', activeAccountingSubTab); }, [activeAccountingSubTab]);
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, orderId: null, totalPrice: 0, order: null });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [printData, setPrintData] = useState({ order: null, type: 'comanda' });
  
  // Soporte Offline
  const { isOnline } = useOfflineSync();

  // Estados de turno movidos arriba
  // const [hasActiveShift... ya definidos ex-inicio
  const hasActiveShift = !!activeShift;

  const handleOpenNewOrder = () => {
    if (!hasActiveShift) {
      setShowShiftWarning(true);
    } else {
      setIsModalOpen(true);
    }
  };




  // Ajustar pestaña inicial y UI según el rol - SOLO AL INICIO (si no hay persistencia)
  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      const savedTab = localStorage.getItem('nexus_active_tab');
      const role = user.role;

      // Solo forzamos pestaña por defecto si no hay una guardada
      if (!savedTab) {
        if (role === 'admin' || role === 'gerente') {
          setActiveTab('analytics');
        } else if (role === 'cajero') {
          setIsSidebarCollapsed(true);
          setActiveTab('restaurante');
          setActiveRestaurantSubTab('turnos');
        } else {
          setIsSidebarCollapsed(true);
          setActiveTab('restaurante');
          setActiveRestaurantSubTab('board');
        }
      }
      isInitializedRef.current = true;
    }
  }, [user]);

  // Si el usuario cambia de verdad (logout/login con otro ID), reiniciamos el flag
  useEffect(() => {
    if (!user) isInitializedRef.current = false;
  }, [user?.id]);

  // --- SUPABASE INTEGRATION FOR ORDERS ---

  useEffect(() => {
    fetchOrders();
  }, []);

  // Re-fetch cuando RealtimeContext detecta cambios (canal Realtime)
  useEffect(() => {
    if (ordersVersion > 0) {
      fetchOrders();
    }
  }, [ordersVersion]);

  // POLLING: refresca pedidos automáticamente según el rol
  // Admin=8s, Gerente=8s, Cajero=6s, Cocina=5s, Analista=30s
  useEffect(() => {
    if (!user) return;
    const interval = getPollingInterval(user.role);
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, interval);
    return () => clearInterval(pollInterval);
  }, [user?.role]);

  // Escuchar eventos de actualización de turno (emitidos por ShiftManagement)
  useEffect(() => {
    const handleShiftUpdate = () => {
      fetchOrders(); // Recargar turno activo y pedidos
    };
    window.addEventListener('shift-updated', handleShiftUpdate);
    return () => window.removeEventListener('shift-updated', handleShiftUpdate);
  }, []);

  // Realtime directo en tabla orders (complementa el polling)
  useEffect(() => {
    const channel = supabase
      .channel('app-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Force clear orders when shift closes — SOLO aplica para cajero
  useEffect(() => {
    const isCajero = user && user.role === 'cajero';
    if (!activeShift && isCajero) {
      console.log('[Force-clear] Cajero sin turno → vaciando pedidos');
      setOrders([]);
    }
  }, [activeShift, user]);

  const fetchOrders = async () => {
    try {
      // 1. Obtener turno activo
      let currentShift = null;
      const isKitchenRole = user?.role === 'cocina' || user?.role === 'mesero';

      if (user?.id) {
        if (isKitchenRole) {
          // COCINA/MESERO: buscar CUALQUIER turno abierto (de cualquier cajero)
          const { data: shiftData } = await supabase
            .from('shifts')
            .select('*')
            .eq('status', 'abierto')
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          currentShift = shiftData;
        } else {
          // CAJERO/ADMIN/GERENTE: buscar turno propio
          const { data: shiftData } = await supabase
            .from('shifts')
            .select('*')
            .eq('status', 'abierto')
            .eq('user_id', user.id)
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          currentShift = shiftData;
        }
      }
      setActiveShift(currentShift);

      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(name, price)
          ),
          branch:branches(*)
        `)
        .order('created_at', { ascending: false });

      // ─── LÓGICA SIMPLIFICADA: Solo CAJERO depende de turno ──
      // Todos los demás roles ven los pedidos del día libremente
      const isCajero = user && user.role === 'cajero';

      console.log(`[fetchOrders] role="${user?.role}", isCajero=${isCajero}, shift=${currentShift?.id || 'NONE'}`);

      if (isCajero) {
        // CAJERO: requiere turno activo
        if (currentShift) {
          query = query.eq('shift_id', currentShift.id);
          console.log(`[fetchOrders] → Cajero: filtrando por shift_id=${currentShift.id}`);
        } else {
          console.log('[fetchOrders] → Cajero sin turno: vaciando pedidos');
          setOrders([]);
          return;
        }
      } else {
        // TODOS LOS DEMÁS (admin, gerente, cocina, mesero, recepcion, etc.)
        // Ven pedidos del día sin necesidad de turno
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
        console.log(`[fetchOrders] → ${user?.role}: cargando pedidos del día`);
      }

      const { data, error } = await query;

      // Merge helper: if a status update is in flight, don't let a stale DB read overwrite it
      const applyPending = (rows) => {
        if (pendingStatusUpdates.current.size === 0) return rows;
        return rows.map(o => {
          const pending = pendingStatusUpdates.current.get(o.id);
          return pending !== undefined ? { ...o, status: pending } : o;
        });
      };

      if (error) {
        console.error('[fetchOrders] Error:', error);
        const localOrders = await db.orders.toArray();
        setOrders(applyPending(localOrders));
        return;
      }

      console.log(`[fetchOrders] ✅ ${data?.length || 0} pedidos (rol: ${user?.role})`);
      setOrders(applyPending(data || []));
      
      // Actualizar cache local
      if (data) {
        await db.orders.bulkPut(data);
      }
    } catch (error) {
      console.error("Error fetching orders, checking local DB:", error);
      const localOrders = await db.orders.toArray();
      setOrders(localOrders);
    }
  };

  // Mantener ordersRef sincronizado con el estado actual (sin re-crear el interval)
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // AUTO-ADVANCE: Mover pedidos de 'nuevo' a 'fabricacion' después de 20 segundos.
  // Usa ordersRef para leer la lista más reciente sin depender de [orders],
  // lo que evita destruir y re-crear el interval en cada cambio de estado.
  // advancingOrders actúa como candado para prevenir llamadas duplicadas
  // mientras handleStatusChange (async) no ha terminado de actualizar el estado.
  useEffect(() => {
    const AUTO_ADVANCE_SECONDS = 20;
    const MAX_CONCURRENT = 3;

    const interval = setInterval(() => {
      if (!autoAdvanceEnabled) return;

      const now = new Date();
      const currentOrders = ordersRef.current;

      let fabricacionMesa = currentOrders.filter(
        o => o.status === 'fabricacion' && o.table_number && o.table_number !== 'DOMICILIO'
      ).length;
      let fabricacionDomicilio = currentOrders.filter(
        o => o.status === 'fabricacion' && (!o.table_number || o.table_number === 'DOMICILIO')
      ).length;

      currentOrders.forEach(order => {
        if (order.status !== 'nuevo') return;
        if (advancingOrders.current.has(order.id)) return; // ya en proceso

        const diffSeconds = Math.ceil(Math.abs(now - new Date(order.created_at)) / 1000);
        if (diffSeconds < AUTO_ADVANCE_SECONDS) return;

        const isMesa = order.table_number && order.table_number !== 'DOMICILIO';
        const atCapacity = isMesa ? fabricacionMesa >= MAX_CONCURRENT : fabricacionDomicilio >= MAX_CONCURRENT;
        if (atCapacity) return;

        // Reservar el slot antes de la llamada async para que el siguiente tick no duplique
        advancingOrders.current.add(order.id);
        if (isMesa) fabricacionMesa++;
        else fabricacionDomicilio++;

        handleStatusChange(order.id, 'fabricacion').finally(() => {
          advancingOrders.current.delete(order.id);
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoAdvanceEnabled]); // solo se recrea si el toggle cambia

  const handleStatusChange = async (orderId, newStatus, paymentDetails = null) => {
    const order = orders.find(o => o.id === orderId);

    // Lógica para Pagos
    if (newStatus === 'pagado') {
      if (order) {
        // Opción 1: Cargo Automático a Habitación (Bypass Modal)
        if (paymentDetails && paymentDetails.method === 'cargo_habitacion') {
          // Continúa abajo para procesar el cargo
        }
        // Opción 2: Ya pagado o total cero
        else if (order.is_paid || order.total === 0) {
          // Continúa
        }
        // Opción 3: Abrir Modal de Pago
        else {
          setPaymentModal({
            isOpen: true,
            orderId,
            totalPrice: order.total || order.total_price || 0,
            order: order
          });
          return;
        }
      }
    }

    // Registrar la actualización pendiente ANTES del update optimista.
    // fetchOrders() (Realtime + polling) respetará este valor mientras el async update está en vuelo,
    // evitando que datos viejos de la BD sobreescriban el estado local.
    pendingStatusUpdates.current.set(orderId, newStatus);
    try {
      // LOGICA ESPECIAL: CARGO A HABITACIÓN (Desde botón rápido)
      if (newStatus === 'pagado' && paymentDetails?.method === 'cargo_habitacion') {
        let bookingId = paymentDetails.reference; // Puede llegar como "HAB-101" o UUID

        // Si no es UUID, buscar la reserva activa por número de habitación
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);

        if (!isUUID) {
          const roomNum = bookingId.replace(/^HAB-/i, '').trim();

          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('number', roomNum)
            .single();

          if (roomError || !roomData) throw new Error(`Habitación ${roomNum} no encontrada.`);

          const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id')
            .eq('room_id', roomData.id)
            .eq('status', 'ocupada')
            .single();

          if (bookingError || !booking) throw new Error(`No hay reserva activa en la habitación ${roomNum}.`);

          bookingId = booking.id;
        }

        // Insertar Cargo
        const { error: chargeError } = await supabase
          .from('room_charges')
          .insert([{
            booking_id: bookingId,
            description: `Consumo Restaurante - Pedido #${orderId}`,
            amount: order.total || order.total_price,
            order_id: orderId
          }]);

        if (chargeError) throw chargeError;

        // Si todo sale bien, actualizamos el pedido localmente con los datos de pago
        // para asegurarnos que n8n o el update posterior tengan la info completa
        let prepTime = 0;
        if (order && order.created_at) {
          prepTime = Math.max(0, differenceInSeconds(new Date(), parseISO(order.created_at)));
        }

        await supabase
          .from('orders')
          .update({
            payment_method: 'cargo_habitacion',
            status: 'pagado',
            preparation_time_seconds: prepTime
          })
          .eq('id', orderId);

        sileo.success({ title: 'Cargo a Habitación', description: `Pedido #${orderId} cargado a la habitación.` });
        // Imprimir recibo para cargo a habitación
        handlePrint({ ...order, status: 'pagado', payment_method: 'cargo_habitacion', preparation_time_seconds: prepTime }, 'recibo');
      }

      // Optimistic UI update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      // Imprimir recibo para pedidos pre-pagados al finalizar (evitar duplicar cargo_habitacion)
      if (newStatus === 'pagado' && order?.is_paid && paymentDetails?.method !== 'cargo_habitacion') {
        const prepTime = order.created_at ? Math.max(0, differenceInSeconds(new Date(), parseISO(order.created_at))) : 0;
        handlePrint({ ...order, status: 'pagado', preparation_time_seconds: prepTime }, 'recibo');
      }

      // Delegar la actualización a n8n para activar triggers (ej. WhatsApp, Factus)
      if (isOnline) {
        await updateOrderStatus(orderId, newStatus);
        
        // Audit Log
        adminLog({
          action: 'Cambio de Estado',
          module: 'restaurante',
          entity_type: 'pedido',
          entity_id: orderId,
          description: `cambió el estado del pedido #${orderId} de ${order?.status} a ${newStatus}`,
          new_value: { status: newStatus }
        });
      } else {

        throw new Error("Offline");
      }

    } catch (error) {
      console.error("Error actualizando estado (n8n o Red):", error);

      // Fallback 1: Actualizar directamente en Supabase si n8n falla pero hay red
      if (isOnline) {
        try {
          let updatePayload = { status: newStatus };
          const curOrder = orders.find(o => o.id === orderId);
          if (newStatus === 'pagado' && curOrder?.created_at) {
            updatePayload.preparation_time_seconds = Math.max(0, differenceInSeconds(new Date(), parseISO(curOrder.created_at)));
          }

          const { error: sbError } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
          if (sbError) throw sbError;
          
          return;
        } catch (sbErr) {
          console.error("Error fallback Supabase:", sbErr);
        }
      }

      // Fallback 2: MODO OFFLINE - Guardar en cola de sincronización local
      try {
        await db.orders.update(orderId, { status: newStatus });
        await db.pending_sync.add({
          type: 'update-status',
          table: 'orders',
          data: { orderId, status: newStatus },
          status: 'pending',
          created_at: new Date().toISOString()
        });
        
        if (!isOnline) {
          sileo.warning({ title: 'Cambio guardado localmente', description: 'Se sincronizará cuando vuelva la conexión.' });
        }
      } catch (localErr) {
        console.error("Error fatal local:", localErr);
        sileo.error({ title: 'Error crítico', description: 'No se pudo guardar el cambio.' });
        fetchOrders(); // Revertir UI
      }
    } finally {
      // Siempre liberar el candado — sea éxito, fallback o error fatal.
      // Si llegamos aquí vía error fatal + fetchOrders(), el delete ya ocurrió
      // antes de que fetchOrders resuelva (es fire-and-forget), por lo que
      // la reversión leerá correctamente el estado de la BD.
      pendingStatusUpdates.current.delete(orderId);
    }
  };

  const handleUpdateOrder = async (orderId, updatedData) => {
    try {

      // 1. Obtener items antiguos para devolver stock
      const { data: oldItems, error: oldItemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

      if (oldItemsError) throw oldItemsError;

      // 2. Devolver Stock (Iterativo para seguridad)
      for (const item of oldItems) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const newStock = product.stock + item.quantity;
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product_id);

          await logInventoryChange({
            productId: item.product_id,
            branchId: user?.branch_id,
            quantityChanged: item.quantity,
            newStock: newStock,
            reason: 'devolucion', // Devolución por edición
            userId: user?.id
          });
        }
      }

      // 3. Eliminar items antiguos
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) throw deleteError;

      // 4. Actualizar datos de la orden (sin el campo items)
      const { items, ...orderFields } = updatedData;

      const { error: updateError } = await supabase
        .from('orders')
        .update(orderFields)
        .eq('id', orderId);

      if (updateError) throw updateError;

      // 5. Insertar nuevos items
      const newItemsFormatted = items.map(item => ({
        order_id: orderId,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        customization: item.customizations
      }));

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(newItemsFormatted);

      if (insertError) throw insertError;

      // 6. Descontar nuevo stock
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id);

          await logInventoryChange({
            productId: item.id,
            branchId: user?.branch_id,
            quantityChanged: -item.quantity,
            newStock: newStock,
            reason: 'venta',
            userId: user?.id
          });
        }
      }

      // 7. Refrescar y notificar
      await fetchOrders();
      sileo.success({ title: 'Pedido actualizado', description: 'El pedido fue modificado correctamente.' });

    } catch (error) {
      console.error("Error updating order:", error);
      sileo.error({ title: 'Error al actualizar', description: error.message });
    }
  };

  const handleDeleteOrder = async (orderId) => {
    // Confirmación doble: primer clic avisa, segundo clic ejecuta
    if (pendingDeleteId !== orderId) {
      setPendingDeleteId(orderId);
      sileo.warning({ title: 'Confirmar eliminación', description: 'Haz clic en "Eliminar" nuevamente para confirmar.' });
      setTimeout(() => setPendingDeleteId(null), 3000);
      return;
    }
    setPendingDeleteId(null);

    try {
      // 1. Obtener los items del pedido para devolver al inventario
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // 2. Devolver stock
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single();

          if (product) {
            const newStock = product.stock + item.quantity;
            await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', item.product_id);

            await logInventoryChange({
              productId: item.product_id,
              branchId: user?.branch_id,
              quantityChanged: item.quantity,
              newStock: newStock,
              reason: 'devolucion', // Devolución por cancelación/eliminación
              userId: user?.id
            });
          }
        }
      }

      // 3. Eliminar el pedido
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;

      setOrders(prev => prev.filter(o => o.id !== orderId));
      sileo.success({ title: 'Pedido eliminado', description: `Pedido #${orderId} eliminado y stock devuelto.` });
      
      // Audit Log
      adminLog({
        action: 'Eliminación de Pedido',
        module: 'restaurante',
        entity_type: 'pedido',
        entity_id: orderId,
        description: `eliminó permanentemente el pedido #${orderId} y devolvió el stock`,
      });

    } catch (error) {
      console.error("Error eliminando pedido:", error);
      sileo.error({ title: 'Error al eliminar', description: error.message });
    }
  };

  const handlePaymentConfirm = async (orderId, method, reference, taxData = null, splitData = null) => {
    try {
      // Calcular tiempo de preparación final usando date-fns para consistencia
      const order = orders.find(o => o.id === orderId);
      let prepTime = 0;
      if (order && order.created_at) {
        prepTime = Math.max(0, differenceInSeconds(new Date(), parseISO(order.created_at)));
      }

      const updates = {
        status: 'pagado',
        payment_method: method,
        preparation_time_seconds: prepTime,
        tax_data: taxData // Save tax/customer data for electronic invoicing
      };

      // LOGICA DE CARGO A HABITACIÓN
      if (method === 'cargo_habitacion') {
        const bookingId = reference; // PaymentModal sends bookingId in reference field
        if (bookingId) {
          const { error: chargeError } = await supabase
            .from('room_charges')
            .insert([{
              booking_id: bookingId,
              description: `Consumo Restaurante - Pedido #${orderId}`,
              amount: order.total || order.total_price || 0,
              order_id: orderId
            }]);

          if (chargeError) throw chargeError;
        }
      }

      // 8. LOGICA DE CUENTA DIVIDIDA
      if (splitData) {
        const { error: splitError } = await supabase
          .from('order_splits')
          .insert([{
            order_id: orderId,
            amount: splitData.amount,
            payment_method: method,
            split_type: splitData.type,
            reference: reference,
            items_json: splitData.items // For itemized split
          }]);

        if (splitError) throw splitError;

        sileo.success({ title: 'Pago parcial registrado', description: `Se recibió un pago de $${splitData.amount.toLocaleString()}.` });
        
        // If it's a split, we might want to NOT mark the order as fully paid yet
        // but for the sake of this MVP and the user's current flow, we'll mark as pagado 
        // OR we could check if it's the last split.
        // For now, simplicity: finalize the order but mark it as shared.
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      // Actualización optimista de la UI
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));

      // Audit Log
      adminLog({
        action: 'Confirmación de Pago',
        module: 'restaurante',
        entity_type: 'pedido',
        entity_id: orderId,
        description: `confirmó el pago del pedido #${orderId} vía ${method}`,
        new_value: updates
      });


      // Cerrar modal localmente y actualizar UI
      setPaymentModal({ ...paymentModal, isOpen: false });

      // Imprimir recibo
      if (order) handlePrint({ ...order, ...updates, tax_data: taxData }, 'recibo');

      // 10. EMISIÓN AUTOMÁTICA DE FACTURA ELECTRÓNICA
      // Si se proporcionaron datos fiscales (ej: third_party_id de un cliente), emitir DIAN
      if (taxData?.third_party_id || taxData?.identification) {
        // Ejecutar en segundo plano para no bloquear al cajero
        (async () => {
          try {
            console.log('[App] Iniciando auto-factura para pedido:', orderId);
            const res = await emitInvoiceForOrder({ ...order, ...updates, tax_data: taxData });
            if (res.success) {
              sileo.success({ title: 'Factura DIAN Emitida', description: `Pedido #${orderId} registrado ante la DIAN (${res.bill.number}).` });
            } else {
              // Si falla la auto-emisión, notificar para que lo hagan manual en Contabilidad
              sileo.warning({ title: 'Factura DIAN Pendiente', description: `Error al emitir: ${res.error}. Por favor reintenta desde Contabilidad → Facturación.` });
            }
          } catch (err) {
            console.error('[App] Error en auto-factura:', err);
          }
        })();
      }

    } catch (error) {
      console.error("Error procesando pago:", error);
      sileo.error({ title: 'Error en el pago', description: error.message });
    }
  };

  const handlePrint = (order, type = 'comanda') => {
    setPrintData({ order, type });
  };

  const handleAfterPrint = () => {
    setPrintData({ order: null, type: 'comanda' });
  };

  // Esta función ahora será llamada por NewOrderModal cuando termine de insertar en Supabase
  // O simplemente el Realtime lo hará. Para compatibilidad, la mantenemos como "refetch"
  const handleAddOrder = (newOrder = null) => {
    fetchOrders();
    // Si el pedido fue creado como pre-pagado, imprimir recibo inmediatamente
    if (newOrder?.is_paid) {
      handlePrint(newOrder, 'recibo');
    }
  };

  // --- PUBLIC ROUTES (No login required) ---
  const isPublicCheckIn = (window.location.search.includes('id=') || window.location.search.includes('source=landing_page') || window.location.pathname.includes('/digital-checkin')) && !window.location.pathname.includes('/admin');

  if (isPublicCheckIn) return <DigitalCheckIn />;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-secondary font-bold text-xl animate-pulse">Cargando sistema...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <>
      <div id="main-app-container" className="flex min-h-screen bg-surface-soft text-secondary">
        {/* Banner Offline / Sincronización */}
        <OfflineBanner />
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          activeRestaurantSubTab={activeRestaurantSubTab}
          setActiveRestaurantSubTab={setActiveRestaurantSubTab}
          activeHotelSubTab={activeHotelSubTab}
          setActiveHotelSubTab={setActiveHotelSubTab}
          activeAccountingSubTab={activeAccountingSubTab}
          setActiveAccountingSubTab={setActiveAccountingSubTab}
        />

        <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-72'} p-3 md:p-6 pt-16 lg:pt-6 w-full overflow-hidden`}>
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-3 border-b border-hairline animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-3 bg-canvas text-secondary rounded-full shadow-airbnb border border-hairline">
                <LayoutGrid size={20} strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-widest rounded-full">Portal Corporativo</span>
                  <h1 className="text-2xl md:text-3xl font-bold text-secondary tracking-tight">
                    {activeTab === 'restaurante' ? 'Gestión Restaurante' :
                      activeTab === 'analytics' ? 'Dashboard Global' :
                        activeTab === 'users' ? 'Gestión de Personal' :
                          activeTab === 'sedes' ? 'Administración de Sedes' :
                            activeTab === 'hotels' ? 'Gestión Hotelera' :
                              activeTab === 'contabilidad' ? 'Contabilidad General' :
                                activeTab === 'marketing' ? 'Marketing AI Studio' :
                                  activeTab === 'qr_tools' ? 'Generador de QR' : 
                                    activeTab === 'saas_admin' ? 'Super Admin SaaS' : 'Seguridad y Auditoría'}
                  </h1>
                </div>
                <p className="text-[10px] font-bold text-accent/60 flex items-center gap-2 uppercase tracking-tight">
                  <Activity size={10} className="text-emerald-500 animate-pulse" />
                  {activeTab === 'restaurante' ? 'Pedidos, carta y control de cajas' :
                    activeTab === 'analytics' ? 'Indicadores clave de rendimiento' :
                      activeTab === 'sedes' ? 'Control logístico de sucursales' :
                        activeTab === 'hotels' ? 'Reservas y gestión de habitaciones' :
                          activeTab === 'contabilidad' ? 'Estados financieros y balances' :
                            activeTab === 'marketing' ? 'Generación de contenido publicitario con IA' :
                              activeTab === 'qr_tools' ? 'Configuración de mesas y accesos digitales' :
                                activeTab === 'operaciones' ? 'Registro de actividad y seguridad' : 'Gestión operativa en tiempo real'}
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-secondary font-black uppercase tracking-widest bg-secondary/5 px-2 py-0.5 rounded-md text-[9px] md:text-[10px]">
                    {user.name || 'USUARIO'}
                  </span>
                </p>
              </div>

              {/* Dynamic Header Actions Portal Target */}
              <div id="header-actions-portal" className="flex items-center gap-2 ml-auto mr-4"></div>

              {/* Indicador de Estado de Caja/Cocina */}
              <div className={`ml-auto md:ml-4 px-3 py-1.5 rounded-xl flex items-center gap-2 border shadow-sm transition-all ${hasActiveShift ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                <div className={`w-2 h-2 rounded-full ${hasActiveShift ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {(user?.role === 'cocina' || user?.role === 'mesero')
                    ? (hasActiveShift ? 'Cocina Abierta' : 'Cocina Cerrada')
                    : (hasActiveShift ? 'Caja Abierta' : 'Caja Cerrada')}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
              {/* Sistema de Notificaciones en Tiempo Real */}
              <NotificationPanel
                isOpen={showNotifications}
                onClose={() => setShowNotifications(prev => !prev)}
              />

              {activeTab === 'restaurante' && user?.role !== 'cocina' && user?.role !== 'mesero' && (
                <button
                  onClick={handleOpenNewOrder}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 bg-primary text-white px-3 py-2 md:px-4 rounded-xl shadow-[0_4px_14px_0_rgba(255,71,87,0.2)] hover:brightness-110 active:scale-95 transition-all font-bold text-[11px] md:text-[12px] whitespace-nowrap"
                >
                  <Plus size={16} />
                  Nuevo <span className="hidden sm:inline">Pedido</span>
                </button>
              )}
              {activeTab === 'restaurante' && user?.role !== 'cocina' && user?.role !== 'mesero' && (
                <button className="flex items-center gap-2 bg-white px-3 py-2 md:px-4 rounded-xl border border-gray-200 shadow-sm text-[11px] md:text-[12px] font-bold text-secondary hover:bg-gray-50 transition-colors">
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filtros</span>
                </button>
              )}
            </div>
          </header>

          {activeTab === 'restaurante' && (
            <RestaurantManagement
              orders={orders}
              onStatusChange={handleStatusChange}
              onEdit={(order) => { setEditingOrder(order); setIsModalOpen(true); }}
              onDelete={handleDeleteOrder}
              onPrint={handlePrint}
              autoAdvance={autoAdvanceEnabled}
              onToggleAutoAdvance={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
              activeSubTab={activeRestaurantSubTab}
              setActiveSubTab={setActiveRestaurantSubTab}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsPro />}
          {activeTab === 'hotels' && <HotelManagement activeSubTab={activeHotelSubTab} />}
          {activeTab === 'contabilidad' && <AccountingModule orders={orders} activeSubTab={activeAccountingSubTab} setActiveSubTab={setActiveAccountingSubTab} />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'sedes' && <BranchManagement />}
          {activeTab === 'marketing' && <MarketingModule />}
          {activeTab === 'qr_tools' && <TableQRGenerator />}
          {activeTab === 'operaciones' && <OperationsHub />}
          {activeTab === 'saas_admin' && <SaasAdminPanel />}
        </main>

        <NewOrderModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingOrder(null);
          }}
          orders={orders}
          onAddOrder={handleAddOrder}
          onUpdateOrder={handleUpdateOrder}
          editingOrder={editingOrder}
          shiftId={activeShift?.id} // Pasamos el ID del turno activo
        />

        <PaymentModal
          isOpen={paymentModal.isOpen}
          orderId={paymentModal.orderId}
          totalPrice={paymentModal.totalPrice}
          order={paymentModal.order}
          onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
          onConfirm={(id, method, ref, tax, split) => {
            handlePaymentConfirm(id, method, ref, tax, split);
          }}
        />

        {/* Componente de impresión movido al root para evitar ocultamiento por CSS */}


        {/* Modal Aviso Caja Cerrada */}
        {showShiftWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300 text-center">
              <div className="bg-red-500 p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <ShieldCheck size={48} className="mx-auto mb-2 text-white/90" />
                  <h3 className="text-xl font-black tracking-tight">Caja Cerrada</h3>
                </div>
                <Wallet className="absolute -right-6 -bottom-6 text-white/10 w-32 h-32 rotate-12" />
              </div>
              <div className="p-8 space-y-6">
                <p className="text-sm font-medium text-gray-500">
                  Por seguridad, no se pueden facturar pedidos sin un turno activo.
                  <br /><br />
                  <span className="text-secondary font-black">¿Desea abrir la caja ahora?</span>
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowShiftWarning(false);
                      setActiveTab('restaurante');
                      setTimeout(() => window.dispatchEvent(new CustomEvent('open-shift-modal')), 100);
                    }}
                    className="w-full bg-secondary text-white py-4 rounded-xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-widest"
                  >
                    Ir a Apertura de Turno
                  </button>
                  <button
                    onClick={() => setShowShiftWarning(false)}
                    className="w-full py-3 text-gray-400 font-bold hover:text-secondary transition-colors text-xs uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Componente de Impresión (Fuera del contenedor principal oculto) */}
      {printData.order && (
        <TicketPrinter
          order={printData.order}
          type={printData.type}
          onAfterPrint={handleAfterPrint}
        />
      )}

      {/* Sistema de Notificaciones Sileo */}
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
