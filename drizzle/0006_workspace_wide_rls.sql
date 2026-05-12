DROP POLICY "creators_select_own_or_admin" ON "creators" CASCADE;--> statement-breakpoint
DROP POLICY "creators_insert_own_or_admin" ON "creators" CASCADE;--> statement-breakpoint
DROP POLICY "creators_update_own_or_admin" ON "creators" CASCADE;--> statement-breakpoint
DROP POLICY "creators_delete_own_or_admin" ON "creators" CASCADE;--> statement-breakpoint
DROP POLICY "launch_packages_select_own_or_admin" ON "launch_packages" CASCADE;--> statement-breakpoint
DROP POLICY "launch_packages_insert_own_or_admin" ON "launch_packages" CASCADE;--> statement-breakpoint
DROP POLICY "launch_packages_update_own_or_admin" ON "launch_packages" CASCADE;--> statement-breakpoint
DROP POLICY "launch_packages_delete_own_or_admin" ON "launch_packages" CASCADE;--> statement-breakpoint
DROP POLICY "generated_assets_select_own_or_admin" ON "generated_assets" CASCADE;--> statement-breakpoint
DROP POLICY "generated_assets_insert_own_or_admin" ON "generated_assets" CASCADE;--> statement-breakpoint
DROP POLICY "generated_assets_update_own_or_admin" ON "generated_assets" CASCADE;--> statement-breakpoint
DROP POLICY "generated_assets_delete_own_or_admin" ON "generated_assets" CASCADE;--> statement-breakpoint
DROP POLICY "generation_jobs_select_own_or_admin" ON "generation_jobs" CASCADE;--> statement-breakpoint
DROP POLICY "generation_jobs_insert_own_or_admin" ON "generation_jobs" CASCADE;--> statement-breakpoint
DROP POLICY "generation_jobs_update_own_or_admin" ON "generation_jobs" CASCADE;--> statement-breakpoint
DROP POLICY "generation_jobs_delete_own_or_admin" ON "generation_jobs" CASCADE;--> statement-breakpoint
CREATE POLICY "creators_select_authed" ON "creators" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "creators_insert_self_or_admin" ON "creators" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "creators_update_authed" ON "creators" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "creators_delete_authed" ON "creators" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "launch_packages_select_authed" ON "launch_packages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "launch_packages_insert_self_or_admin" ON "launch_packages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "launch_packages_update_authed" ON "launch_packages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "launch_packages_delete_authed" ON "launch_packages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "generated_assets_select_authed" ON "generated_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "generated_assets_insert_self_or_admin" ON "generated_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generated_assets_update_authed" ON "generated_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "generated_assets_delete_authed" ON "generated_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "generation_jobs_select_authed" ON "generation_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "generation_jobs_insert_self_or_admin" ON "generation_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "generation_jobs_update_authed" ON "generation_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "generation_jobs_delete_authed" ON "generation_jobs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);
