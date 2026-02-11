-- 1. Add missing columns to BRANCHES table for Invoicing/Legal details
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS nit TEXT DEFAULT '900.000.000-1',
ADD COLUMN IF NOT EXISTS resolution TEXT,
ADD COLUMN IF NOT EXISTS resolution_date DATE,
ADD COLUMN IF NOT EXISTS resolution_prefix TEXT DEFAULT 'POS',
ADD COLUMN IF NOT EXISTS resolution_range TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurante', -- 'restaurante', 'hotel', 'mixto'
ADD COLUMN IF NOT EXISTS invoice_footer TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Add branch_id to ORDERS table to link sales to specific branch
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES branches(id);

-- 3. Create PROFILES table to store user metadata (Role, Branch, Permissions)
-- This links to Supabase Auth.users via id
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    branch_id BIGINT REFERENCES branches(id), -- User belongs to a specific branch
    role TEXT DEFAULT 'cajero', -- 'admin', 'gerente', 'cajero', 'mesero'
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    permissions JSONB DEFAULT '{}'::jsonb
);

-- 4. Policy updates (Simple for now: Enable read for authenticated)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admin Policies
CREATE POLICY "Admins and Managers can insert profiles"
ON profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Admins and Managers can update any profile"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Admins and Managers can delete profiles"
ON profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 5. Trigger to create profile on signup (Optional but good practice)
-- (Omitting for now to avoid complexity, relying on manual creation in UserManagement)
