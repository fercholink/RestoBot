import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { FileText, Calendar, Download, Search, RefreshCw, Calculator, FileSpreadsheet } from 'lucide-react';
import { sileo } from 'sileo';

const LegalReports = () => {
    const { user } = useAuth();
    const [reportType, setReportType] = useState('trial_balance'); // trial_balance | income_statement
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState({ debits: 0, credits: 0, net: 0 });

    const generateReport = async () => {
        setLoading(true);
        try {
            // Consulta de todos los items contables en el rango de fechas con asientos "posted"
            const { data, error } = await supabase
                .from('accounting_entry_items')
                .select(`
                    debit,
                    credit,
                    account:accounting_accounts(code, name),
                    entry:accounting_entries!inner(date, status, organization_id)
                `)
                .eq('entry.status', 'posted')
                .eq('entry.organization_id', user.organization_id)
                .gte('entry.date', dateRange.start)
                .lte('entry.date', dateRange.end);

            if (error) throw error;

            const balances = {};
            let totalDebits = 0;
            let totalCredits = 0;

            (data || []).forEach(row => {
                if (!row.account) return;
                const code = row.account.code;

                // Si es P&G, filtramos cuentas 4, 5, 6
                if (reportType === 'income_statement' && !['4', '5', '6'].includes(code.charAt(0))) {
                    return; // Skip
                }

                if (!balances[code]) {
                    balances[code] = {
                        code: code,
                        name: row.account.name,
                        debit: 0,
                        credit: 0,
                        // Naturaleza: Activos (1) y Gastos/Costos (5,6) DEBITO; Pasivos (2), Patrimonio (3), Ingresos (4) CREDITO
                        nature: ['1', '5', '6'].includes(code.charAt(0)) ? 'D' : 'C'
                    };
                }

                const d = row.debit || 0;
                const c = row.credit || 0;

                balances[code].debit += d;
                balances[code].credit += c;

                totalDebits += d;
                totalCredits += c;
            });

            // Procesar saldo neto según naturaleza
            const processedData = Object.values(balances).map(acc => {
                let netBalance = 0;
                if (acc.nature === 'D') {
                    netBalance = acc.debit - acc.credit;
                } else {
                    netBalance = acc.credit - acc.debit;
                }
                return { ...acc, netBalance };
            }).sort((a, b) => a.code.localeCompare(b.code));

            setReportData(processedData);

            if (reportType === 'income_statement') {
                // Para ingresos, sumamos 4 (Crédito) y restamos 5, 6 (Débito)
                const ingresos = processedData.filter(a => a.code.startsWith('4')).reduce((sum, a) => sum + a.netBalance, 0);
                const gastosCostos = processedData.filter(a => a.code.startsWith('5') || a.code.startsWith('6')).reduce((sum, a) => sum + a.netBalance, 0);
                setSummary({
                    ingresos,
                    gastos: gastosCostos,
                    net: ingresos - gastosCostos
                });
            } else {
                setSummary({
                    debits: totalDebits,
                    credits: totalCredits,
                    difference: Math.abs(totalDebits - totalCredits)
                });
            }

        } catch (error) {
            console.error('Error al generar:', error);
            sileo.error({ title: 'Error', description: 'No se pudo generar el reporte.' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (reportData.length === 0) return sileo.error({ title: 'Vacío', description: 'No hay datos para exportar.' });

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Cuenta,Nombre,Débito,Crédito,Saldo Neto\n";

        reportData.forEach(row => {
            csvContent += `"${row.code}","${row.name}",${row.debit},${row.credit},${row.netBalance}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Reporte_${reportType}_${dateRange.start}_a_${dateRange.end}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grow overflow-hidden animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight">Informes Legales</h2>
                    <p className="text-sm text-gray-500">Genera reportes financieros para el periodo contable.</p>
                </div>
            </div>

            {/* Controles de Configuración del Reporte */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5">Tipo de Informe</label>
                    <select
                        value={reportType}
                        onChange={(e) => { setReportType(e.target.value); setReportData([]); }}
                        className="w-full bg-white border border-gray-200 text-secondary font-bold text-sm rounded-xl px-4 py-2.5 outline-none focus:border-secondary transition-colors"
                    >
                        <option value="trial_balance">Balance de Prueba (Libro Mayor)</option>
                        <option value="income_statement">Estdo de Resultados (P&G)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5">Periodo Desde</label>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-white border border-gray-200 text-secondary font-bold text-sm rounded-xl px-4 py-2.5 outline-none focus:border-secondary transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5">Hasta</label>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-white border border-gray-200 text-secondary font-bold text-sm rounded-xl px-4 py-2.5 outline-none focus:border-secondary transition-colors"
                    />
                </div>

                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={handleExportCSV}
                        disabled={loading || reportData.length === 0}
                        className="px-5 py-2.5 rounded-xl bg-white text-secondary font-black text-xs uppercase tracking-widest transition-all shadow-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                    <button
                        onClick={generateReport}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-secondary text-white font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                        Generar
                    </button>
                </div>
            </div>

            {/* Resumen / Tarjetas Superiores */}
            {reportData.length > 0 && reportType === 'income_statement' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Ingresos</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">${(summary.ingresos || 0).toLocaleString('es-CO')}</p>
                    </div>
                    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Total Gastos/Costos</p>
                        <p className="text-2xl font-black text-rose-700 mt-1">${(summary.gastos || 0).toLocaleString('es-CO')}</p>
                    </div>
                    <div className={`${summary.net >= 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-50 border-red-200 text-red-600'} rounded-2xl p-4 border`}>
                        <p className="text-[10px] font-black uppercase tracking-widest">Utilidad o Pérdida Bruta</p>
                        <p className="text-2xl font-black mt-1">${(summary.net || 0).toLocaleString('es-CO')}</p>
                    </div>
                </div>
            )}

            {/* Tabla de Resultados */}
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-gray-300">
                            <RefreshCw className="animate-spin" size={32} />
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="bg-gray-50 text-gray-300 p-6 rounded-full mb-4">
                                <FileSpreadsheet size={48} />
                            </div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Sin datos</p>
                            <p className="text-xs text-gray-400 mt-2 max-w-sm">
                                Selecciona un rango de fechas y oprime "Generar" para calcular el balance.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Código</th>
                                    <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Cuenta</th>
                                    <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Débito Mov.</th>
                                    <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Crédito Mov.</th>
                                    <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Saldo Neto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row) => (
                                    <tr key={row.code} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                                        <td className="p-4 text-sm font-mono font-bold text-gray-600">{row.code}</td>
                                        <td className="p-4 text-sm font-bold text-secondary uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px]" title={row.name}>{row.name}</td>
                                        <td className="p-4 text-sm font-medium text-gray-500 text-right">${row.debit.toLocaleString('es-CO')}</td>
                                        <td className="p-4 text-sm font-medium text-gray-500 text-right">${row.credit.toLocaleString('es-CO')}</td>
                                        <td className={`p-4 text-sm font-black text-right ${reportType === 'trial_balance' ? 'text-secondary' :
                                            (row.nature === 'C' ? 'text-emerald-600' : 'text-rose-500')
                                            }`}>
                                            ${row.netBalance.toLocaleString('es-CO')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {reportType === 'trial_balance' && (
                                <tfoot className="bg-gray-50 font-black text-secondary sticky bottom-0 z-10 border-t border-gray-200">
                                    <tr>
                                        <td colSpan={2} className="p-4 text-right">Sumas Iguales:</td>
                                        <td className="p-4 text-right text-emerald-600">${(summary.debits || 0).toLocaleString('es-CO')}</td>
                                        <td className="p-4 text-right text-emerald-600">${(summary.credits || 0).toLocaleString('es-CO')}</td>
                                        <td className="p-4 text-right text-[10px] text-gray-400">
                                            Dif: ${Math.abs((summary.debits || 0) - (summary.credits || 0)).toLocaleString('es-CO')}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LegalReports;
