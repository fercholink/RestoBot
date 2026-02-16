import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Plus, Trash2, Search, ArrowLeft, DollarSign, Calendar, FileText } from 'lucide-react';

const ExpenseForm = ({ onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [expenseAccounts, setExpenseAccounts] = useState([]);
    const [paymentAccounts, setPaymentAccounts] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        reference: '', // Factura #
        provider_name: '', // Simple text for now, could be search link later
        provider_doc: '', // NIT
        payment_method: 'credit', // 'credit' (Por Pagar - 2335) or 'cash' (Caja/Bancos - 11)
        payment_account_id: '', // Selected payment account if cash
        notes: ''
    });

    // Items (Gastos)
    const [items, setItems] = useState([
        { id: 1, account_id: '', description: '', amount: 0 }
    ]);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        // Fetch Expense Accounts (Class 5 and 6)
        const { data: expenses } = await supabase
            .from('accounting_accounts')
            .select('id, code, name')
            .or('code.ilike.5%,code.ilike.6%') // Class 5 & 6
            .eq('is_movement', true)
            .order('code');
        setExpenseAccounts(expenses || []);

        // Fetch Payment/Liability Accounts (Class 11 and 23)
        const { data: payments } = await supabase
            .from('accounting_accounts')
            .select('id, code, name')
            .or('code.ilike.11%,code.ilike.22%,code.ilike.23%')
            .eq('is_movement', true)
            .order('code');
        setPaymentAccounts(payments || []);
    };

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), account_id: '', description: '', amount: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
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
        if (totalAmount <= 0) return;
        if (formData.payment_method === 'cash' && !formData.payment_account_id) {
            alert('Por favor selecciona la cuenta de donde sale el dinero.');
            return;
        }

        setLoading(true);

        try {
            // 1. Create Entry
            const { data: entry, error: entryError } = await supabase
                .from('accounting_entries')
                .insert([{
                    date: formData.date,
                    journal_type: 'egreso',
                    reference: formData.reference,
                    description: `Compra/Gasto: ${formData.provider_name} - ${formData.notes}`,
                    status: 'posted',
                    origin: 'manual'
                }])
                .select()
                .single();

            if (entryError) throw entryError;

            // 2. Prepare Items
            const entryItems = [];

            // A. Debits (Expenses)
            items.forEach(item => {
                entryItems.push({
                    entry_id: entry.id,
                    account_id: item.account_id,
                    description: item.description || formData.notes,
                    debit: item.amount,
                    credit: 0
                });
            });

            // B. Credit (Contrapartida: Payable or Bank)
            let creditAccountId = '';

            if (formData.payment_method === 'credit') {
                // Find a default "Cuentas por Pagar" account if not selected?
                // For now, let's force user to pick or find '233595' (Costos y gastos por pagar)
                const payableAccount = paymentAccounts.find(a => a.code.startsWith('2335') || a.code.startsWith('2205'));
                creditAccountId = payableAccount?.id;

                if (!creditAccountId) throw new Error("No se encontró una cuenta de 'Cuentas por Pagar' (2335/2205) configurada.");
            } else {
                creditAccountId = formData.payment_account_id;
            }

            // check if we found a credit account
            if (!creditAccountId) throw new Error("Cuenta de contrapartida no definida.");

            entryItems.push({
                entry_id: entry.id,
                account_id: creditAccountId,
                description: `Pago/Causación: ${formData.provider_name}`,
                debit: 0,
                credit: totalAmount
            });

            // 3. Insert Items
            const { error: itemsError } = await supabase
                .from('accounting_entry_items')
                .insert(entryItems);

            if (itemsError) throw itemsError;

            onSuccess();
        } catch (error) {
            console.error('Error saving expenses:', error);
            alert(error.message);
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
                        <h2 className="text-xl font-black text-secondary">Registrar Compra / Gasto</h2>
                        <p className="text-sm text-gray-500">Ingresa la factura del proveedor.</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500 font-bold uppercase">Total a Pagar</p>
                    <p className="text-2xl font-black text-secondary">{totalAmount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* General Info */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 border-b border-gray-100">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Datos de la Factura</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Fecha</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="date"
                                            required
                                            className="w-full pl-10 p-2.5 rounded-xl border border-gray-200 focus:border-primary font-medium"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Factura / Ref</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Ej: FE-1092"
                                            className="w-full pl-10 p-2.5 rounded-xl border border-gray-200 focus:border-primary"
                                            value={formData.reference}
                                            onChange={e => setFormData({ ...formData, reference: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Proveedor</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nombre o Razón Social"
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-primary mb-2"
                                    value={formData.provider_name}
                                    onChange={e => setFormData({ ...formData, provider_name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="NIT / Documento (Opcional)"
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-primary text-sm"
                                    value={formData.provider_doc}
                                    onChange={e => setFormData({ ...formData, provider_doc: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 text-sm-4">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Forma de Pago</h3>
                            <div className="flex gap-4 mb-4">
                                <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.payment_method === 'credit' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="credit"
                                        className="hidden"
                                        checked={formData.payment_method === 'credit'}
                                        onChange={() => setFormData({ ...formData, payment_method: 'credit' })}
                                    />
                                    <span className="block font-bold mb-1">Crédito</span>
                                    <span className="text-xs opacity-70">A cuentas por pagar (Proveedores 2205 / Costos 2335)</span>
                                </label>
                                <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.payment_method === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="cash"
                                        className="hidden"
                                        checked={formData.payment_method === 'cash'}
                                        onChange={() => setFormData({ ...formData, payment_method: 'cash' })}
                                    />
                                    <span className="block font-bold mb-1">Contado</span>
                                    <span className="text-xs opacity-70">Sale de Caja General o Bancos inmediatamente.</span>
                                </label>
                            </div>

                            {formData.payment_method === 'cash' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Cuenta de Origen (Dinero)</label>
                                    <select
                                        className="w-full p-2.5 rounded-xl border border-emerald-200 focus:border-emerald-500 text-emerald-800 bg-white"
                                        value={formData.payment_account_id}
                                        onChange={e => setFormData({ ...formData, payment_account_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar Caja o Banco...</option>
                                        {paymentAccounts.filter(p => p.code.startsWith('11')).map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Notas / Observaciones</label>
                                <textarea
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-primary h-20 resize-none"
                                    placeholder="Detalles adicionales..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="p-6">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4">Detalle de Gastos</h3>
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-y border-gray-200">
                                <tr>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase w-[40%]">Concepto / Cuenta</th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase w-[30%]">Descripción</th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase w-[20%] text-right">Valor</th>
                                    <th className="p-3 w-[10%]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="group hover:bg-gray-50">
                                        <td className="p-2">
                                            <select
                                                className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-primary"
                                                value={item.account_id}
                                                onChange={e => handleItemChange(index, 'account_id', e.target.value)}
                                                required
                                            >
                                                <option value="">Seleccionar Tipo de Gasto...</option>
                                                {expenseAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.name} ({acc.code})
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-primary"
                                                placeholder="Ej: Resmas de papel, Servicio de Luz"
                                                value={item.description}
                                                onChange={e => handleItemChange(index, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-primary text-right font-mono"
                                                value={item.amount}
                                                onChange={e => handleItemChange(index, 'amount', e.target.value)}
                                                required
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-1.5 text-gray-300 hover:text-rose-500 rounded hover:bg-rose-50"
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
                            className="mt-4 flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
                        >
                            <Plus size={16} /> Agregar línea
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 ${loading ? 'bg-gray-400' : 'bg-primary hover:scale-105'}`}
                    >
                        <Save size={20} />
                        {loading ? 'Guardando...' : 'Guardar Gasto'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExpenseForm;
