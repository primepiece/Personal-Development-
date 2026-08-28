CREATE TYPE "public"."dogfood_category" AS ENUM('friction', 'missing_capability', 'confusing_ui', 'bad_calculation', 'bad_recommendation', 'coach_quality', 'bug');--> statement-breakpoint
CREATE TABLE "dogfood_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "dogfood_category" NOT NULL,
	"note" text NOT NULL,
	"context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
