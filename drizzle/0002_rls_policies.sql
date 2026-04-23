-- Phase 1 RLS policies
-- Per CLAUDE.md: role checks via auth.jwt() ->> 'role'.
-- Per PRD: owner-scoped tables gate on created_by = auth.uid(); admins see all.
-- pattern_library: SELECT open to all authed users, writes admin-only.
--
-- Idempotent: drops policies first so the file can be re-applied safely.

-- ---------- Enable RLS on every Phase 1 table ----------

ALTER TABLE "creators"          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "launch_packages"   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generated_assets"  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_jobs"   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pattern_library"   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log"         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ============================================================
-- creators
-- ============================================================

DROP POLICY IF EXISTS "creators_select_own_or_admin" ON "creators";--> statement-breakpoint
DROP POLICY IF EXISTS "creators_insert_own_or_admin" ON "creators";--> statement-breakpoint
DROP POLICY IF EXISTS "creators_update_own_or_admin" ON "creators";--> statement-breakpoint
DROP POLICY IF EXISTS "creators_delete_own_or_admin" ON "creators";--> statement-breakpoint

CREATE POLICY "creators_select_own_or_admin" ON "creators"
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "creators_insert_own_or_admin" ON "creators"
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "creators_update_own_or_admin" ON "creators"
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "creators_delete_own_or_admin" ON "creators"
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

-- ============================================================
-- launch_packages
-- ============================================================

DROP POLICY IF EXISTS "launch_packages_select_own_or_admin" ON "launch_packages";--> statement-breakpoint
DROP POLICY IF EXISTS "launch_packages_insert_own_or_admin" ON "launch_packages";--> statement-breakpoint
DROP POLICY IF EXISTS "launch_packages_update_own_or_admin" ON "launch_packages";--> statement-breakpoint
DROP POLICY IF EXISTS "launch_packages_delete_own_or_admin" ON "launch_packages";--> statement-breakpoint

CREATE POLICY "launch_packages_select_own_or_admin" ON "launch_packages"
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "launch_packages_insert_own_or_admin" ON "launch_packages"
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "launch_packages_update_own_or_admin" ON "launch_packages"
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "launch_packages_delete_own_or_admin" ON "launch_packages"
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

-- ============================================================
-- generated_assets
-- ============================================================

DROP POLICY IF EXISTS "generated_assets_select_own_or_admin" ON "generated_assets";--> statement-breakpoint
DROP POLICY IF EXISTS "generated_assets_insert_own_or_admin" ON "generated_assets";--> statement-breakpoint
DROP POLICY IF EXISTS "generated_assets_update_own_or_admin" ON "generated_assets";--> statement-breakpoint
DROP POLICY IF EXISTS "generated_assets_delete_own_or_admin" ON "generated_assets";--> statement-breakpoint

CREATE POLICY "generated_assets_select_own_or_admin" ON "generated_assets"
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generated_assets_insert_own_or_admin" ON "generated_assets"
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generated_assets_update_own_or_admin" ON "generated_assets"
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generated_assets_delete_own_or_admin" ON "generated_assets"
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

-- ============================================================
-- generation_jobs
-- ============================================================

DROP POLICY IF EXISTS "generation_jobs_select_own_or_admin" ON "generation_jobs";--> statement-breakpoint
DROP POLICY IF EXISTS "generation_jobs_insert_own_or_admin" ON "generation_jobs";--> statement-breakpoint
DROP POLICY IF EXISTS "generation_jobs_update_own_or_admin" ON "generation_jobs";--> statement-breakpoint
DROP POLICY IF EXISTS "generation_jobs_delete_own_or_admin" ON "generation_jobs";--> statement-breakpoint

CREATE POLICY "generation_jobs_select_own_or_admin" ON "generation_jobs"
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generation_jobs_insert_own_or_admin" ON "generation_jobs"
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generation_jobs_update_own_or_admin" ON "generation_jobs"
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "generation_jobs_delete_own_or_admin" ON "generation_jobs"
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

-- ============================================================
-- audit_log
-- Column is user_id (not created_by) per PRD §6.3; owner-scoped on that.
-- ============================================================

DROP POLICY IF EXISTS "audit_log_select_own_or_admin" ON "audit_log";--> statement-breakpoint
DROP POLICY IF EXISTS "audit_log_insert_own_or_admin" ON "audit_log";--> statement-breakpoint
DROP POLICY IF EXISTS "audit_log_update_own_or_admin" ON "audit_log";--> statement-breakpoint
DROP POLICY IF EXISTS "audit_log_delete_own_or_admin" ON "audit_log";--> statement-breakpoint

CREATE POLICY "audit_log_select_own_or_admin" ON "audit_log"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "audit_log_insert_own_or_admin" ON "audit_log"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "audit_log_update_own_or_admin" ON "audit_log"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "audit_log_delete_own_or_admin" ON "audit_log"
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

-- ============================================================
-- pattern_library
-- SELECT: all authed users. Writes: admin only.
-- ============================================================

DROP POLICY IF EXISTS "pattern_library_select_authed" ON "pattern_library";--> statement-breakpoint
DROP POLICY IF EXISTS "pattern_library_insert_admin" ON "pattern_library";--> statement-breakpoint
DROP POLICY IF EXISTS "pattern_library_update_admin" ON "pattern_library";--> statement-breakpoint
DROP POLICY IF EXISTS "pattern_library_delete_admin" ON "pattern_library";--> statement-breakpoint

CREATE POLICY "pattern_library_select_authed" ON "pattern_library"
  FOR SELECT TO authenticated
  USING (true);--> statement-breakpoint

CREATE POLICY "pattern_library_insert_admin" ON "pattern_library"
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "pattern_library_update_admin" ON "pattern_library"
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint

CREATE POLICY "pattern_library_delete_admin" ON "pattern_library"
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');
