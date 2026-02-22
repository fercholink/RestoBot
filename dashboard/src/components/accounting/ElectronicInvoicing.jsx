import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    FileText, CheckCircle, Clock, AlertCircle, RefreshCw,
    Download, Send, Filter, Building2, UtensilsCrossed, Bike,
    ChevronLeft, Inbox, ArrowRight, Receipt
} from 'lucide-react';
import factusService from '../../services/factusService';
import FactusConfig from './FactusConfig';
import { sileo } from 'sileo';

// -------------------------------------------------------
// Helpers de mapeo según API Factus / DIAN
// -------------------------------------------------------

/**
 * Mapea el tipo de persona al código de Factus/DIAN:
 * legal_organization_id: "1" = Persona Jurídica, "2" = Persona Natural
 *
 * En el modal de pago usamos:
 *   type_person "1" → Natural
 *   type_person "2" → Jurídica
 * (Orden inverso al de Factus)
 */
const mapPersonType = (taxData) => {
    if (!taxData?.type_person) return 2; // Default: 2 = Persona Natural
    // Modal: '1' Natural, '2' Jurídica | Factus: 2 Natural, 1 Jurídica
    return taxData.type_person === '1' ? 2 : 1;
};

const mapTributeId = (legalOrg) => {
    // 18 = Responsable de IVA (Jurídica), 21 = No responsable (Natural)
    return legalOrg === 1 ? 18 : 21;
};

const mapDocType = (taxData, legalOrg) => {
    const raw = taxData?.document_type;
    if (raw == '13') return 3; // DIAN Cédula -> Factus 3
    if (raw == '31') return 6; // DIAN NIT -> Factus 6
    if (raw && /^\d{1,2}$/.test(raw)) return Number(raw);
    return legalOrg === 1 ? 6 : 3; // 6 = NIT, 3 = Cédula
};

const mapPaymentMethod = (method) => {
    const map = { efectivo: '10', transferencia: '31', tarjeta: '31', nequi: '31', daviplata: '31' };
    return map[method?.toLowerCase()] || '10';
};

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

            // Filtrar y excluir cargos a habitación, ya que se facturan en el checkout del huésped
            query = query.or('table_number.not.ilike.HAB-%,table_number.is.null');

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
    // Emitir Factura
    // -------------------------------------------------------
    const handleEmitInvoice = async (order) => {
        setProcessingId(order.id);

        // Timeout de seguridad: el botón nunca quedará bloqueado más de 20s
        const safetyTimer = setTimeout(() => {
            setProcessingId(null);
            sileo.error({ title: 'Timeout', description: 'Factus no respondió. Verifica tu conexión o las credenciales.' });
        }, 20_000);

        try {
            console.log('[Factus] Iniciando emisión para orden:', order.id);

            // 0. Verificar credenciales
            const creds = await factusService.getCredentials();
            if (!creds?.email || !creds?.client_id) {
                throw new Error('Credenciales Factus no configuradas. Ve a Facturación → Configuración.');
            }
            console.log('[Factus] Credenciales OK, entorno:', creds.environment);

            // 1. Obtener rangos de numeración
            console.log('[Factus] Obteniendo rangos...');
            const rangesResp = await factusService.getRanges();
            // Factus puede devolver { data: [...] } o { data: { data: [...] } } (paginado)
            const rangesList = Array.isArray(rangesResp?.data)
                ? rangesResp.data
                : Array.isArray(rangesResp?.data?.data)
                    ? rangesResp.data.data
                    : [];
            console.log('[Factus] Rangos disponibles:', rangesList.length, rangesList);
            if (rangesList.length > 0) console.table(rangesList);
            // Intentar encontrar el rango correcto de "Factura de Venta". Si no, tomar el primero.
            if (!selectedRange) {
                const env = creds.environment === 'production' ? 'Producción (factus.com.co)' : 'Sandbox (api-sandbox.factus.com.co)';
                throw new Error(`No hay rangos de numeración activos en Factus (${env}). Ve a Configuración → Rangos de Numeración en el portal de Factus y crea uno.`);
            }

            // 1.5 Obtener datos del tercero si viene referenciado
            let finalTaxData = order.tax_data;
            if (order.tax_data?.third_party_id) {
                const { data: tp, error: tpError } = await supabase
                    .from('third_parties')
                    .select('*')
                    .eq('id', order.tax_data.third_party_id)
                    .single();

                if (tpError || !tp) {
                    throw new Error('No se pudo cargar la información del tercero para la factura electrónica.');
                }

                // Adapter para mapear ThirdParty a nuestro viejo TaxData para no romper el resto del código
                // En third_parties document_type es texto ('13', '31'), que mapDocType ya maneja.
                finalTaxData = {
                    document_type: tp.document_type || '13',
                    identification: tp.document_number,
                    names: tp.business_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim(),
                    email: tp.email || 'factura@contabilidad.com',
                    phone: tp.phone || '0000000000',
                    dv: tp.verification_digit,
                    type_person: tp.document_type === '31' ? '2' : '1', // '31' (NIT) -> Jurídica, else Natural
                    address: tp.address || 'Colombia',
                };
            }

            // 2. Mapear cliente
            const legalOrg = mapPersonType(finalTaxData);
            const tributeIdClient = mapTributeId(legalOrg);
            const docType = mapDocType(finalTaxData, legalOrg);
            console.log('[Factus] Mapeo cliente → legalOrg:', legalOrg, '| tributeId:', tributeIdClient, '| docType:', docType);

            // 3. Ítems — Ajuste de impuestos (Precios POS ya tienen IVA, Factus lo suma)
            const rawItems = order.order_items?.length > 0
                ? order.order_items
                : [{ product_name: 'Servicio General', quantity: 1, unit_price: order.total || 0 }];

            const items = rawItems.map((item, idx) => {
                const totalPrice = parseFloat(item.unit_price || item.price || 0);
                // Si el precio es total, la base es precio / 1.19
                const basePrice = Math.round((totalPrice / 1.19) * 100) / 100;

                return {
                    code_reference: `ITM-${item.id || idx + 1}`,
                    name: (item.product_name || item.name || 'Servicio').slice(0, 250),
                    quantity: Number(item.quantity) || 1,
                    discount_rate: 0,
                    price: basePrice > 0 ? basePrice : 1,
                    tax_rate: '19.00',
                    unit_measure_id: 70,     // 70 = Unidad (Numérico)
                    standard_code_id: 1,      // 1 = EAN (Numérico)
                    is_excluded: 0,
                    tribute_id: 1,            // 1 = IVA (Numérico)
                    withholding_taxes: []
                };
            });

            // 4. Payload completo
            const invoicePayload = {
                numbering_range_id: Number(selectedRange.id),
                reference_code: `ORD-${order.id}-${Date.now()}`,
                observation: `Pedido #${order.id} - POS RestoBot`,
                payment_form: '1',
                payment_method_code: mapPaymentMethod(order.payment_method),
                customer: {
                    identification: String(finalTaxData?.identification || '222222222222'),
                    dv: (finalTaxData?.dv !== undefined && finalTaxData?.dv !== null && finalTaxData?.dv !== '')
                        ? Number(finalTaxData.dv)
                        : null,
                    company: legalOrg === 1 ? (finalTaxData?.names || 'Empresa') : null,
                    trade_name: legalOrg === 1 ? (finalTaxData?.trade_name || finalTaxData?.names || 'Empresa') : null,
                    names: legalOrg === 2 ? (finalTaxData?.names || order.customer_name || 'Consumidor Final') : null,
                    address: finalTaxData?.address || 'Colombia',
                    email: finalTaxData?.email || 'factura@contabilidad.com',
                    phone: String(order.customer_phone || finalTaxData?.phone || '3000000000'),
                    legal_organization_id: legalOrg,
                    tribute_id: tributeIdClient,
                    identification_document_id: docType
                },
                items
            };

            console.log('[Factus] Payload FINAL (tipos corregidos):', JSON.stringify(invoicePayload, null, 2));

            // 5. Enviar
            const result = await factusService.createInvoice(invoicePayload);
            console.log('[Factus] Respuesta:', result);
            const bill = result?.data?.bill;

            if (!bill?.number) {
                throw new Error('Respuesta incompleta de Factus: ' + JSON.stringify(result));
            }

            // 6. Guardar en Supabase
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    factus_id: bill.id,
                    factus_doc_number: bill.number,
                    factus_status: bill.status,
                    pdf_url: null
                })
                .eq('id', order.id);

            if (updateError) throw updateError;

            clearTimeout(safetyTimer);
            sileo.success({ title: '✓ Factura Emitida', description: `Documento ${bill.number} registrado ante la DIAN.` });
            fetchOrders();

        } catch (error) {
            clearTimeout(safetyTimer);
            const msg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
            sileo.error({ title: 'Error al Emitir Factura', description: msg });
            console.error('[Factus] Error completo:', error);
        } finally {
            clearTimeout(safetyTimer);
            setProcessingId(null);
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
                disabled: true
            },
            {
                id: 'reception',
                title: 'Recepción de documentos',
                description: 'Emite eventos de acuse para facturas a crédito.',
                icon: Inbox,
                disabled: true
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
                                <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                                    {/* Left: Info */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${typeInfo.color}`}>
                                            <TypeIcon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-secondary">Pedido #{order.id}</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                                                    {typeInfo.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                                                {order.tax_data?.names || order.customer_name || 'Sin cliente'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {new Date(order.created_at).toLocaleString('es-CO')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Center: Total */}
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-lg font-black text-secondary">
                                            ${(order.total || order.total_price || 0).toLocaleString('es-CO')}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase">{order.payment_method || '—'}</p>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        {subTab === 'history' ? (
                                            <>
                                                <div className="flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle size={14} />
                                                    <span className="text-xs font-black">Emitida</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-mono">{order.factus_doc_number}</span>
                                                <button
                                                    onClick={() => handleViewPdf(order)}
                                                    className="flex items-center gap-1 text-[10px] text-blue-500 font-black hover:text-blue-700 underline"
                                                >
                                                    <Download size={10} /> Ver PDF
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleEmitInvoice(order)}
                                                disabled={isProcessing}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${isProcessing
                                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                    : 'bg-secondary text-white hover:bg-secondary/90 hover:scale-105 active:scale-95'
                                                    }`}
                                            >
                                                {isProcessing
                                                    ? <><Clock size={12} className="animate-spin" /> Emitiendo...</>
                                                    : <><Send size={12} /> Emitir Factura</>
                                                }
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

export default ElectronicInvoicing;
