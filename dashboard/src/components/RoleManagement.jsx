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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Roles', value: roles.length, icon: Shield, color: 'blue' },
                    { label: 'Del Sistema', value: roles.filter(r => r.is_system).length, icon: Lock, color: 'purple' },
                    { label: 'Personalizados', value: roles.filter(r => !r.is_system).length, icon: Sparkles, color: 'amber' },
                    { label: 'Usuarios Asignados', value: Object.values(userCounts).reduce((a, b) => a + b, 0), icon: Users, color: 'green' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-500`}>
                            <stat.icon size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-secondary">{stat.value}</p>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wide">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar roles..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <button
                    onClick={fetchData}
                    className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-secondary hover:bg-gray-50 transition-all"
                    title="Recargar"
                >
                    <RefreshCw size={16} />
                </button>

                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
                >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Nuevo Rol</span>
                    <span className="sm:hidden">Crear</span>
                </button>
            </div>

            {/* ── Sección: Roles del Sistema ── */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cargando Roles...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Roles del Sistema */}
                    {systemRoles.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Lock size={14} className="text-gray-400" />
                                <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Roles del Sistema</h3>
                                <span className="text-[9px] text-gray-300 font-medium">— No se pueden eliminar</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {systemRoles.map(role => (
                                    <RoleCard
                                        key={role.id}
                                        role={role}
                                        userCount={userCounts[role.name] || 0}
                                        getIcon={getIcon}
                                        countPerms={countPerms}
                                        expanded={expandedRole === role.id}
                                        onToggleExpand={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                                        onEdit={() => handleOpenEdit(role)}
                                        onDuplicate={() => handleDuplicate(role)}
                                        onDelete={() => handleDelete(role)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Roles Personalizados */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-amber-400" />
                            <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Roles Personalizados</h3>
                            {customRoles.length === 0 && (
                                <span className="text-[9px] text-gray-300 font-medium">— Crea tu primer rol personalizado</span>
                            )}
                        </div>

                        {customRoles.length === 0 ? (
                            <div className="bg-white rounded-[2rem] border-2 border-dashed border-gray-200 p-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-amber-50 text-amber-400 rounded-2xl flex items-center justify-center mb-4">
                                    <Sparkles size={28} />
                                </div>
                                <h4 className="text-lg font-black text-secondary mb-1">Sin roles personalizados</h4>
                                <p className="text-sm text-gray-400 max-w-sm mb-6">
                                    Crea roles a medida como "Domiciliario", "Auditor" o "Host" con permisos específicos para tu negocio.
                                </p>
                                <button
                                    onClick={handleOpenCreate}
                                    className="flex items-center gap-2 bg-amber-400 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg"
                                >
                                    <Plus size={16} /> Crear Primer Rol
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customRoles.map(role => (
                                    <RoleCard
                                        key={role.id}
                                        role={role}
                                        userCount={userCounts[role.name] || 0}
                                        getIcon={getIcon}
                                        countPerms={countPerms}
                                        expanded={expandedRole === role.id}
                                        onToggleExpand={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                                        onEdit={() => handleOpenEdit(role)}
                                        onDuplicate={() => handleDuplicate(role)}
                                        onDelete={() => handleDelete(role)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════
               MODAL: CREAR / EDITAR ROL
            ══════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

                        {/* Header */}
                        <div
                            className="p-6 text-white flex justify-between items-center relative overflow-hidden shrink-0"
                            style={{ background: `linear-gradient(135deg, ${formRole.color}, ${formRole.color}cc)` }}
                        >
                            <div className="relative z-10">
                                <h3 className="text-xl font-black tracking-tight">
                                    {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
                                </h3>
                                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-0.5">
                                    {editingRole ? `Modificando: ${editingRole.label}` : 'Definir nuevo perfil de acceso'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={22} />
                            </button>
                            <Shield className="absolute -right-6 -bottom-6 text-white/10 w-36 h-36" />
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                            <div className="overflow-y-auto flex-1 p-6 space-y-6">

                                {/* ── Identificación ── */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                        <Type size={12} /> Identificación del Rol
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Label */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre Visible</label>
                                            <input
                                                required type="text"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                                placeholder="Ej: Domiciliario"
                                                value={formRole.label}
                                                onChange={e => setFormRole({ ...formRole, label: e.target.value })}
                                            />
                                        </div>

                                        {/* Name (ID interno) */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                                ID Interno
                                                {editingRole?.is_system && <span className="text-red-400 ml-1">(no editable)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-sm font-mono disabled:opacity-50"
                                                placeholder="domiciliario"
                                                value={formRole.name}
                                                onChange={e => setFormRole({
                                                    ...formRole,
                                                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                                })}
                                                disabled={editingRole?.is_system}
                                            />
                                            <p className="text-[9px] text-gray-400 pl-1">
                                                Se genera automáticamente del nombre si se deja vacío.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Descripción */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Descripción</label>
                                        <div className="relative">
                                            <FileText className="absolute left-4 top-3 text-gray-300" size={14} />
                                            <input
                                                type="text"
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                                                placeholder="Ej: Encargado de entregas a domicilio"
                                                value={formRole.description}
                                                onChange={e => setFormRole({ ...formRole, description: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Apariencia ── */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                        <Palette size={12} /> Apariencia
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Color */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Color</label>
                                            <div className="flex flex-wrap gap-2">
                                                {COLOR_OPTIONS.map(c => (
                                                    <button
                                                        key={c.value}
                                                        type="button"
                                                        onClick={() => setFormRole({ ...formRole, color: c.value })}
                                                        className={`w-8 h-8 rounded-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${formRole.color === c.value
                                                            ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                                                            : ''
                                                            }`}
                                                        style={{ backgroundColor: c.value }}
                                                        title={c.label}
                                                    >
                                                        {formRole.color === c.value && <Check size={14} className="text-white" strokeWidth={3} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Icono */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Icono</label>
                                            <div className="flex flex-wrap gap-2">
                                                {ICON_OPTIONS.map(opt => {
                                                    const IconComp = opt.icon;
                                                    const isSelected = formRole.icon === opt.name;
                                                    return (
                                                        <button
                                                            key={opt.name}
                                                            type="button"
                                                            onClick={() => setFormRole({ ...formRole, icon: opt.name })}
                                                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isSelected
                                                                ? 'text-white shadow-md'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                }`}
                                                            style={isSelected ? { backgroundColor: formRole.color } : {}}
                                                            title={opt.name}
                                                        >
                                                            <IconComp size={16} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                                            style={{ backgroundColor: formRole.color }}
                                        >
                                            {(() => { const I = getIcon(formRole.icon); return <I size={22} />; })()}
                                        </div>
                                        <div>
                                            <p className="font-black text-secondary text-sm">{formRole.label || 'Nombre del Rol'}</p>
                                            <p className="text-[10px] text-gray-400">{formRole.description || 'Descripción del rol'}</p>
                                        </div>
                                        <span className="ml-auto text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border"
                                            style={{
                                                backgroundColor: `${formRole.color}15`,
                                                color: formRole.color,
                                                borderColor: `${formRole.color}30`
                                            }}>
                                            Vista Previa
                                        </span>
                                    </div>
                                </div>

                                {/* ── Permisos ── */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                            <Shield size={12} /> Matriz de Permisos
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={toggleAllPermissions}
                                            className="text-[9px] font-black uppercase px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                                        >
                                            {countPerms(formRole.permissions) === Object.keys(MODULE_LABELS).length * 4 ? 'Quitar Todo' : 'Marcar Todo'}
                                        </button>
                                    </div>

                                    <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-gray-100/60 border-b border-gray-100">
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-gray-400">Módulo</th>
                                                    <th className="px-2 py-3 text-[9px] font-black uppercase text-center text-blue-400">Ver</th>
                                                    <th className="px-2 py-3 text-[9px] font-black uppercase text-center text-green-400">Crear</th>
                                                    <th className="px-2 py-3 text-[9px] font-black uppercase text-center text-amber-400">Editar</th>
                                                    <th className="px-2 py-3 text-[9px] font-black uppercase text-center text-red-400">Borrar</th>
                                                    <th className="px-2 py-3 text-[9px] font-black uppercase text-center text-gray-400">Todo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
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
                                                        <tr key={moduleName} className="hover:bg-white/80 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <span className="text-[11px] font-bold text-secondary flex items-center gap-1.5">
                                                                    <span>{modInfo.emoji}</span> {modInfo.label}
                                                                </span>
                                                            </td>
                                                            {['read', 'create', 'update', 'delete'].map(action => (
                                                                <td key={action} className="px-2 py-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePermissionChange(moduleName, action)}
                                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${perms[action]
                                                                            ? 'text-white shadow-sm'
                                                                            : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                                                            }`}
                                                                        style={perms[action] ? { backgroundColor: formRole.color } : {}}
                                                                    >
                                                                        {perms[action] ? <Check size={13} strokeWidth={3} /> : <X size={13} />}
                                                                    </button>
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleModuleAll(moduleName)}
                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${allOn
                                                                        ? 'bg-secondary text-white'
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                        }`}
                                                                    title={allOn ? 'Deshabilitar todo' : 'Habilitar todo'}
                                                                >
                                                                    {allOn ? <Unlock size={12} /> : <Lock size={12} />}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Resumen de permisos */}
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {countPerms(formRole.permissions)} de {Object.keys(MODULE_LABELS).length * 4} permisos activos
                                        </p>
                                        <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
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
                            <div className="p-6 border-t border-gray-100 shrink-0 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-gray-200 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 text-white py-3 rounded-2xl font-black shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-60"
                                    style={{ backgroundColor: formRole.color }}
                                >
                                    {isSaving ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                                    ) : (
                                        <><Save size={16} /> {editingRole ? 'Guardar Cambios' : 'Crear Rol'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Subcomponente: Role Card ───────────────────────────────────────────────
const RoleCard = ({ role, userCount, getIcon, countPerms, expanded, onToggleExpand, onEdit, onDuplicate, onDelete }) => {
    const Icon = getIcon(role.icon);
    const activePerms = countPerms(role.permissions);
    const totalPerms = Object.keys(MODULE_LABELS).length * 4;
    const permPercent = Math.round((activePerms / totalPerms) * 100);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
            {/* Card Header */}
            <div className="p-5">
                <div className="flex items-start gap-3">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                        style={{ backgroundColor: role.color || '#6b7280' }}
                    >
                        <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-black text-secondary text-sm truncate">{role.label}</h4>
                            {role.is_system && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 shrink-0">Sistema</span>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{role.description}</p>
                        <p className="text-[9px] font-mono text-gray-300 mt-0.5">{role.name}</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400" />
                        <span className="text-[11px] font-black text-secondary">{userCount}</span>
                        <span className="text-[9px] text-gray-400">usuarios</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${permPercent}%`,
                                    backgroundColor: role.color || '#6b7280'
                                }}
                            />
                        </div>
                        <span className="text-[9px] font-black text-gray-400">{activePerms}/{totalPerms}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-gray-50">
                    <button
                        onClick={onToggleExpand}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-gray-400 hover:text-secondary hover:bg-gray-50 rounded-lg transition-all"
                    >
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expanded ? 'Ocultar' : 'Ver'} Permisos
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                        <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Duplicar rol">
                            <Copy size={13} />
                        </button>
                        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Editar rol">
                            <Edit2 size={13} />
                        </button>
                        {!role.is_system && (
                            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar rol">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Permissions */}
            {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(role.permissions || {}).map(([mod, perms]) => {
                            const modInfo = MODULE_LABELS[mod] || { label: mod, emoji: '📦' };
                            const activeCount = Object.values(perms).filter(Boolean).length;
                            return (
                                <div key={mod} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] ${activeCount > 0 ? 'bg-white border border-gray-100' : 'opacity-40'
                                    }`}>
                                    <span>{modInfo.emoji}</span>
                                    <span className="font-bold text-secondary flex-1">{modInfo.label}</span>
                                    <div className="flex gap-0.5">
                                        {['read', 'create', 'update', 'delete'].map(a => (
                                            <div
                                                key={a}
                                                className={`w-3.5 h-3.5 rounded flex items-center justify-center ${perms[a]
                                                    ? 'text-white'
                                                    : 'bg-gray-100 text-gray-300'
                                                    }`}
                                                style={perms[a] ? { backgroundColor: role.color || '#6b7280' } : {}}
                                                title={`${a === 'read' ? 'Ver' : a === 'create' ? 'Crear' : a === 'update' ? 'Editar' : 'Borrar'}: ${perms[a] ? 'Sí' : 'No'}`}
                                            >
                                                {perms[a] ? <Check size={8} strokeWidth={3} /> : <X size={8} />}
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
