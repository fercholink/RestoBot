import { useState, useEffect, useCallback } from 'react';
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
import { useAdminLog } from '../hooks/useAdminLog';
import { DEFAULT_PERMISSIONS, getDefaultPermissions } from '../config/roles';


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
    const { log: adminLog } = useAdminLog();


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
    const [newPass, setNewPass] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab] = useState('info'); // 'info' | 'permisos'
    const [selectedRoleTemplate, setSelectedRoleTemplate] = useState(null);
    const [pendingDeleteUserId, setPendingDeleteUserId] = useState(null);

    const isGerente = currentUser?.role === 'gerente';
    // Roles que un gerente puede asignar a su equipo (no puede crear otros gerentes)
    const GERENTE_ALLOWED_ROLES = ['admin', 'recepcion', 'cajero', 'mesero', 'cocina', 'camarera'];

    // Construir ROLE_TEMPLATES dinámicamente de la BD
    // Si la BD no tiene permisos para un rol, usa los DEFAULT_PERMISSIONS de roles.js
    const ROLE_TEMPLATES = {};
    const ROLE_BADGE_STYLES = {};
    dbRoles.forEach(r => {
        // Verificar si permissions es un objeto con contenido real
        const hasRealPermissions = r.permissions && typeof r.permissions === 'object'
            && Object.keys(r.permissions).length > 0;
        const rolePerms = hasRealPermissions
            ? r.permissions
            : (DEFAULT_PERMISSIONS[r.name] || getDefaultPermissions(r.name));

        ROLE_TEMPLATES[r.name] = {
            label: r.label,
            description: r.description || '',
            icon: ICON_MAP[r.icon] || Shield,
            color: r.color || '#6b7280',
            gradient: `from-gray-500 to-gray-600`,
            permissions: rolePerms,
        };
        ROLE_BADGE_STYLES[r.name] = '';
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
            <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8 animate-in fade-in zoom-in duration-700">
                <div className="w-32 h-32 bg-rose-50 text-rose-500 rounded-[40px] flex items-center justify-center shadow-inner mb-8 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Ban size={56} strokeWidth={1.5} />
                </div>
                <div className="max-w-md">
                    <h2 className="text-4xl font-black text-secondary tracking-tighter mb-4 leading-tight">
                        Acceso <span className="text-rose-500">Protegido</span>
                    </h2>
                    <p className="text-accent font-bold text-sm uppercase tracking-widest opacity-60 leading-relaxed mb-8">
                        Tu perfil de <span className="text-secondary">{currentUser.role?.toUpperCase()}</span> no cuenta con las credenciales necesarias para administrar el personal de la organización.
                    </p>
                    <div className="p-1 bg-surface-soft rounded-full border border-hairline inline-flex items-center gap-4 pr-6">
                        <div className="w-10 h-10 rounded-full bg-canvas shadow-sm flex items-center justify-center text-secondary">
                            <Shield size={18} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-accent">Nivel de seguridad: Máximo</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Data Fetching ───────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // El Super Admin ('admin') puede ver todo, el resto solo de su organización
            const isSuperAdmin = currentUser?.role === 'admin';
            
            let profilesQuery = supabase.from('profiles').select('*, branch:branches(name)').order('created_at', { ascending: false });
            let branchesQuery = supabase.from('branches').select('id, name').order('name');
            
            // Fila clave para Multi-Tenant:
            if (!isSuperAdmin && currentUser?.organization_id) {
                profilesQuery = profilesQuery.eq('organization_id', currentUser.organization_id);
                branchesQuery = branchesQuery.eq('organization_id', currentUser.organization_id);
            }

            const [profilesRes, branchesRes, rolesRes] = await Promise.all([
                profilesQuery,
                branchesQuery,
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
    }, [currentUser]);

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
    const handleResetPassword = async () => {
        if (!newPass || newPass.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        setIsResetting(true);
        try {
            const { error: rpcErr } = await supabase.rpc('reset_user_password', {
                p_user_id: selectedUserForPass.id,
                p_new_password: newPass,
            });
            if (rpcErr) throw rpcErr;
            
            // Log activity
            adminLog({
                action: 'user_password_reset',
                description: `Reseteo de contraseña para usuario: ${selectedUserForPass.email}`,
                module: 'usuarios',
                entity_type: 'profile',
                entity_id: selectedUserForPass.id,
                new_value: { email: selectedUserForPass.email }
            });

            showToast('Contraseña actualizada correctamente');
            setShowPassModal(false);
            setNewPass('');
        } catch (error) {
            console.error('Error resetting password:', error);
            showToast('Error al actualizar la contraseña: ' + error.message, 'error');
        } finally {
            setIsResetting(false);
        }
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Asegurar que permissions nunca sea {} vacío
            const hasPerms = formUser.permissions && Object.keys(formUser.permissions).length > 0;
            const safePermissions = hasPerms ? formUser.permissions : getDefaultPermissions(formUser.role);

            const profileData = {
                full_name: formUser.full_name,
                role: formUser.role,
                branch_id: formUser.branch_id || null,
                permissions: safePermissions,
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

                // Audit Log
                adminLog({
                    action: 'Actualización de Usuario',
                    module: 'usuarios',
                    entity_type: 'profile',
                    entity_id: editingUser.id,
                    description: `actualizó los datos del usuario ${formUser.full_name}`,
                    new_value: profileData
                });


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
                                organization_id: currentUser.organization_id || null,
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
        if (pendingDeleteUserId !== id) {
            setPendingDeleteUserId(id);
            showToast(`⚠️ Clic de nuevo para eliminar a "${name}"`, 'warning');
            setTimeout(() => setPendingDeleteUserId(null), 3500);
            return;
        }
        setPendingDeleteUserId(null);
        try {
            const { error } = await supabase.rpc('delete_user_with_auth', { p_user_id: id });
            if (error) throw error;
            showToast(`Usuario "${name}" eliminado correctamente`);
            fetchData();
        } catch (error) {
            showToast('❌ Error eliminando usuario: ' + error.message, 'error');
        }
    };

    const toggleUserStatus = async (targetUser) => {
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
        const subject = 'Bienvenido a Nexus – Tus Credenciales de Acceso';
        const body = `Hola ${u.full_name},\n\nTe hemos creado una cuenta en Nexus.\n\nUsuario: ${u.email}\nURL de acceso: ${window.location.origin}\n\nSi aún no tienes contraseña, solicita el enlace de recuperación.\n\nSaludos,\nEl equipo Nexus`;
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
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-[20px] shadow-airbnb text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-right-4 duration-300 ${
                    toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}>
                    {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    {toast.message}
                </div>
            )}

            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-secondary tracking-tighter leading-none mb-2">
                        Equipo <span className="text-primary">&</span> Gestión
                    </h1>
                    <p className="text-accent font-bold text-[11px] uppercase tracking-[0.2em] opacity-60">
                        Administración central de accesos y roles
                    </p>
                </div>

                {/* ── Sub-Tabs ── */}
                <div className="flex items-center bg-canvas rounded-full border border-hairline p-1.5 shadow-sm self-start">
                    <button
                        onClick={() => setMainTab('usuarios')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                            mainTab === 'usuarios'
                            ? 'bg-secondary text-white shadow-airbnb'
                            : 'text-accent hover:text-secondary hover:bg-surface-soft'
                        }`}
                    >
                        <Users size={14} strokeWidth={2.5} />
                        Personal
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black ${
                            mainTab === 'usuarios' ? 'bg-white/20 text-white' : 'bg-surface-soft text-accent'
                        }`}>{users.length}</span>
                    </button>
                    <button
                        onClick={() => setMainTab('roles')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                            mainTab === 'roles'
                            ? 'bg-secondary text-white shadow-airbnb'
                            : 'text-accent hover:text-secondary hover:bg-surface-soft'
                        }`}
                    >
                        <Shield size={14} strokeWidth={2.5} />
                        Roles
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black ${
                            mainTab === 'roles' ? 'bg-white/20 text-white' : 'bg-surface-soft text-accent'
                        }`}>{dbRoles.length}</span>
                    </button>
                </div>
            </div>

            {/* ── Contenido según Sub-Tab ── */}
            {mainTab === 'roles' ? (
                <RoleManagement />
            ) : (
                <>
                    {/* ── Stats Bar ── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Equipo', value: users.length, icon: Users, color: 'blue', desc: 'Colaboradores registrados' },
                            { label: 'En Servicio', value: users.filter(u => u.active !== false).length, icon: CheckCircle2, color: 'emerald', desc: 'Usuarios con acceso activo' },
                            { label: 'Sin Acceso', value: users.filter(u => u.active === false).length, icon: XCircle, color: 'rose', desc: 'Cuentas desactivadas' },
                            { label: 'Jerarquías', value: new Set(users.map(u => u.role)).size, icon: Shield, color: 'amber', desc: 'Niveles de permisos' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-canvas rounded-[32px] border border-hairline p-6 shadow-sm hover:shadow-airbnb transition-all duration-500 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
                                        stat.color === 'blue' ? 'bg-blue-50 text-blue-500' :
                                        stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
                                        stat.color === 'rose' ? 'bg-rose-50 text-rose-500' :
                                        'bg-amber-50 text-amber-500'
                                    }`}>
                                        <stat.icon size={22} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-secondary tracking-tighter group-hover:scale-110 transition-transform duration-500 origin-right">
                                            {stat.value}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase text-secondary tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-[10px] font-bold text-accent opacity-60 leading-tight">{stat.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Filtros y Acciones ── */}
                    <div className="bg-canvas rounded-[32px] border border-hairline p-6 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-accent opacity-50" size={18} />
                            <input
                                type="text"
                                placeholder="BUSCAR POR NOMBRE O CORREO..."
                                className="w-full pl-14 pr-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[11px] font-black uppercase tracking-widest placeholder:text-accent/40"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                            <select
                                className="bg-surface-soft border-none rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-widest text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                            >
                                <option value="all">TODOS LOS ROLES</option>
                                {Object.entries(ROLE_TEMPLATES).map(([key, t]) => (
                                    <option key={key} value={key}>{t.label.toUpperCase()}</option>
                                ))}
                            </select>

                            <select
                                className="bg-surface-soft border-none rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-widest text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                value={filterBranch}
                                onChange={e => setFilterBranch(e.target.value)}
                            >
                                <option value="all">TODAS LAS SEDES</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                            </select>

                            <button
                                onClick={fetchData}
                                className="p-4 bg-surface-soft text-accent hover:text-secondary rounded-2xl transition-all hover:bg-surface-soft/80 active:scale-95"
                                title="Recargar"
                            >
                                <RefreshCw size={18} strokeWidth={2.5} />
                            </button>
                        </div>

                        <button
                            onClick={handleOpenCreate}
                            className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary text-white px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-airbnb hover:shadow-premium active:scale-95 transition-all whitespace-nowrap"
                        >
                            <UserPlus size={18} strokeWidth={2.5} />
                            Añadir Miembro
                        </button>
                        </div>
                    {/* ── Tabla de Usuarios ── */}
                    <div className="bg-canvas rounded-[32px] shadow-airbnb border border-hairline overflow-hidden mt-8">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
                                    <p className="text-[11px] font-black text-accent uppercase tracking-[0.2em]">Sincronizando equipo...</p>
                                </div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-accent opacity-40">
                                <Users size={48} strokeWidth={1} />
                                <p className="mt-4 font-black text-[11px] uppercase tracking-[0.2em]">Sin resultados encontrados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                {/* Desktop Table */}
                                <table className="w-full text-left border-collapse hidden md:table">
                                    <thead>
                                        <tr className="bg-surface-soft/40 border-b border-hairline">
                                            {['Colaborador', 'Jerarquía', 'Ubicación', 'Nivel de Acceso', 'Estado', ''].map(col => (
                                                <th key={col} className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-accent/60 whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-hairline">
                                        {filteredUsers.map(u => {
                                            const template = ROLE_TEMPLATES[u.role];
                                            const RoleIcon = template?.icon || Shield;
                                            const roleColor = template?.color || '#6b7280';
                                            const activePerms = countActivePermissions(u.permissions);
                                            const totalPerms = Object.keys(MODULE_LABELS).length * 4;

                                            return (
                                                <tr key={u.id} className={`group hover:bg-surface-soft/20 transition-all duration-300 ${u.active === false ? 'opacity-40 grayscale' : ''}`}>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm group-hover:scale-110 transition-transform duration-500" style={{ backgroundColor: roleColor }}>
                                                                    {(u.full_name || u.name || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                {u.active !== false && (
                                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-canvas rounded-full shadow-sm" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-[15px] text-secondary tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">
                                                                    {u.full_name || u.name}
                                                                </p>
                                                                <p className="text-[11px] text-accent flex items-center gap-1.5 font-bold opacity-60">
                                                                    <Mail size={12} className="opacity-50" />
                                                                    {u.email || 'SIN EMAIL'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-[9px] font-black uppercase px-4 py-1.5 rounded-full border inline-flex items-center gap-2 tracking-widest transition-all group-hover:shadow-sm" style={{ backgroundColor: `${roleColor}10`, color: roleColor, borderColor: `${roleColor}25` }}>
                                                            <RoleIcon size={12} strokeWidth={2.5} />
                                                            {template?.label || u.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-2 text-[11px] font-black text-secondary tracking-tight">
                                                            <Building2 size={14} className="text-accent opacity-40" />
                                                            {u.branch?.name?.toUpperCase() || 'ACCESO GLOBAL'}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-24 h-2 bg-surface-soft rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-700 bg-secondary"
                                                                    style={{ width: `${(activePerms / totalPerms) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-black text-accent tracking-tighter">{activePerms}/{totalPerms}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <button
                                                            onClick={() => toggleUserStatus(u)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-500 focus:outline-none shadow-sm ${u.active !== false ? 'bg-secondary' : 'bg-gray-200'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-500 ${u.active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                            {[
                                                                { icon: Mail, color: 'blue', action: () => sendInvite(u), tip: 'Invitar' },
                                                                { icon: Key, color: 'amber', action: () => { setSelectedUserForPass(u); setShowPassModal(true); }, tip: 'Clave' },
                                                                { icon: Edit2, color: 'primary', action: () => handleOpenEdit(u), tip: 'Editar' },
                                                            ].map((btn, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={btn.action}
                                                                    className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${
                                                                        btn.color === 'blue' ? 'text-blue-400 hover:bg-blue-50' :
                                                                        btn.color === 'amber' ? 'text-amber-400 hover:bg-amber-50' :
                                                                        'text-primary hover:bg-primary/10'
                                                                    }`}
                                                                    title={btn.tip}
                                                                >
                                                                    <btn.icon size={16} strokeWidth={2.5} />
                                                                </button>
                                                            ))}
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id, u.full_name || u.name)}
                                                                className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${pendingDeleteUserId === u.id ? 'bg-rose-500 text-white animate-pulse' : 'text-rose-400 hover:bg-rose-50'}`}
                                                                title={pendingDeleteUserId === u.id ? 'Clic de nuevo para confirmar' : 'Eliminar'}
                                                            >
                                                                <Trash2 size={16} strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Mobile Card List */}
                                <div className="md:hidden divide-y divide-hairline">
                                    {filteredUsers.map(u => {
                                        const template = ROLE_TEMPLATES[u.role];
                                        const roleColor = template?.color || '#6b7280';
                                        const RoleIcon = template?.icon || Shield;
                                        const activePerms = countActivePermissions(u.permissions);
                                        const totalPerms = Object.keys(MODULE_LABELS).length * 4;

                                        return (
                                            <div key={u.id} className={`p-6 space-y-6 ${u.active === false ? 'bg-surface-soft/30 grayscale' : ''}`}>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-3xl flex items-center justify-center font-black text-white text-xl shadow-md" style={{ backgroundColor: roleColor }}>
                                                            {(u.full_name || u.name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-[17px] text-secondary tracking-tighter leading-none mb-1">{u.full_name || u.name}</p>
                                                            <p className="text-[11px] text-accent font-bold opacity-60 flex items-center gap-1.5 uppercase">
                                                                <Mail size={12} /> {u.email || 'SIN EMAIL'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleUserStatus(u)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-500 ${u.active !== false ? 'bg-secondary' : 'bg-gray-200'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 bg-surface-soft/40 p-4 rounded-[24px] border border-hairline">
                                                    <div className="space-y-3">
                                                        <div>
                                                            <p className="text-[9px] font-black text-accent/50 uppercase tracking-[0.2em] mb-2">Jerarquía</p>
                                                            <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full border inline-flex items-center gap-1.5 tracking-widest" style={{ backgroundColor: `${roleColor}10`, color: roleColor, borderColor: `${roleColor}25` }}>
                                                                <RoleIcon size={10} /> {template?.label || u.role}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-accent/50 uppercase tracking-[0.2em] mb-1">Ubicación</p>
                                                            <p className="text-[11px] font-black text-secondary flex items-center gap-1.5 tracking-tight uppercase">
                                                                <Building2 size={12} className="opacity-40" /> {u.branch?.name || 'Acceso Global'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end justify-between border-l border-hairline pl-4">
                                                        <p className="text-[9px] font-black text-accent/50 uppercase tracking-[0.2em]">Permisos</p>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="w-16 h-2 bg-canvas rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full bg-secondary rounded-full"
                                                                    style={{ width: `${(activePerms / totalPerms) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[12px] font-black text-secondary tracking-tighter">{activePerms}<span className="text-accent opacity-40">/{totalPerms}</span></span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button onClick={() => sendInvite(u)} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-canvas border border-hairline rounded-2xl text-secondary text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-transform">
                                                        <Mail size={14} /> Invitar
                                                    </button>
                                                    <button onClick={() => handleOpenEdit(u)} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-secondary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-airbnb active:scale-95 transition-transform">
                                                        <Edit2 size={14} /> Editar
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(u.id, u.full_name || u.name)} className="px-4 py-3.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-2xl active:scale-95 transition-transform">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* ══════════════════════════════════════════
          MODAL: CREAR / EDITAR USUARIO
      ══════════════════════════════════════════ */}
                    {showModal && (
                        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                            <div className="bg-canvas rounded-[40px] shadow-premium w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[92vh] border border-hairline">

                                {/* Header Modal */}
                                <div className="p-8 bg-canvas border-b border-hairline flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tighter text-secondary leading-none mb-1">
                                            {editingUser ? 'Perfile del Equipo' : 'Nuevo Colaborador'}
                                        </h3>
                                        <p className="text-accent text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">
                                            {editingUser ? editingUser.full_name?.toUpperCase() : 'REGISTRO DE PERSONAL'}
                                        </p>
                                    </div>
                                    <button onClick={() => setShowModal(false)} className="p-3 hover:bg-surface-soft rounded-full transition-all active:scale-90">
                                        <X size={24} className="text-accent" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex bg-surface-soft/30 p-2 mx-8 mt-4 rounded-2xl border border-hairline shrink-0">
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                            activeTab === 'info' 
                                            ? 'bg-canvas text-secondary shadow-sm border border-hairline' 
                                            : 'text-accent hover:text-secondary'
                                        }`}
                                    >
                                        <User size={14} strokeWidth={2.5} />
                                        Información
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('permisos')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                            activeTab === 'permisos' 
                                            ? 'bg-canvas text-secondary shadow-sm border border-hairline' 
                                            : 'text-accent hover:text-secondary'
                                        }`}
                                    >
                                        <Shield size={14} strokeWidth={2.5} />
                                        Permisos
                                    </button>
                                </div>

                                <form onSubmit={handleSaveUser} className="flex flex-col flex-1 overflow-hidden">
                                    <div className="overflow-y-auto flex-1 p-8 custom-scrollbar">

                                        {/* ── TAB INFO ── */}
                                        {activeTab === 'info' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {/* Nombre */}
                                                <div className="space-y-3">
                                                    <label className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Identificación del Miembro</label>
                                                    <div className="relative group">
                                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                                        <input
                                                            required type="text"
                                                            className="w-full pl-14 pr-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm uppercase tracking-widest placeholder:text-accent/30"
                                                            placeholder="EJ. CARLOS RODRÍGUEZ"
                                                            value={formUser.full_name}
                                                            onChange={e => setFormUser({ ...formUser, full_name: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Email */}
                                                <div className="space-y-3">
                                                    <label className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Canal de Acceso (Email)</label>
                                                    <div className="relative group">
                                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                                        <input
                                                            required={!editingUser} type="email"
                                                            className="w-full pl-14 pr-6 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm uppercase tracking-widest placeholder:text-accent/30"
                                                            placeholder="CORREO@EMPRESA.COM"
                                                            value={formUser.email}
                                                            onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Contraseña — solo al crear */}
                                                {!editingUser && (
                                                    <div className="space-y-3">
                                                        <label className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Credenciales de Seguridad</label>
                                                        <div className="relative group">
                                                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                                            <input
                                                                required type={showPassword ? 'text' : 'password'}
                                                                minLength={6}
                                                                className="w-full pl-14 pr-14 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm tracking-[0.3em] placeholder:text-accent/30 placeholder:tracking-widest"
                                                                placeholder="******"
                                                                value={formUser.password}
                                                                onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                                                            />
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-accent hover:text-secondary transition-colors">
                                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-accent font-bold px-2 flex items-center gap-2">
                                                            <Info size={12} className="text-amber-500" />
                                                            Se enviará una invitación de seguridad al correo indicado.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Sede */}
                                                <div className="space-y-3">
                                                    <label className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Asignación de Sede</label>
                                                    <div className="relative group">
                                                        <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                                        <select
                                                            className="w-full pl-14 pr-10 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black uppercase tracking-widest appearance-none cursor-pointer"
                                                            value={formUser.branch_id}
                                                            onChange={e => setFormUser({ ...formUser, branch_id: e.target.value })}
                                                        >
                                                            <option value="">ACCESO GLOBAL (TODAS LAS SEDES)</option>
                                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                                                        </select>
                                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-accent pointer-events-none" size={18} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── TAB PERMISOS ── */}
                                        {activeTab === 'permisos' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {/* Plantillas de Roles */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between ml-1">
                                                        <h4 className="text-[11px] font-black uppercase text-secondary tracking-[0.2em]">Jerarquías Predefinidas</h4>
                                                        <Sparkles size={16} className="text-amber-500 animate-pulse" />
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {Object.entries(ROLE_TEMPLATES).filter(([key]) => !isGerente || GERENTE_ALLOWED_ROLES.includes(key)).map(([key, template]) => {
                                                            const Icon = template.icon;
                                                            const isSelected = selectedRoleTemplate === key;
                                                            const tColor = template.color || '#6b7280';
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    type="button"
                                                                    onClick={() => applyRoleTemplate(key)}
                                                                    className={`p-4 rounded-3xl border-2 text-left transition-all duration-300 hover:scale-[1.02] active:scale-95 group ${
                                                                        isSelected
                                                                        ? 'border-transparent text-white shadow-airbnb'
                                                                        : 'border-hairline bg-canvas hover:border-accent/30'
                                                                    }`}
                                                                    style={isSelected ? { backgroundColor: tColor } : {}}
                                                                >
                                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                                                                        isSelected ? 'bg-white/20' : 'bg-surface-soft text-accent group-hover:text-secondary'
                                                                    }`}>
                                                                        <Icon size={20} strokeWidth={2.5} />
                                                                    </div>
                                                                    <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${isSelected ? 'text-white' : 'text-secondary'}`}>
                                                                        {template.label}
                                                                    </p>
                                                                    <p className={`text-[9px] font-bold mt-2 line-clamp-1 opacity-60 ${isSelected ? 'text-white' : 'text-accent'}`}>
                                                                        {template.description}
                                                                    </p>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Matriz de Permisos Detallada */}
                                                <div className="space-y-4">
                                                    <h4 className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Privilegios Individuales</h4>
                                                    <div className="bg-canvas rounded-3xl border border-hairline overflow-hidden shadow-sm">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="bg-surface-soft/50 border-b border-hairline">
                                                                    <th className="px-5 py-4 text-[9px] font-black uppercase text-accent tracking-widest">Módulo</th>
                                                                    {['LEER', 'CREAR', 'EDIT', 'BORRAR'].map(action => (
                                                                        <th key={action} className="px-2 py-4 text-[9px] font-black uppercase text-center text-accent tracking-widest">{action}</th>
                                                                    ))}
                                                                    <th className="px-5 py-4 text-[9px] font-black uppercase text-center text-accent tracking-widest">FULL</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-hairline">
                                                                {Object.entries(formUser.permissions || {}).map(([moduleName, perms]) => {
                                                                    const modInfo = MODULE_LABELS[moduleName] || { label: moduleName, emoji: '📦' };
                                                                    const allOn = Object.values(perms).every(Boolean);
                                                                    return (
                                                                        <tr key={moduleName} className="group hover:bg-surface-soft/20 transition-colors">
                                                                            <td className="px-5 py-4">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="text-base group-hover:scale-125 transition-transform">{modInfo.emoji}</span>
                                                                                    <span className="text-[11px] font-black text-secondary tracking-tight">{modInfo.label.toUpperCase()}</span>
                                                                                </div>
                                                                            </td>
                                                                            {['read', 'create', 'update', 'delete'].map(action => (
                                                                                <td key={action} className="px-2 py-3 text-center">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handlePermissionChange(moduleName, action)}
                                                                                        className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all ${
                                                                                            perms[action]
                                                                                            ? 'bg-secondary text-white shadow-airbnb scale-110'
                                                                                            : 'bg-surface-soft text-accent/30 hover:text-accent hover:bg-surface-soft/80'
                                                                                        }`}
                                                                                    >
                                                                                        {perms[action] ? <Check size={14} strokeWidth={4} /> : <X size={12} />}
                                                                                    </button>
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-5 py-3 text-center border-l border-hairline">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleModuleAll(moduleName)}
                                                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all ${
                                                                                        allOn
                                                                                        ? 'bg-primary text-white shadow-airbnb'
                                                                                        : 'bg-surface-soft text-accent/30 hover:bg-primary/10 hover:text-primary'
                                                                                    }`}
                                                                                    title={allOn ? 'Revocar todo' : 'Habilitar todo'}
                                                                                >
                                                                                    {allOn ? <Unlock size={14} strokeWidth={2.5} /> : <Lock size={14} strokeWidth={2.5} />}
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
                                    <div className="p-8 border-t border-hairline shrink-0 flex gap-4 bg-canvas">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 py-4 bg-surface-soft rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="flex-[2] bg-primary text-white py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-airbnb hover:shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                            {editingUser ? 'Sincronizar' : 'Crear'} Miembro
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}                    {/* ══════════════════════════════════════════
          MODAL: CAMBIO DE CONTRASEÑA
      ══════════════════════════════════════════ */}
                    {showPassModal && (
                        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                            <div className="bg-canvas rounded-[32px] shadow-premium w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-500 border border-hairline">
                                <div className="p-8 border-b border-hairline flex justify-between items-center bg-canvas">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-surface-soft text-secondary rounded-2xl flex items-center justify-center shadow-sm">
                                            <Key size={24} strokeWidth={2} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-secondary text-base tracking-tighter leading-none mb-1">Seguridad</h3>
                                            <p className="text-[10px] font-black text-accent tracking-[0.2em] uppercase opacity-60 truncate max-w-[150px]">{selectedUserForPass?.full_name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowPassModal(false)} className="p-2 hover:bg-surface-soft rounded-full transition-all active:scale-90">
                                        <X size={20} className="text-accent" />
                                    </button>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex gap-4">
                                        <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                                        <div className="text-[11px] text-rose-600 font-bold leading-relaxed">
                                            <p className="font-black mb-1 uppercase tracking-widest">Aviso de Seguridad</p>
                                            <p className="opacity-80">Al confirmar, el acceso anterior será revocado inmediatamente.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black uppercase text-secondary tracking-[0.2em] ml-1">Nueva Clave de Acceso</label>
                                        <div className="relative group">
                                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="w-full pl-14 pr-14 py-4 bg-surface-soft border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-sm tracking-[0.3em] placeholder:text-accent/30 placeholder:tracking-widest"
                                                placeholder="******"
                                                value={newPass}
                                                onChange={e => setNewPass(e.target.value)}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-accent hover:text-secondary transition-colors">
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleResetPassword}
                                        disabled={isResetting}
                                        className="w-full bg-secondary text-white py-4 rounded-full font-black text-[11px] uppercase tracking-[0.2em] shadow-airbnb hover:shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {isResetting ? (
                                            <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> PROCESANDO...</>
                                        ) : (
                                            <><Check size={20} strokeWidth={2.5} /> CONFIRMAR CAMBIO</>
                                        )}
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
