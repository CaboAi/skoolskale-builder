ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "creators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generated_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "launch_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pattern_library" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_log_select_own_or_admin" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "audit_log_insert_own_or_admin" ON "audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "audit_log_update_own_or_admin" ON "audit_log" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin') WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "audit_log_delete_own_or_admin" ON "audit_log" AS PERMISSIVE FOR DELETE TO "authenticated" USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "creators_select_own_or_admin" ON "creators" AS PERMISSIVE FOR SELECT TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "creators_insert_own_or_admin" ON "creators" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "creators_update_own_or_admin" ON "creators" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin') WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "creators_delete_own_or_admin" ON "creators" AS PERMISSIVE FOR DELETE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generated_assets_select_own_or_admin" ON "generated_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generated_assets_insert_own_or_admin" ON "generated_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generated_assets_update_own_or_admin" ON "generated_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin') WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generated_assets_delete_own_or_admin" ON "generated_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generation_jobs_select_own_or_admin" ON "generation_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generation_jobs_insert_own_or_admin" ON "generation_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generation_jobs_update_own_or_admin" ON "generation_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin') WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generation_jobs_delete_own_or_admin" ON "generation_jobs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "launch_packages_select_own_or_admin" ON "launch_packages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "launch_packages_insert_own_or_admin" ON "launch_packages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "launch_packages_update_own_or_admin" ON "launch_packages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin') WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "launch_packages_delete_own_or_admin" ON "launch_packages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "pattern_library_select_authed" ON "pattern_library" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "pattern_library_insert_admin" ON "pattern_library" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "pattern_library_update_admin" ON "pattern_library" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.jwt() ->> 'role') = 'admin') WITH CHECK ((auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "pattern_library_delete_admin" ON "pattern_library" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.jwt() ->> 'role') = 'admin');