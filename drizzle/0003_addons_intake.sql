ALTER TYPE "public"."module" ADD VALUE 'classroom';--> statement-breakpoint
ALTER TYPE "public"."module" ADD VALUE 'calendar';--> statement-breakpoint
ALTER TYPE "public"."module" ADD VALUE 'leaderboard';--> statement-breakpoint
ALTER TYPE "public"."module" ADD VALUE 'categories';--> statement-breakpoint
ALTER TYPE "public"."module" ADD VALUE 'discovery_seo';--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "classroom_intake" jsonb;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "calendar_intake" jsonb;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "leaderboard_levels" jsonb;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "categories" jsonb;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "discovery_keywords" text[];