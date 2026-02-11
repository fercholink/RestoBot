-- 1. Allow Admins and Managers to INSERT new profiles (e.g. creating staff)
DROP POLICY IF EXISTS "Admins and Managers can insert profiles" ON profiles;
CREATE POLICY "Admins and Managers can insert profiles"
ON profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

-- 2. Allow Admins and Managers to UPDATE any profile
DROP POLICY IF EXISTS "Admins and Managers can update any profile" ON profiles;
CREATE POLICY "Admins and Managers can update any profile"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

-- 3. Allow Admins and Managers to DELETE profiles
DROP POLICY IF EXISTS "Admins and Managers can delete profiles" ON profiles;
CREATE POLICY "Admins and Managers can delete profiles"
ON profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

-- 4. Allow users to INSERT their own profile (Bootstrap)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
