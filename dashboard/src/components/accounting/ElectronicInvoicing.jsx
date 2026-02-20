import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Search, Filter, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import factusService from '../../services/factusService';
import FactusConfig from './FactusConfig';
import { sileo } from 'sileo';

const ElectronicInvoicing = () => {
    const [subTab, setSubTab] = useState('pending'); // pending, history, config
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, [subTab]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('orders')
                .select('*, order_items(*)')
                .order('created_at', { ascending: false });

            if (subTab === 'pending') {
                // Pedidos pagados pero SIN factura emitida (o fallida)
                query = query.eq('status', 'pagado')
                    .is('factus_doc_number', null);
            } else if (subTab === 'history') {
                // Pedidos con factura emitida
                query = query.not('factus_doc_number', 'is', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEmitInvoice = async (order) => {
        setProcessingId(order.id);

        try {
            // 1. Get Credentials
            const credentials = await factusService.getCredentials();
            if (!credentials) {
                sileo.error({ title: "Sin Credenciales", description: "Configure la API de Factus primero." });
                setSubTab('config');
                return;
            }

            // 2. Login
            const tokenData = await factusService.login(credentials);
            if (!tokenData?.access_token) throw new Error("No se pudo obtener token de acceso");

            // 2.1 Get Numbering Ranges (Dynamic)
            const ranges = await factusService.getRanges(tokenData.access_token);
            const selectedRange = ranges?.data?.[0]; // Pick first available range
            if (!selectedRange) throw new Error("No se encontraron rangos de numeración activos en Factus.");

            // 3. Prepare Invoice Data (Mapping)

            // Map Customer Data
            // Modal: 1=Natural, 2=Juridica
            // Factus/DIAN: 2=Natural, 1=Juridica
            const personType = order.tax_data?.type_person === '2' ? '1' : '2';
            const docType = order.tax_data?.document_type || '13'; // 13=Cedula, 31=NIT

            const items = order.order_items?.length > 0 ? order.order_items.map(item => ({
                code_reference: `ITM-${item.id || 'GEN'}`,
                name: item.product_name || 'Producto General',
                quantity: item.quantity || 1,
                discount_rate: 0,
                price: parseFloat(item.price || item.unit_price || 0),
                tax_rate: "19.00", // Default tax. Consider 0 for exemptions in future.
                unit_measure_id: "70", // Unidad
                standard_code_id: "1",
                is_excluded: 0,
                tribute_id: "1", // IVA
                withholding_taxes: []
            })) : [{
                code_reference: "GEN-001",
                name: "Servicio de Alojamiento / Consumo",
                quantity: 1,
                discount_rate: 0,
                price: order.total_price || 0,
                tax_rate: "19.00",
                unit_measure_id: "70",
                standard_code_id: "1",
                is_excluded: 0,
                tribute_id: "1",
                withholding_taxes: []
            }];

            const invoicePayload = {
                numbering_range_id: selectedRange.id,
                reference_code: `ORD-${order.id}`,
                observation: `Pedido #${order.id} - ${new Date().toLocaleDateString()}`,
                payment_form: "1", // Contado
                payment_method_code: order.payment_method === 'efectivo' ? "10" : "31",
                customer: {
                    identification: order.tax_data?.identification || "222222222222",
                    dv: order.tax_data?.dv || "",
                    company: personType === '1' ? (order.tax_data?.names || "") : "",
                    trade_name: personType === '1' ? (order.tax_data?.names || "") : "",
                    names: personType === '2' ? (order.tax_data?.names || "Consumidor Final") : "",
                    address: order.tax_data?.address || "Dirección General",
                    email: order.tax_data?.email || "consumidor@final.com",
                    phone: order.customer_phone || "3000000000",
                    legal_organization_id: personType,
                    tribute_id: "21",
                    identification_document_id: docType
                },
                items: items
            };

            // 4. Send to Factus
            console.log("Enviando Factura:", invoicePayload);
            const result = await factusService.createInvoice(tokenData.access_token, invoicePayload);

            // 5. Update Local Order
            if (result?.data?.bill?.number) {
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        factus_id: result.data.bill.id,
                        factus_doc_number: result.data.bill.number,
                        factus_status: result.data.bill.status,
                        pdf_url: result.data.bill.graphic_representation_url || result.data.bill.public_url || result.data.bill.qr || result.data.bill.qr_image
                    })
                    .eq('id', order.id);

                if (updateError) throw updateError;

                sileo.success({ title: "Factura Emitida", description: `Documento ${result.data.bill.number} generado.` });
                fetchOrders(); // Refresh list
            } else {
                throw new Error("Respuesta incompleta de Factus: " + JSON.stringify(result));
            }

        } catch (error) {
            console.error('Emission Error:', error);
            sileo.error({ title: "Error de Emisión", description: error.message });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-100 pb-2">
                <button
                    onClick={() => setSubTab('pending')}
                    className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === 'pending' ? 'border-b-4 border-secondary text-secondary' : 'text-gray-400 hover:text-secondary'
                        }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setSubTab('history')}
                    className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === 'history' ? 'border-b-4 border-secondary text-secondary' : 'text-gray-400 hover:text-secondary'
                        }`}
                >
                    Historial
                </button>
                <button
                    onClick={() => setSubTab('config')}
                    className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ml-auto ${subTab === 'config' ? 'border-b-4 border-secondary text-secondary' : 'text-gray-400 hover:text-secondary'
                        }`}
                >
                    Configuración
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {subTab === 'config' ? (
                    <FactusConfig />
                ) : (
                    <div className="space-y-4">
                        {orders.length === 0 ? (
                            <div className="text-center py-20 text-gray-300">
                                <FileText size={48} className="mx-auto mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">No hay registros</p>
                            </div>
                        ) : (
                            orders.map(order => (
                                <div key={order.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-lg font-black text-secondary">Pedido #{order.id}</span>
                                            {order.type === 'mesa' ?
                                                <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded text-[10px] uppercase font-black">Mesa {order.table_id}</span>
                                                :
                                                <span className="bg-orange-50 text-orange-500 px-2 py-0.5 rounded text-[10px] uppercase font-black">Domicilio</span>
                                            }
                                        </div>
                                        <p className="text-xs text-secondary font-medium">Cliente: {order.tax_data?.names || order.customer_name || 'Desconocido'}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(order.created_at).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="text-xl font-black text-secondary">${order.total_price?.toLocaleString()}</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{order.payment_method}</p>
                                        </div>

                                        {subTab === 'history' ? (
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const toastId = sileo.loading("Actualizando factura...");
                                                            try {
                                                                const credentials = await factusService.getCredentials();
                                                                const tokenData = await factusService.login(credentials);
                                                                console.log("REFRESH: Consultando Factus ID:", order.factus_doc_number);
                                                                const invoiceData = await factusService.getInvoice(tokenData.access_token, order.factus_doc_number);
                                                                console.log("REFRESH: Respuesta Factus:", invoiceData);

                                                                const bill = invoiceData.data?.bill || invoiceData.data;
                                                                if (!bill) throw new Error("Estructura de respuesta inválida: " + JSON.stringify(invoiceData));

                                                                let publicUrl = null;
                                                                if (bill.graphic_representation_url && !bill.graphic_representation_url.startsWith("data:")) publicUrl = bill.graphic_representation_url;
                                                                else if (bill.public_url && !bill.public_url.startsWith("data:")) publicUrl = bill.public_url;

                                                                // Manual Fallback
                                                                if (!publicUrl && order.factus_doc_number) {
                                                                    publicUrl = `https://api-sandbox.factus.com.co/v1/bills/download-pdf/${order.factus_doc_number}`;
                                                                }

                                                                console.log("REFRESH: URL Final:", publicUrl);

                                                                if (publicUrl) {
                                                                    await supabase.from('orders').update({ pdf_url: publicUrl }).eq('id', order.id);

                                                                    sileo.dismiss(toastId);
                                                                    sileo.success("Documento actualizado. Haz clic en 'Ver PDF'.");
                                                                    fetchOrders();
                                                                } else {
                                                                    throw new Error("No se pudo generar una URL válida");
                                                                }
                                                            } catch (err) {
                                                                console.error("Refresh Error:", err);
                                                                sileo.dismiss(toastId);
                                                                sileo.error({ title: "Error", description: err.message });
                                                            }
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Refrescar Factura"
                                                    >
                                                        <Clock size={14} />
                                                    </button>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="flex items-center gap-1 text-xs font-black text-success uppercase">
                                                            <CheckCircle size={14} /> Emitida
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-mono">{order.factus_doc_number}</span>
                                                    </div>
                                                </div>

                                                {(order.factus_doc_number || order.pdf_url) && (
                                                    <div className="flex flex-col items-end">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                // e.preventDefault(); // Don't prevent default on button unless it's form submit, but let's be safe.

                                                                const toastId = sileo.loading("Preparando descarga...");
                                                                // Open window immediately to avoid popup blockers
                                                                const newWindow = window.open('', '_blank');
                                                                if (newWindow) {
                                                                    newWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;"><h2>Cargando PDF...</h2><p>Por favor espere mientras contactamos a Factus.</p></body></html>');
                                                                }

                                                                try {
                                                                    // Check if it's a direct public URL first (and not base64)
                                                                    if (order.pdf_url && order.pdf_url.startsWith('http') && !order.pdf_url.includes('download-pdf')) {
                                                                        if (newWindow) newWindow.location.href = order.pdf_url;
                                                                        else window.open(order.pdf_url, '_blank');
                                                                        sileo.dismiss(toastId);
                                                                        return;
                                                                    }

                                                                    // Authenticated Download
                                                                    sileo.dismiss(toastId);
                                                                    sileo.loading("Autenticando...", { id: toastId });

                                                                    const credentials = await factusService.getCredentials();
                                                                    const tokenData = await factusService.login(credentials);

                                                                    sileo.loading("Descargando archivo...", { id: toastId });
                                                                    const blob = await factusService.downloadPdf(tokenData.access_token, order.factus_doc_number);

                                                                    const url = window.URL.createObjectURL(blob);

                                                                    if (newWindow) {
                                                                        newWindow.location.href = url;
                                                                    } else {
                                                                        window.open(url, '_blank');
                                                                    }

                                                                    sileo.dismiss(toastId);
                                                                    sileo.success("PDF generado exitosamente");

                                                                    // Clean up after small delay
                                                                    setTimeout(() => window.URL.revokeObjectURL(url), 60000);

                                                                } catch (err) {
                                                                    console.error("PDF Download Error:", err);
                                                                    sileo.dismiss(toastId);
                                                                    sileo.error({ title: "Fallo la descarga", description: err.toString() }); // Show exact error
                                                                    if (newWindow) newWindow.close();
                                                                }
                                                            }}
                                                            className="text-[10px] text-blue-500 underline font-bold hover:text-blue-700"
                                                        >
                                                            Ver PDF
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleEmitInvoice(order)}
                                                disabled={processingId === order.id}
                                                className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${processingId === order.id
                                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                    : 'bg-secondary text-white hover:bg-secondary/90 hover:scale-105 active:scale-95'
                                                    }`}
                                            >
                                                {processingId === order.id ? 'Emitiendo...' : 'Emitir Factura'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ElectronicInvoicing;
