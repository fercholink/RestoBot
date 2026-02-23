import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download, Send, Clock, CheckCircle } from 'lucide-react';
import factusService from '../../services/factusService';
import { sileo } from 'sileo';

const SupportDocuments = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [subTab, setSubTab] = useState('pending'); // pending | history
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchDocuments();
    }, [subTab]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('accounting_entries')
                .select(`
                    id,
                    date,
                    reference,
                    description,
                    status,
                    factus_doc_number,
                    factus_id,
                    created_at,
                    accounting_entry_items (
                        debit,
                        third_party_id
                    )
                `)
                .eq('journal_type', 'egreso')
                .order('date', { ascending: false })
                .limit(50);

            if (subTab === 'pending') {
                query = query.is('factus_doc_number', null);
            } else {
                query = query.not('factus_doc_number', 'is', null);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Calculate totals
            const processed = (data || []).map(doc => {
                const totalAmount = doc.accounting_entry_items?.reduce((sum, item) => sum + (item.debit || 0), 0) || 0;
                // Intentar encontrar el primer third_party_id si existe
                const tp = doc.accounting_entry_items?.find(i => i.third_party_id)?.third_party_id;
                return { ...doc, totalAmount, third_party_id: tp };
            });

            setDocuments(processed);
        } catch (error) {
            console.error('Error fetching support docs:', error);
            sileo.error({ title: 'Error', description: 'No se pudieron cargar los documentos.' });
        } finally {
            setLoading(false);
        }
    };

    const handleEmitSupportDocument = async (doc) => {
        setProcessingId(doc.id);

        const safetyTimer = setTimeout(() => {
            setProcessingId(null);
            sileo.error({ title: 'Timeout', description: 'Factus no respondió a tiempo.' });
        }, 20_000);

        try {
            const creds = await factusService.getCredentials();
            if (!creds?.email || !creds?.client_id) {
                throw new Error('Credenciales Factus no configuradas.');
            }

            // 1. Obtener Rangos
            const rangesResp = await factusService.getRanges();
            const rangesList = Array.isArray(rangesResp?.data) ? rangesResp.data : (Array.isArray(rangesResp?.data?.data) ? rangesResp.data.data : []);

            // Buscar rango de Documento Soporte
            // El document_id en Factus para Documento Soporte Electrónico suele ser '11'
            const sdRange = rangesList.find(r => String(r.document_id) === '11') || rangesList[0];

            if (!sdRange) throw new Error('No se encontró un rango de numeración para Documento Soporte en Factus.');

            // 2. Obtener Proveedor
            let providerInfo = {
                identification: '222222222222',
                company: 'Proveedor Genérico No Obligado',
                names: 'Proveedor Genérico',
                address: 'Colombia',
                email: 'factura@contabilidad.com',
                phone: '3000000000',
                legal_organization_id: 2, // Natural
                tribute_id: 21, // No responsable
                identification_document_id: 3 // CC
            };

            if (doc.third_party_id) {
                const { data: tp } = await supabase.from('third_parties').select('*').eq('id', doc.third_party_id).single();
                if (tp) {
                    providerInfo = {
                        identification: tp.document_number,
                        company: tp.business_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim(),
                        names: tp.business_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim(),
                        address: tp.address || 'Colombia',
                        email: tp.email || 'factura@contabilidad.com',
                        phone: tp.phone || '0000000000',
                        legal_organization_id: tp.document_type === '31' ? 1 : 2,
                        tribute_id: tp.document_type === '31' ? 18 : 21,
                        identification_document_id: tp.document_type === '31' ? 6 : (tp.document_type === '13' ? 3 : 3)
                    };
                }
            }

            // 3. Ítems
            const basePrice = Math.round((doc.totalAmount) * 100) / 100;
            const items = [{
                code_reference: `GASTO-${doc.id.slice(0, 8)}`,
                name: (doc.description || 'Gasto Operativo').slice(0, 250),
                quantity: 1,
                discount_rate: 0,
                price: basePrice > 0 ? basePrice : 1,
                tax_rate: '0.00', // Documentos soporte usualmente no tienen IVA (son a no obligados)
                unit_measure_id: 70, // Unidad
                standard_code_id: 1, // EAN
                is_excluded: 0,
                tribute_id: 21, // No aplica
                withholding_taxes: []
            }];

            // 4. Payload
            const payload = {
                numbering_range_id: Number(sdRange.id),
                reference_code: `DSE-${doc.id.slice(0, 8)}-${Date.now()}`,
                observation: `Documento Soporte - Gasto ${doc.reference || doc.id.slice(0, 8)}`,
                payment_form: '1', // Contado
                payment_method_code: '10', // Efectivo / Default
                customer: providerInfo, // Factus API reuses 'customer' block
                items
            };

            const result = await factusService.createSupportDocument(payload);
            const bill = result?.data?.bill;

            if (!bill?.number) {
                throw new Error('Respuesta de Factus incompleta.');
            }

            // 5. Guardar en DB
            const { error: updateError } = await supabase
                .from('accounting_entries')
                .update({
                    factus_id: bill.id,
                    factus_doc_number: bill.number,
                    factus_status: bill.status
                })
                .eq('id', doc.id);

            if (updateError) throw updateError;

            clearTimeout(safetyTimer);
            sileo.success({ title: 'Documento Emitido', description: `Soporte ${bill.number} registrado ante la DIAN.` });
            fetchDocuments();

        } catch (error) {
            clearTimeout(safetyTimer);
            sileo.error({ title: 'Error Emitiendo', description: error.message || 'Fallo desconocido' });
            console.error(error);
        } finally {
            clearTimeout(safetyTimer);
            setProcessingId(null);
        }
    };

    const handleViewPdf = async (doc) => {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>Cargando PDF de Factus...</h2></body></html>');
        }

        try {
            const blob = await factusService.downloadPdf(doc.factus_doc_number);
            const url = URL.createObjectURL(blob);

            if (newWindow) {
                newWindow.location.href = url;
            } else {
                window.open(url, '_blank');
            }

            sileo.success({ title: 'PDF listo', description: 'Abierto en nueva pestaña.' });
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
            if (newWindow) newWindow.close();
        }
    };

    return (
        <div className="h-full flex flex-col fade-in">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                {['pending', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSubTab(tab)}
                        className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === tab
                            ? 'border-b-4 border-secondary text-secondary'
                            : 'text-gray-400 hover:text-secondary'
                            }`}
                    >
                        {tab === 'pending' ? 'Pendientes de Emitir' : 'Historial'}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-300">
                        <Clock className="animate-spin" size={32} />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-20 text-gray-300">
                        <FileText size={48} className="mx-auto mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">
                            No hay documentos soporte registrados
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map(doc => {
                            const isProcessing = processingId === doc.id;
                            return (
                                <div key={doc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="p-2.5 rounded-xl flex-shrink-0 bg-blue-50 text-blue-600">
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-secondary">Documento Soporte (Ref: {doc.reference || doc.id.slice(0, 8)})</p>
                                            <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                                                {doc.description || 'Gasto Operativo'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-secondary">
                                            ${(doc.totalAmount || 0).toLocaleString('es-CO')}
                                        </p>
                                        <p className="text-[10px] text-gray-400">{new Date(doc.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {subTab === 'history' ? (
                                            <>
                                                <div className="flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle size={14} />
                                                    <span className="text-xs font-black">Emitido</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-mono">{doc.factus_doc_number}</span>
                                                <button
                                                    onClick={() => handleViewPdf(doc)}
                                                    className="flex items-center gap-1 text-[10px] text-blue-500 font-black hover:text-blue-700 underline"
                                                >
                                                    <Download size={10} /> Ver PDF
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleEmitSupportDocument(doc)}
                                                disabled={isProcessing}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-secondary text-white hover:scale-105 transition-all shadow-md ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                {isProcessing ? <Clock size={12} className="animate-spin" /> : <Send size={12} />}
                                                {isProcessing ? 'Emitiendo...' : 'Emitir a DIAN'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportDocuments;
