import Dexie from 'dexie';

export const db = new Dexie('NexusLocal_DB_v2');

// ─── v1: restaurante ─────────────────────────────────────────────────────────
db.version(1).stores({
    products:    'id, name, category_id, organization_id, available',
    categories:  'id, name, organization_id',
    orders:      'id, order_number, status, shift_id, organization_id, created_at',
    order_items: '++id, order_id, product_id, organization_id',
    shifts:      '++id, user_id, status, start_time',
    areas:       'id, organization_id, branch_id',
    tables:      'id, organization_id, branch_id, area_id',
    pending_sync: '++local_id, type, table, status, created_at'
});

// ─── v2: hotel + accounting snapshot ─────────────────────────────────────────
db.version(2).stores({
    products:    'id, name, category_id, organization_id, available',
    categories:  'id, name, organization_id',
    orders:      'id, order_number, status, shift_id, organization_id, created_at',
    order_items: '++id, order_id, product_id, organization_id',
    shifts:      '++id, user_id, status, start_time',
    areas:       'id, organization_id, branch_id',
    tables:      'id, organization_id, branch_id, area_id',
    pending_sync: '++local_id, type, table, status, created_at',
    // Hotel
    rooms:        'id, branch_id, organization_id, status, housekeeping_status, floor_id',
    bookings:     'id, room_id, guest_id, organization_id, status, check_in, check_out',
    guests:       'id, organization_id, full_name, email, phone, nationality',
    // Accounting snapshot (clave/valor)
    accounting_snapshots: 'key, saved_at'
});

/**
 * Tipos de operaciones en la cola de sync:
 * - 'insert-order'        : Nuevo pedido creado offline
 * - 'update-status'       : Cambio de estado de pedido
 * - 'insert-booking'      : Nueva reserva creada offline
 * - 'update-booking'      : Cambio de estado de reserva/habitación
 * - 'insert-room-charge'  : Cargo a habitación creado offline
 * - 'update-stock'        : Actualización de inventario
 */

export default db;
