-- ============================================================
-- MIGRACIÓN: Turnos por Usuario — RestoBot
-- Ejecutar en: Supabase SQL Editor
--
-- Problema: La caja es global. Si un cajero abre turno,
--           el admin también ve la caja abierta al refrescar.
-- Solución: Agregar user_id a shifts para que cada usuario
--           tenga su propio estado de caja independiente.
-- ============================================================

-- PASO 1: Agregar columna user_id a la tabla shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- PASO 2: Crear índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_user_status ON shifts(user_id, status);

-- PASO 3: Actualizar shifts existentes (intentar asociar por cashier_name si hay match)
-- Si hay turnos abiertos sin user_id, podemos intentar asociarlos
UPDATE shifts s
SET user_id = p.id
FROM profiles p
WHERE s.user_id IS NULL
  AND LOWER(TRIM(s.cashier_name)) = LOWER(TRIM(p.full_name));

-- PASO 4: Cerrar turnos huérfanos (sin user_id) que están abiertos 
-- Esto limpia el estado y previene confusión
UPDATE shifts
SET status = 'cerrado',
    end_time = NOW()
WHERE status = 'abierto'
  AND user_id IS NULL;

-- VERIFICACIÓN
SELECT 
    id, 
    cashier_name, 
    user_id, 
    status, 
    start_time 
FROM shifts 
ORDER BY start_time DESC 
LIMIT 10;
