-- Add floor column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INTEGER DEFAULT 1;

-- Update existing rooms based on the first digit of their number (heuristic)
-- Assuming 101 -> Floor 1, 205 -> Floor 2, etc.
UPDATE rooms 
SET floor = CAST(SUBSTRING(number FROM 1 FOR 1) AS INTEGER)
WHERE floor = 1 AND number ~ '^[0-9]+$';
