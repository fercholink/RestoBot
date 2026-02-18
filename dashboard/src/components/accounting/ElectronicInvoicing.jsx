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
                .select('*')
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

            // 3. Prepare Invoice Data (Mapping)
            // Este es un mapeo básico. En producción se requeriría un modal para validar datos del cliente.
            const invoicePayload = {
                numbering_range_id: 8, // HARDCODED TEST ID - Debe venir de getRanges o config
                reference_code: `ORD-${order.id}`,
                observation: `Pedido #${order.id} - ${new Date().toLocaleDateString()}`,
                payment_form: "1", // Contado
                payment_method_code: order.payment_method === 'efectivo' ? "10" : "31", // 10 Efectivo, 31 Transferencia
                customer: {
                    identification: order.tax_data?.identification || "222222222222", // Consumidor Final si no hay datos
                    dv: order.tax_data?.dv || "",
                    company: "",
                    trade_name: "",
                    names: order.tax_data?.names || "Consumidor Final",
                    address: "Dirección General",
                    email: order.tax_data?.email || "consumidor@final.com",
                    phone: order.customer_phone || "3000000000",
                    legal_organization_id: "2", // Persona Natural
                    tribute_id: "21", // No responsable de IVA
                },
                items: [
                    // Aquí deberíamos mapear order.items. Requeriría un select join en el fetch.
                    // Por simplicidad del MVP, enviamos un item genérico por el total si no tenemos los items a mano.
                    // TODO: Mejorar fetchOrders para incluir order_items
                    {
                        code_reference: "GEN-001",
                        name: "Consumo Alimentos y Bebidas",
                        quantity: 1,
                        discount_rate: 0,
                        price: order.total_price || 0,
                        tax_rate: "0.00",
                        unit_measure_id: "70", // Unidad
                        standard_code_id: "1", // Estándar de adopción del contribuyente
                        is_excluded: 0,
                        tribute_id: "1", // IVA
                        withholding_taxes: []
                    }
                ]
            };

            // 4. Send to Factus
            console.log("Enviando Factura:", invoicePayload);
            const result = await factusService.createInvoice(tokenData.access_token, invoicePayload);

            // 5. Update Local Order
            if (result?.data?.bill?.number) { // Revisar estructura exacta de respuesta Factus
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        factus_id: result.data.bill.id, // ID interno Factus
                        factus_doc_number: result.data.bill.number,
                        factus_status: result.data.bill.status, // VALIDATED / DRAFT
                        pdf_url: result.data.bill.qr_image // A veces viene aquí o en resources
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
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="flex items-center gap-1 text-xs font-black text-success uppercase">
                                                    <CheckCircle size={14} /> Emitida
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">{order.factus_doc_number}</span>
                                                {order.pdf_url && (
                                                    <a href={order.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 underline font-bold">Ver QR/PDF</a>
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
