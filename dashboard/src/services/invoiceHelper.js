import factusService from './factusService';
import { supabase } from '../lib/supabase';

// -------------------------------------------------------
// Helpers de mapeo según API Factus / DIAN
// -------------------------------------------------------

const mapPersonType = (taxData) => {
    if (taxData?.legal_organization_id) return Number(taxData.legal_organization_id);
    const docType = String(taxData?.document_type || '').toUpperCase();
    if (docType === 'NIT' || docType === '31' || taxData?.type_person === '2') {
        return 1; // Jurídica en Factus
    }
    return 2; // Natural en Factus (default)
};

const mapTributeId = (legalOrg) => {
    // 18 = Responsable de IVA (Jurídica), 21 = No responsable de IVA (Natural)
    return legalOrg === 1 ? 18 : 21;
};

const mapDocType = (taxData, legalOrg) => {
    const raw = String(taxData?.document_type || '').toUpperCase();
    if (raw === '13' || raw === 'CC') return 3;  // Cédula de ciudadanía
    if (raw === '31' || raw === 'NIT') return 6; // NIT
    if (raw === '22' || raw === 'CE') return 4;  // Cédula de extranjería
    if (raw === '42' || raw === 'PASS' || raw === 'PASAPORTE') return 7;
    if (raw && /^\d+$/.test(raw)) return Number(raw);
    return legalOrg === 1 ? 6 : 3; // Fallback
};

const mapPaymentMethod = (method) => {
    const map = {
        efectivo: '10',
        transferencia: '31',
        tarjeta: '31',
        nequi: '31',
        daviplata: '31',
        cargo_habitacion: '10'
    };
    return map[method?.toLowerCase()] || '10';
};

// Extrae el número de factura de la respuesta de Factus (estructura varía por versión)
const extractBillNumber = (bill) => {
    return bill?.number
        || bill?.identification?.number
        || bill?.prefix_number
        || bill?.document_number
        || null;
};

// Extrae el status como string (Factus a veces devuelve objeto { code, name })
const extractBillStatus = (status) => {
    if (!status) return 'unknown';
    if (typeof status === 'string') return status;
    return status?.code || status?.name || JSON.stringify(status);
};

// -------------------------------------------------------
// Función principal de emisión de factura electrónica
// -------------------------------------------------------

/**
 * Emite una factura electrónica para un pedido/orden dado.
 * @param {Object} order - id, order_items, tax_data, payment_method, total, customer_name, customer_phone
 * @returns {Promise<{success: boolean, bill: Object|null, error: string|null}>}
 */
export async function emitInvoiceForOrder(order) {
    try {
        // 0. Verificar credenciales
        const creds = await factusService.getCredentials();
        if (!creds?.email || !creds?.client_id) {
            throw new Error('Credenciales Factus no configuradas. Ve a Facturación → Configuración.');
        }

        // 1. Obtener rangos de numeración
        const rangesResp = await factusService.getRanges();
        const rangesList = Array.isArray(rangesResp?.data)
            ? rangesResp.data
            : Array.isArray(rangesResp?.data?.data)
                ? rangesResp.data.data
                : [];

        console.log('[Factus] Rangos obtenidos:', rangesList.length, JSON.stringify(rangesList, null, 2));

        // Buscar rango de Factura de Venta electrónica (document '01')
        const selectedRange = rangesList.find(r => {
            const doc = r.document;
            return doc === '01'
                || doc?.id === '01'
                || doc?.id === 1
                || r.document_type === '01'
                || r.document_type_code === '01';
        }) || rangesList[0] || null;

        console.log('[Factus] Rango seleccionado:', JSON.stringify(selectedRange, null, 2));

        if (!selectedRange) {
            const env = creds.environment === 'production'
                ? 'Producción (factus.com.co)'
                : 'Sandbox (api-sandbox.factus.com.co)';
            throw new Error(`No hay rangos de numeración activos en Factus (${env}). Ve a Configuración → Rangos de Numeración.`);
        }

        // 1.5 Resolver datos del tercero si viene referenciado por ID
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

            finalTaxData = {
                document_type: tp.document_type || 'CC',
                identification: tp.document_number,
                names: tp.business_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim(),
                email: tp.email || 'factura@contabilidad.com',
                phone: tp.phone || '0000000000',
                dv: tp.verification_digit,
                address: tp.address || 'Colombia',
                type_person: tp.document_type === 'NIT' ? '2' : '1',
            };
        }

        // 2. Mapear datos del cliente
        const legalOrg = mapPersonType(finalTaxData);
        const tributeIdClient = mapTributeId(legalOrg);
        const docType = mapDocType(finalTaxData, legalOrg);
        console.log('[Factus] Cliente → legalOrg:', legalOrg, '| tributeId:', tributeIdClient, '| docType:', docType);

        // 3. Construir ítems
        const rawItems = order.order_items?.length > 0
            ? order.order_items
            : (order.items?.length > 0
                ? order.items
                : [{ product_name: 'Servicio General', quantity: 1, unit_price: order.total || order.total_price || 0 }]);

        // 2.5 Leer impuesto por defecto del tenant (configurado en Estructura Empresa)
        let tenantDefaultTaxType = 'ICO_8';
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: prof } = await supabase.from('profiles').select('organization_id').eq('id', authUser.id).single();
                if (prof?.organization_id) {
                    const { data: taxCfg } = await supabase
                        .from('tenant_accounting_config')
                        .select('default_tax_type')
                        .eq('organization_id', prof.organization_id)
                        .maybeSingle();
                    if (taxCfg?.default_tax_type === 'iva_19') tenantDefaultTaxType = 'IVA_19';
                }
            }
        } catch (e) {
            console.warn('[Factus] No se pudo leer default_tax_type del tenant, usando ICO_8:', e.message);
        }

        const items = rawItems.map((item, idx) => {
            const totalWithTax = parseFloat(item.unit_price || item.price || item.product?.price || 0);

            // Determinar tipo de impuesto según nombre del producto
            let taxType = item.tax_type;
            if (!taxType) {
                const name = (item.product_name || item.product?.name || item.name || '').toLowerCase();
                if (name.includes('alojamiento') || name.includes('hospedaje') || name.includes('habitación') || name.includes('noche')) {
                    taxType = 'IVA_19';
                } else if (name.includes('(exento)')) {
                    taxType = 'EXENTO';
                } else {
                    taxType = tenantDefaultTaxType; // Impuesto por defecto según configuración del tenant
                }
            }

            let taxRate = '19.00';
            let tributeId = 1;  // 1 = IVA
            let divisor = 1.19;

            if (taxType === 'ICO_8' || taxType === 'ICO') {
                taxRate = '8.00';
                tributeId = 4;  // 4 = INC (Impuesto Nacional al Consumo) — valor correcto Factus
                divisor = 1.08;
            } else if (taxType === 'EXENTO') {
                taxRate = '0.00';
                tributeId = 1;  // IVA 0%
                divisor = 1;
            }

            // Precio base sin impuestos, redondeado a entero (COP no tiene centavos)
            const basePrice = Math.round(totalWithTax / divisor);

            return {
                code_reference: `ITM-${item.id || idx + 1}`,
                name: (item.product_name || item.name || 'Servicio').slice(0, 250),
                quantity: Number(item.quantity) || 1,
                discount_rate: 0,
                price: basePrice > 0 ? basePrice : 1,
                tax_rate: taxRate,
                unit_measure_id: 70,    // 70 = Unidad
                standard_code_id: 1,    // 1 = EAN
                is_excluded: 0,
                tribute_id: tributeId,
                withholding_taxes: []
            };
        });

        // 4. Construir objeto customer (omitir campos no aplicables con undefined)
        const hasDv = finalTaxData?.dv !== undefined
            && finalTaxData?.dv !== null
            && finalTaxData?.dv !== '';

        const customer = {
            identification: String(finalTaxData?.identification || '222222222222'),
            ...(hasDv && { dv: Number(finalTaxData.dv) }),
            ...(legalOrg === 1 && { company: finalTaxData?.names || 'Empresa' }),
            ...(legalOrg === 1 && { trade_name: finalTaxData?.trade_name || finalTaxData?.names || 'Empresa' }),
            ...(legalOrg === 2 && { names: finalTaxData?.names || order.customer_name || 'Consumidor Final' }),
            address: finalTaxData?.address || 'Colombia',
            email: finalTaxData?.email || 'factura@contabilidad.com',
            phone: String(order.customer_phone || finalTaxData?.phone || '3000000000').replace(/\D/g, '').slice(0, 10),
            legal_organization_id: legalOrg,
            tribute_id: tributeIdClient,
            identification_document_id: docType
        };

        // 5. Payload completo
        const invoicePayload = {
            numbering_range_id: Number(selectedRange.id),
            reference_code: `ORD-${order.id}-${Date.now()}`,
            observation: `Pedido #${order.id} - Nexus POS`,
            payment_form: '1',
            payment_method_code: mapPaymentMethod(order.payment_method),
            customer,
            items
        };

        console.log('[Factus] Payload a enviar:', JSON.stringify(invoicePayload, null, 2));

        // 6. Enviar a Factus
        const result = await factusService.createInvoice(invoicePayload);
        console.log('[Factus] Respuesta cruda completa:', JSON.stringify(result, null, 2));

        const bill = result?.data?.bill || result?.bill || result?.data || null;
        const billNumber = extractBillNumber(bill);

        if (!billNumber) {
            throw new Error('Factus no devolvió número de factura. Respuesta: ' + JSON.stringify(result));
        }

        const billStatus = extractBillStatus(bill?.status);
        const billId = bill?.id ?? null;

        // 7. Persistir en Supabase (status como string, no objeto)
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                factus_id: billId,
                factus_doc_number: billNumber,
                factus_status: billStatus,
                pdf_url: null
            })
            .eq('id', order.id);

        if (updateError) {
            // La factura ya se creó en Factus — avisar pero no fallar completamente
            console.error('[Factus] Factura creada en Factus pero falló guardado en BD:', updateError.message);
            // Devolver éxito igual para que el usuario vea el número de factura
            return {
                success: true,
                bill: { ...bill, number: billNumber, status: billStatus, id: billId },
                error: null,
                warning: `Factura ${billNumber} creada en Factus pero no se guardó en BD: ${updateError.message}`
            };
        }

        return {
            success: true,
            bill: { ...bill, number: billNumber, status: billStatus, id: billId },
            error: null
        };

    } catch (err) {
        const rawMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        const formattedMsg = rawMsg.replace(/\n/g, ' | ');
        console.error('[Factus] Error en emitInvoiceForOrder:', rawMsg);
        return { success: false, bill: null, error: formattedMsg };
    }
}
