ALTER TYPE "public"."signal_status" ADD VALUE 'new' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."signal_status" ADD VALUE 'acknowledged' BEFORE 'resolved';--> statement-breakpoint
ALTER TYPE "public"."signal_status" ADD VALUE 'suppressed';--> statement-breakpoint
ALTER TABLE "coach_signals" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "coach_signals" ADD COLUMN "importance" integer DEFAULT 3 NOT NULL;