CREATE TYPE "public"."image_reference_kind" AS ENUM('headshot', 'brand_kit');--> statement-breakpoint
CREATE TYPE "public"."image_slot_kind" AS ENUM('icon', 'classroom_cover', 'calendar_cover', 'about_us', 'start_here_thumb', 'join_now_banner');--> statement-breakpoint
CREATE TYPE "public"."image_style_spec_source" AS ENUM('generated', 'edited', 'fallback');--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"slot_kind" "image_slot_kind" NOT NULL,
	"slot_index" integer DEFAULT 0 NOT NULL,
	"slot_title" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"storage_path" text,
	"width" integer,
	"height" integer,
	"mime" text DEFAULT 'image/png' NOT NULL,
	"prompt" text,
	"style_spec_id" uuid,
	"provider" text,
	"model" text,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"duration_ms" integer,
	"error" text,
	"regenerate_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "image_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"kind" "image_reference_kind" NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_references" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "image_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"style_spec_id" uuid,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"planned_slot_keys" text[] NOT NULL,
	"inngest_run_id" text,
	"image_usage" jsonb,
	"error" text,
	"created_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "image_style_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"spec" jsonb NOT NULL,
	"source" "image_style_spec_source" NOT NULL,
	"model" text,
	"usage" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_style_specs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_run_id_image_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."image_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_style_spec_id_image_style_specs_id_fk" FOREIGN KEY ("style_spec_id") REFERENCES "public"."image_style_specs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_references" ADD CONSTRAINT "image_references_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_runs" ADD CONSTRAINT "image_runs_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_runs" ADD CONSTRAINT "image_runs_style_spec_id_image_style_specs_id_fk" FOREIGN KEY ("style_spec_id") REFERENCES "public"."image_style_specs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_style_specs" ADD CONSTRAINT "image_style_specs_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_assets_run_id_idx" ON "image_assets" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "image_assets_package_slot_idx" ON "image_assets" USING btree ("package_id","slot_key","version");--> statement-breakpoint
CREATE INDEX "image_references_package_kind_idx" ON "image_references" USING btree ("package_id","kind");--> statement-breakpoint
CREATE INDEX "image_runs_package_id_idx" ON "image_runs" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "image_runs_status_idx" ON "image_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "image_style_specs_package_version_idx" ON "image_style_specs" USING btree ("package_id","version");--> statement-breakpoint
CREATE POLICY "image_assets_select_authed" ON "image_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_assets_insert_self_or_admin" ON "image_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "image_assets_update_authed" ON "image_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "image_assets_delete_authed" ON "image_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_references_select_authed" ON "image_references" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_references_insert_self_or_admin" ON "image_references" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "image_references_update_authed" ON "image_references" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "image_references_delete_authed" ON "image_references" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_runs_select_authed" ON "image_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_runs_insert_self_or_admin" ON "image_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "image_runs_update_authed" ON "image_runs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "image_runs_delete_authed" ON "image_runs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_style_specs_select_authed" ON "image_style_specs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "image_style_specs_insert_self_or_admin" ON "image_style_specs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "image_style_specs_update_authed" ON "image_style_specs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "image_style_specs_delete_authed" ON "image_style_specs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);