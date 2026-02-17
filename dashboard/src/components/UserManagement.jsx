import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, Shield, User, Mail, Building2, Key, Check, Info, X, Save, AlertCircle, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Helper to generate UUID if needed (though DB should handle it)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterBranch, setFilterBranch] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassModal, setShowPassModal] = useState(false);
    const [selectedUserForPass, setSelectedUserForPass] = useState(null);

    const INITIAL_PERMISSIONS = {
        restaurante: { create: true, read: true, update: true, delete: false },
        hotel: { create: false, read: false, update: false, delete: false }, // Nuevo: Gestión Hotel
        financiero: { create: false, read: false, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: false, update: false, delete: false },
        marketing: { create: false, read: false, update: false, delete: false }, // Nuevo: Marketing AI
        qr_tools: { create: false, read: false, update: false, delete: false }, // Nuevo: Códigos QR
        operaciones: { create: false, read: false, update: false, delete: false }, // Nuevo: Seguridad/Logs
    };

    const [formUser, setFormUser] = useState({
        full_name: '',
        email: '',
        password: '', // Nota: No se guardará en profiles, solo para creación Auth futura
        role: 'cajero',
        branch_id: '',
        permissions: INITIAL_PERMISSIONS,
        organization_id: user.organization_id // Nuevo: Heredar organización del admin
    });

    const [isPassUpdated, setIsPassUpdated] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [profilesRes, branchesRes, rolesRes] = await Promise.all([
                supabase.from('profiles').select('*, branch:branches(name)'),
                supabase.from('branches').select('id, name').order('name'),
                supabase.from('roles').select('*').order('name')
            ]);

            setUsers(profilesRes.data || []);
            setBranches(branchesRes.data || []);
            setRolesList(rolesRes.data || []);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    // Protección de Ruta
    if (user && user.role !== 'admin' && user.role !== 'gerente') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner">
                    <Ban size={48} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-secondary">Acceso Restringido</h2>
                    <p className="text-gray-400 font-medium mt-2 max-w-sm mx-auto">
                        Su perfil de <strong>{user.role}</strong> no tiene permisos para gestionar usuarios.
                    </p>
                </div>
            </div>
        );
    }

    const handleOpenCreate = () => {
        setEditingUser(null);
        setFormUser({
            full_name: '',
            email: '',
            password: '',
            role: 'cajero',
            branch_id: branches[0]?.id || '',
            permissions: JSON.parse(JSON.stringify(INITIAL_PERMISSIONS))
        });
        setShowModal(true);
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        setFormUser({
            full_name: user.full_name || user.name, // Support both fields just in case
            email: user.email || '', // Profiles might not have email if not synced
            password: '',
            role: user.role,
            branch_id: user.branch_id || branches[0]?.id,
            branch_id: user.branch_id || branches[0]?.id,
            // Fusionar permisos existentes con los nuevos (para que aparezcan los nuevos módulos en usuarios antiguos)
            permissions: { ...INITIAL_PERMISSIONS, ...(user.permissions || {}) }
        });
        setShowModal(true);
    };

    const handleRoleChange = (e) => {
        const selectedRoleName = e.target.value;
        const roleObj = rolesList.find(r => r.name === selectedRoleName);

        let newPermissions = { ...INITIAL_PERMISSIONS };
        if (roleObj && roleObj.permissions) {
            // Merge or replace based on logic. For now, replace entire structure if format matches, or merge deeply.
            // Simplified: If role has "all": true, enable everything.
            if (roleObj.permissions.all) {
                Object.keys(newPermissions).forEach(k => {
                    newPermissions[k] = { create: true, read: true, update: true, delete: true };
                });
            } else {
                // Apply specific overrides
                Object.keys(roleObj.permissions).forEach(k => {
                    if (newPermissions[k]) {
                        // If boolean true, enable fully
                        if (roleObj.permissions[k] === true) {
                            newPermissions[k] = { create: true, read: true, update: true, delete: true };
                        } else if (typeof roleObj.permissions[k] === 'object') {
                            newPermissions[k] = { ...newPermissions[k], ...roleObj.permissions[k] };
                        }
                    }
                });
            }
        }

        setFormUser(prev => ({
            ...prev,
            role: selectedRoleName,
            permissions: newPermissions
        }));
    };

    const handlePermissionChange = (module, action) => {
        setFormUser(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: {
                    ...prev.permissions[module],
                    [action]: !prev.permissions[module][action]
                }
            }
        }));
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            const profileData = {
                full_name: formUser.full_name,
                role: formUser.role,
                branch_id: formUser.branch_id,
                permissions: formUser.permissions,
                active: true,
                organization_id: user.organization_id // Nuevo: Asegurar que el usuario pertenece a la misma organización
                // Si tuviéramos email en perfil, lo guardamos
                // email: formUser.email 
            };

            if (editingUser) {
                // Update Profile
                const { error } = await supabase
                    .from('profiles')
                    .update(profileData)
                    .eq('id', editingUser.id);

                if (error) throw error;
            } else {
                // Create New User Logic
                // IMPORTANTE: Aquí deberíamos llamar a una Edge Function para crear el usuario en Auth
                // O usar supabase.auth.signUp() si es auto-registro. 
                // Como workaround, insertamos en perfiles con un ID generado para tener el registro "Staff".
                // En un sistema real, el trigger de Auth crearía este perfil.

                // Opción A: Intentar Crear Auth User (Solo funciona si 'Enable Email Signup' está on y no requiere confirmación para login inmediato)
                // const { data: authData, error: authError } = await supabase.auth.signUp({
                //    email: formUser.email,
                //    password: formUser.password,
                //    options: { data: { full_name: formUser.full_name } }
                // });
                // if (authError) console.warn("No se pudo crear Auth:", authError);

                // Opción B: Insertar solo perfil (Staff sin login o login manejado externamente)
                const mockId = generateUUID(); // En producción usar authData.user.id

                const { error } = await supabase
                    .from('profiles')
                    .insert([{ ...profileData, id: mockId, email: formUser.email }]);

                if (error) throw error;
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            alert("Error guardando usuario: " + error.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este usuario?')) {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) alert("Error: " + error.message);
            else fetchData();
        }
    };

    const handleUpdatePassword = () => {
        // Placeholder: Client-side password update for OTHER users is restricted. 
        // We need an Admin function or "Send Password Reset Email".
        alert("Función disponible solo vía 'Recuperar Contraseña' o acceso Admin API.");
        setShowPassModal(false);
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.full_name || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        const matchesBranch = filterBranch === 'all' || (u.branch_id === filterBranch) || (!u.branch_id && filterBranch === 'global');

        return matchesSearch && matchesRole && matchesBranch;
    });

    const sendInvite = (user) => {
        const subject = "Bienvenido a RestoBot - Tus Credenciales";
        const body = `Hola ${user.full_name},\n\nTe hemos creado una cuenta en RestoBot.\n\nUsuario: ${user.email}\nContraseña Temporal: (Solicita al administrador)\n\nIngresa aquí: ${window.location.origin}`;
        window.open(`mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    const toggleUserStatus = async (user) => {
        if (!confirm(`¿${user.active ? 'Desactivar' : 'Activar'} acceso para ${user.full_name}?`)) return;
        try {
            const { error } = await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id);
            if (error) throw error;
            fetchData();
        } catch (e) {
            alert("Error actualizando estado: " + e.message);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header Control & Filters */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, correo o cargo..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                        >
                            <option value="all">Todos los Roles</option>
                            <option value="admin">Administradores</option>
                            <option value="gerente">Gerentes</option>
                            <option value="cajero">Cajeros</option>
                            <option value="mesero">Meseros</option>
                            <option value="cocina">Cocina</option>
                        </select>
                        <select
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={filterBranch}
                            onChange={(e) => setFilterBranch(e.target.value)}
                        >
                            <option value="all">Todas las Sedes</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all w-full md:w-auto justify-center"
                    >
                        <UserPlus size={18} />
                        <span className="hidden md:inline">Nuevo Personal</span>
                        <span className="md:hidden">Crear</span>
                    </button>
                </div>
            </div>

            {/* User Cards / List */}
            <div className="bg-white rounded-[2.5rem] shadow-premium border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Usuario</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Rol & Acceso</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Sede</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400 text-center">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm ${user.active ? 'bg-secondary' : 'bg-gray-300'}`}>
                                                {(user.full_name || user.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${user.active ? 'text-secondary' : 'text-gray-400'}`}>{user.full_name || user.name}</p>
                                                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <Mail size={10} />
                                                    {user.email || 'Sin email'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border inline-flex items-center gap-1 ${user.role === 'gerente' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                            user.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                'bg-orange-50 text-orange-600 border-orange-100'
                                            }`}>
                                            <Shield size={10} />
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                            <Building2 size={12} className="text-gray-400" />
                                            {user.branch?.name || 'Globál / Sin Asignar'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => toggleUserStatus(user)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${user.active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                        >
                                            <span className="sr-only">Activar usuario</span>
                                            <span
                                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${user.active ? 'translate-x-5' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => sendInvite(user)}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Enviar Credenciales por Correo"
                                            >
                                                <Mail size={14} />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedUserForPass(user); setShowPassModal(true); setIsPassUpdated(false); }}
                                                className="p-2 text-gray-400 hover:text-warning hover:bg-warning/10 rounded-lg transition-all"
                                                title="Cambiar Contraseña"
                                            >
                                                <Key size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Creación / Edición */}
            {showModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-8 bg-secondary text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black tracking-tight">{editingUser ? 'Editar Perfil' : 'Alta de Personal'}</h3>
                                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">Configuración de credenciales</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                            <Shield className="absolute -right-6 -bottom-6 text-white/5 w-40 h-40" />
                        </div>
                        <form onSubmit={handleSaveUser} className="p-8 space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Nombre y Apellidos</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        required
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                        placeholder="Ej. Carlos Ruiz"
                                        value={formUser.full_name}
                                        onChange={(e) => setFormUser({ ...formUser, full_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Email Profesional</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        required
                                        type="email"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                        placeholder="correo@sucursal.com"
                                        value={formUser.email}
                                        onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            {!editingUser && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Contraseña Temporal</label>
                                    <div className="relative">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input
                                            required
                                            type="password"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                            placeholder="••••••••"
                                            value={formUser.password}
                                            onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-400 pl-2 opacity-70">Nota: Solo se creará el perfil. La cuenta Auth debe crearse por Admin.</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Rol</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-black appearance-none"
                                        value={formUser.role}
                                        onChange={handleRoleChange}
                                    >
                                        <option value="">Seleccionar Rol...</option>
                                        {rolesList.map(role => (
                                            <option key={role.id} value={role.code}>{role.name}</option>
                                        ))}
                                        {!rolesList.length && (
                                            <>
                                                <option value="cajero">Cajero (Default)</option>
                                                <option value="mesero">Mesero (Default)</option>
                                                <option value="admin">Administrador (Default)</option>
                                                <option value="gerente">Gerente (Default)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Sede de Trabajo</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-black appearance-none"
                                        value={formUser.branch_id}
                                        onChange={(e) => setFormUser({ ...formUser, branch_id: e.target.value })}
                                    >
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Matriz de Permisos */}
                            <div className="space-y-3 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 pb-2">Matriz de Permisos</h4>
                                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-100/50">
                                                <th className="px-4 py-2 text-[8px] font-black uppercase text-gray-400">Módulo</th>
                                                <th className="px-2 py-2 text-[8px] font-black uppercase text-center text-gray-400" title="Leer/Ver">Ver</th>
                                                <th className="px-2 py-2 text-[8px] font-black uppercase text-center text-gray-400" title="Crear">Crear</th>
                                                <th className="px-2 py-2 text-[8px] font-black uppercase text-center text-gray-400" title="Editar">Edit</th>
                                                <th className="px-2 py-2 text-[8px] font-black uppercase text-center text-gray-400" title="Eliminar">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Object.entries(formUser.permissions || {}).map(([moduleName, perms]) => (
                                                <tr key={moduleName}>
                                                    <td className="px-4 py-3 text-[10px] font-bold capitalize text-secondary">
                                                        {moduleName}
                                                    </td>
                                                    {['read', 'create', 'update', 'delete'].map(action => (
                                                        <td key={action} className="px-2 py-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={perms[action] || false}
                                                                onChange={() => handlePermissionChange(moduleName, action)}
                                                                className="w-4 h-4 rounded-md border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl hover:brightness-110 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                            >
                                <Save size={18} />
                                {editingUser ? 'Actualizar Datos' : 'Registrar Colaborador'}
                            </button>
                        </form>
                    </div >
                </div >
            )}

            {/* Modal de Cambio de Contraseña (Seguridad) */}
            {
                showPassModal && (
                    <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in fade-in duration-200">
                            {isPassUpdated ? (
                                <div className="p-12 text-center space-y-6 animate-in zoom-in duration-300">
                                    <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <Check size={40} strokeWidth={3} className="animate-in slide-in-from-bottom-2" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-secondary">¡Cambio Exitoso!</h3>
                                        <p className="text-sm font-medium text-gray-400 mt-2">La contraseña ha sido actualizada correctamente.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center space-y-4">
                                    <div className="w-16 h-16 bg-warning/10 text-warning rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Key size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-secondary">Control de Seguridad</h3>
                                    <p className="text-xs text-gray-400 font-medium">Establecer nueva contraseña para <br /><span className="text-secondary font-black">{selectedUserForPass?.name || selectedUserForPass?.full_name}</span></p>

                                    <div className="bg-blue-50 p-3 rounded-xl flex gap-3 text-left">
                                        <AlertCircle size={18} className="text-blue-500 shrink-0" />
                                        <p className="text-[10px] text-blue-600 font-medium leading-normal">
                                            Por seguridad, el cambio de contraseña para otros usuarios debe realizarse desde el Panel de Administración de Supabase o mediante el flujo de recuperación de contraseña por email.
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-6">

                                        <button onClick={() => setShowPassModal(false)} className="px-6 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all w-full">
                                            Entendido
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default UserManagement;
