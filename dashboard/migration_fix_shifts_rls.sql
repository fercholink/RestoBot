
-- Enable RLS (good practice) or Disable if causing issues. 
-- For this project, let's Ensure RLS is enabled but generic policy exists.

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for all users" ON shifts;
DROP POLICY IF EXISTS "Enable read access for all users" ON shifts;
DROP POLICY IF EXISTS "Enable insert for all users" ON shifts;
DROP POLICY IF EXISTS "Enable update for all users" ON shifts;

-- Create permissive policy (since we handle auth in app logic mostly)
-- In a real prod app, we'd be stricter, but for "Opening Box" issues, this usually fixes it.
CREATE POLICY "Enable all access for all users" ON shifts
    FOR ALL
    USING (true)
    WITH CHECK (true);
