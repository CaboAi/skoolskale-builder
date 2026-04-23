CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'running', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."launch_package_status" AS ENUM('draft', 'generating', 'review', 'ready', 'deployed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('welcome_dm', 'transformation', 'about_us', 'start_here', 'cover', 'icon', 'start_here_thumb', 'join_now_banner');--> statement-breakpoint
CREATE TYPE "public"."niche" AS ENUM('spiritual', 'business', 'fitness', 'relationships', 'money', 'yoga', 'other');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('loving', 'direct', 'playful');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"community_name" text NOT NULL,
	"niche" "niche" NOT NULL,
	"audience" text NOT NULL,
	"transformation" text NOT NULL,
	"tone" "tone" NOT NULL,
	"offer_breakdown" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"trial_terms" jsonb,
	"refund_policy" text,
	"brand_prefs" text,
	"creator_photo_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"module" "module" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"edit_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"va_notes" text,
	"quality_score" numeric(5, 2),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"module" "module" NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"inngest_run_id" text,
	"claude_usage" jsonb,
	"gemini_image_usage" jsonb,
	"error" text,
	"created_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launch_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"status" "launch_package_status" DEFAULT 'draft' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"generation_duration_ms" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exported_at" timestamp with time zone,
	"deployed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pattern_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" "module" NOT NULL,
	"niche" "niche",
	"tone" "tone",
	"example_content" jsonb NOT NULL,
	"source_creator" text,
	"source_package_id" uuid,
	"quality_rank" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"promoted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "generated_assets" ADD CONSTRAINT "generated_assets_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_packages" ADD CONSTRAINT "launch_packages_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_library" ADD CONSTRAINT "pattern_library_source_package_id_launch_packages_id_fk" FOREIGN KEY ("source_package_id") REFERENCES "public"."launch_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "creators_created_by_idx" ON "creators" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "creators_niche_idx" ON "creators" USING btree ("niche");--> statement-breakpoint
CREATE INDEX "generated_assets_package_id_idx" ON "generated_assets" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "generated_assets_module_idx" ON "generated_assets" USING btree ("module");--> statement-breakpoint
CREATE INDEX "generated_assets_created_by_idx" ON "generated_assets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "generation_jobs_package_id_idx" ON "generation_jobs" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_inngest_run_id_idx" ON "generation_jobs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX "launch_packages_creator_id_idx" ON "launch_packages" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "launch_packages_created_by_idx" ON "launch_packages" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "launch_packages_status_idx" ON "launch_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pattern_library_module_idx" ON "pattern_library" USING btree ("module");--> statement-breakpoint
CREATE INDEX "pattern_library_niche_idx" ON "pattern_library" USING btree ("niche");--> statement-breakpoint
CREATE INDEX "pattern_library_tone_idx" ON "pattern_library" USING btree ("tone");--> statement-breakpoint
CREATE INDEX "pattern_library_is_active_idx" ON "pattern_library" USING btree ("is_active");