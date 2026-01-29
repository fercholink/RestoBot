
-- Add user_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add created_by_email to orders table (optional, for easier display/debugging)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by_email text;

-- Add shift_id to orders table to link orders to a specific cash register shift
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id bigint;

-- Update RLS policies to restrict visibility based on role
-- Note: You might need to drop existing policies first if they conflict
-- DROP POLICY IF EXISTS "Enable all access for all users" ON orders;

-- We need a function to get the current open shift for a user?
-- For now, let's just make sure the column exists. Logic will be in the app.
