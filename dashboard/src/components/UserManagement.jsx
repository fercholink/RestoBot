import React, { useState } from 'react';
import { UserPlus, Search, Edit2, Trash2, Shield, User, Mail, Building2, Key, Check, Info, X, Save, AlertCircle, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { INITIAL_USERS } from '../constants/initialUsers';

// Removing local MOCK_USERS in favor of shared constant
const MOCK_USERS = INITIAL_USERS;

const MOCK_BRANCHES = ['Sede Norte', 'Sede Sur', 'Sede Centro', 'Global'];

const UserManagement = () => {
    const { user } = useAuth();

    // Protección de Ruta: Si no es admin ni gerente, no mostrar nada o redirect.
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
    // Cargar usuarios de localStorage o usar MOCK inicial
    const [users, setUsers] = useState(() => {
        const saved = localStorage.getItem('restobot_registered_users');
        return saved ? JSON.parse(saved) : MOCK_USERS;
    });

    // Sincronizar con localStorage cada vez que cambie la lista
    const syncUsers = (newList) => {
        setUsers(newList);
        localStorage.setItem('restobot_registered_users', JSON.stringify(newList));
    };

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
        name: '',
        email: '',
        password: '',
        role: 'cajero',
        branch: '',
        permissions: INITIAL_PERMISSIONS
    });

    const [isPassUpdated, setIsPassUpdated] = useState(false);

    const handleOpenCreate = () => {
        setEditingUser(null);
        setFormUser({
            name: '',
            email: '',
            password: '',
            role: 'cajero',
            branch: 'Sede Norte',
            permissions: JSON.parse(JSON.stringify(INITIAL_PERMISSIONS))
        });
        setShowModal(true);
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        setFormUser({
            ...user,
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

    const handleSaveUser = (e) => {
        e.preventDefault();
        if (editingUser) {
            syncUsers(users.map(u => u.id === editingUser.id ? { ...formUser, id: u.id } : u));
        } else {
            syncUsers([...users, { ...formUser, id: Date.now(), active: true }]);
        }
        setShowModal(false);
    };

    const handleDeleteUser = (id) => {
        if (window.confirm('¿Está seguro de eliminar este usuario? Recibirá una alerta de seguridad.')) {
            syncUsers(users.filter(u => u.id !== id));
        }
    };

    const handleUpdatePassword = () => {
        const newPassword = document.getElementById('new-password-input')?.value;
        if (!newPassword) return;

        // Actualizar el password en la lista persistente
        syncUsers(users.map(u =>
            u.id === selectedUserForPass.id ? { ...u, password: newPassword } : u
        ));

        setIsPassUpdated(true);
        setTimeout(() => {
            setIsPassUpdated(false);
            setShowPassModal(false);
            setSelectedUserForPass(null);
        }, 2000);
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
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
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Auditoría / Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-secondary text-white flex items-center justify-center font-black text-lg shadow-sm">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-secondary text-sm tracking-tight">{user.name}</p>
                                                <p className="text-[11px] text-gray-400 font-medium">{user.email}</p>
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
                                            {user.branch}
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
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
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
                                        value={formUser.name}
                                        onChange={(e) => setFormUser({ ...formUser, name: e.target.value })}
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
                                        <option value="admin">Administrador</option>
                                        <option value="gerente">Gerente General</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Sede de Trabajo</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-black appearance-none"
                                        value={formUser.branch}
                                        onChange={(e) => setFormUser({ ...formUser, branch: e.target.value })}
                                    >
                                        {MOCK_BRANCHES.map(b => (
                                            <option key={b} value={b}>{b}</option>
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
                                                                checked={perms[action]}
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
                                    <h3 className="text-xl font-black text-secondary">Control de Segurança</h3>
                                    <p className="text-xs text-gray-400 font-medium">Establecer nueva contraseña para <br /><span className="text-secondary font-black">{selectedUserForPass?.name}</span></p>

                                    <div className="space-y-3 pt-4 text-left">
                                        <input
                                            type="password"
                                            id="new-password-input"
                                            autoFocus
                                            className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                                            placeholder="Nueva contraseña"
                                        />
                                        <div className="bg-blue-50 p-3 rounded-xl flex gap-3">
                                            <AlertCircle size={18} className="text-blue-500 shrink-0" />
                                            <p className="text-[10px] text-blue-600 font-medium leading-normal">
                                                Se generará un log de seguridad indicando que usted restableció esta cuenta.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-6">
                                        <button
                                            onClick={handleUpdatePassword}
                                            className="flex-1 bg-secondary text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                                        >
                                            Actualizar
                                        </button>
                                        <button onClick={() => setShowPassModal(false)} className="px-6 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">
                                            Volver
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
