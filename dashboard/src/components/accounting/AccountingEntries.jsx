import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, FileText, Calendar, Filter, Eye, Download } from 'lucide-react';

import AccountingEntryForm from './AccountingEntryForm';
import EntryDetailsModal from './EntryDetailsModal';

const AccountingEntries = () => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Details Modal State
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    useEffect(() => {
        if (!isCreating) fetchEntries();
    }, [isCreating]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('accounting_entries')
                .select(`
                    *,
                    created_by_user:created_by (email)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            // Apply filters if needed (date, etc)
            // if (dateRange.start) query = query.gte('date', dateRange.start);

            const { data, error } = await query;

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (entry) => {
        try {
            // Fetch items for this entry
            const { data, error } = await supabase
                .from('accounting_entries')
                .select(`
                    *,
                    created_by_user:created_by (email),
                    accounting_entry_items (
                        id,
                        description,
                        debit,
                        credit,
                        account:accounting_accounts (code, name)
                    )
                `)
                .eq('id', entry.id)
                .single();

            if (error) throw error;
            setSelectedEntry(data);
            setIsDetailsOpen(true);
        } catch (error) {
            console.error('Error details:', error);
            alert('Error al cargar detalles.');
        }
    };

    const handleVoidEntry = async (id) => {
        try {
            const { error } = await supabase
                .from('accounting_entries')
                .update({ status: 'voided' })
                .eq('id', id);

            if (error) throw error;

            setIsDetailsOpen(false);
            fetchEntries();
        } catch (error) {
            console.error('Error voiding:', error);
            alert('Error al anular el asiento.');
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight">Libro Diario</h2>
                    <p className="text-sm text-gray-500">Gestión de asientos y movimientos contables.</p>
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
                        Nuevo Asiento
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por descripción, referencia..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <input
                        type="date"
                        className="p-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 focus:outline-none focus:border-primary"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        className="p-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 focus:outline-none focus:border-primary"
                    />
                </div>
                <button className="p-2 text-gray-400 hover:text-secondary transition-colors">
                    <Filter size={20} />
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referencia</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Descripción</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">Cargando asientos...</td></tr>
                            ) : entries.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No hay asientos registrados aún.</td></tr>
                            ) : (
                                entries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-secondary">{entry.date}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold uppercase border border-gray-200">
                                                {entry.journal_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 font-mono">{entry.reference || '-'}</td>
                                        <td className="p-4 text-sm text-gray-600 md:max-w-xs truncate" title={entry.description}>
                                            {entry.description}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${entry.status === 'posted' ? 'bg-emerald-50 text-emerald-600' :
                                                entry.status === 'voided' ? 'bg-rose-50 text-rose-600' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                {entry.status === 'posted' ? 'Asentado' :
                                                    entry.status === 'voided' ? 'Anulado' : 'Borrador'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleViewDetails(entry)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Ver Detalle"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Creación de Asiento */}
            {
                isCreating && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                            <AccountingEntryForm
                                onCancel={() => setIsCreating(false)}
                                onSuccess={() => {
                                    setIsCreating(false);
                                    fetchEntries();
                                }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Modal de Detalles */}
            {isDetailsOpen && selectedEntry && (
                <EntryDetailsModal
                    entry={selectedEntry}
                    onClose={() => setIsDetailsOpen(false)}
                    onVoid={handleVoidEntry}
                />
            )}
        </div >
    );
};

export default AccountingEntries;
