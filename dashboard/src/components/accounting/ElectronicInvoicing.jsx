import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    FileText, CheckCircle, Clock, RefreshCw,
    Download, Send, Building2, UtensilsCrossed, Bike,
    ChevronLeft, Inbox, ArrowRight, Receipt, XCircle
} from 'lucide-react';
import factusService from '../../services/factusService';
import { emitInvoiceForOrder, mapItemsForFactus, mapDocType } from '../../services/invoiceHelper';
import FactusConfig from './FactusConfig';
import SupportDocuments from './SupportDocuments';
import ReceptionDocuments from './ReceptionDocuments';
import { sileo } from 'sileo';

const ORDER_TYPE_LABEL = {
    mesa: { label: 'Mesa', icon: UtensilsCrossed, color: 'text-blue-600 bg-blue-50' },
    domicilio: { label: 'Domicilio', icon: Bike, color: 'text-orange-500 bg-orange-50' },
    habitacion: { label: 'Hotel', icon: Building2, color: 'text-purple-600 bg-purple-50' },
};

// -------------------------------------------------------
// Componente Principal
// -------------------------------------------------------

const ElectronicInvoicing = () => {
    const [view, setView] = useState('menu'); // menu | electronic | support | reception
    const [subTab, setSubTab] = useState('pending'); // pending | history | config
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [envBadge, setEnvBadge] = useState(null);

    useEffect(() => {
        if (view === 'electronic' && subTab !== 'config') fetchOrders();
        if (view !== 'menu') loadEnvBadge();
    }, [subTab, view]);

    const loadEnvBadge = async () => {
        try {
            const creds = await factusService.getCredentials();
            setEnvBadge(creds?.environment || null);
        } catch { /* ignore */ }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('orders')
                .select('*, order_items(*)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (subTab === 'pending') {
                query = query.or('is_paid.eq.true,status.eq.pagado').is('factus_doc_number', null);
            } else if (subTab === 'history') {
                query = query.not('factus_doc_number', 'is', null);
            }

            // Filtrar y excluir cargos a habitación DEL RESTAURANTE (los checkout de hotel SÍ deben verse)
            query = query.or('table_number.not.ilike.HAB-%,table_number.is.null,notes.ilike.Checkout%');

            const { data, error } = await query;
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------
    // Emitir Factura — delega toda la lógica a invoiceHelper
    // -------------------------------------------------------
    const handleEmitInvoice = async (order) => {
        setProcessingId(order.id);
        let loadingToast = null;
        try {
            sileo.info({ title: 'Emitiendo factura...', description: `Procesando pedido #${order.id} en Factus...` });

            const result = await emitInvoiceForOrder(order);

            if (result.success) {
                if (result.warning) {
                    sileo.warning({ title: `Factura ${result.bill.number} emitida`, description: result.warning });
                } else {
                    sileo.success({ title: '✓ Factura Emitida', description: `Documento ${result.bill.number} registrado ante la DIAN.` });
                }
                fetchOrders();
            } else {
                sileo.error({ title: 'Error al Emitir Factura', description: result.error });
                window.alert(`Error de Validación Factus:\n${result.error}`);
            }
        } catch (error) {
            console.error('Unexpected error in handleEmitInvoice:', error);
            const errorMsg = error.message || 'Ocurrió un error al procesar la factura.';
            sileo.error({ title: 'Error Inesperado', description: errorMsg });
            // Mostrar alert para que el usuario vea el detalle completo si el toast lo corta
            window.alert(`Detalle del Error:\n${errorMsg}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleCreateCreditNote = async (order) => {
        if (!window.confirm(`¿Estás seguro de emitir una Nota de Crédito para la factura ${order.factus_doc_number}? Esta acción anulará la factura ante la DIAN.`)) return;

        sileo.info({ title: 'Anulando...', description: 'Generando Nota Crédito en Factus...' });
        setProcessingId(order.id);

        try {
            // 1. Obtener rangos para Notas Crédito
            const rangesResp = await factusService.getRanges();
            const rangesList = Array.isArray(rangesResp?.data) ? rangesResp.data : (Array.isArray(rangesResp?.data?.data) ? rangesResp.data.data : []);
            
            // Buscar rango de Nota de Crédito
            const selectedRange = rangesList.find(r => r.document === '91' || r.document?.id === '91' || r.document_type === '91' || r.document === '04') || rangesList[0];
            
            if (!selectedRange) throw new Error('No se encontró un rango de numeración para Notas de Crédito.');

            // 2. Construir payload (Anulación total)
            const legalOrg = order.tax_data?.document_type === 'NIT' ? 1 : 2;
            const docTypeMapped = mapDocType(order.tax_data, legalOrg);

            const payload = {
                numbering_range_id: Number(selectedRange.id || selectedRange.numbering_range_id),
                reference_code: `NC-${order.id}-${Date.now()}`,
                observation: `Anulación total de factura ${order.factus_doc_number} - Pedido #${order.id}`,
                payment_form: "1",
                payment_method_code: "10",
                billing_reference: {
                    number: order.factus_doc_number,
                    uuid: order.factus_id, // Factus a veces pide el UUID/ID interno
                    issue_date: order.created_at.split('T')[0]
                },
                customer: {
                    identification: order.tax_data?.identification || '222222222222',
                    dv: order.tax_data?.dv ? Number(order.tax_data.dv) : undefined,
                    company: order.tax_data?.names || order.customer_name || 'Consumidor Final',
                    trade_name: order.tax_data?.names || order.customer_name || 'Consumidor Final',
                    names: order.tax_data?.names || order.customer_name || 'Consumidor Final',
                    address: order.tax_data?.address || 'Colombia',
                    email: order.tax_data?.email || 'factura@contabilidad.com',
                    phone: order.tax_data?.phone || '3000000000',
                    legal_organization_id: legalOrg,
                    tribute_id: legalOrg === 1 ? 18 : 21,
                    identification_document_id: docTypeMapped,
                    municipality_id: '68001'
                },
                items: mapItemsForFactus(order.order_items || [])
            };

            // 3. Llamada real
            const result = await factusService.createCreditNote(payload);
            const bill = result?.data?.bill || result?.bill;

            if (!bill?.number) throw new Error('La nota crédito se emitió pero no se recibió un número de confirmación.');

            // 4. Actualizar estado en BD
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    factus_status: 'anulado',
                    notes: (order.notes || '') + ` | Nota Crédito: ${bill.number}`
                })
                .eq('id', order.id);

            if (updateError) console.error('Error actualizando estado en BD:', updateError.message);

            sileo.success({ title: 'Nota Crédito Emitida', description: `La factura ${order.factus_doc_number} fue anulada con el documento ${bill.number}.` });
            fetchOrders();
        } catch (error) {
            console.error('Error generando nota crédito:', error);
            sileo.error({ title: 'Error Factus', description: error.message || 'No se pudo generar la nota crédito.' });
        } finally {
            setProcessingId(null);
            loadingToast.close();
        }
    };

    // -------------------------------------------------------
    // Descargar / Ver PDF (siempre autenticado)
    // -------------------------------------------------------
    const handleViewPdf = async (order) => {
        // Abrir ventana antes del await para evitar popup blocker
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>Cargando PDF de Factus...</h2></body></html>');
        }

        try {
            const blob = await factusService.downloadPdf(order.factus_doc_number);
            const url = URL.createObjectURL(blob);

            if (newWindow) {
                newWindow.location.href = url;
            } else {
                window.open(url, '_blank');
            }

            sileo.success({ title: 'PDF listo', description: 'Abierto en nueva pestaña.' });
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (error) {
            sileo.error({ title: 'Error descargando PDF', description: error.message });
            if (newWindow) newWindow.close();
        }
    };

    // -------------------------------------------------------
    // Render
    // -------------------------------------------------------

    if (view === 'menu') {
        const menuOptions = [
            {
                id: 'electronic',
                title: 'Factura electrónica y notas crédito',
                description: 'Genera facturas electrónicas de venta cumpliendo con todos los requisitos de la DIAN.',
                icon: FileText,
                disabled: false
            },
            {
                id: 'support',
                title: 'Documentos soporte y notas de ajuste',
                description: 'Emite documentos soporte y notas de ajuste de forma automática y segura.',
                icon: Receipt,
                disabled: false
            },
            {
                id: 'reception',
                title: 'Recepción de documentos',
                description: 'Emite eventos de acuse para facturas a crédito.',
                icon: Inbox,
                disabled: false
            }
        ];

        return (
            <div className="h-full flex flex-col items-center justify-center p-8 fade-in">
                <div className="max-w-4xl w-full text-center mb-12">
                    <h2 className="text-3xl font-black text-secondary mb-4 tracking-tight">Integra nuestra API a tu solución de software</h2>
                    <p className="text-gray-500 font-medium">Si tienes un sistema interno, SaaS, ERP, PMS, TMS, CMS, POS, etc.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
                    {menuOptions.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => !opt.disabled && setView(opt.id)}
                            className={`bg-white p-8 rounded-3xl border ${opt.disabled ? 'border-gray-100 opacity-60' : 'border-gray-100 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-1'} transition-all text-left flex flex-col h-full group`}
                        >
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-6 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <opt.icon size={20} />
                            </div>
                            <h3 className="text-lg font-black text-secondary mb-3 leading-tight">{opt.title}</h3>
                            <p className="text-sm font-medium text-gray-500 flex-1">{opt.description}</p>

                            {!opt.disabled ? (
                                <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ingresar <ArrowRight size={12} />
                                </div>
                            ) : (
                                <div className="mt-6">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-3 py-1 rounded-full">Próximamente</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (view === 'support') {
        return (
            <div className="h-full flex flex-col fade-in">
                {/* Nav / Atrás */}
                <div className="mb-4">
                    <button
                        onClick={() => setView('menu')}
                        className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-secondary uppercase tracking-widest transition-colors w-fit"
                    >
                        <ChevronLeft size={16} /> Volver al menú
                    </button>
                </div>
                <div className="flex-1 overflow-y-hidden">
                    <SupportDocuments />
                </div>
            </div>
        );
    }

    if (view === 'reception') {
        return (
            <div className="h-full flex flex-col fade-in">
                {/* Nav / Atrás */}
                <div className="mb-4">
                    <button
                        onClick={() => setView('menu')}
                        className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-secondary uppercase tracking-widest transition-colors w-fit"
                    >
                        <ChevronLeft size={16} /> Volver al menú
                    </button>
                </div>
                <div className="flex-1 overflow-y-hidden rounded-3xl pb-2">
                    <ReceptionDocuments />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col fade-in">
            {/* Nav / Atrás */}
            <div className="mb-4">
                <button
                    onClick={() => setView('menu')}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-secondary uppercase tracking-widest transition-colors w-fit"
                >
                    <ChevronLeft size={16} /> Volver al menú
                </button>
            </div>

            {/* Tabs + Entorno Badge */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                {['pending', 'history', 'config'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSubTab(tab)}
                        className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === tab
                            ? 'border-b-4 border-secondary text-secondary'
                            : 'text-gray-400 hover:text-secondary'
                            }`}
                    >
                        {tab === 'pending' ? 'Pendientes' : tab === 'history' ? 'Historial' : 'Configuración'}
                    </button>
                ))}

                {/* Entorno Badge */}
                {envBadge && subTab !== 'config' && (
                    <span className={`ml-auto text-[10px] font-black uppercase px-3 py-1 rounded-full ${envBadge === 'sandbox'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {envBadge === 'sandbox' ? '🧪 Sandbox' : '🚀 Producción'}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {subTab === 'config' ? (
                    <FactusConfig />
                ) : loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-gray-300">
                        <FileText size={48} className="mx-auto mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">
                            {subTab === 'pending' ? 'No hay pedidos pendientes de facturar' : 'No hay facturas emitidas'}
                        </p>
                        {subTab === 'pending' && (
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                Solo aparecen pedidos marcados como pagados sin factura emitida.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => {
                            // Detectar tipo de orden aunque no tenga el campo 'type'
                            const detectedType = order.type ||
                                (order.table_number?.startsWith('HAB-') ? 'habitacion' : 'mesa');
                            const typeInfo = ORDER_TYPE_LABEL[detectedType] || ORDER_TYPE_LABEL.mesa;
                            const TypeIcon = typeInfo.icon;
                            const isProcessing = processingId === order.id;

                            return (
                                <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-gray-200 transition-all">
                                    {/* Left: Info */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`p-3 rounded-2xl flex-shrink-0 ${typeInfo.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                            <TypeIcon size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-black text-secondary">Pedido #{order.id}</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${typeInfo.color} border border-current opacity-70`}>
                                                    {typeInfo.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 font-bold truncate mt-1">
                                                {order.tax_data?.names || order.customer_name || 'Consumidor Final'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(order.created_at).toLocaleString('es-CO', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                                <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-tight">{order.payment_method || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Group */}
                                    <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-50 mt-1 sm:mt-0">
                                        {/* Total */}
                                        <div className="sm:text-right flex-shrink-0">
                                            <p className="text-xl font-black text-secondary leading-none">
                                                ${(order.total || order.total_price || 0).toLocaleString('es-CO')}
                                            </p>
                                            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Total Cobrado</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            {subTab === 'history' ? (
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                                                        <CheckCircle size={14} />
                                                        <span className="text-[11px] font-black uppercase tracking-tight">Factura Emitida</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => handleViewPdf(order)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors"
                                                        >
                                                            <Download size={12} /> Ver PDF
                                                        </button>
                                                        <button
                                                            onClick={() => handleCreateCreditNote(order)}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                        >
                                                            <XCircle size={12} /> {isProcessing ? '...' : 'Anular'}
                                                        </button>
                                                    </div>
                                                    <span className="text-[9px] text-gray-300 font-mono mt-2 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{order.factus_doc_number}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEmitInvoice(order)}
                                                    disabled={isProcessing}
                                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md group ${isProcessing
                                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                        : 'bg-secondary text-white hover:bg-secondary/95 hover:shadow-lg active:scale-95'
                                                        }`}
                                                >
                                                    {isProcessing
                                                        ? <><Clock size={14} className="animate-spin text-gray-400" /> Procesando</>
                                                        : <><Send size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Emitir Factura</>
                                                    }
                                                </button>
                                            )}
                                        </div>
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

export default ElectronicInvoicing;
