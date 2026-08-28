CREATE TABLE "weekly_reflection_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start_date" date NOT NULL,
	"biggest_win" text NOT NULL,
	"biggest_mistake" text NOT NULL,
	"what_learned" text NOT NULL,
	"what_to_change" text NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start_date" date NOT NULL,
	"biggest_win" text DEFAULT '' NOT NULL,
	"biggest_mistake" text DEFAULT '' NOT NULL,
	"what_learned" text DEFAULT '' NOT NULL,
	"what_to_change" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reflections_week_start_date_unique" UNIQUE("week_start_date")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start_date" date NOT NULL,
	"week_end_date" date NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trajectory_state" text NOT NULL,
	"snapshot" jsonb NOT NULL
);
