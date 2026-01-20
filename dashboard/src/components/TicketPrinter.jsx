import React from 'react';

const TicketPrinter = ({ order, type = 'comanda', branchName = 'BS COMUNICACIONES TEST SAS' }) => {
    if (!order) return null;

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
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

    return (
        <div id="thermal-ticket" className="bg-white text-black p-4 font-mono text-[10px] w-[75mm] leading-tight select-none fixed top-0 left-[-9999px] print:static print:block print:w-full">
            <style>{`
                @media print {
                    @page { 
                        margin: 0; 
                        size: 80mm auto;
                    }
                    body { 
                        margin: 0; 
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                    }
                    #thermal-ticket { 
                        display: block !important; 
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 10px !important;
                    }
                    nav, sidebar, header, button, .no-print { display: none !important; }
                }
            `}</style>

            {/* Cabezote Legal */}
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <h2 className="text-sm font-black uppercase">{branchName}</h2>
                <p className="text-[8px] font-bold">NIT: 900.876.543-1 - RESPONSABLE DE IVA</p>
                <p className="text-[8px]">Dirección: Calle Falsa 123 - Montería, Córdoba</p>
                <p className="text-[8px]">TEL: +57 321 000 0000</p>

                {type === 'recibo' && (
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
                    {type === 'comanda' ? '*** COMANDA DE COCINA ***' : 'FACTURA ELECTRÓNICA DE VENTA'}
                </p>

                <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex justify-between"><span>No:</span> <span className="font-bold">{order.prefix || 'RB'}-{order.id}</span></div>
                    <div className="flex justify-between"><span>FECHA:</span> <span>{new Date(order.created_at).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>HORA:</span> <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div className="flex justify-between"><span>TIPO:</span> <span className="uppercase font-bold">{order.table_id ? `Mesa: ${order.table_id}` : 'Domicilio'}</span></div>
                </div>

                {/* Datos del Cliente Tributario */}
                <div className="border-t border-dotted border-black mt-1 pt-1">
                    <div className="flex justify-between">
                        <span>CLIENTE:</span>
                        <span className="font-bold truncate max-w-[150px]">
                            {order.tax_data?.names || order.customer_name || 'CONSUMIDOR FINAL'}
                        </span>
                    </div>
                    {(order.tax_data?.identification || order.customer_phone) && (
                        <div className="flex justify-between">
                            <span>{getIDLabel(order.tax_data?.document_type)}:</span>
                            <span className="font-bold">{order.tax_data?.identification || '222222222222'}</span>
                        </div>
                    )}
                    {order.tax_data?.email && (
                        <div className="flex justify-between">
                            <span>EMAIL:</span>
                            <span className="truncate max-w-[150px]">{order.tax_data.email}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Detalle de Productos */}
            <table className="w-full border-t border-b border-black mb-2 py-1">
                <thead>
                    <tr className="border-b border-black">
                        <th className="text-left py-1 text-[8px]">CANT</th>
                        <th className="text-left py-1 text-[8px]">DESCRIPCIÓN</th>
                        {type === 'recibo' && <th className="text-right py-1 text-[8px]">TOTAL</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                    {order.items.map((item, idx) => (
                        <React.Fragment key={idx}>
                            <tr>
                                <td className="py-1 align-top">{item.quantity}</td>
                                <td className="py-1">
                                    <span className="font-bold uppercase text-[9px]">{item.product_name}</span>
                                </td>
                                {type === 'recibo' && (
                                    <td className="py-1 text-right text-[9px]">
                                        ${(item.unit_price * item.quantity).toLocaleString()}
                                    </td>
                                )}
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {/* Totales y Desglose de Impuestos */}
            {type === 'recibo' && (
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

            {/* Footer Legal DIAN */}
            {type === 'recibo' && (
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
                        <p className="font-black">¡GRACIAS POR SU COMPRA!</p>
                        <p>Visítenos pronto</p>
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
        </div>
    );
};

export default TicketPrinter;
