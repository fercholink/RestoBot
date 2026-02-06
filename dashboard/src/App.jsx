import React, { useState, useEffect } from 'react';
import { updateOrderStatus } from './api';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
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
import { LayoutGrid, Filter, Plus, Building2, Bell, BellDot, AlertTriangle, ShieldCheck, Wallet, Terminal, User, Printer, Activity, Megaphone } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('restobot_active_tab') || 'restaurante';
  });

  useEffect(() => {
    localStorage.setItem('restobot_active_tab', activeTab);
  }, [activeTab]);

  // Estados para control de turnos y edición
  const [hasActiveShift, setHasActiveShift] = useState(() => {
    // Check initial state from storage
    const shifts = JSON.parse(localStorage.getItem('restobot_shifts') || '[]');
    return shifts.some(s => s.status === 'abierto');
  });

  // Listen for shift updates
  useEffect(() => {
    const checkShiftStatus = () => {
      const shifts = JSON.parse(localStorage.getItem('restobot_shifts') || '[]');
      setHasActiveShift(shifts.some(s => s.status === 'abierto'));
    };

    window.addEventListener('shift-updated', checkShiftStatus);
    return () => window.removeEventListener('shift-updated', checkShiftStatus);
  }, []);

  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);

  const [orders, setOrders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeRestaurantSubTab, setActiveRestaurantSubTab] = useState(user?.role === 'cajero' ? 'turnos' : 'board');
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, orderId: null, totalPrice: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [printData, setPrintData] = useState({ order: null, type: 'comanda' });

  // Estados de turno movidos arriba
  // const [hasActiveShift... ya definidos ex-inicio

  const handleOpenNewOrder = () => {
    if (!hasActiveShift) {
      setShowShiftWarning(true);
    } else {
      setIsModalOpen(true);
    }
  };

  // Mock de notificaciones de inventario (Pending migration to real alerts)
  const stockAlerts = [];

  // Ajustar pestaña inicial y UI según el rol
  useEffect(() => {
    if (user) {
      if (user.role === 'cajero') {
        // Reglas para Cajero: Sidebar colapsado y pestaña Caja por defecto (si no hay una guardada o forzamos inicio)
        setIsSidebarCollapsed(true);
        if (!localStorage.getItem('restobot_active_tab') || localStorage.getItem('restobot_active_tab') === 'caja') {
          setActiveTab('restaurante');
        }
      } else if (!localStorage.getItem('restobot_active_tab')) {
        setActiveTab('restaurante');
      }
    }
  }, [user]);

  // --- SUPABASE INTEGRATION FOR ORDERS ---

  useEffect(() => {
    fetchOrders();

    // Suscripción Realtime para la tabla 'orders'
    const ordersChannel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        console.log('Realtime Order Change:', payload);
        fetchOrders(); // Recarga simple por ahora para traer items relacionados también
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      // Necesitamos los items también. Supabase permite hacer joins profundos.
      // 1. Obtener turno activo actual (si existe) para filtrar pedidos de la sesión
      const shifts = JSON.parse(localStorage.getItem('restobot_shifts') || '[]');
      const activeShift = shifts.find(s => s.status === 'abierto');

      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .order('created_at', { ascending: false });

      // LOGICA DE FILTRADO POR ROL
      // LOGICA DE FILTRADO PARA CAJEROS
      if (user && user.role !== 'admin' && user.role !== 'gerente') {
        const todayStr = new Date().toISOString().split('T')[0];
        // Mostrar pedidos creados HOY o pedidos ACTIVOS (no pagados) de cualquier fecha
        // Como 'or' es complejo en supabase client js con filtros anidados, simplificamos:
        // Traemos los de hoy. Los activos antiguos deberían ser pocos o gestionados por admin.

        // Filtro: created_at >= hoy Inicio del día
        query = query.gte('created_at', `${todayStr}T00:00:00`);
      }


      const { data, error } = await query;

      if (error) throw error;
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

  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === 'pagado') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setPaymentModal({ isOpen: true, orderId, totalPrice: order.total });
      }
      return;
    }

    try {
      // Optimistic UI update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      // Delegar la actualización a n8n para activar triggers (ej. WhatsApp, Factus)
      await updateOrderStatus(orderId, newStatus);

      // No necesitamos actualizar Supabase manualmente aquí, n8n lo hará.
      // El Realtime confirmará el cambio en breve.

    } catch (error) {
      console.error("Error actualizando estado vía n8n:", error);
      const errorMsg = error.response ? `Status: ${error.response.status}. ${JSON.stringify(error.response.data)}` : error.message;

      // Mostrar toast o alerta más amigable
      const isNetworkError = errorMsg.includes('Network Error') || errorMsg.includes('Failed to fetch');
      alert(isNetworkError
        ? "⚠️ No se pudo conectar con el Asistente WhatsApp (n8n). El estado se guardará localmente, pero el cliente NO recibirá notificación."
        : `Error de sincronización: ${errorMsg}`
      );

      // En caso de error de red, mantenemos el cambio optimista (porque Supabase probablemente sí funcionó si está desacoplado, 
      // o deberíamos revertir si la idea es que n8n hace el update en supabase).
      // NOTA: Según la arquitectura actual, el dashboard hace el update a n8n y n8n a su vez a Supabase.
      // Si n8n falla, el update NO se hizo en BD. Revertimos.
      fetchOrders();
    }
  };

  const handleUpdateOrder = async (updatedOrderData) => {
    // Este handler era para edición full. Por ahora lo dejamos simple o logueamos.
    // En Supabase implicaría Updates a 'orders' y upserts/deletes a 'order_items'.
    console.warn("Edición completa de pedido pendiente de refactorizar para Supabase");
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
        preparation_time_seconds: prepTime
      };

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
    // Reset after print dialog would ideally close, but for now just setting it works 
    // as TicketPrinter usually handles its own lifecycle or we can reset it on effective print.
    // However, keeping it simple:
    setTimeout(() => setPrintData({ order: null, type: 'comanda' }), 100);
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
              {/* Indicador de Estado de Caja */}
              <div className={`ml-auto md:ml-4 px-3 py-1.5 rounded-xl flex items-center gap-2 border shadow-sm transition-all ${hasActiveShift ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                <div className={`w-2 h-2 rounded-full ${hasActiveShift ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{hasActiveShift ? 'Caja Abierta' : 'Caja Cerrada'}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
              {/* Sistema de Notificaciones */}
              {(user.role === 'admin' || user.role === 'gerente') && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`p-2 md:p-2.5 rounded-xl border border-gray-200 transition-all relative ${showNotifications ? 'bg-secondary text-white' : 'bg-white text-secondary hover:bg-gray-50'}`}
                  >
                    {stockAlerts.length > 0 ? <BellDot size={18} className="text-primary" /> : <Bell size={18} />}
                    {stockAlerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-primary text-white text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#f8fafc]">
                        {stockAlerts.length}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-72 md:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Alertas de Inventario</h4>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Crítico</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {stockAlerts.map(alert => (
                          <div key={alert.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                              <AlertTriangle size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-black text-secondary">{alert.product}</p>
                              <p className="text-[10px] text-gray-400 font-medium">Quedan {alert.stock} unidades</p>
                              <div className="flex items-center gap-1 mt-1 text-[9px] font-black text-primary uppercase">
                                <Building2 size={10} />
                                {alert.branch}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'restaurante' && (
                <button
                  onClick={handleOpenNewOrder}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 bg-primary text-white px-3 py-2.5 md:px-5 rounded-xl shadow-[0_4px_14px_0_rgba(255,71,87,0.3)] hover:brightness-110 active:scale-95 transition-all font-bold text-xs md:text-sm whitespace-nowrap"
                >
                  <Plus size={18} />
                  Nuevo <span className="hidden sm:inline">Pedido</span>
                </button>
              )}
              {activeTab === 'restaurante' && (
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
          {activeTab === 'hotels' && <HotelManagement />}
          {activeTab === 'contabilidad' && <AccountingModule orders={orders} />}
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
        />

        <PaymentModal
          isOpen={paymentModal.isOpen}
          orderId={paymentModal.orderId}
          totalPrice={paymentModal.totalPrice}
          onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
          onConfirm={(id, method, ref, tax) => {
            handlePaymentConfirm(id, method, ref, tax);
            const order = orders.find(o => o.id === id);
            if (order) handlePrint({ ...order, payment_method: method, tax_data: tax }, 'recibo');
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
        />
      )}
    </>
  );
}

export default App;
