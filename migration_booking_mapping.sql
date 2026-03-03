-- ============================================================
-- MIGRACIÓN: BOOKING.COM MAPPING — CHANNEL MANAGER
-- ============================================================

-- 1. EXTENDER TABLA DE SEDES (BRANCHES)
-- Para almacenar el Property ID y las credenciales de la Machine Account
ALTER TABLE branches ADD COLUMN IF NOT EXISTS booking_property_id TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS booking_machine_id TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS booking_machine_password TEXT;

-- 2. EXTENDER TABLA DE HABITACIONES (ROOMS)
-- Para mapear el ID de habitación y el ID del plan de tarifas de Booking.com
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS booking_room_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS booking_rate_plan_id TEXT;
