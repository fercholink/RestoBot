import React, { useState } from 'react';
import { LayoutPanelLeft, Users, Utensils, Settings, Menu, X, LogOut, ChevronLeft, ChevronRight, Building2, Wallet, ShieldAlert, Zap, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();

    const menuItems = [
        { id: 'corporate', label: 'Centro Inteligencia', icon: Zap, roles: ['gerente'] },
        { id: 'restaurante', label: 'Gestión Restaurante', icon: Utensils, roles: ['admin', 'cajero', 'gerente'] },
        { id: 'hotels', label: 'Gestión Hotel', icon: Building2, roles: ['gerente', 'admin'] },
        { id: 'contabilidad', label: 'Contabilidad', icon: Wallet, roles: ['gerente', 'admin'] },
        { id: 'sedes', label: 'Sucursales', icon: Building2, roles: ['gerente'] },
        { id: 'users', label: 'Personal', icon: Users, roles: ['admin', 'gerente'] },
        { id: 'marketing', label: 'Marketing AI', icon: Megaphone, roles: ['admin', 'gerente'] },
        { id: 'operaciones', label: 'Seguridad / Logs', icon: ShieldAlert, roles: ['gerente'] },
    ].filter(item => item.roles.includes(user?.role || 'cajero'));

    const content = (
        <div className="flex flex-col h-full bg-secondary transition-all duration-300">
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

            <nav className="flex-1 mt-6">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActiveTab(item.id);
                            setIsOpen(false);
                        }}
                        className={`w-full flex items-center transition-all duration-200 border-l-4 ${isCollapsed ? 'justify-center px-0 py-5' : 'gap-4 px-6 py-4'} ${activeTab === item.id
                            ? 'bg-primary/10 text-primary border-primary'
                            : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                            }`}
                        title={isCollapsed ? item.label : ''}
                    >
                        <item.icon size={isCollapsed ? 24 : 22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        {!isCollapsed && <span className="font-bold text-sm tracking-wide">{item.label}</span>}
                    </button>
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
