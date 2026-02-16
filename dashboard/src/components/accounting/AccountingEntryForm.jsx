import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Plus, Trash2, Search, AlertCircle, ArrowLeft } from 'lucide-react';

const AccountingEntryForm = ({ onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);

    // Header State
    const [header, setHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        journal_type: 'diario',
        reference: '',
        description: ''
    });

    // Items State
    const [items, setItems] = useState([
        { id: 1, account_id: '', description: '', debit: 0, credit: 0 },
        { id: 2, account_id: '', description: '', debit: 0, credit: 0 }
    ]);

    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        const { data } = await supabase
            .from('accounting_accounts')
            .select('id, code, name')
            .eq('is_movement', true) // Only movement accounts
            .order('code');
        setAccounts(data || []);
    };

    // Calculations
    const totalDebits = items.reduce((sum, item) => sum + (parseFloat(item.debit) || 0), 0);
    const totalCredits = items.reduce((sum, item) => sum + (parseFloat(item.credit) || 0), 0);
    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 0.01;

    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), account_id: '', description: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 2) return; // Keep at least 2 lines
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!isBalanced) {
            setError('El asiento no está cuadrado. La diferencia debe ser cero.');
            return;
        }

        if (totalDebits === 0) {
            setError('El asiento no puede estar en cero.');
            return;
        }

        if (items.some(i => !i.account_id)) {
            setError('Todas las líneas deben tener una cuenta contable seleccionada.');
            return;
        }

        setLoading(true);

        try {
            // 1. Create Entry Header
            const { data: entryData, error: entryError } = await supabase
                .from('accounting_entries')
                .insert([{
                    date: header.date,
                    journal_type: header.journal_type,
                    reference: header.reference,
                    description: header.description,
                    status: 'posted' // Auto-post for now
                }])
                .select()
                .single();

            if (entryError) throw entryError;

            // 2. Create Entry Items
            const itemsToInsert = items.map(item => ({
                entry_id: entryData.id,
                account_id: item.account_id,
                description: item.description || header.description, // Fallback to header desc
                debit: item.debit || 0,
                credit: item.credit || 0
            }));

            const { error: itemsError } = await supabase
                .from('accounting_entry_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            onSuccess();
        } catch (err) {
            console.error('Error saving entry:', err);
            setError(err.message || 'Error al guardar el asiento.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-secondary">Nuevo Asiento Contable</h2>
                        <p className="text-sm text-gray-500">Registra un movimiento manual en el libro diario.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${isBalanced ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <span>Diferencia:</span>
                        <span className="font-mono text-lg">{Math.abs(difference).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</span>
                        {!isBalanced && <AlertCircle size={16} />}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* General Info */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50/50 border-b border-gray-100">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                        <input
                            type="date"
                            required
                            className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                            value={header.date}
                            onChange={e => setHeader({ ...header, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Comprobante</label>
                        <select
                            className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                            value={header.journal_type}
                            onChange={e => setHeader({ ...header, journal_type: e.target.value })}
                        >
                            <option value="diario">Diario General</option>
                            <option value="ingreso">Nota de Ingreso</option>
                            <option value="egreso">Nota de Egreso</option>
                            <option value="ajuste">Ajuste Contable</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia</label>
                        <input
                            type="text"
                            placeholder="# Factura, Recibo..."
                            className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={header.reference}
                            onChange={e => setHeader({ ...header, reference: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Concepto General</label>
                        <input
                            type="text"
                            required
                            placeholder="Descripción del movimiento..."
                            className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={header.description}
                            onChange={e => setHeader({ ...header, description: e.target.value })}
                        />
                    </div>
                </div>

                {/* Lines */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 pl-6 text-xs font-black text-gray-500 uppercase tracking-wider w-[35%]">Cuenta Contable</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider w-[25%]">Descripción (Opcional)</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-right w-[15%]">Débito</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-right w-[15%]">Crédito</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-center w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-3 pl-6">
                                        <select
                                            className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-primary font-mono"
                                            value={item.account_id}
                                            onChange={e => handleItemChange(index, 'account_id', e.target.value)}
                                        >
                                            <option value="">Seleccionar Cuenta...</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.code} - {acc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="text"
                                            className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-primary"
                                            value={item.description}
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                            placeholder={header.description || "Detalle..."}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full p-2 rounded-lg border border-gray-200 text-sm text-right font-mono focus:border-primary focus:bg-blue-50/50"
                                            value={item.debit}
                                            onChange={e => {
                                                handleItemChange(index, 'debit', e.target.value);
                                                if (parseFloat(e.target.value) > 0) handleItemChange(index, 'credit', 0);
                                            }}
                                            onFocus={e => e.target.select()}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full p-2 rounded-lg border border-gray-200 text-sm text-right font-mono focus:border-primary focus:bg-orange-50/50"
                                            value={item.credit}
                                            onChange={e => {
                                                handleItemChange(index, 'credit', e.target.value);
                                                if (parseFloat(e.target.value) > 0) handleItemChange(index, 'debit', 0);
                                            }}
                                            onFocus={e => e.target.select()}
                                        />
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            disabled={items.length <= 2}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="m-6 mt-2 flex items-center gap-2 text-primary font-bold text-sm hover:underline"
                    >
                        <Plus size={16} />
                        Agregar Línea
                    </button>
                </div>

                {/* Footer Totals */}
                <div className="p-6 bg-gray-50 border-t border-gray-200">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex gap-8 text-right ml-auto mr-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Débitos</p>
                                <p className="text-xl font-mono font-bold text-secondary">{totalDebits.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Créditos</p>
                                <p className="text-xl font-mono font-bold text-secondary">{totalCredits.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !isBalanced}
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${loading || !isBalanced ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary hover:scale-105 hover:shadow-primary/30'}`}
                        >
                            <Save size={20} />
                            {loading ? 'Guardando...' : 'Guardar Asiento'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AccountingEntryForm;
