-- ── Migration 024: Super Admin Role ─────────────────────────────────────────
-- Adds a system_role column to bookflow.profiles.
-- Values: NULL (regular user) | 'super_admin'
-- Super admins bypass all book/club access checks server-side.

SET search_path = bookflow, public;

-- 1. Add system_role column
ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS system_role TEXT
    CHECK (system_role IN ('super_admin'))
    DEFAULT NULL;

-- 2. RLS: super_admins can read ALL profiles (needed for admin UI)
CREATE POLICY "Super admins can view all profiles"
  ON bookflow.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- 3. Super admins can update any profile (for role assignment)
CREATE POLICY "Super admins can update profiles"
  ON bookflow.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- 4. Super admins can read ALL books regardless of visibility
CREATE POLICY "Super admins can view all books"
  ON bookflow.books
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- 5. Super admins can read ALL clubs
CREATE POLICY "Super admins can view all clubs"
  ON bookflow.book_clubs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- 6. Super admins can view all club members
CREATE POLICY "Super admins can view all club members"
  ON bookflow.club_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- 7. Assign super_admin to platform admins
UPDATE bookflow.profiles
SET system_role = 'super_admin'
WHERE email IN ('admin.steen2@silverflow.ca', 'damion.steen@silverflow.ca');
