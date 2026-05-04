import React, { useState } from 'react';
import { LayoutPanelLeft, Users, Utensils, Settings, Menu, X, LogOut, ChevronLeft, ChevronRight, Building2, Wallet, ShieldAlert, Zap, Megaphone, QrCode, ShieldCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, activeRestaurantSubTab, setActiveRestaurantSubTab, activeHotelSubTab, setActiveHotelSubTab, activeAccountingSubTab, setActiveAccountingSubTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();

    const [expandedMenu, setExpandedMenu] = useState(null); // Ningún menú expandido por defecto

    // Solo definimos subitems para restaurante por ahora
    const restaurantSubItems = [
        { id: 'board', label: 'Monitor de Pedidos', roles: ['admin', 'cajero', 'gerente', 'cocina', 'mesero'] },
        { id: 'mapa', label: 'Mapa de Mesas', roles: ['admin', 'cajero', 'gerente', 'mesero'] },
        { id: 'menu', label: 'Gestión de Carta', roles: ['admin', 'gerente'] },
        { id: 'turnos', label: 'Cajas y Turnos', roles: ['admin', 'cajero', 'gerente'] },
    ].filter(item => item.roles.includes(user?.role || 'cajero'));

    const hotelSubItems = [
        { id: 'habitaciones', label: 'Habitaciones', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'mapa', label: '📍 Mapa Interactivo', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'cinta', label: '📊 Cinta de Reservas', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'calendario', label: 'Calendario', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'limpieza', label: '🧹 Amas de Llaves', roles: ['admin', 'gerente', 'recepcion', 'limpieza'] },
        { id: 'crm', label: '👤 CRM Huéspedes', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'analitica', label: '📈 Analítica Pro', roles: ['admin', 'gerente'] },
        { id: 'canales', label: '📩 Canales OTA', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'historial', label: 'Historial', roles: ['admin', 'gerente', 'recepcion'] },
        { id: 'floors', label: 'Pisos y Zonas', roles: ['admin', 'gerente'] },
    ].filter(item => {
        // Fallback simple si no hay roles definidos en el item, permitir admin/gerente
        if (!item.roles) return true;
        const userRole = user?.role || 'cajero';
        if (userRole === 'admin' || userRole === 'gerente') return true;
        return item.roles.includes(userRole);
    });

    // Definimos subitems para Contabilidad
    const accountingSubItems = [
        { id: 'summary', label: 'Resumen Diario', roles: ['admin', 'gerente'] },
        { id: 'invoicing', label: 'Facturación DIAN', roles: ['admin', 'gerente'] },
        { id: 'payroll', label: 'Nómina Electrónica', roles: ['admin', 'gerente'] },
        { id: 'third_parties', label: 'Directorio DIAN', roles: ['admin', 'gerente'] },
        { id: 'reports', label: 'Informes Legales', roles: ['admin', 'gerente'] },
        { id: 'config', label: '🏢 Estructura Empresa', roles: ['admin', 'gerente'] },
    ].filter(item => item.roles.includes(user?.role || 'cajero'));

    const hasPermission = (moduleName) => {
        // Si no hay permisos definidos (legacy users), usamos el rol como fallback
        if (!user?.permissions) {
            const role = user?.role || 'cajero';
            // Admin y Gerente ven todo por defecto en legacy
            if (role === 'admin' || role === 'gerente') return true;
            // TODOS los roles ven módulo restaurante (pedidos)
            if (moduleName === 'restaurante') return true;
            return false;
        }
        // Si hay permisos explícitos (Modelo SaaS)
        // Para restaurante, siempre permitir lectura (es el módulo core)
        if (moduleName === 'restaurante') return true;
        return user.permissions[moduleName]?.read ?? false;
    };

    const menuItems = [
        { id: 'analytics', label: 'Smart Analytics', icon: BarChart3, roles: ['admin', 'gerente', 'cajero', 'recepcion', 'analista'] },
        {
            id: 'restaurante',
            label: 'Gestión Restaurante',
            icon: Utensils,
            // Visible para TODOS los roles — es el módulo principal
            roles: ['admin', 'cajero', 'gerente', 'cocina', 'mesero', 'recepcion', 'analista'],
            hasSubmenu: true,
            module: 'restaurante'
        },
        { id: 'hotels', label: 'Gestión Hotel', icon: Building2, roles: ['gerente', 'admin'], hasSubmenu: true, module: 'hotel' },
        { id: 'contabilidad', label: 'Contabilidad', icon: Wallet, roles: ['gerente', 'admin'], hasSubmenu: true, module: 'financiero' },
        { id: 'sedes', label: 'Sucursales', icon: Building2, roles: ['gerente'], module: 'sedes' },
        { id: 'users', label: 'Personal', icon: Users, roles: ['admin', 'gerente'], module: 'usuarios' },
        { id: 'marketing', label: 'Marketing AI', icon: Megaphone, roles: ['admin', 'gerente'], module: 'marketing' },
        { id: 'qr_tools', label: 'Códigos QR', icon: QrCode, roles: ['admin', 'gerente'], module: 'qr_tools' },
        { id: 'saas_admin', label: 'Súper Admin SaaS', icon: ShieldCheck, roles: [], isSuperAdminOnly: true },
        { id: 'operaciones', label: 'Seguridad / Logs', icon: ShieldAlert, roles: ['gerente'], module: 'operaciones' },
    ].filter(item => {
        // --- SUPER ADMIN ---
        if (item.isSuperAdminOnly) {
            return user?.is_superadmin === true;
        }

        // --- FEATURE FLAG POR ORGANIZACIÓN (NIVEL SaaS) ---
        // Si el menú pertenece a un módulo particular y la organización NO lo tiene activo, se oculta completamente.
        if (item.module && user?.organization?.active_modules) {
            if (!user.organization.active_modules.includes(item.module)) {
                return false; // Módulo bloqueado/no comprado para este Tenant
            }
        }

        // --- AUTORIZACIÓN POR ROLES/PERMISOS DEL USUARIO ---
        // 0. Super Admin siempre ve todo (siempre que la org tenga el módulo, verificado arriba)
        if (user?.role === 'admin' || user?.role === 'gerente') return true;

        // 1. Si no hay permisos definidos, usamos validación legacy por roles
        // Esto aplica para usuarios antiguos o si la carga de perfil falló parcialmente
        if (!user?.permissions) {
            return item.roles.includes(user?.role || 'cajero');
        }

        // 2. Si hay permisos explícitos (Modelo SaaS)
        if (item.module) {
            return hasPermission(item.module);
        }

        // 3. Módulos sin 'module' key fallback a rol
        return item.roles.includes(user?.role || 'cajero');
    });

    const toggleSubmenu = (menuId) => {
        if (expandedMenu === menuId) {
            setExpandedMenu(null);
        } else {
            setExpandedMenu(menuId);
        }
    };

    const handleItemClick = (item) => {
        if (item.hasSubmenu) {
            // Activar tab
            setActiveTab(item.id);
            // Lógica Toggle: Si ya está abierto, cerrarlo. Si no, abrirlo.
            if (expandedMenu === item.id) {
                setExpandedMenu(null);
            } else {
                setExpandedMenu(item.id);
            }

            if (isCollapsed) setIsCollapsed(false); // Abrir sidebar si esta colapsado
        } else {
            // Comportamiento normal
            setActiveTab(item.id);
            setIsOpen(false);
        }
    };

    const content = (
        <div className="flex flex-col h-full bg-canvas border-r border-hairline transition-all duration-300">
            {/* ... Header igual ... */}
            <div className={`p-4 border-b border-hairline text-secondary flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                <LayoutPanelLeft className="text-primary" size={isCollapsed ? 28 : 22} />
                {!isCollapsed && <span className="text-xl font-bold tracking-tight">Nexus</span>}
            </div>

            <div className={`p-4 border-b border-hairline bg-surface-soft ${isCollapsed ? 'flex justify-center' : ''}`}>
                {!isCollapsed ? (
                    <>
                        <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-1">Usuario</p>
                        <p className="text-sm font-semibold text-secondary truncate">{user?.name}</p>
                        <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold mt-2 inline-block">
                            {user?.role}
                        </span>
                    </>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                        {user?.name?.charAt(0)}
                    </div>
                )}
            </div>

            <nav className="flex-1 mt-4 px-3 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => (
                    <div key={item.id} className="mb-1">
                        <button
                            onClick={() => handleItemClick(item)}
                            className={`w-full flex items-center transition-all duration-200 rounded-lg ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === item.id
                                ? 'bg-surface-soft text-secondary font-semibold'
                                : 'text-accent hover:bg-surface-soft hover:text-secondary'
                                }`}
                            title={isCollapsed ? item.label : ''}
                        >
                            <item.icon size={isCollapsed ? 22 : 20} strokeWidth={activeTab === item.id ? 2.5 : 2} className={activeTab === item.id ? 'text-primary' : ''} />
                            {!isCollapsed && (
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="text-[15px]">{item.label}</span>
                                    {item.hasSubmenu && (
                                        <ChevronRight size={16} className={`transition-transform duration-200 ${expandedMenu === item.id ? 'rotate-90' : ''}`} />
                                    )}
                                </div>
                            )}
                        </button>

                        {/* Submenu Render */}
                        {!isCollapsed && item.hasSubmenu && expandedMenu === item.id && (
                            <div className="mt-1 mb-2 ml-4 border-l-2 border-surface-strong animate-in slide-in-from-top-2 duration-200">
                                {item.id === 'restaurante' && restaurantSubItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('restaurante');
                                            setActiveRestaurantSubTab && setActiveRestaurantSubTab(sub.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 pl-6 pr-4 py-2.5 transition-all text-[14px] rounded-r-lg ${activeTab === 'restaurante' && activeRestaurantSubTab === sub.id
                                            ? 'text-secondary font-semibold bg-surface-soft'
                                            : 'text-accent hover:text-secondary hover:bg-surface-soft'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'restaurante' && activeRestaurantSubTab === sub.id ? 'bg-primary' : 'bg-surface-strong'}`} />
                                        {sub.label}
                                    </button>
                                ))}
                                {item.id === 'hotels' && hotelSubItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('hotels');
                                            setActiveHotelSubTab && setActiveHotelSubTab(sub.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 pl-6 pr-4 py-2.5 transition-all text-[14px] rounded-r-lg ${activeTab === 'hotels' && activeHotelSubTab === sub.id
                                            ? 'text-secondary font-semibold bg-surface-soft'
                                            : 'text-accent hover:text-secondary hover:bg-surface-soft'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'hotels' && activeHotelSubTab === sub.id ? 'bg-primary' : 'bg-surface-strong'}`} />
                                        {sub.label}
                                    </button>
                                ))}
                                {item.id === 'contabilidad' && accountingSubItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('contabilidad');
                                            setActiveAccountingSubTab && setActiveAccountingSubTab(sub.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 pl-6 pr-4 py-2.5 transition-all text-[14px] rounded-r-lg ${activeTab === 'contabilidad' && activeAccountingSubTab === sub.id
                                            ? 'text-secondary font-semibold bg-surface-soft'
                                            : 'text-accent hover:text-secondary hover:bg-surface-soft'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'contabilidad' && activeAccountingSubTab === sub.id ? 'bg-primary' : 'bg-surface-strong'}`} />
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className={`p-6 border-t border-hairline flex flex-col gap-3 ${isCollapsed ? 'items-center px-2' : ''}`}>
                <button
                    onClick={logout}
                    className={`flex items-center text-secondary hover:text-danger transition-colors font-semibold text-[15px] ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}
                    title={isCollapsed ? 'Cerrar Sesión' : ''}
                >
                    <LogOut size={isCollapsed ? 22 : 20} />
                    {!isCollapsed && <span>Cerrar Sesión</span>}
                </button>
                {!isCollapsed && (
                    <div className="px-4 py-2 mt-2 bg-surface-soft rounded-lg text-xs text-accent text-center">
                        CLOUD API v1.1.0
                    </div>
                )}
            </div>

            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex absolute -right-3 top-20 bg-canvas text-secondary w-6 h-6 rounded-full items-center justify-center shadow-airbnb hover:scale-110 active:scale-90 transition-all z-50 border border-hairline"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>


        </div>
    );

    return (
        <>
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-canvas flex items-center justify-between px-6 z-40 border-b border-hairline">
                <div className="flex items-center gap-2">
                    <LayoutPanelLeft className="text-primary" size={24} />
                    <span className="text-secondary font-bold tracking-tight text-xl">Nexus</span>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} className="text-secondary p-2">
                    {isOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Desktop Sidebar */}
            <aside className={`hidden lg:flex ${isCollapsed ? 'w-24' : 'w-72'} bg-canvas text-secondary h-screen flex-col fixed left-0 top-0 z-30 transition-all duration-300 border-r border-hairline`}>
                {content}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-secondary/20 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Mobile Drawer */}
            <aside className={`lg:hidden fixed top-0 left-0 bottom-0 w-[280px] bg-canvas text-secondary z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-airbnb`}>
                {content}
            </aside>
        </>
    );
};

export default Sidebar;
