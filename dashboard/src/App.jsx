import React, { useState, useEffect } from 'react';
import { updateOrderStatus } from './api';
import { useAuth } from './context/AuthContext';
import { useRealtime } from './context/RealtimeContext';
import { supabase } from './lib/supabase';
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
import { LayoutGrid, Filter, Plus, Building2, ShieldCheck, Wallet, Activity } from 'lucide-react';
import { Toaster, sileo } from 'sileo';
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

function App() {
  const { user, loading } = useAuth();
  const { ordersVersion } = useRealtime();
  const [activeTab, setActiveTab] = useState('operaciones'); // Pestaña por defecto, no persistente

  // Eliminamos el useEffect que guardaba la pestaña en localStorage
  // para cumplir con el requerimiento de que la selección sea manual al recargar.

  const [showNotifications, setShowNotifications] = useState(false);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);

  const [orders, setOrders] = useState([]);
  const [activeShift, setActiveShift] = useState(null); // Estado para el turno activo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeRestaurantSubTab, setActiveRestaurantSubTab] = useState(user?.role === 'cajero' ? 'turnos' : 'board');
  const [activeHotelSubTab, setActiveHotelSubTab] = useState('habitaciones');
  const [activeAccountingSubTab, setActiveAccountingSubTab] = useState('summary');
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, orderId: null, totalPrice: 0 });
  const [printData, setPrintData] = useState({ order: null, type: 'comanda' });

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




  // Ajustar pestaña inicial y UI según el rol
  useEffect(() => {
    if (user) {
      const role = user.role;
      if (role === 'cajero') {
        // Cajero: Sidebar colapsado y pestaña Caja por defecto
        setIsSidebarCollapsed(true);
        setActiveTab('restaurante');
        setActiveRestaurantSubTab('turnos');
      } else if (role === 'admin' || role === 'gerente') {
        // Admin/Gerente: vista normal
        setActiveTab('restaurante');
      } else {
        // TODOS los demás roles (cocina, mesero, etc.): Board directo, sidebar colapsado
        setIsSidebarCollapsed(true);
        setActiveTab('restaurante');
        setActiveRestaurantSubTab('board');
      }
    }
  }, [user]);

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

      if (error) {
        console.error('[fetchOrders] Error:', error);
        throw error;
      }

      console.log(`[fetchOrders] ✅ ${data?.length || 0} pedidos (rol: ${user?.role})`);
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  // AUTO-ADVANCE: Mover pedidos de 'nuevo' a 'fabricacion' después de 5 segundos
  // LIMITADO: Solo si hay menos de 3 pedidos en fabricación por tipo (Mesa vs Domicilio)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      // Contar pedidos actuales en fabricación para verificar límites
      let fabricacionMesa = orders.filter(o => o.status === 'fabricacion' && o.table_number && o.table_number !== 'DOMICILIO').length;
      let fabricacionDomicilio = orders.filter(o => o.status === 'fabricacion' && (!o.table_number || o.table_number === 'DOMICILIO')).length;

      orders.forEach(order => {
        if (order.status === 'nuevo') {
          const createdAt = new Date(order.created_at);
          const diffTime = Math.abs(now - createdAt);
          const diffSeconds = Math.ceil(diffTime / 1000);

          if (diffSeconds >= 20) {
            const isMesa = order.table_number && order.table_number !== 'DOMICILIO';

            // Verificar capacidad antes de mover
            if (isMesa) {
              if (fabricacionMesa < 3) {
                console.log(`Auto-advancing Mesa order ${order.id}`);
                handleStatusChange(order.id, 'fabricacion');
                fabricacionMesa++; // Prevenir mover múltiples en el mismo tick si excede límite
              }
            } else {
              if (fabricacionDomicilio < 3) {
                console.log(`Auto-advancing Domicilio order ${order.id}`);
                handleStatusChange(order.id, 'fabricacion');
                fabricacionDomicilio++;
              }
            }
          }
        }
      });
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [orders]); // Re-run when orders change to avoid stale closures

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
          setPaymentModal({ isOpen: true, orderId, totalPrice: order.total });
          return;
        }
      }
    }

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
        await supabase
          .from('orders')
          .update({
            payment_method: 'cargo_habitacion',
            status: 'pagado'
          })
          .eq('id', orderId);

        alert("✅ Cargo a habitación realizado correctamente.");
      }

      // Optimistic UI update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      // Delegar la actualización a n8n para activar triggers (ej. WhatsApp, Factus)
      // Nota: Si ya actualizamos arriba, n8n podría redudnar, pero sirve para notificaciones.
      await updateOrderStatus(orderId, newStatus);

    } catch (error) {
      console.error("Error actualizando estado vía n8n:", error);

      // Fallback: Actualizar directamente en Supabase si n8n falla
      try {
        const { error: sbError } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (sbError) throw sbError;

        // Si funcionó el fallback, no revertimos, pero avisamos (opcional, para no spammear quitamos el alert intrusivo)
        console.warn("N8N no disponible. Estado actualizado directamente en Supabase.");

        // Podríamos mostrar un toast aquí si tuviéramos un sistema de notificaciones, 
        // pero por ahora el console.warn es suficiente para no bloquear el flujo.

      } catch (fallbackError) {
        console.error("Error fatal: Falló n8n y también Supabase", fallbackError);
        alert("Error crítico: No se pudo actualizar el estado del pedido.");
        fetchOrders(); // Revertir UI
      }
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
          await supabase
            .from('products')
            .update({ stock: product.stock + item.quantity })
            .eq('id', item.product_id);
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
          await supabase
            .from('products')
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq('id', item.id);
        }
      }

      // 7. Refrescar y notificar
      await fetchOrders();
      alert("✅ Pedido actualizado correctamente");

    } catch (error) {
      console.error("Error updating order:", error);
      alert("❌ Error al actualizar el pedido: " + error.message);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('¿Está seguro de eliminar este pedido permanentemente?')) {
      try {
        // 1. Obtener los items del pedido para devolver al inventario
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', orderId);

        if (itemsError) throw itemsError;

        // 2. Devolver stock (iterar uno por uno para asegurar consistencia simple)
        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            // Obtener stock actual para sumar
            const { data: product } = await supabase
              .from('products')
              .select('stock')
              .eq('id', item.product_id)
              .single();

            if (product) {
              await supabase
                .from('products')
                .update({ stock: product.stock + item.quantity })
                .eq('id', item.product_id);
            }
          }
        }

        // 3. Eliminar el pedido (Cascada eliminará los items de la BD, pero ya devolvimos el stock)
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;

        // La UI se actualizará via Realtime, pero limpieza optimista:
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } catch (error) {
        console.error("Error eliminando pedido:", error);
        alert("Error al eliminar pedido: " + error.message);
      }
    }
  };

  const handlePaymentConfirm = async (orderId, method, reference, taxData = null) => {
    try {
      // Calcular tiempo de preparación final usando date-fns para consistencia
      // Importamos dinámicamente o usamos lógica robusta similar
      const order = orders.find(o => o.id === orderId);
      let prepTime = 0;
      if (order && order.created_at) {
        const created = new Date(order.created_at);
        const now = new Date();
        prepTime = Math.max(0, Math.floor((now - created) / 1000));
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
              amount: order.total_price,
              order_id: orderId
            }]);

          if (chargeError) throw chargeError;
        }
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      // Actualización optimista de la UI
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));

      // Cerrar modal localmente y actualizar UI
      setPaymentModal({ ...paymentModal, isOpen: false });

      // Imprimir recibo
      if (order) handlePrint({ ...order, ...updates, tax_data: taxData }, 'recibo');

    } catch (error) {
      console.error("Error procesando pago:", error);
      alert("Error registrando el pago: " + error.message);
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
  const handleAddOrder = (newOrder) => {
    // Si NewOrderModal ya insertó en BD, aquí solo esperamos el Realtime.
    // Pero si NewOrderModal nos pasa el objeto para insertar, lo hacemos aquí.
    // POR AHORA: Asumiremos que NewOrderModal será refactorizado para insertar DIRECTAMENTE en Supabase.
    // Así que esta función puede ser un simple fetchOrders() o empty si confiamos en Realtime.
    fetchOrders();
  };

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
      <div id="main-app-container" className="flex min-h-screen bg-[#f8fafc] text-secondary">
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

        <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} p-3 md:p-8 pt-20 lg:pt-8 w-full overflow-hidden`}>
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-gray-200/60 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="p-3 bg-secondary text-white rounded-[1.25rem] shadow-xl shadow-secondary/10">
                <LayoutGrid size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter rounded-sm">Portal Corporativo</span>
                  <h1 className="text-2xl md:text-3xl font-black text-secondary tracking-tighter">
                    {activeTab === 'restaurante' ? 'Gestión Restaurante' :
                      activeTab === 'analytics' ? 'Dashboard Global' :
                        activeTab === 'users' ? 'Gestión de Personal' :
                          activeTab === 'sedes' ? 'Administración de Sedes' :
                            activeTab === 'hotels' ? 'Gestión Hotelera' :
                              activeTab === 'contabilidad' ? 'Contabilidad General' :
                                activeTab === 'marketing' ? 'Marketing AI Studio' :
                                  activeTab === 'qr_tools' ? 'Generador de QR' : 'Seguridad y Auditoría'}
                  </h1>
                </div>
                <p className="text-xs font-bold text-accent/70 flex items-center gap-2 uppercase tracking-tight">
                  <Activity size={12} className="text-emerald-500 animate-pulse" />
                  {activeTab === 'restaurante' ? 'Pedidos, carta y control de cajas' :
                    activeTab === 'analytics' ? 'Indicadores clave de rendimiento' :
                      activeTab === 'sedes' ? 'Control logístico de sucursales' :
                        activeTab === 'hotels' ? 'Reservas y gestión de habitaciones' :
                          activeTab === 'contabilidad' ? 'Estados financieros y balances' :
                            activeTab === 'marketing' ? 'Generación de contenido publicitario con IA' :
                              activeTab === 'qr_tools' ? 'Configuración de mesas y accesos digitales' :
                                activeTab === 'operaciones' ? 'Registro de actividad y seguridad' : 'Gestión operativa en tiempo real'}
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-secondary font-black uppercase tracking-widest bg-secondary/5 px-2 py-0.5 rounded-md text-[10px] md:text-xs">
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
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 bg-primary text-white px-3 py-2.5 md:px-5 rounded-xl shadow-[0_4px_14px_0_rgba(255,71,87,0.3)] hover:brightness-110 active:scale-95 transition-all font-bold text-xs md:text-sm whitespace-nowrap"
                >
                  <Plus size={18} />
                  Nuevo <span className="hidden sm:inline">Pedido</span>
                </button>
              )}
              {activeTab === 'restaurante' && user?.role !== 'cocina' && user?.role !== 'mesero' && (
                <button className="flex items-center gap-2 bg-white px-3 py-2.5 md:px-4 rounded-xl border border-gray-200 shadow-sm text-xs md:text-sm font-bold text-secondary hover:bg-gray-50 transition-colors">
                  <Filter size={18} />
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
          onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
          onConfirm={(id, method, ref, tax) => {
            handlePaymentConfirm(id, method, ref, tax);
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
