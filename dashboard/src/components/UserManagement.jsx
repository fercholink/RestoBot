import React, { useState, useEffect, useCallback } from 'react';
import {
    UserPlus, Search, Edit2, Trash2, Shield, User, Mail, Building2,
    Key, Check, Info, X, Save, AlertCircle, Ban, ChevronDown,
    CheckCircle2, XCircle, Sparkles, Lock, Unlock, RefreshCw,
    Eye, EyeOff, Crown, Users, ChefHat, CreditCard, ConciergeBell,
    BarChart3, Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import RoleManagement from './RoleManagement';

// ─── Mapa de Iconos para roles ──────────────────────────────────────────────
const ICON_MAP = {
    Shield, Crown, Briefcase, CreditCard, ChefHat, Building2,
    BarChart3, Users, Lock, Eye, Sparkles, ConciergeBell, Star: Sparkles
};

// ─── Labels de módulos ────────────────────────────────────────────────────────
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

const INITIAL_PERMISSIONS = Object.fromEntries(
    Object.keys(MODULE_LABELS).map(k => [k, { create: false, read: false, update: false, delete: false }])
);

// ─── Componente Principal ─────────────────────────────────────────────────────
const UserManagement = () => {
    const { user: currentUser } = useAuth();

    // ── Sub-Tab principal: 'usuarios' | 'roles' ──
    const [mainTab, setMainTab] = useState('usuarios');

    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [dbRoles, setDbRoles] = useState([]); // Roles desde Supabase
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterBranch, setFilterBranch] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassModal, setShowPassModal] = useState(false);
    const [selectedUserForPass, setSelectedUserForPass] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab] = useState('info'); // 'info' | 'permisos'
    const [selectedRoleTemplate, setSelectedRoleTemplate] = useState(null);

    // Construir ROLE_TEMPLATES dinámicamente de la BD
    const ROLE_TEMPLATES = {};
    const ROLE_BADGE_STYLES = {};
    dbRoles.forEach(r => {
        ROLE_TEMPLATES[r.name] = {
            label: r.label,
            description: r.description || '',
            icon: ICON_MAP[r.icon] || Shield,
            color: r.color || '#6b7280',
            gradient: `from-gray-500 to-gray-600`, // fallback
            permissions: r.permissions || {},
        };
        ROLE_BADGE_STYLES[r.name] = ''; // Se usa inline style ahora
    });

    const [formUser, setFormUser] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'cajero',
        branch_id: '',
        permissions: JSON.parse(JSON.stringify(INITIAL_PERMISSIONS)),
    });

    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Protección de Ruta ──────────────────────────────────────────────────────
    if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'gerente') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-red-50 text-red-400 rounded-full flex items-center justify-center shadow-inner">
                    <Ban size={48} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-secondary">Acceso Restringido</h2>
                    <p className="text-gray-400 font-medium mt-2 max-w-sm mx-auto">
                        Su perfil de <strong>{currentUser.role}</strong> no tiene permisos para gestionar usuarios.
                    </p>
                </div>
            </div>
        );
    }

    // ─── Data Fetching ───────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [profilesRes, branchesRes, rolesRes] = await Promise.all([
                supabase.from('profiles').select('*, branch:branches(name)').order('created_at', { ascending: false }),
                supabase.from('branches').select('id, name').order('name'),
                supabase.from('roles').select('*').order('id', { ascending: true }),
            ]);
            setUsers(profilesRes.data || []);
            setBranches(branchesRes.data || []);
            setDbRoles(rolesRes.data || []);
        } catch (error) {
            console.error('Error cargando datos:', error);
            showToast('Error cargando datos del sistema', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime: escuchar cambios en profiles para actualizar la lista en tiempo real
    useEffect(() => {
        const channel = supabase
            .channel('user-management-profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchData(); // Re-cargar lista cuando otro admin hace cambios
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [fetchData]);

    // ─── Handlers de Formulario ──────────────────────────────────────────────────
    const handleOpenCreate = () => {
        setEditingUser(null);
        setActiveTab('info');
        setSelectedRoleTemplate(null);
        setFormUser({
            full_name: '',
            email: '',
            password: '',
            role: 'cajero',
            branch_id: branches[0]?.id || '',
            permissions: JSON.parse(JSON.stringify(INITIAL_PERMISSIONS)),
        });
        setShowModal(true);
    };

    const handleOpenEdit = (userToEdit) => {
        setEditingUser(userToEdit);
        setActiveTab('info');
        setSelectedRoleTemplate(userToEdit.role);
        setFormUser({
            full_name: userToEdit.full_name || userToEdit.name,
            email: userToEdit.email || '',
            password: '',
            role: userToEdit.role,
            branch_id: userToEdit.branch_id || branches[0]?.id || '',
            permissions: { ...JSON.parse(JSON.stringify(INITIAL_PERMISSIONS)), ...(userToEdit.permissions || {}) },
        });
        setShowModal(true);
    };

    // Aplicar plantilla de rol automáticamente
    const applyRoleTemplate = (roleKey) => {
        const template = ROLE_TEMPLATES[roleKey];
        if (!template) return;
        setSelectedRoleTemplate(roleKey);
        setFormUser(prev => ({
            ...prev,
            role: roleKey,
            permissions: JSON.parse(JSON.stringify(template.permissions)),
        }));
    };

    const handlePermissionChange = (module, action) => {
        setFormUser(prev => ({
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

    // Toggle rápido: activar/desactivar todo el módulo
    const toggleModuleAll = (module) => {
        const current = formUser.permissions[module];
        const allOn = Object.values(current).every(Boolean);
        setFormUser(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: Object.fromEntries(Object.keys(current).map(k => [k, !allOn])),
            },
        }));
    };

    // ─── Guardar Usuario ─────────────────────────────────────────────────────────
    const handleSaveUser = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const profileData = {
                full_name: formUser.full_name,
                role: formUser.role,
                branch_id: formUser.branch_id || null,
                permissions: formUser.permissions,
                active: true,
                organization_id: currentUser.organization_id || null,
                email: formUser.email,
            };

            if (editingUser) {
                // ── ACTUALIZAR USUARIO EXISTENTE ──
                const { error } = await supabase
                    .from('profiles')
                    .update(profileData)
                    .eq('id', editingUser.id);

                if (error) throw error;
                showToast(`✅ Usuario ${formUser.full_name} actualizado correctamente`);

            } else {
                // ── CREAR NUEVO USUARIO ──
                let userId = null;
                let authCreated = false;

                // Paso 1: Intentar crear cuenta Auth (puede fallar por config del proyecto)
                try {
                    const { data: authData, error: authError } = await supabase.auth.signUp({
                        email: formUser.email,
                        password: formUser.password,
                        options: {
                            data: {
                                full_name: formUser.full_name,
                                role: formUser.role,
                            },
                        },
                    });

                    if (authError) {
                        console.warn('[UserMgmt] signUp falló:', authError.message);
                    } else if (authData?.user?.id) {
                        userId = authData.user.id;
                        authCreated = true;
                        console.log(`[UserMgmt] Auth creado OK: ${userId}`);
                    }
                } catch (signUpErr) {
                    console.warn('[UserMgmt] signUp exception:', signUpErr.message);
                }

                // Paso 2: Crear o actualizar perfil
                if (authCreated && userId) {
                    // Auth funcionó — esperar trigger y luego forzar el rol correcto
                    await new Promise(r => setTimeout(r, 1200));

                    const { error: updateErr } = await supabase
                        .from('profiles')
                        .update({
                            ...profileData,
                        })
                        .eq('id', userId);

                    if (updateErr) {
                        // El trigger puede no haber creado el row aún, intentar upsert
                        console.warn('[UserMgmt] Update falló, haciendo upsert:', updateErr.message);
                        const { error: upsertErr } = await supabase
                            .from('profiles')
                            .upsert([{ ...profileData, id: userId }]);
                        if (upsertErr) throw upsertErr;
                    }

                    showToast(`✅ ${formUser.full_name} creado con login y rol "${formUser.role}".`);

                } else {
                    // Auth NO funcionó — crear perfil directamente (sin login)
                    // El usuario podrá ser habilitado luego desde Supabase Dashboard
                    const fallbackId = crypto.randomUUID?.() || `usr-${Date.now()}`;

                    const { error: insertErr } = await supabase
                        .from('profiles')
                        .insert([{ ...profileData, id: fallbackId }]);

                    if (insertErr) throw insertErr;

                    showToast(`✅ ${formUser.full_name} creado con rol "${formUser.role}". ⚠️ Para habilitar login, crear cuenta Auth manualmente.`, 'warning');
                }
            }

            setShowModal(false);
            fetchData();

        } catch (error) {
            console.error('Error guardando usuario:', error);
            showToast('❌ Error: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`¿Está seguro de eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
            showToast(`🗑️ Usuario eliminado correctamente`);
            fetchData();
        } catch (error) {
            showToast('❌ Error eliminando usuario: ' + error.message, 'error');
        }
    };

    const toggleUserStatus = async (targetUser) => {
        const action = targetUser.active ? 'desactivar' : 'activar';
        if (!window.confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} acceso para ${targetUser.full_name}?`)) return;
        try {
            const { error } = await supabase.from('profiles').update({ active: !targetUser.active }).eq('id', targetUser.id);
            if (error) throw error;
            showToast(targetUser.active ? '🔒 Acceso desactivado' : '🔓 Acceso activado');
            fetchData();
        } catch (e) {
            showToast('❌ Error: ' + e.message, 'error');
        }
    };

    const sendInvite = (u) => {
        const subject = 'Bienvenido a RestoBot – Tus Credenciales de Acceso';
        const body = `Hola ${u.full_name},\n\nTe hemos creado una cuenta en RestoBot.\n\nUsuario: ${u.email}\nURL de acceso: ${window.location.origin}\n\nSi aún no tienes contraseña, solicita el enlace de recuperación.\n\nSaludos,\nEl equipo RestoBot`;
        window.open(`mailto:${u.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    // ─── Filtrado ────────────────────────────────────────────────────────────────
    const filteredUsers = users.filter(u => {
        const name = (u.full_name || u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();

        const matchesSearch = name.includes(term) || email.includes(term);
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        const matchesBranch = filterBranch === 'all' || u.branch_id === filterBranch;
        const matchesStatus = filterStatus === 'all'
            ? true
            : filterStatus === 'activo'
                ? u.active !== false
                : u.active === false;

        return matchesSearch && matchesRole && matchesBranch && matchesStatus;
    });

    // Contar permisos activos de un usuario
    const countActivePermissions = (permissions) => {
        if (!permissions) return 0;
        return Object.values(permissions).reduce((acc, mod) => {
            return acc + Object.values(mod).filter(Boolean).length;
        }, 0);
    };

    // ─── Render ──────────────────────────────────────────────────────────────────
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

            {/* ── Sub-Tabs: Usuarios vs Roles ── */}
            <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1.5 shadow-sm w-full md:w-auto md:inline-flex">
                <button
                    onClick={() => setMainTab('usuarios')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'usuarios'
                        ? 'bg-secondary text-white shadow-lg'
                        : 'text-gray-400 hover:text-secondary hover:bg-gray-50'
                        }`}
                >
                    <Users size={15} />
                    Usuarios
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${mainTab === 'usuarios' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                        }`}>{users.length}</span>
                </button>
                <button
                    onClick={() => setMainTab('roles')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'roles'
                        ? 'bg-secondary text-white shadow-lg'
                        : 'text-gray-400 hover:text-secondary hover:bg-gray-50'
                        }`}
                >
                    <Shield size={15} />
                    Roles
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${mainTab === 'roles' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                        }`}>{dbRoles.length}</span>
                </button>
            </div>

            {/* ── Contenido según Sub-Tab ── */}
            {mainTab === 'roles' ? (
                <RoleManagement />
            ) : (
                <>

                    {/* ── Stats Bar ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Personal', value: users.length, icon: Users, color: 'blue' },
                            { label: 'Activos', value: users.filter(u => u.active !== false).length, icon: CheckCircle2, color: 'green' },
                            { label: 'Inactivos', value: users.filter(u => u.active === false).length, icon: XCircle, color: 'red' },
                            { label: 'Roles Únicos', value: new Set(users.map(u => u.role)).size, icon: Shield, color: 'purple' },
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

                    {/* ── Filtros ── */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o correo..."
                                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <select
                                className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                            >
                                <option value="all">Todos los Roles</option>
                                {Object.entries(ROLE_TEMPLATES).map(([key, t]) => (
                                    <option key={key} value={key}>{t.label}</option>
                                ))}
                            </select>

                            <select
                                className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={filterBranch}
                                onChange={e => setFilterBranch(e.target.value)}
                            >
                                <option value="all">Todas las Sedes</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>

                            <select
                                className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Todos</option>
                                <option value="activo">Activos</option>
                                <option value="inactivo">Inactivos</option>
                            </select>

                            <button
                                onClick={fetchData}
                                className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-secondary hover:bg-gray-50 transition-all"
                                title="Recargar"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
                        >
                            <UserPlus size={16} />
                            <span className="hidden sm:inline">Nuevo Personal</span>
                            <span className="sm:hidden">Crear</span>
                        </button>
                    </div>

                    {/* ── Tabla de Usuarios ── */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cargando Personal...</p>
                                </div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                                <Users size={48} strokeWidth={1} />
                                <p className="mt-3 font-bold text-sm">No se encontraron usuarios</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-100">
                                            {['Usuario', 'Rol', 'Sede', 'Permisos', 'Estado', 'Acciones'].map(col => (
                                                <th key={col} className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredUsers.map(u => {
                                            const template = ROLE_TEMPLATES[u.role];
                                            const RoleIcon = template?.icon || Shield;
                                            const roleColor = template?.color || '#6b7280';
                                            const activePerms = countActivePermissions(u.permissions);
                                            const totalPerms = Object.keys(MODULE_LABELS).length * 4;

                                            return (
                                                <tr key={u.id} className={`hover:bg-gray-50/40 transition-colors ${u.active === false ? 'opacity-50' : ''}`}>
                                                    {/* Usuario */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm" style={{ backgroundColor: roleColor }}>
                                                                {(u.full_name || u.name || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-secondary">{u.full_name || u.name}</p>
                                                                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                    <Mail size={9} />
                                                                    {u.email || 'Sin email'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Rol */}
                                                    <td className="px-6 py-4">
                                                        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5" style={{ backgroundColor: `${roleColor}15`, color: roleColor, borderColor: `${roleColor}30` }}>
                                                            <RoleIcon size={10} />
                                                            {template?.label || u.role}
                                                        </span>
                                                    </td>

                                                    {/* Sede */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                                            <Building2 size={12} className="text-gray-400" />
                                                            {u.branch?.name || 'Global'}
                                                        </div>
                                                    </td>

                                                    {/* Permisos */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-primary to-rose-400 rounded-full transition-all"
                                                                    style={{ width: `${(activePerms / totalPerms) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-black text-gray-400">{activePerms}/{totalPerms}</span>
                                                        </div>
                                                    </td>

                                                    {/* Estado */}
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => toggleUserStatus(u)}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${u.active !== false ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                                            title={u.active !== false ? 'Desactivar acceso' : 'Activar acceso'}
                                                        >
                                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${u.active !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                                                        </button>
                                                    </td>

                                                    {/* Acciones */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => sendInvite(u)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Enviar invitación">
                                                                <Mail size={14} />
                                                            </button>
                                                            <button onClick={() => { setSelectedUserForPass(u); setShowPassModal(true); }} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Cambiar contraseña">
                                                                <Key size={14} />
                                                            </button>
                                                            <button onClick={() => handleOpenEdit(u)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Editar usuario">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteUser(u.id, u.full_name || u.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════
          MODAL: CREAR / EDITAR USUARIO
      ══════════════════════════════════════════ */}
                    {showModal && (
                        <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

                                {/* Header Modal */}
                                <div className="p-6 bg-secondary text-white flex justify-between items-center relative overflow-hidden shrink-0">
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-black tracking-tight">
                                            {editingUser ? 'Editar Colaborador' : 'Alta de Personal'}
                                        </h3>
                                        <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-0.5">
                                            {editingUser ? `Modificando: ${editingUser.full_name || editingUser.name}` : 'Nuevo miembro del equipo'}
                                        </p>
                                    </div>
                                    <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                        <X size={22} />
                                    </button>
                                    <Shield className="absolute -right-6 -bottom-6 text-white/5 w-36 h-36" />
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-gray-100 shrink-0">
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        📋 Información
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('permisos')}
                                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'permisos' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        🔐 Permisos
                                    </button>
                                </div>

                                <form onSubmit={handleSaveUser} className="flex flex-col flex-1 overflow-hidden">
                                    <div className="overflow-y-auto flex-1 p-6">

                                        {/* ── TAB INFO ── */}
                                        {activeTab === 'info' && (
                                            <div className="space-y-5">
                                                {/* Nombre */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre Completo</label>
                                                    <div className="relative">
                                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                        <input
                                                            required type="text"
                                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                                            placeholder="Ej. Carlos Rodríguez"
                                                            value={formUser.full_name}
                                                            onChange={e => setFormUser({ ...formUser, full_name: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Email */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Email Profesional</label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                        <input
                                                            required={!editingUser} type="email"
                                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                                            placeholder="correo@empresa.com"
                                                            value={formUser.email}
                                                            onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Contraseña — solo al crear */}
                                                {!editingUser && (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Contraseña Inicial</label>
                                                        <div className="relative">
                                                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                            <input
                                                                required type={showPassword ? 'text' : 'password'}
                                                                minLength={6}
                                                                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                                                placeholder="Mínimo 6 caracteres"
                                                                value={formUser.password}
                                                                onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                                                            />
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] text-gray-400 pl-1">El usuario recibirá un email de confirmación para activar su cuenta.</p>
                                                    </div>
                                                )}

                                                {/* Sede */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sede de Trabajo</label>
                                                    <div className="relative">
                                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                        <select
                                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold appearance-none"
                                                            value={formUser.branch_id}
                                                            onChange={e => setFormUser({ ...formUser, branch_id: e.target.value })}
                                                        >
                                                            <option value="">Sin sede asignada (Global)</option>
                                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── TAB PERMISOS ── */}
                                        {activeTab === 'permisos' && (
                                            <div className="space-y-5">
                                                {/* Plantillas de Roles */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Sparkles size={14} className="text-primary" />
                                                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Plantillas de Rol</h4>
                                                        <span className="text-[9px] text-gray-400 font-medium">— Aplicar permisos predefinidos</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {Object.entries(ROLE_TEMPLATES).map(([key, template]) => {
                                                            const Icon = template.icon;
                                                            const isSelected = selectedRoleTemplate === key;
                                                            const tColor = template.color || '#6b7280';
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    type="button"
                                                                    onClick={() => applyRoleTemplate(key)}
                                                                    className={`p-3 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-95 ${isSelected
                                                                        ? 'border-transparent text-white shadow-lg'
                                                                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                                                        }`}
                                                                    style={isSelected ? { backgroundColor: tColor } : {}}
                                                                >
                                                                    <Icon size={18} className={isSelected ? 'text-white mb-1' : 'text-gray-400 mb-1'} />
                                                                    <p className={`text-[10px] font-black uppercase tracking-wide ${isSelected ? 'text-white' : 'text-secondary'}`}>
                                                                        {template.label}
                                                                    </p>
                                                                    <p className={`text-[8px] font-medium mt-0.5 line-clamp-1 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                                                        {template.description}
                                                                    </p>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Matriz de Permisos Detallada */}
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ajuste Fino de Permisos</h4>
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
                                                                {Object.entries(formUser.permissions || {}).map(([moduleName, perms]) => {
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
                                                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center mx-auto transition-all ${perms[action]
                                                                                            ? 'bg-primary text-white shadow-sm'
                                                                                            : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                                                                            }`}
                                                                                    >
                                                                                        {perms[action] ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
                                                                                    </button>
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-2 py-2 text-center">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleModuleAll(moduleName)}
                                                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center mx-auto transition-all ${allOn
                                                                                        ? 'bg-secondary text-white'
                                                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                                        }`}
                                                                                    title={allOn ? 'Deshabilitar todo' : 'Habilitar todo'}
                                                                                >
                                                                                    {allOn ? <Unlock size={11} /> : <Lock size={11} />}
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer del Modal */}
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
                                            className="flex-1 bg-primary text-white py-3 rounded-2xl font-black shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-60"
                                        >
                                            {isSaving ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                                            ) : (
                                                <><Save size={16} /> {editingUser ? 'Guardar Cambios' : 'Registrar Colaborador'}</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════
          MODAL: CAMBIO DE CONTRASEÑA
      ══════════════════════════════════════════ */}
                    {showPassModal && (
                        <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-secondary text-sm">Seguridad de Cuenta</h3>
                                            <p className="text-[10px] text-gray-400">{selectedUserForPass?.full_name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowPassModal(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                                        <X size={18} className="text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                                        <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
                                        <div className="text-xs text-blue-700 font-medium leading-relaxed">
                                            <p className="font-black mb-1">Opciones para cambiar contraseña:</p>
                                            <ul className="list-disc list-inside space-y-1 text-blue-600">
                                                <li>El usuario puede usar "Olvidé mi contraseña" en el login</li>
                                                <li>Usar el Dashboard de Supabase → Authentication → Users</li>
                                                <li>Implementar Edge Function con privilegios Admin</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            window.open('https://supabase.com/dashboard', '_blank');
                                            setShowPassModal(false);
                                        }}
                                        className="w-full py-3 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Shield size={14} /> Abrir Admin de Supabase
                                    </button>
                                    <button
                                        onClick={() => setShowPassModal(false)}
                                        className="w-full py-2.5 text-gray-400 font-bold text-xs hover:text-secondary transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UserManagement;
