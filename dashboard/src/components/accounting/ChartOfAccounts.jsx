import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, Folder, FileText, ChevronRight, ChevronDown, Save, X, AlertCircle } from 'lucide-react';

const ChartOfAccounts = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({}); // { prefix: boolean }

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        nature: 'debit',
        is_movement: true
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('accounting_accounts')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            console.error('Error fetching accounts:', error);
        } else {
            setAccounts(data || []);
        }
        setLoading(false);
    };

    const handleSaveAccount = async (e) => {
        e.preventDefault();
        setError(null);

        // Basic Validation
        if (!formData.code || !formData.name) {
            setError('Código y Nombre son obligatorios.');
            return;
        }

        try {
            if (editingAccount) {
                // Update
                const { error } = await supabase
                    .from('accounting_accounts')
                    .update(formData)
                    .eq('id', editingAccount.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('accounting_accounts')
                    .insert([formData]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchAccounts();
            resetForm();
        } catch (err) {
            console.error('Error saving account:', err);
            setError(err.message || 'Error al guardar la cuenta.');
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta cuenta?')) return;

        try {
            const { error } = await supabase
                .from('accounting_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchAccounts();
        } catch (err) {
            console.error('Error deleting account:', err);
            alert('No se puede eliminar la cuenta. Verifica que no tenga movimientos asociados.');
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            nature: 'debit',
            is_movement: true
        });
        setEditingAccount(null);
        setError(null);
    };

    const openModal = (account = null) => {
        if (account) {
            setEditingAccount(account);
            setFormData({
                code: account.code,
                name: account.name,
                nature: account.nature,
                is_movement: account.is_movement
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    // Filtering
    const filteredAccounts = accounts.filter(acc =>
        acc.code.includes(searchTerm) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight">Plan Único de Cuentas (PUC)</h2>
                    <p className="text-sm text-gray-500">Gestiona el catálogo de cuentas contables.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                    <Plus size={18} />
                    Nueva Cuenta
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por código o nombre..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider">Código</th>
                            <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Naturaleza</th>
                            <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Tipo</th>
                            <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">Cargando cuentas...</td></tr>
                        ) : filteredAccounts.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">No se encontraron cuentas.</td></tr>
                        ) : (
                            filteredAccounts.map(account => (
                                <tr key={account.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-3 font-mono font-medium text-secondary">
                                        <span className={`px-2 py-0.5 rounded ${account.is_movement ? 'bg-white border' : 'bg-gray-200 font-bold'}`}>
                                            {account.code}
                                        </span>
                                    </td>
                                    <td className={`p-3 text-sm ${!account.is_movement ? 'font-black text-secondary' : 'text-gray-600 font-medium'}`}>
                                        {account.name}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${account.nature === 'debit' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                            {account.nature === 'debit' ? 'Débito' : 'Crédito'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        {account.is_movement ? (
                                            <span className="flex items-center justify-center gap-1 text-xs text-gray-500">
                                                <FileText size={14} /> Movimiento
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-1 text-xs text-secondary font-bold">
                                                <Folder size={14} /> Grupo
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(account)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteAccount(account.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-secondary">
                                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta Contable'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-secondary transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código PUC</label>
                                <input
                                    type="text"
                                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                                    placeholder="Ej: 110505"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '') })}
                                    maxLength={10}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Solo números. La longitud define el nivel.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre de la Cuenta</label>
                                <input
                                    type="text"
                                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder="Ej: CAJA GENERAL"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Naturaleza</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={formData.nature}
                                        onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                                    >
                                        <option value="debit">Débito</option>
                                        <option value="credit">Crédito</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                                    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_movement}
                                            onChange={(e) => setFormData({ ...formData, is_movement: e.target.checked })}
                                            className="w-4 h-4 text-primary rounded focus:ring-primary"
                                        />
                                        <span className="text-sm text-secondary font-medium">Es de Movimiento</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    <Save size={18} />
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartOfAccounts;
