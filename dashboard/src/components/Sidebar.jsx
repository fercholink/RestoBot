import React, { useState } from 'react';
import { LayoutPanelLeft, Users, Utensils, Settings, Menu, X, LogOut, ChevronLeft, ChevronRight, Building2, Wallet, ShieldAlert, Zap, Megaphone, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, activeRestaurantSubTab, setActiveRestaurantSubTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const [expandedMenu, setExpandedMenu] = useState('restaurante'); // Expandir restaurante por defecto

    // Solo definimos subitems para restaurante por ahora
    const restaurantSubItems = [
        { id: 'board', label: 'Monitor de Pedidos', roles: ['admin', 'cajero', 'gerente'] },
        { id: 'menu', label: 'Gestión de Carta', roles: ['admin', 'gerente'] }, // Solo admin/gerente
        { id: 'turnos', label: 'Cajas y Turnos', roles: ['admin', 'cajero', 'gerente'] },
    ].filter(item => item.roles.includes(user?.role || 'cajero'));

    const hasPermission = (moduleName) => {
        // Si no hay permisos definidos (legacy users), usamos el rol como fallback
        if (!user?.permissions) {
            const role = user?.role || 'cajero';
            // Admin y Gerente ven todo por defecto en legacy. Cajero solo restaurante.
            if (role === 'admin' || role === 'gerente') return true;
            if (role === 'cajero' && moduleName === 'restaurante') return true;
            return false;
        }
        // Si hay permisos, devolver el valor de 'read'
        return user.permissions[moduleName]?.read ?? false;
    };

    const menuItems = [
        {
            id: 'restaurante',
            label: 'Gestión Restaurante',
            icon: Utensils,
            roles: ['admin', 'cajero', 'gerente'],
            hasSubmenu: true,
            module: 'restaurante'
        },
        { id: 'hotels', label: 'Gestión Hotel', icon: Building2, roles: ['gerente', 'admin'] },
        { id: 'contabilidad', label: 'Contabilidad', icon: Wallet, roles: ['gerente', 'admin'], module: 'financiero' },
        { id: 'sedes', label: 'Sucursales', icon: Building2, roles: ['gerente'], module: 'sedes' },
        { id: 'users', label: 'Personal', icon: Users, roles: ['admin', 'gerente'], module: 'usuarios' },
        { id: 'marketing', label: 'Marketing AI', icon: Megaphone, roles: ['admin', 'gerente'] },
        { id: 'qr_tools', label: 'Códigos QR', icon: QrCode, roles: ['admin', 'gerente'] },
        { id: 'operaciones', label: 'Seguridad / Logs', icon: ShieldAlert, roles: ['gerente'] },
    ].filter(item => {
        // 1. Filtrar por rol (Legacy check)
        const hasRole = item.roles.includes(user?.role || 'cajero');
        // 2. Filtrar por permiso explícito si tiene módulo asociado
        if (item.module) {
            return hasPermission(item.module);
        }
        // Si no tiene módulo (ej. Marketing), fallback al rol
        return hasRole;
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
        <div className="flex flex-col h-full bg-secondary transition-all duration-300">
            {/* ... Header igual ... */}
            <div className={`p-6 border-b border-white/10 text-white flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                <LayoutPanelLeft className="text-primary" size={isCollapsed ? 28 : 24} />
                {!isCollapsed && <span className="text-2xl font-black tracking-tighter">RestoBot</span>}
            </div>

            <div className={`p-6 border-b border-white/5 bg-white/5 ${isCollapsed ? 'flex justify-center' : ''}`}>
                {!isCollapsed ? (
                    <>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Usuario</p>
                        <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md font-black uppercase mt-1 inline-block">
                            {user?.role}
                        </span>
                    </>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs uppercase">
                        {user?.name?.charAt(0)}
                    </div>
                )}
            </div>

            <nav className="flex-1 mt-6 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => (
                    <div key={item.id}>
                        <button
                            onClick={() => handleItemClick(item)}
                            className={`w-full flex items-center transition-all duration-200 border-l-4 ${isCollapsed ? 'justify-center px-0 py-5' : 'gap-4 px-6 py-4'} ${activeTab === item.id
                                ? 'bg-primary/10 text-primary border-primary'
                                : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                }`}
                            title={isCollapsed ? item.label : ''}
                        >
                            <item.icon size={isCollapsed ? 24 : 22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                            {!isCollapsed && (
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="font-bold text-sm tracking-wide">{item.label}</span>
                                    {item.hasSubmenu && (
                                        <ChevronRight size={14} className={`transition-transform duration-200 ${expandedMenu === item.id ? 'rotate-90' : ''}`} />
                                    )}
                                </div>
                            )}
                        </button>

                        {/* Submenu Render */}
                        {!isCollapsed && item.hasSubmenu && expandedMenu === item.id && (
                            <div className="bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                {restaurantSubItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('restaurante');
                                            setActiveRestaurantSubTab && setActiveRestaurantSubTab(sub.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 pl-16 pr-6 py-3 transition-all text-xs font-bold ${activeTab === 'restaurante' && activeRestaurantSubTab === sub.id
                                            ? 'text-white bg-white/5'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'restaurante' && activeRestaurantSubTab === sub.id ? 'bg-primary' : 'bg-gray-600'}`} />
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className={`p-6 border-t border-white/5 flex flex-col gap-3 ${isCollapsed ? 'items-center' : ''}`}>
                <button
                    onClick={logout}
                    className={`flex items-center text-red-400 hover:text-red-300 transition-colors font-bold text-sm ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}
                    title={isCollapsed ? 'Cerrar Sesión' : ''}
                >
                    <LogOut size={isCollapsed ? 22 : 18} />
                    {!isCollapsed && <span>Cerrar Sesión</span>}
                </button>
                {!isCollapsed && (
                    <div className="px-4 py-2 bg-white/5 rounded-lg text-[10px] text-gray-500 font-mono text-center">
                        CLOUD API v1.1.0
                    </div>
                )}
            </div>

            {/* Desktop Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex absolute -right-3 top-20 bg-primary text-white w-6 h-6 rounded-full items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all z-50 border-2 border-secondary"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </div>
    );

    return (
        <>
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-secondary flex items-center justify-between px-6 z-40 border-b border-white/5 shadow-md">
                <div className="flex items-center gap-2">
                    <LayoutPanelLeft className="text-primary" size={24} />
                    <span className="text-white font-black tracking-tighter text-xl">RestoBot</span>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} className="text-white p-2">
                    {isOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Desktop Sidebar */}
            <aside className={`hidden lg:flex ${isCollapsed ? 'w-20' : 'w-64'} bg-secondary text-white h-screen flex-col fixed left-0 top-0 z-30 shadow-2xl transition-all duration-300`}>
                {content}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Mobile Drawer */}
            <aside className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-secondary text-white z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {content}
            </aside>
        </>
    );
};

export default Sidebar;
