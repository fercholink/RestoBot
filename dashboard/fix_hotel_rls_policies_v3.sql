-- FIX HOTEL RLS POLICIES (Version 3 - FULL ACCESS)
-- Updates policies to allow INSERT, UPDATE, DELETE in addition to SELECT.
-- Execute this in Supabase SQL Editor.

-- 1. Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON "public"."bookings";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."bookings";
DROP POLICY IF EXISTS "Enable insert access for all users" ON "public"."bookings";
DROP POLICY IF EXISTS "Enable update access for all users" ON "public"."bookings";
DROP POLICY IF EXISTS "Enable delete access for all users" ON "public"."bookings";

CREATE POLICY "Enable all access for all users" ON "public"."bookings" FOR ALL USING (true) WITH CHECK (true);

-- 2. Rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON "public"."rooms";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."rooms";

CREATE POLICY "Enable all access for all users" ON "public"."rooms" FOR ALL USING (true) WITH CHECK (true);

-- 3. Floors
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON "public"."floors";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."floors";

CREATE POLICY "Enable all access for all users" ON "public"."floors" FOR ALL USING (true) WITH CHECK (true);

-- 4. Branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON "public"."branches";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."branches";

CREATE POLICY "Enable all access for all users" ON "public"."branches" FOR ALL USING (true) WITH CHECK (true);
