import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, Folder, FileText, ChevronRight, ChevronDown, Save, X, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';
import { sileo } from 'sileo';

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
        is_movement: true,
        requires_third_party: false,
        requires_cost_center: false
    });
    const [saving, setSaving] = useState(false);
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
            setSaving(true);
            if (editingAccount) {
                // Update
                const { error } = await supabase
                    .from('accounting_accounts')
                    .update(formData)
                    .eq('id', editingAccount.id);
                if (error) throw error;
                sileo.success({ title: 'Cuenta Actualizada', description: `La cuenta ${formData.code} fue guardada exitosamente.` });
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
            const msg = err.code === '23505' ? 'Este código de cuenta ya existe en el PUC.' : err.message;
            setError(msg);
            sileo.error({ title: 'Error', description: msg });
        } finally {
            setSaving(false);
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
            sileo.success({ title: 'Cuenta Eliminada', description: `Cuenta eliminada del catálogo.` });
            fetchAccounts();
        } catch (err) {
            console.error('Error deleting account:', err);
            sileo.error({ title: 'Error', description: 'No se puede eliminar la cuenta. Verifica que no tenga movimientos asociados.' });
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            nature: 'debit',
            is_movement: true,
            requires_third_party: false,
            requires_cost_center: false
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
                is_movement: account.is_movement,
                requires_third_party: account.requires_third_party || false,
                requires_cost_center: account.requires_cost_center || false
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
        <div className="flex-1 flex flex-col h-full fade-in bg-gray-50/30 p-2 md:p-6">
            {/* Header */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-black text-secondary flex items-center gap-3 tracking-tight">
                        <BarChart2 className="text-purple-500" />
                        Plan Único de Cuentas (PUC)
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Catálogo de cuentas contables parametrizable para NIIF y requerimientos de la DIAN.
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-purple-600/20"
                >
                    <Plus size={16} /> Agregar Cuenta
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
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-3xl border border-gray-100 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Código</th>
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Nombre de la Cuenta</th>
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Clasificación</th>
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Reglas (DIAN)</th>
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Acciones</th>
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
                                    <td className="p-4 font-mono font-medium text-secondary align-middle">
                                        <div className="flex items-center gap-2">
                                            {account.is_movement ? <FileText size={14} className="text-gray-300" /> : <Folder size={14} className="text-purple-500" />}
                                            <span className={`px-2 py-0.5 rounded ${account.is_movement ? 'bg-gray-50 border border-gray-200 text-gray-600' : 'bg-purple-50 text-purple-700 font-bold'}`}>
                                                {account.code}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={`p-4 text-sm align-middle ${!account.is_movement ? 'font-black text-secondary' : 'text-gray-600 font-medium'}`}>
                                        {account.name}
                                    </td>
                                    <td className="p-4 text-center align-middle">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${account.nature === 'debit' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                            {account.nature === 'debit' ? 'Débito (DB)' : 'Crédito (CR)'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center align-middle flex flex-col items-center gap-1">
                                        {account.is_movement && account.requires_third_party && (
                                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 rounded-full border border-amber-100">Exige Tercero</span>
                                        )}
                                        {account.is_movement && account.requires_cost_center && (
                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 rounded-full border border-emerald-100">Exige C. Costo</span>
                                        )}
                                        {account.is_movement && !account.requires_third_party && !account.requires_cost_center && (
                                            <span className="text-[9px] font-bold text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right align-middle">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                                <Folder size={20} className="text-purple-500" />
                                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta Contable'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-secondary rounded-full p-1 transition-colors">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAccount} className="p-6 space-y-5">
                            {error && (
                                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Código PUC</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-gray-200 text-secondary text-base rounded-xl p-3 outline-none focus:ring-purple-500 transition-all shadow-sm font-mono tracking-wider font-bold"
                                    placeholder="Ej: 110505"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '') })}
                                    maxLength={10}
                                />
                                <p className="text-[9px] font-bold text-gray-400 mt-1.5 ml-1">Para grupos usa 1, 2, 4, o 6 dígitos (Ej: 1105). Para movimientos usa 6+ dígitos.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nombre de la Cuenta</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-purple-500 transition-all shadow-sm uppercase font-black tracking-tight"
                                    placeholder="Ej: CAJA GENERAL"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Naturaleza</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-purple-500 transition-all shadow-sm font-bold"
                                        value={formData.nature}
                                        onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                                    >
                                        <option value="debit">Débito</option>
                                        <option value="credit">Crédito</option>
                                    </select>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-purple-200 transition-colors h-[46px]">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_movement}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    is_movement: checked,
                                                    // Reset requirements if it's no longer a movement account
                                                    requires_third_party: checked ? prev.requires_third_party : false,
                                                    requires_cost_center: checked ? prev.requires_cost_center : false
                                                }))
                                            }}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-xs font-black text-secondary tracking-tight">Es de Movimiento</span>
                                    </label>
                                </div>
                            </div>

                            {/* Reglas DIAN (Solo si es de movimiento) */}
                            {formData.is_movement && (
                                <div className="mt-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-100 border-dashed animate-in fade-in duration-300">
                                    <h4 className="text-[10px] font-black text-gray-400 border-b border-gray-200/60 pb-2 mb-3 uppercase tracking-widest">Exigencias DIAN / NIIF</h4>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-white border border-gray-100 rounded-xl hover:border-amber-200 transition-colors flex-1 shadow-sm">
                                            <input type="checkbox" name="requires_third_party" checked={formData.requires_third_party} onChange={(e) => setFormData({ ...formData, requires_third_party: e.target.checked })} className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500" />
                                            <span className="text-xs font-black text-secondary uppercase">Exige Tercero (NIT)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-white border border-gray-100 rounded-xl hover:border-emerald-200 transition-colors flex-1 shadow-sm">
                                            <input type="checkbox" name="requires_cost_center" checked={formData.requires_cost_center} onChange={(e) => setFormData({ ...formData, requires_cost_center: e.target.checked })} className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500" />
                                            <span className="text-xs font-black text-secondary uppercase">Exige C. Costo</span>
                                        </label>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-bold mt-2 ml-1 leading-relaxed">
                                        Si activas "Exige Tercero", no se podrá guardar un asiento en esta cuenta sin especificar el NIT. Útil para CxC, CxP o Retenciones.
                                    </p>
                                </div>
                            )}

                            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-gray-500 hover:text-secondary rounded-xl font-black transition-colors text-xs uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
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
