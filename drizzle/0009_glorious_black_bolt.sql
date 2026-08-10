CREATE TYPE "public"."handover_doc_key" AS ENUM('readme', 'vsl_and_cancellation', 'pre_launch_emails', 'post_launch_emails', 'docuseries_full_script', 'dm_sequences');--> statement-breakpoint
CREATE TABLE "handover_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"doc_key" "handover_doc_key" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_md" text NOT NULL,
	"pdf_path" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"placeholder_count" integer DEFAULT 0 NOT NULL,
	"claude_usage" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handover_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "handover_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"include_guest_emails" boolean DEFAULT false NOT NULL,
	"inngest_run_id" text,
	"claude_usage" jsonb,
	"error" text,
	"created_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handover_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "handover_documents" ADD CONSTRAINT "handover_documents_run_id_handover_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handover_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_documents" ADD CONSTRAINT "handover_documents_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_runs" ADD CONSTRAINT "handover_runs_package_id_launch_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."launch_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handover_documents_run_id_idx" ON "handover_documents" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "handover_documents_package_doc_idx" ON "handover_documents" USING btree ("package_id","doc_key");--> statement-breakpoint
CREATE INDEX "handover_runs_package_id_idx" ON "handover_runs" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "handover_runs_status_idx" ON "handover_runs" USING btree ("status");--> statement-breakpoint
CREATE POLICY "handover_documents_select_authed" ON "handover_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "handover_documents_insert_self_or_admin" ON "handover_documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "handover_documents_update_authed" ON "handover_documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "handover_documents_delete_authed" ON "handover_documents" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "handover_runs_select_authed" ON "handover_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "handover_runs_insert_self_or_admin" ON "handover_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by = auth.uid() OR (auth.jwt() ->> 'role') = 'admin');--> statement-breakpoint
CREATE POLICY "handover_runs_update_authed" ON "handover_runs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "handover_runs_delete_authed" ON "handover_runs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);