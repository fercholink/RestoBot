import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Filter, Download, FileText, DollarSign, Calendar, Paperclip } from 'lucide-react';

import ExpenseForm from './ExpenseForm';

const ExpenseList = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!isCreating) fetchExpenses();
    }, [isCreating]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            // Fetch entries of type 'egreso'
            // We also need to calculate the total amount for each entry. 
            // Since we don't have a 'total' column in header, we assume the sum of credits to 'Cuentas por Pagar' or 'Caja' 
            // approximates the total. Or we can just sum the debits (gastos).

            const { data, error } = await supabase
                .from('accounting_entries')
                .select(`
                    id,
                    date,
                    reference,
                    description,
                    status,
                    origin,
                    attachment_url,
                    accounting_entry_items (
                        debit,
                        credit,
                        account:accounting_accounts (name, code)
                    )
                `)
                .eq('journal_type', 'egreso')
                .order('date', { ascending: false });

            if (error) throw error;

            // Process data to calculate totals
            const processed = data?.map(entry => {
                const totalAmount = entry.accounting_entry_items.reduce((sum, item) => sum + (item.debit || 0), 0);
                return { ...entry, totalAmount };
            });

            setExpenses(processed || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight">Compras y Gastos</h2>
                    <p className="text-sm text-gray-500">Gestión de facturas de proveedores y gastos operativos.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-secondary rounded-xl font-bold hover:bg-gray-50 transition-colors">
                        <Download size={18} />
                        Exportar
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                        <Plus size={18} />
                        Registrar Gasto
                    </button>
                </div>
            </div>

            {/* Metrics Loop (Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Gastos del Mes</p>
                    <p className="text-2xl font-black text-secondary mt-1">$0.00</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Por Pagar</p>
                    <p className="text-2xl font-black text-rose-500 mt-1">$0.00</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Facturas Recientes</p>
                    <p className="text-2xl font-black text-blue-500 mt-1">0</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar proveedor, referencia..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* ... Date filters ... */}
            </div>

            {/* List */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referencia</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Detalle</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Origen</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Total</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Adjunto</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-400">Cargando gastos...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No hay gastos registrados.</td></tr>
                            ) : (
                                expenses.map(expense => (
                                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-secondary">{expense.date}</td>
                                        <td className="p-4 text-sm text-gray-500 font-mono">{expense.reference || '-'}</td>
                                        <td className="p-4 text-sm text-gray-600 truncate max-w-[200px]" title={expense.description}>{expense.description}</td>
                                        <td className="p-4">
                                            {expense.origin?.includes('n8n') ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-600 text-[10px] font-bold uppercase">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                                    IA / Auto
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">
                                                    Manual
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-secondary text-right">
                                            {expense.totalAmount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                                        </td>
                                        <td className="p-4 text-center">
                                            {expense.attachment_url ? (
                                                <a href={expense.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                                    <Paperclip size={16} />
                                                </a>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${expense.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {expense.status === 'posted' ? 'Asentado' : 'Borrador'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Registro de Gasto */}
            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <ExpenseForm
                            onCancel={() => setIsCreating(false)}
                            onSuccess={() => {
                                setIsCreating(false);
                                fetchExpenses();
                            }}
                        />
                    </div>
                </div>
            )}
        </div >
    );
};

export default ExpenseList;
