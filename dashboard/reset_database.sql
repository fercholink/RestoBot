-- ⚠️ PRECAUCIÓN: Este script borrará TODOS los pedidos y turnos.
-- Ejecutar en el Editor SQL de Supabase.

-- 1. Borrar items de pedidos (por claves foráneas)
TRUNCATE TABLE order_items CASCADE;

-- 2. Borrar pedidos
TRUNCATE TABLE orders CASCADE;

-- 3. Borrar turnos
TRUNCATE TABLE shifts CASCADE;

-- 4. (Opcional) Reiniciar contadores de ID si son SERIAL/IDENTITY
-- ALTER SEQUENCE shifts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE orders_id_seq RESTART WITH 1;
-- ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
