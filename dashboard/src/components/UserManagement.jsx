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
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassModal, setShowPassModal] = useState(false);
    const [selectedUserForPass, setSelectedUserForPass] = useState(null);

    const INITIAL_PERMISSIONS = {
        restaurante: { create: true, read: true, update: true, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: true, update: false, delete: false },
        financiero: { create: false, read: false, update: false, delete: false },
    };

    const [formUser, setFormUser] = useState({
        full_name: '',
        email: '',
        password: '', // Nota: No se guardará en profiles, solo para creación Auth futura
        role: 'cajero',
        branch_id: '',
        permissions: INITIAL_PERMISSIONS
    });

    const [isPassUpdated, setIsPassUpdated] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [profilesRes, branchesRes] = await Promise.all([
                supabase.from('profiles').select('*, branch:branches(name)'),
                supabase.from('branches').select('id, name')
            ]);

            setUsers(profilesRes.data || []);
            setBranches(branchesRes.data || []);
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
            permissions: user.permissions || JSON.parse(JSON.stringify(INITIAL_PERMISSIONS))
        });
        setShowModal(true);
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

    const filteredUsers = users.filter(u =>
        (u.full_name || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header Control */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o correo..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <UserPlus size={18} />
                    Registrar Personal
                </button>
            </div>

            {/* User Cards / List */}
            <div className="bg-white rounded-[2.5rem] shadow-premium border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Perfil de Usuario</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Nivel de Acceso</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sede Asignada</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-secondary text-white flex items-center justify-center font-black text-lg shadow-sm">
                                                {(user.full_name || user.name || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-secondary text-sm tracking-tight">{user.full_name || user.name}</p>
                                                <p className="text-[11px] text-gray-400 font-medium">{user.email || 'Sin email'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${user.role === 'gerente' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                            user.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                'bg-orange-50 text-orange-600 border-orange-100'
                                            }`}>
                                            <Shield size={10} className="inline mr-1 mb-0.5" />
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-gray-500 font-bold text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            {user.branch?.name || 'Globál / Sin Asignar'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setSelectedUserForPass(user); setShowPassModal(true); setIsPassUpdated(false); }}
                                                className="p-2.5 text-gray-400 hover:text-warning hover:bg-warning/10 rounded-xl transition-all"
                                                title="Cambiar Contraseña"
                                            >
                                                <Key size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-2.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={16} />
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
                                        onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}
                                    >
                                        <option value="cajero">Cajero</option>
                                        <option value="mesero">Mesero</option>
                                        <option value="admin">Administrador</option>
                                        <option value="gerente">Gerente General</option>
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
