import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TicketPrinter = ({ order, type = 'comanda', branchName = 'BS COMUNICACIONES TEST SAS' }) => {
    const hasPrinted = useRef(false);

    useEffect(() => {
        if (!hasPrinted.current) {
            hasPrinted.current = true;
            window.print();
        }
    }, []);

    if (!order) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString('es-CO', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) {
            return 'Fecha inválida';
        }
    };

    const getIDLabel = (type) => {
        const labels = { '13': 'CC', '31': 'NIT', '22': 'CE', '42': 'PAS' };
        return labels[type] || 'ID';
    };

    // Cálculos Tributarios DIAN (8% ICO es común en restaurantes de Colombia)
    const total = order.total_price || 0;
    const ico_rate = 0.08;
    const subtotal = Math.round(total / (1 + ico_rate));
    const ico_val = total - subtotal;

    return createPortal(
        <>
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    /* Ocultar toda la aplicación principal */
                    #main-app-container, .no-print { display: none !important; }
                    
                    /* Asegurar que el ticket sea visible y ocupe el flujo */
                    #thermal-ticket {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 10px !important;
                        background: white !important;
                        z-index: 9999 !important;
                        visibility: visible !important;
                    }
                }
            `}</style>
            <div id="thermal-ticket" className="bg-white text-black p-4 font-mono text-[10px] w-[75mm] leading-tight select-none fixed top-0 left-[-9999px] print:static print:block print:w-full">


                {/* Cabezote Legal */}
                <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                    <h2 className="text-sm font-black uppercase">{branchName}</h2>
                    <p className="text-[8px] font-bold">NIT: 900.876.543-1 - RESPONSABLE DE IVA</p>
                    <p className="text-[8px]">Dirección: Calle Falsa 123 - Montería, Córdoba</p>
                    <p className="text-[8px]">TEL: +57 321 000 0000</p>

                    {(type === 'recibo' || type === 'factura_hotel') && (
                        <div className="mt-2 pt-1 border-t border-dotted border-black px-2">
                            <p className="text-[7px] leading-tight">
                                RESOLUCIÓN DIAN No. 187640000001 <br />
                                FECHA: 2024/01/01 DESDE: 1 HASTA: 5000 <br />
                                PREFIJO: RB - DOCUMENTO EQUIVALENTE POS
                            </p>
                        </div>
                    )}
                </div>

                {/* Información del Pedido */}
                <div className="space-y-1 mb-2">
                    <p className="font-black uppercase text-[10px] text-center mb-2">
                        {type === 'comanda' ? '*** COMANDA DE COCINA ***' : (type === 'factura_hotel' ? 'FACTURA ELECTRÓNICA DE VENTA' : 'RECIBO DE CAJA')}
                    </p>

                    <div className="grid grid-cols-2 gap-x-4">
                        <div className="flex justify-between"><span>No:</span> <span className="font-bold">{order.prefix || 'RB'}-{order.id}</span></div>
                        <div className="flex justify-between"><span>FECHA:</span> <span>{new Date(order.created_at).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span>HORA:</span> <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className="flex justify-between"><span>TIPO:</span> <span className="uppercase font-bold">{order.table_id ? `Mesa: ${order.table_id}` : 'Domicilio'}</span></div>
                    </div>

                    {/* Datos de Entrega (Domicilio) */}
                    {/* Datos de Entrega (Domicilio) - BLOQUE CONSOLIDADO */}
                    {(order.type === 'domicilio' || order.table_number === 'DOMICILIO') && (
                        <div className="border-t border-dashed border-black mt-2 pt-2 pb-2">
                            <p className="font-black text-center mb-1 text-[10px]">=== DATOS DE ENTREGA ===</p>

                            <div className="flex flex-col text-[9px] gap-1">
                                {/* 1. Contacto del Cliente Principal */}
                                <div className="border-b border-dotted border-black/30 pb-1 mb-0.5">
                                    <div className="flex justify-between">
                                        <span>CLIENTE:</span>
                                        <span className="font-black uppercase">{order.customer_name || 'SIN NOMBRE'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>TELÉFONO:</span>
                                        <span className="font-black text-[10px]">
                                            {order.customer_phone || (order.notes?.match(/Tel:\s*(.*)/)?.[1]) || 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                {/* 2. Detalles de Dirección */}
                                {order.delivery_info || order.delivery ? (
                                    <>
                                        {(() => {
                                            const details = order.delivery_info || order.delivery;
                                            return (
                                                <div className="space-y-0.5">
                                                    <span className="block font-black text-[11px] leading-tight break-words border-l-2 border-black pl-1 my-1">
                                                        {details.address}
                                                    </span>

                                                    <div className="flex justify-between font-bold">
                                                        <span>{details.neighborhood || 'SIN BARRIO'}</span>
                                                        <span className="uppercase">{details.city || 'MONTERÍA'}</span>
                                                    </div>

                                                    {(details.housingType === 'apto' || details.complex || details.unit) && (
                                                        <div className="flex gap-2 text-[8px] italic">
                                                            {details.complex && <span>Urb: {details.complex}</span>}
                                                            {details.unit && <span className="font-bold not-italic">Int/Apto: {details.unit}</span>}
                                                        </div>
                                                    )}

                                                    {details.notes && (
                                                        <div className="mt-1 bg-black/5 p-1 rounded-sm border border-black/10">
                                                            <span className="font-black">NOTA:</span> <span className="italic">{details.notes}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    // Fallback para pedidos antiguos sin estructura
                                    <div className="space-y-0.5">
                                        <span className="font-black text-[10px] break-words leading-tight">{order.delivery_address || 'Dirección no especificada'}</span>
                                        {order.notes && !order.notes.startsWith('Tel:') && (
                                            <div className="mt-1 border-t border-dotted border-black pt-0.5">
                                                <span className="italic font-bold">Nota: {order.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Datos del Cliente */}
                    <div className="border-t border-dotted border-black mt-1 pt-1">
                        <div className="flex flex-col">
                            <div className="flex justify-between">
                                <span>CLIENTE:</span>
                                <span className="font-bold truncate max-w-[150px] uppercase">
                                    {order.tax_data?.names || order.customer_name || 'CONSUMIDOR FINAL'}
                                </span>
                            </div>

                            {/* Dirección del Cliente (Si no es domicilio o para redundancia) */}
                            {order.customer_address && order.type !== 'domicilio' && (
                                <div className="flex justify-between">
                                    <span>DIR:</span>
                                    <span className="truncate max-w-[150px] uppercase">{order.customer_address}</span>
                                </div>
                            )}

                            {/* Teléfono */}
                            {(order.tax_data?.phone || order.customer_phone || (order.notes && order.notes.includes('Tel:'))) && (
                                <div className="flex justify-between">
                                    <span>TEL:</span>
                                    <span className="font-bold">
                                        {order.tax_data?.phone || order.customer_phone || (order.notes?.match(/Tel:\s*(.*)/)?.[1] || 'N/A')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {(order.tax_data?.identification) && (
                            <div className="flex justify-between">
                                <span>{getIDLabel(order.tax_data?.document_type)}:</span>
                                <span className="font-bold">{order.tax_data?.identification}</span>
                            </div>
                        )}
                        {order.tax_data?.email && (
                            <div className="flex justify-between">
                                <span>EMAIL:</span>
                                <span className="truncate max-w-[150px]">{order.tax_data.email}</span>
                            </div>
                        )}

                        {/* Notas Generales */}
                        {order.notes && !order.notes.startsWith('Tel:') && (
                            <div className="mt-1 border-t border-dotted border-black/50 pt-0.5">
                                <span className="italic font-bold">Nota: {order.notes}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detalle de Productos */}
                {/* Detalle de Productos (Solo para Comandas, Recibos y Facturas Hotel) */}
                {order.items && (
                    <table className="w-full border-t border-b border-black mb-2 py-1">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="text-left py-1 text-[8px]">CANT</th>
                                <th className="text-left py-1 text-[8px]">DESCRIPCIÓN</th>
                                {(type === 'recibo' || type === 'factura_hotel') && <th className="text-right py-1 text-[8px]">TOTAL</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {order.items.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <tr>
                                        <td className="py-1 align-top">{item.quantity}</td>
                                        <td className="py-1">
                                            <span className="font-bold uppercase text-[9px]">{item.product_name}</span>
                                            {/* Mostrar Personalizaciones */}
                                            {item.customizations && (
                                                <div className="text-[7px] leading-tight text-gray-600 pl-1 mt-0.5">
                                                    {item.customizations.excluded_ingredients?.map((ing, i) => (
                                                        <div key={`ex-${i}`}>- Sin {ing}</div>
                                                    ))}
                                                    {item.customizations.added_extras?.map((extra, i) => (
                                                        <div key={`add-${i}`}>+ {extra.name}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        {(type === 'recibo' || type === 'factura_hotel') && (
                                            <td className="py-1 text-right text-[9px]">
                                                ${(item.unit_price * item.quantity).toLocaleString()}
                                            </td>
                                        )}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Totales y Desglose de Impuestos */}
                {(type === 'recibo' || type === 'factura_hotel') && (
                    <div className="space-y-1 text-[10px] mb-4">
                        <div className="flex justify-between pt-1">
                            <span>SUBTOTAL:</span>
                            <span>${subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>IMPOCONSUMO (8%):</span>
                            <span>${ico_val.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>IVA (0%):</span>
                            <span>$0</span>
                        </div>
                        <div className="flex justify-between font-black text-[12px] border-t border-black pt-1 mt-1">
                            <span>TOTAL A PAGAR:</span>
                            <span>${total.toLocaleString()}</span>
                        </div>

                        {order.payment_method && (
                            <div className="flex justify-between uppercase text-[8px] pt-1">
                                <span>FORMA DE PAGO:</span>
                                <span>{order.payment_method}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Template: Factura Hotel / Recibo */}
                {(type === 'recibo' || type === 'factura_hotel') && (
                    <div className="text-center space-y-3 mt-4">
                        {/* Placeholder de QR Code */}
                        <div className="flex justify-center">
                            <div className="w-20 h-20 border-2 border-black flex items-center justify-center p-1 bg-gray-50">
                                <div className="grid grid-cols-4 grid-rows-4 gap-0.5 w-full h-full opacity-30">
                                    {[...Array(16)].map((_, i) => (
                                        <div key={i} className={Math.random() > 0.5 ? 'bg-black' : ''} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-[6px] break-all leading-tight px-4 border border-black/10 py-1">
                            <p className="font-bold">CUFE: </p>
                            <p className="opacity-70">{order.cufe || '8e4f2a5b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4 (SIMULADO)'}</p>
                        </div>

                        <div className="text-[7px] space-y-1">
                            <p className="font-black">¡GRACIAS POR SU VISITA!</p>
                            <p className="font-bold opacity-30">Software: RestoBot v2.0 - BS COMUNICACIONES</p>
                            <p className="opacity-30 italic"> Montería - Colombia </p>
                        </div>
                    </div>
                )}

                {type === 'comanda' && (
                    <div className="text-center text-[8px] font-black border-t border-black pt-2 mt-4">
                        REVISAR PEDIDO ANTES DE SERVIR
                    </div>
                )}

                {/* Template: Cierre de Caja */}
                {type === 'cierre_caja' && (
                    <div className="space-y-2">
                        <div className="text-center border-b border-black pb-2 mb-2">
                            <h2 className="text-xs font-black uppercase">REPORTE DE TURNO</h2>
                            <p className="text-[8px] font-bold">CAJA #1 - GENERAL</p>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[9px]">
                            <span>CAJERO:</span> <span className="font-bold text-right truncate">{order.cashier}</span>
                            <span>APERTURA:</span> <span className="text-right">{formatDate(order.start_time)}</span>
                            <span>CIERRE:</span> <span className="text-right">{order.end_time ? formatDate(order.end_time) : 'EN CURSO'}</span>
                        </div>

                        <div className="border-t border-dashed border-black my-2 py-1">
                            <h3 className="text-[10px] font-black mb-1">RESUMEN FINANCIERO</h3>
                            <table className="w-full text-[9px]">
                                <tbody>
                                    <tr>
                                        <td>BASE INICIAL:</td>
                                        <td className="text-right font-bold">${(order.initial_cash || 0).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td>VENTAS EFECTIVO:</td>
                                        <td className="text-right font-bold">${((order.metrics?.cashSales || 0)).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td>SALIDAS/GASTOS:</td>
                                        <td className="text-right font-bold">-${((order.metrics?.totalExpenses || 0)).toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-t border-black font-black">
                                        <td className="pt-1">ESPERADO CAJA:</td>
                                        <td className="text-right pt-1">${((order.metrics?.expectedInDrawer || 0)).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-dashed border-black my-2 py-1">
                            <h3 className="text-[10px] font-black mb-1">VENTAS DIGITALES</h3>
                            <table className="w-full text-[9px]">
                                <tbody>
                                    <tr>
                                        <td>NEQUI/DAVI:</td>
                                        <td className="text-right">${((order.metrics?.digitalBreakdown?.nequi || 0)).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td>TARJETAS:</td>
                                        <td className="text-right">${((order.metrics?.digitalBreakdown?.tarjeta || 0)).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td>TRANSF. BANCO:</td>
                                        <td className="text-right">${((order.metrics?.digitalBreakdown?.transferencia || 0)).toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-t border-black font-bold">
                                        <td className="pt-1">TOTAL DIGITAL:</td>
                                        <td className="text-right pt-1">${((order.metrics?.digitalSales || 0)).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {order.status === 'cerrado' && (
                            <div className="border border-black p-2 mt-2">
                                <h3 className="text-[10px] font-black text-center mb-1 uppercase">Cuadre de Efectivo</h3>
                                <div className="flex justify-between text-[9px] font-bold">
                                    <span>CONTADO:</span>
                                    <span>${(order.final_cash || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[9px] font-bold">
                                    <span>SISTEMA:</span>
                                    <span>${(order.expected_cash || 0).toLocaleString()}</span>
                                </div>
                                <div className={`flex justify-between text-[10px] font-black border-t border-black mt-1 pt-1 ${order.balance === 0 ? '' : 'uppercase'}`}>
                                    <span>DIFERENCIA:</span>
                                    <span>${(order.balance || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="text-center text-[7px] mt-4 opacity-60">
                            <p>Firma Cajero: _______________________</p>
                        </div>
                    </div>
                )}
            </div>
        </>
        , document.body
    );
};

export default TicketPrinter;
