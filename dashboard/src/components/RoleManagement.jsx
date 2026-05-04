import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Plus, Edit2, Trash2, Copy, Users, Check, X, Save,
    Crown, Briefcase, CreditCard, ChefHat, Building2, BarChart3,
    Lock, Unlock, Sparkles, AlertTriangle, Search, RefreshCw,
    ChevronDown, ChevronUp, Eye, Palette, Type, FileText,
    CheckCircle2, XCircle, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Mapa de Iconos disponibles ─────────────────────────────────────────────
const ICON_MAP = {
    Shield, Crown, Briefcase, CreditCard, ChefHat, Building2,
    BarChart3, Users, Lock, Eye, Sparkles, Star: Sparkles
};

const ICON_OPTIONS = [
    { name: 'Shield', icon: Shield },
    { name: 'Crown', icon: Crown },
    { name: 'Briefcase', icon: Briefcase },
    { name: 'CreditCard', icon: CreditCard },
    { name: 'ChefHat', icon: ChefHat },
    { name: 'Building2', icon: Building2 },
    { name: 'BarChart3', icon: BarChart3 },
    { name: 'Users', icon: Users },
    { name: 'Lock', icon: Lock },
    { name: 'Eye', icon: Eye },
    { name: 'Sparkles', icon: Sparkles },
];

// ─── Colores disponibles ────────────────────────────────────────────────────
const COLOR_OPTIONS = [
    { value: '#6c5ce7', label: 'Púrpura', bg: 'bg-purple-500' },
    { value: '#0984e3', label: 'Azul', bg: 'bg-blue-500' },
    { value: '#00b894', label: 'Verde', bg: 'bg-emerald-500' },
    { value: '#e17055', label: 'Naranja', bg: 'bg-orange-500' },
    { value: '#d63031', label: 'Rojo', bg: 'bg-red-500' },
    { value: '#a29bfe', label: 'Lavanda', bg: 'bg-indigo-400' },
    { value: '#fdcb6e', label: 'Ámbar', bg: 'bg-amber-400' },
    { value: '#00cec9', label: 'Cian', bg: 'bg-cyan-500' },
    { value: '#636e72', label: 'Gris', bg: 'bg-gray-500' },
    { value: '#e84393', label: 'Rosa', bg: 'bg-pink-500' },
    { value: '#2d3436', label: 'Negro', bg: 'bg-gray-800' },
    { value: '#55a3e8', label: 'Cielo', bg: 'bg-sky-400' },
];

// ─── Módulos del sistema ────────────────────────────────────────────────────
const MODULE_LABELS = {
    restaurante: { label: 'Restaurante', emoji: '🍽️' },
    hotel: { label: 'Hotel', emoji: '🏨' },
    financiero: { label: 'Finanzas', emoji: '💰' },
    usuarios: { label: 'Usuarios', emoji: '👥' },
    sedes: { label: 'Sucursales', emoji: '🏢' },
    marketing: { label: 'Marketing', emoji: '📣' },
    qr_tools: { label: 'QR Tools', emoji: '📱' },
    operaciones: { label: 'Operaciones', emoji: '🔐' },
};

const EMPTY_PERMISSIONS = Object.fromEntries(
    Object.keys(MODULE_LABELS).map(k => [k, { create: false, read: false, update: false, delete: false }])
);

// ─── Componente Principal ───────────────────────────────────────────────────
const RoleManagement = () => {
    const { user: currentUser } = useAuth();
    const [roles, setRoles] = useState([]);
    const [userCounts, setUserCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedRole, setExpandedRole] = useState(null);

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Form
    const [formRole, setFormRole] = useState({
        name: '',
        label: '',
        description: '',
        color: '#6c5ce7',
        icon: 'Shield',
        is_system: false,
        permissions: JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)),
    });

    // ─── Data Fetching ──────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, profilesRes] = await Promise.all([
                supabase.from('roles').select('*').order('id', { ascending: true }),
                supabase.from('profiles').select('role'),
            ]);

            if (rolesRes.error) throw rolesRes.error;
            setRoles(rolesRes.data || []);

            // Contar usuarios por rol
            const counts = {};
            (profilesRes.data || []).forEach(p => {
                counts[p.role] = (counts[p.role] || 0) + 1;
            });
            setUserCounts(counts);
        } catch (error) {
            console.error('Error cargando roles:', error);
            showToast('Error cargando roles: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime
    useEffect(() => {
        const channel = supabase
            .channel('role-management')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, () => fetchData())
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [fetchData]);

    // ─── Handlers ───────────────────────────────────────────────────────────
    const handleOpenCreate = () => {
        setEditingRole(null);
        setFormRole({
            name: '',
            label: '',
            description: '',
            color: '#6c5ce7',
            icon: 'Shield',
            is_system: false,
            permissions: JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)),
        });
        setShowModal(true);
    };

    const handleOpenEdit = (role) => {
        setEditingRole(role);
        setFormRole({
            name: role.name,
            label: role.label,
            description: role.description || '',
            color: role.color || '#6c5ce7',
            icon: role.icon || 'Shield',
            is_system: role.is_system,
            permissions: { ...JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)), ...(role.permissions || {}) },
        });
        setShowModal(true);
    };

    const handleDuplicate = (role) => {
        setEditingRole(null);
        setFormRole({
            name: '',
            label: `${role.label} (Copia)`,
            description: role.description || '',
            color: role.color || '#6c5ce7',
            icon: role.icon || 'Shield',
            is_system: false,
            permissions: JSON.parse(JSON.stringify(role.permissions || EMPTY_PERMISSIONS)),
        });
        setShowModal(true);
    };

    const handlePermissionChange = (module, action) => {
        setFormRole(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: {
                    ...prev.permissions[module],
                    [action]: !prev.permissions[module][action],
                },
            },
        }));
    };

    const toggleModuleAll = (module) => {
        const current = formRole.permissions[module];
        const allOn = Object.values(current).every(Boolean);
        setFormRole(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: Object.fromEntries(Object.keys(current).map(k => [k, !allOn])),
            },
        }));
    };

    const toggleAllPermissions = () => {
        const totalActive = Object.values(formRole.permissions).reduce((acc, mod) =>
            acc + Object.values(mod).filter(Boolean).length, 0
        );
        const totalPossible = Object.keys(MODULE_LABELS).length * 4;
        const allOn = totalActive === totalPossible;

        setFormRole(prev => ({
            ...prev,
            permissions: Object.fromEntries(
                Object.keys(MODULE_LABELS).map(k => [
                    k,
                    Object.fromEntries(['create', 'read', 'update', 'delete'].map(a => [a, !allOn]))
                ])
            ),
        }));
    };

    // ─── Save ───────────────────────────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Generar name del rol a partir del label si es nuevo
            const roleName = editingRole
                ? formRole.name
                : formRole.name || formRole.label
                    .toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, '');

            // Validar nombre único
            if (!editingRole) {
                const existing = roles.find(r => r.name === roleName);
                if (existing) {
                    showToast('❌ Ya existe un rol con ese identificador', 'error');
                    setIsSaving(false);
                    return;
                }
            }

            const roleData = {
                name: roleName,
                label: formRole.label,
                description: formRole.description,
                color: formRole.color,
                icon: formRole.icon,
                permissions: formRole.permissions,
                is_system: formRole.is_system,
            };

            if (editingRole) {
                // No permitir cambiar el name de roles de sistema
                const { name, ...updateData } = roleData;
                if (editingRole.is_system) {
                    // Solo actualizar permisos y metadata, no el name
                    const { error } = await supabase
                        .from('roles')
                        .update(updateData)
                        .eq('id', editingRole.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('roles')
                        .update(roleData)
                        .eq('id', editingRole.id);
                    if (error) throw error;
                }
                showToast(`✅ Rol "${formRole.label}" actualizado`);
            } else {
                const { error } = await supabase
                    .from('roles')
                    .insert([roleData]);
                if (error) throw error;
                showToast(`✅ Rol "${formRole.label}" creado correctamente`);
            }

            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Error guardando rol:', error);
            showToast('❌ Error: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (role) => {
        if (role.is_system) {
            showToast('⚠️ Los roles del sistema no se pueden eliminar', 'warning');
            return;
        }

        const usersWithRole = userCounts[role.name] || 0;
        if (usersWithRole > 0) {
            showToast(`⚠️ Hay ${usersWithRole} usuario(s) con este rol. Reasígnelos primero.`, 'warning');
            return;
        }

        if (!window.confirm(`¿Eliminar el rol "${role.label}"? Esta acción no se puede deshacer.`)) return;

        try {
            const { error } = await supabase.from('roles').delete().eq('id', role.id);
            if (error) throw error;
            showToast(`🗑️ Rol "${role.label}" eliminado`);
            fetchData();
        } catch (error) {
            showToast('❌ Error: ' + error.message, 'error');
        }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getIcon = (iconName) => ICON_MAP[iconName] || Shield;

    const countPerms = (permissions) => {
        if (!permissions) return 0;
        return Object.values(permissions).reduce((acc, mod) =>
            acc + Object.values(mod).filter(Boolean).length, 0
        );
    };

    const filteredRoles = roles.filter(r => {
        const term = searchTerm.toLowerCase();
        return (r.label || '').toLowerCase().includes(term) ||
            (r.name || '').toLowerCase().includes(term) ||
            (r.description || '').toLowerCase().includes(term);
    });

    const systemRoles = filteredRoles.filter(r => r.is_system);
    const customRoles = filteredRoles.filter(r => !r.is_system);

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl text-white font-bold text-sm flex items-center gap-3 animate-in slide-in-from-right-4 duration-300 ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                    {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    {toast.message}
                </div>
            )}

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Roles Totales', value: roles.length, icon: Shield, color: 'blue', detail: 'ESTRUCTURA DE EQUIPO' },
                    { label: 'Roles Sistema', value: roles.filter(r => r.is_system).length, icon: Lock, color: 'indigo', detail: 'NATIVOS PROTEGIDOS' },
                    { label: 'Personalizados', value: roles.filter(r => !r.is_system).length, icon: Sparkles, color: 'amber', detail: 'CONFIGURACIÓN PRO' },
                    { label: 'Usuarios Activos', value: Object.values(userCounts).reduce((a, b) => a + b, 0), icon: Users, color: 'emerald', detail: 'PERSONAL ASIGNADO' },
                ].map(stat => (
                    <div key={stat.label} className="bg-canvas rounded-[32px] border border-hairline p-6 shadow-airbnb hover:shadow-premium transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-150 duration-700 bg-${stat.color}-500`} />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-${stat.color}-50 text-${stat.color}-500`}>
                                <stat.icon size={28} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-secondary leading-none mb-1">{stat.value}</p>
                                <p className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em]">{stat.label}</p>
                                <p className="text-[8px] font-black uppercase text-secondary/20 tracking-widest mt-1">{stat.detail}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-col md:flex-row gap-4 bg-canvas p-4 rounded-[32px] shadow-airbnb border border-hairline">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="BUSCAR ROLES O PRIVILEGIOS..."
                        className="w-full pl-14 pr-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[11px] font-black uppercase tracking-widest placeholder:text-accent/30"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="p-4 bg-surface-soft text-accent hover:text-secondary rounded-2xl transition-all hover:bg-surface-soft/80 active:scale-95"
                        title="Recargar"
                    >
                        <RefreshCw size={20} strokeWidth={2.5} />
                    </button>

                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center justify-center gap-3 bg-secondary text-white px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-airbnb hover:shadow-premium active:scale-95 transition-all whitespace-nowrap"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                        Crear Nuevo Rol
                    </button>
                </div>
            </div>

            {/* ── Role List Sections ── */}
            {loading ? (
                <div className="flex items-center justify-center h-64 bg-canvas rounded-[40px] border border-hairline shadow-airbnb">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-[4px] border-secondary/10 border-t-secondary rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Sincronizando privilegios...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* The role sections are rendered below the modal logic for better structure */}
                </div>
            )}

            {/* ══════════════════════════════════════════
               MODAL: CREAR / EDITAR ROL
            ══════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-canvas rounded-[40px] shadow-premium w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[92vh] border border-hairline">

                        {/* Header */}
                        <div
                            className="p-8 text-white flex justify-between items-center relative overflow-hidden shrink-0"
                            style={{ backgroundColor: formRole.color }}
                        >
                            <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black tracking-tighter leading-none mb-1">
                                    {editingRole ? 'Ajustes de Privilegio' : 'Nuevo Nivel de Acceso'}
                                </h3>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">
                                    {editingRole ? `GESTIONANDO: ${editingRole.label.toUpperCase()}` : 'DEFINICIÓN DE PERFIL OPERATIVO'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="relative z-10 p-3 hover:bg-white/20 rounded-full transition-all active:scale-90">
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                            <div className="overflow-y-auto flex-1 p-8 space-y-10 custom-scrollbar">

                                {/* ── Identificación ── */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 ml-1">
                                        <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-secondary">
                                            <Type size={16} strokeWidth={2.5} />
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase text-secondary tracking-[0.2em]">Identidad del Perfil</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Label */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em] ml-1">Nombre Comercial</label>
                                            <input
                                                required type="text"
                                                className="w-full px-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm uppercase tracking-widest"
                                                placeholder="EJ. ADMINISTRADOR DE TURNO"
                                                value={formRole.label}
                                                onChange={e => setFormRole({ ...formRole, label: e.target.value })}
                                            />
                                        </div>

                                        {/* Name (ID interno) */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em] ml-1">
                                                ID Técnico
                                                {editingRole?.is_system && <span className="text-rose-500 ml-2">(SISTEMA PROTEGIDO)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm tracking-widest font-mono opacity-60 disabled:opacity-30"
                                                placeholder="admin_turno"
                                                value={formRole.name}
                                                onChange={e => setFormRole({
                                                    ...formRole,
                                                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                                })}
                                                disabled={editingRole?.is_system}
                                            />
                                        </div>
                                    </div>

                                    {/* Descripción */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em] ml-1">Alcance y Responsabilidades</label>
                                        <div className="relative group">
                                            <FileText className="absolute left-6 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                            <input
                                                type="text"
                                                className="w-full pl-14 pr-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black uppercase tracking-widest placeholder:text-accent/30"
                                                placeholder="DESCRIBA LAS FUNCIONES DE ESTE ROL..."
                                                value={formRole.description}
                                                onChange={e => setFormRole({ ...formRole, description: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Apariencia ── */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 ml-1">
                                        <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-secondary">
                                            <Palette size={16} strokeWidth={2.5} />
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase text-secondary tracking-[0.2em]">Personalización Visual</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Color */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em] ml-1">Paleta Cromática</label>
                                            <div className="grid grid-cols-6 gap-3">
                                                {COLOR_OPTIONS.map(c => (
                                                    <button
                                                        key={c.value}
                                                        type="button"
                                                        onClick={() => setFormRole({ ...formRole, color: c.value })}
                                                        className={`aspect-square rounded-xl transition-all hover:scale-110 active:scale-90 flex items-center justify-center group ${formRole.color === c.value
                                                            ? 'ring-4 ring-offset-4 ring-secondary/10 scale-110 shadow-lg'
                                                            : 'hover:shadow-md'
                                                            }`}
                                                        style={{ backgroundColor: c.value }}
                                                        title={c.label}
                                                    >
                                                        {formRole.color === c.value && <Check size={16} className="text-white" strokeWidth={4} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Icono */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-secondary/40 tracking-[0.2em] ml-1">Simbología</label>
                                            <div className="grid grid-cols-5 gap-3">
                                                {ICON_OPTIONS.map(opt => {
                                                    const IconComp = opt.icon;
                                                    const isSelected = formRole.icon === opt.name;
                                                    return (
                                                        <button
                                                            key={opt.name}
                                                            type="button"
                                                            onClick={() => setFormRole({ ...formRole, icon: opt.name })}
                                                            className={`aspect-square rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${isSelected
                                                                ? 'text-white shadow-lg'
                                                                : 'bg-surface-soft text-accent hover:bg-gray-200'
                                                                }`}
                                                            style={isSelected ? { backgroundColor: formRole.color } : {}}
                                                            title={opt.name}
                                                        >
                                                            <IconComp size={20} strokeWidth={2.5} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="bg-canvas rounded-[32px] p-6 border border-hairline flex items-center gap-6 shadow-airbnb relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 opacity-[0.03] transition-transform group-hover:scale-110" style={{ backgroundColor: formRole.color }} />
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-premium relative z-10"
                                            style={{ backgroundColor: formRole.color }}
                                        >
                                            {(() => { const I = getIcon(formRole.icon); return <I size={32} strokeWidth={1.5} />; })()}
                                        </div>
                                        <div className="relative z-10 flex-1">
                                            <p className="text-xl font-black text-secondary tracking-tighter leading-none mb-1">{formRole.label || 'NOMBRE DEL ROL'}</p>
                                            <p className="text-[10px] font-black uppercase text-accent tracking-[0.2em]">{formRole.description || 'SIN DESCRIPCIÓN DEFINIDA'}</p>
                                        </div>
                                        <div className="px-4 py-2 rounded-full border font-black text-[9px] uppercase tracking-widest relative z-10"
                                            style={{
                                                backgroundColor: `${formRole.color}15`,
                                                color: formRole.color,
                                                borderColor: `${formRole.color}30`
                                            }}>
                                            Vista Previa
                                        </div>
                                    </div>
                                </div>

                                {/* ── Permisos ── */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between ml-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-secondary">
                                                <Shield size={16} strokeWidth={2.5} />
                                            </div>
                                            <h4 className="text-[11px] font-black uppercase text-secondary tracking-[0.2em]">Configuración de Privilegios</h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={toggleAllPermissions}
                                            className="text-[9px] font-black uppercase px-4 py-2 rounded-full bg-surface-soft text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm border border-hairline"
                                        >
                                            {countPerms(formRole.permissions) === Object.keys(MODULE_LABELS).length * 4 ? 'REVOCAR TODO' : 'CONCEDER TODO'}
                                        </button>
                                    </div>

                                    <div className="bg-canvas rounded-[32px] border border-hairline overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-surface-soft/50 border-b border-hairline">
                                                    <th className="px-6 py-5 text-[9px] font-black uppercase text-secondary/40 tracking-widest">Módulo</th>
                                                    <th className="px-2 py-5 text-[9px] font-black uppercase text-center text-secondary/40 tracking-widest">Ver</th>
                                                    <th className="px-2 py-5 text-[9px] font-black uppercase text-center text-secondary/40 tracking-widest">Crear</th>
                                                    <th className="px-2 py-5 text-[9px] font-black uppercase text-center text-secondary/40 tracking-widest">Edit</th>
                                                    <th className="px-2 py-5 text-[9px] font-black uppercase text-center text-secondary/40 tracking-widest">Borrar</th>
                                                    <th className="px-6 py-5 text-[9px] font-black uppercase text-center text-secondary/40 tracking-widest">Full</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-hairline">
                                                {Object.entries(formRole.permissions || {})
                                                    .filter(([moduleName]) => {
                                                        const orgModules = currentUser?.organization?.active_modules;
                                                        if (orgModules && !orgModules.includes(moduleName)) return false;
                                                        return true;
                                                    })
                                                    .map(([moduleName, perms]) => {
                                                    const modInfo = MODULE_LABELS[moduleName] || { label: moduleName, emoji: '📦' };
                                                    const allOn = Object.values(perms).every(Boolean);
                                                    return (
                                                        <tr key={moduleName} className="group hover:bg-surface-soft/20 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-xl group-hover:rotate-12 transition-transform duration-500">{modInfo.emoji}</span>
                                                                    <span className="text-[11px] font-black text-secondary tracking-tighter uppercase">{modInfo.label}</span>
                                                                </div>
                                                            </td>
                                                            {['read', 'create', 'update', 'delete'].map(action => (
                                                                <td key={action} className="px-2 py-3 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePermissionChange(moduleName, action)}
                                                                        className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto transition-all ${perms[action]
                                                                            ? 'text-white shadow-airbnb scale-110'
                                                                            : 'bg-surface-soft text-accent/30 hover:text-accent hover:bg-gray-200'
                                                                            }`}
                                                                        style={perms[action] ? { backgroundColor: formRole.color } : {}}
                                                                    >
                                                                        {perms[action] ? <Check size={16} strokeWidth={4} /> : <X size={14} />}
                                                                    </button>
                                                                </td>
                                                            ))}
                                                            <td className="px-6 py-3 text-center border-l border-hairline">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleModuleAll(moduleName)}
                                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto transition-all ${allOn
                                                                        ? 'bg-secondary text-white shadow-airbnb'
                                                                        : 'bg-surface-soft text-accent/30 hover:bg-secondary/10 hover:text-secondary'
                                                                        }`}
                                                                    title={allOn ? 'Revocar permisos' : 'Conceder todo'}
                                                                >
                                                                    {allOn ? <Unlock size={16} strokeWidth={2.5} /> : <Lock size={16} strokeWidth={2.5} />}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Resumen Progress */}
                                    <div className="bg-surface-soft p-6 rounded-[32px] border border-hairline flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-secondary font-black text-xs border border-hairline">
                                                {countPerms(formRole.permissions)}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-secondary tracking-widest leading-none mb-1">Capacidad Operativa</p>
                                                <p className="text-[9px] font-bold text-accent uppercase tracking-[0.2em]">{countPerms(formRole.permissions)} de {Object.keys(MODULE_LABELS).length * 4} privilegios habilitados</p>
                                            </div>
                                        </div>
                                        <div className="w-48 h-2 bg-canvas rounded-full overflow-hidden border border-hairline shadow-inner">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{
                                                    width: `${(countPerms(formRole.permissions) / (Object.keys(MODULE_LABELS).length * 4)) * 100}%`,
                                                    backgroundColor: formRole.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 border-t border-hairline shrink-0 flex gap-4 bg-canvas">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-surface-soft rounded-full font-black text-[11px] uppercase tracking-[0.2em] text-accent hover:bg-red-50 hover:text-rose-500 transition-all duration-300"
                                >
                                    DESCARTAR
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] text-white py-4 rounded-full font-black shadow-airbnb hover:shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] disabled:opacity-60"
                                    style={{ backgroundColor: formRole.color }}
                                >
                                    {isSaving ? (
                                        <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> PROCESANDO...</>
                                    ) : (
                                        <><Save size={20} strokeWidth={2.5} /> {editingRole ? 'ACTUALIZAR ROL' : 'CONFIRMAR CREACIÓN'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Sección: Roles del Sistema ── */}
            <div className="space-y-8 pt-6">
                <div className="flex items-center gap-4 ml-2">
                    <div className="w-1.5 h-8 bg-secondary rounded-full" />
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tighter uppercase leading-none">Estructuras Base</h2>
                        <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mt-1">ROLES NATIVOS NO EDITABLES</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredRoles.filter(r => r.is_system).map(role => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            userCount={userCounts[role.name] || 0}
                            onEdit={() => handleOpenEdit(role)}
                            onDelete={() => handleDelete(role.id)}
                            onDuplicate={() => handleDuplicate(role)}
                            onToggleExpand={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                            expanded={expandedRoleId === role.id}
                        />
                    ))}
                </div>
            </div>

            {/* ── Sección: Roles Personalizados ── */}
            <div className="space-y-8 pt-12 border-t border-hairline">
                <div className="flex items-center justify-between ml-2">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-primary rounded-full" />
                        <div>
                            <h2 className="text-xl font-black text-secondary tracking-tighter uppercase leading-none">Configuraciones Pro</h2>
                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mt-1">ROLES CREADOS POR EL ESTABLECIMIENTO</p>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-surface-soft rounded-full border border-hairline text-[9px] font-black text-accent uppercase tracking-widest">
                        {filteredRoles.filter(r => !r.is_system).length} DEFINICIONES
                    </div>
                </div>

                {filteredRoles.filter(r => !r.is_system).length === 0 ? (
                    <div className="bg-canvas rounded-[40px] border-2 border-dashed border-hairline p-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-surface-soft rounded-3xl flex items-center justify-center mx-auto text-accent">
                            <Sparkles size={40} strokeWidth={1} />
                        </div>
                        <h3 className="text-xl font-black text-secondary uppercase tracking-tighter">Sin Roles Personalizados</h3>
                        <p className="text-accent text-[11px] font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                            Aún no has creado roles específicos para tu operación. Los roles del sistema cubren las funciones básicas.
                        </p>
                        <button
                            onClick={handleOpenCreate}
                            className="mt-4 bg-secondary text-white px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-airbnb hover:shadow-premium active:scale-95 transition-all"
                        >
                            Comenzar a Crear
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                        {filteredRoles.filter(r => !r.is_system).map(role => (
                            <RoleCard
                                key={role.id}
                                role={role}
                                userCount={userCounts[role.name] || 0}
                                onEdit={() => handleOpenEdit(role)}
                                onDelete={() => handleDelete(role.id)}
                                onDuplicate={() => handleDuplicate(role)}
                                onToggleExpand={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                                expanded={expandedRoleId === role.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Componente Sub-Card de Rol ── */
const RoleCard = ({ role, userCount, onEdit, onDelete, onDuplicate, onToggleExpand, expanded }) => {
    const IconComp = getIcon(role.icon);
    const activePerms = countPerms(role.permissions);
    const totalPerms = Object.keys(MODULE_LABELS).length * 4;
    const permPercent = (activePerms / totalPerms) * 100;

    return (
        <div className={`bg-canvas rounded-[32px] border border-hairline shadow-airbnb hover:shadow-premium transition-all overflow-hidden flex flex-col group ${expanded ? 'ring-2 ring-primary/20 scale-[1.02] z-10' : ''
            }`}>
            <div className="p-8 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg relative overflow-hidden group-hover:scale-110 transition-transform duration-500"
                        style={{ backgroundColor: role.color || '#6b7280' }}
                    >
                        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
                        <IconComp size={28} strokeWidth={1.5} className="relative z-10" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${role.is_system ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'
                            }`}>
                            {role.is_system ? 'SISTEMA' : 'PERSONALIZADO'}
                        </div>
                        {role.is_system && (
                            <div className="p-1.5 bg-surface-soft text-accent rounded-lg border border-hairline shadow-sm">
                                <Lock size={10} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="text-2xl font-black text-secondary tracking-tighter leading-none mb-1 group-hover:text-primary transition-colors">
                        {role.label}
                    </h3>
                    <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] line-clamp-1">{role.description || 'Sin descripción'}</p>
                    <p className="text-[9px] font-mono text-accent/30 mt-1 uppercase tracking-tighter">{role.name}</p>
                </div>

                {/* Stats */}
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-secondary border border-hairline shadow-sm">
                                <Users size={14} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-black text-secondary uppercase tracking-[0.1em]">Usuarios</span>
                        </div>
                        <span className="text-sm font-black text-secondary">{userCount}</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-black text-accent uppercase tracking-widest">
                            <span>Capacidad Operativa</span>
                            <span>{activePerms}/{totalPerms}</span>
                        </div>
                        <div className="h-2 bg-surface-soft rounded-full overflow-hidden border border-hairline shadow-inner">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${permPercent}%`,
                                    backgroundColor: role.color || '#6b7280'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-8 pt-6 border-t border-hairline">
                    <button
                        onClick={onToggleExpand}
                        className={`flex items-center gap-2 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-full border border-hairline transition-all active:scale-95 ${expanded
                            ? 'bg-secondary text-white border-secondary'
                            : 'bg-surface-soft text-secondary hover:bg-white hover:shadow-md'
                            }`}
                    >
                        {expanded ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
                        {expanded ? 'OCULTAR' : 'VER'} PRIVILEGIOS
                    </button>

                    <div className="ml-auto flex items-center gap-1.5">
                        <button
                            onClick={onDuplicate}
                            className="p-3 text-accent hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                            title="Duplicar rol"
                        >
                            <Copy size={16} strokeWidth={2} />
                        </button>
                        <button
                            onClick={onEdit}
                            className="p-3 text-accent hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all active:scale-90"
                            title="Editar rol"
                        >
                            <Edit2 size={16} strokeWidth={2} />
                        </button>
                        {!role.is_system && (
                            <button
                                onClick={onDelete}
                                className="p-3 text-accent hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                title="Eliminar rol"
                            >
                                <Trash2 size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Permissions Grid */}
            {expanded && (
                <div className="bg-surface-soft p-6 border-t border-hairline animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(role.permissions || {}).map(([mod, perms]) => {
                            const modInfo = MODULE_LABELS[mod] || { label: mod, emoji: '📦' };
                            const activeCount = Object.values(perms).filter(Boolean).length;
                            return (
                                <div key={mod} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] transition-all border ${activeCount > 0
                                    ? 'bg-canvas border-hairline shadow-sm'
                                    : 'opacity-30 border-transparent grayscale'
                                    }`}>
                                    <span className="text-sm">{modInfo.emoji}</span>
                                    <span className="font-black text-secondary uppercase tracking-tighter flex-1">{modInfo.label}</span>
                                    <div className="flex gap-1">
                                        {['read', 'create', 'update', 'delete'].map(a => (
                                            <div
                                                key={a}
                                                className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${perms[a]
                                                    ? 'text-white shadow-sm'
                                                    : 'bg-surface-soft text-accent/20 border border-hairline'
                                                    }`}
                                                style={perms[a] ? { backgroundColor: role.color || '#6b7280' } : {}}
                                                title={`${a === 'read' ? 'Ver' : a === 'create' ? 'Crear' : a === 'update' ? 'Editar' : 'Borrar'}: ${perms[a] ? 'Sí' : 'No'}`}
                                            >
                                                {perms[a] ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
