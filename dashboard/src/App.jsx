import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
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
import CorporateIntelligence from './components/CorporateIntelligence';
import MarketingModule from './components/Marketing/MarketingModule';
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

  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, orderId: null, totalPrice: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [printData, setPrintData] = useState({ order: null, type: 'comanda' });

  // Mock de notificaciones de inventario
  const stockAlerts = [
    { id: 1, product: 'Hamburguesa Clásica', stock: 3, threshold: 5, branch: 'Sede Norte' },
    { id: 2, product: 'Coca Cola 350ml', stock: 2, threshold: 12, branch: 'Global' },
  ];

  // Ajustar pestaña inicial según el rol (solo si no hay una guardada)
  useEffect(() => {
    if (user && !localStorage.getItem('restobot_active_tab')) {
      if (user.role === 'gerente') {
        setActiveTab('corporate');
      } else {
        setActiveTab('restaurante');
      }
    }
  }, [user]);
  // Automatización: Si no hay pedidos en fabricación y hay nuevos, pasar uno automáticamente tras 2 segundos
  useEffect(() => {
    // Solo aplicar si estamos en la vista de pedidos
    if (activeTab !== 'restaurante') return;

    const inFabricacion = orders.filter(o => o.status === 'fabricacion');
    const nuevos = orders.filter(o => o.status === 'nuevo');

    if (inFabricacion.length === 0 && nuevos.length > 0) {
      console.log("Automatización: Cocina libre, preparando auto-pase...");
      const timer = setTimeout(() => {
        // Tomar el pedido más antiguo (último del array si se usa unshift) o el primero de la cola filtrada
        // En nuestro caso, los nuevos pedidos se agregan al inicio, por lo que el más antiguo es el último
        const oldestOrder = nuevos[nuevos.length - 1];
        handleStatusChange(oldestOrder.id, 'fabricacion');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [orders, activeTab]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Verificar turno activo para bloqueo de ventas
  const [hasActiveShift, setHasActiveShift] = useState(() => {
    const saved = localStorage.getItem('restobot_shifts');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.some(s => s.status === 'abierto');
    }
    return false;
  });

  // Escucha cambios en el turno (Demo simplification)
  useEffect(() => {
    const interval = setInterval(() => {
      const saved = localStorage.getItem('restobot_shifts');
      if (saved) {
        setHasActiveShift(JSON.parse(saved).some(s => s.status === 'abierto'));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [showShiftWarning, setShowShiftWarning] = useState(false);

  const handleOpenNewOrder = () => {
    if (!hasActiveShift) {
      setShowShiftWarning(true);
      return;
    }
    setIsModalOpen(true);
  };

  const handlePrint = (order, type = 'comanda') => {
    setPrintData({ order, type });
    // Pequeño delay para que React renderice el contenido oculto antes de imprimir
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Limpiar estado de impresión al terminar
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintData({ order: null, type: 'comanda' });
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleStatusChange = (orderId, newStatus) => {
    if (newStatus === 'pagado') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setPaymentModal({ isOpen: true, orderId, totalPrice: order.total_price });
      } else {
        console.error("Error: Pedido no encontrado para pago", orderId);
      }
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let updates = { status: newStatus };
        if (newStatus === 'despachado') {
          updates.dispatched_at = new Date().toISOString();
        }
        return { ...o, ...updates };
      }
      return o;
    }));
  };

  const handleUpdateOrder = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setEditingOrder(null);
  };

  const handleDeleteOrder = (orderId) => {
    if (window.confirm('¿Está seguro de eliminar este pedido permanentemente?')) {
      // Restaurar inventario al eliminar
      const orderToDelete = orders.find(o => o.id === orderId);
      if (orderToDelete) {
        const savedProducts = localStorage.getItem('restobot_products');
        if (savedProducts) {
          let products = JSON.parse(savedProducts);
          orderToDelete.items.forEach(item => {
            const productIndex = products.findIndex(p => p.id === item.id);
            if (productIndex !== -1) {
              products[productIndex].stock = (products[productIndex].stock || 0) + item.quantity;
            }
          });
          localStorage.setItem('restobot_products', JSON.stringify(products));
          // Notificar cambio de stock
          window.dispatchEvent(new Event('storage'));
        }
      }

      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  const handlePaymentConfirm = (orderId, method, reference, taxData = null) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let updates = {
          status: 'pagado',
          is_paid: true,
          payment_method: method,
          payment_reference: reference,
          tax_data: taxData,
          is_electronic_invoiced: !!taxData
        };
        if (!o.preparation_time_seconds) {
          const startTime = new Date(o.created_at);
          const endTime = new Date();
          updates.preparation_time_seconds = Math.floor((endTime - startTime) / 1000);
        }
        return { ...o, ...updates };
      }
      return o;
    }));
  };

  const handleAddOrder = (newOrder) => {
    // Actualizar stock en localStorage
    const savedProducts = localStorage.getItem('restobot_products');
    if (savedProducts) {
      let products = JSON.parse(savedProducts);

      // Descontar inventario
      newOrder.items.forEach(item => {
        const productIndex = products.findIndex(p => p.id === item.id);
        if (productIndex !== -1) {
          products[productIndex].stock = Math.max(0, (products[productIndex].stock || 0) - item.quantity);
        }
      });

      localStorage.setItem('restobot_products', JSON.stringify(products));
      // Notificar cambio de stock a otros componentes
      window.dispatchEvent(new Event('storage'));
    }

    setOrders([newOrder, ...orders]);
  };

  if (loading) return null;

  if (!user) return <LoginPage />;

  return (
    <>
      <div id="main-app-container" className="flex min-h-screen bg-[#f8fafc] text-secondary">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
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
                      activeTab === 'corporate' ? 'Centro de Inteligencia' :
                        activeTab === 'analytics' ? 'Dashboard Global' :
                          activeTab === 'users' ? 'Gestión de Personal' :
                            activeTab === 'sedes' ? 'Administración de Sedes' :
                              activeTab === 'hotels' ? 'Gestión Hotelera' :
                                activeTab === 'contabilidad' ? 'Contabilidad General' :
                                  activeTab === 'marketing' ? 'Marketing AI Studio' : 'Seguridad y Auditoría'}
                  </h1>
                </div>
                <p className="text-xs font-bold text-accent/70 flex items-center gap-2 uppercase tracking-tight">
                  <Activity size={12} className="text-emerald-500 animate-pulse" />
                  {activeTab === 'restaurante' ? 'Pedidos, carta y control de cajas' :
                    activeTab === 'corporate' ? 'Monitoreo ejecutivo multidimensional' :
                      activeTab === 'analytics' ? 'Indicadores clave de rendimiento' :
                        activeTab === 'sedes' ? 'Control logístico de sucursales' :
                          activeTab === 'hotels' ? 'Reservas y gestión de habitaciones' :
                            activeTab === 'contabilidad' ? 'Estados financieros y balances' :
                              activeTab === 'marketing' ? 'Generación de contenido publicitario con IA' :
                                activeTab === 'operaciones' ? 'Registro de actividad y seguridad' : 'Gestión operativa en tiempo real'}
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-secondary opacity-80">{user.name}</span>
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
            />
          )}
          {activeTab === 'corporate' && <CorporateIntelligence orders={orders} />}
          {activeTab === 'analytics' && <AnalyticsPro />}
          {activeTab === 'hotels' && <HotelManagement />}
          {activeTab === 'contabilidad' && <AccountingModule orders={orders} />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'sedes' && <BranchManagement />}
          {activeTab === 'marketing' && <MarketingModule />}
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
