import React, { useRef } from 'react';
import { X, Printer, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const EntryDetailsModal = ({ entry, onClose, onVoid }) => {
    const printRef = useRef();

    const handlePrint = () => {
        const printContent = printRef.current;
        const windowPrint = window.open('', '', 'width=900,height=650');
        windowPrint.document.write(`
            <html>
                <head>
                    <title>Comprobante Contable #${entry.id}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #333; }
                        .header { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #f2f2f2; }
                        .text-right { text-align: right; }
                        .total-row { font-weight: bold; background-color: #f9f9f9; }
                        .void-stamp { 
                            position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
                            font-size: 100px; color: rgba(255, 0, 0, 0.2); border: 5px solid rgba(255, 0, 0, 0.2);
                            padding: 20px; text-transform: uppercase; font-weight: bold; pointer-events: none;
                        }
                    </style>
                </head>
                <body>
                    ${entry.status === 'voided' ? '<div class="void-stamp">ANULADO</div>' : ''}
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        windowPrint.document.close();
        windowPrint.focus();
        windowPrint.print();
        windowPrint.close();
    };

    const totalDebits = entry.accounting_entry_items?.reduce((sum, item) => sum + (item.debit || 0), 0) || 0;
    const totalCredits = entry.accounting_entry_items?.reduce((sum, item) => sum + (item.credit || 0), 0) || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header Actions */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                        <FileText size={20} />
                        Detalle del Asiento
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="Imprimir Comprobante"
                        >
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6" ref={printRef}>
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-black text-secondary uppercase tracking-wider">Comprobante de Diario</h1>
                        <p className="text-sm text-gray-500">#{entry.id} - {new Date(entry.date).toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-gray-400 uppercase">Referencia</p>
                            <p className="font-medium text-secondary">{entry.reference || 'N/A'}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase">Estado</p>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${entry.status === 'posted' ? 'bg-emerald-50 text-emerald-600' :
                                    entry.status === 'voided' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-500'
                                }`}>
                                {entry.status === 'posted' ? 'Asentado' : entry.status === 'voided' ? 'Anulado' : 'Borrador'}
                            </span>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs font-bold text-gray-400 uppercase">Descripción</p>
                            <p className="font-medium text-secondary">{entry.description}</p>
                        </div>
                    </div>

                    <table className="w-full text-left border-collapse border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase border-b border-gray-200">Cuenta</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase border-b border-gray-200">Descripción</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase border-b border-gray-200 text-right">Débito</th>
                                <th className="p-3 text-xs font-black text-gray-500 uppercase border-b border-gray-200 text-right">Crédito</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {entry.accounting_entry_items?.map((item) => (
                                <tr key={item.id}>
                                    <td className="p-3 text-sm font-mono text-secondary">
                                        {item.account?.code} - {item.account?.name}
                                    </td>
                                    <td className="p-3 text-sm text-gray-600">{item.description}</td>
                                    <td className="p-3 text-sm font-medium text-right text-secondary">
                                        {item.debit > 0 ? item.debit.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : '-'}
                                    </td>
                                    <td className="p-3 text-sm font-medium text-right text-secondary">
                                        {item.credit > 0 ? item.credit.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                            <tr>
                                <td colSpan="2" className="p-3 text-right text-xs uppercase text-gray-500">Totales</td>
                                <td className="p-3 text-right text-secondary">
                                    {totalDebits.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                                </td>
                                <td className="p-3 text-right text-secondary">
                                    {totalCredits.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-8 pt-8 border-t border-gray-200 grid grid-cols-3 gap-8 text-center text-xs">
                        <div className="border-t border-black pt-2">
                            <p className="font-bold">Elaboró</p>
                            <p className="text-gray-500 mt-1">{entry.created_by_user?.email || 'Sistema'}</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="font-bold">Revisó</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="font-bold">Aprobó</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                {entry.status === 'posted' && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-500" />
                            <span>Si anulas este asiento, los saldos se revertirán.</span>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de ANULAR este asiento contable? Esta acción no se puede deshacer.')) {
                                    onVoid(entry.id);
                                }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl font-bold text-xs uppercase transition-colors"
                        >
                            Anular Asiento
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EntryDetailsModal;
