import { supabase } from './supabase';

/**
 * Registra un movimiento de inventario en la tabla inventory_logs.
 * @param {Object} params
 * @param {number} params.productId - ID del producto.
 * @param {number} params.branchId - ID de la sede.
 * @param {number} params.quantityChanged - Cantidad que cambió (positiva o negativa).
 * @param {number} params.newStock - Nuevo stock resultante.
 * @param {string} params.reason - Razón del cambio ('venta', 'ajuste', 'compra', 'devolucion', 'desperdicio').
 * @param {string} [params.userId] - ID del usuario que realizó el cambio.
 */
export const logInventoryChange = async ({
    productId,
    branchId,
    quantityChanged,
    newStock,
    reason,
    userId = null
}) => {
    try {
        const { error } = await supabase
            .from('inventory_logs')
            .insert([{
                product_id: productId,
                branch_id: branchId,
                user_id: userId,
                quantity_changed: quantityChanged,
                new_stock: newStock,
                reason: reason,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error al registrar log de inventario:', error);
            // No bloqueamos el flujo principal si el log falla, pero avisamos.
        }
    } catch (err) {
        console.error('Exception in logInventoryChange:', err);
    }
};
