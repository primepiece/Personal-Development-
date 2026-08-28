CREATE TYPE "public"."metric_direction" AS ENUM('higher_is_better', 'lower_is_better');--> statement-breakpoint
CREATE TABLE "trajectory_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"value" double precision NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trajectory_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"venture_id" uuid,
	"linked_goal_id" uuid,
	"unit" text NOT NULL,
	"direction" "metric_direction" NOT NULL,
	"target_value" double precision,
	"target_date" date,
	"baseline_value" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trajectory_checkpoints" ADD CONSTRAINT "trajectory_checkpoints_metric_id_trajectory_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."trajectory_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectory_metrics" ADD CONSTRAINT "trajectory_metrics_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectory_metrics" ADD CONSTRAINT "trajectory_metrics_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectory_metrics" ADD CONSTRAINT "trajectory_metrics_linked_goal_id_goals_id_fk" FOREIGN KEY ("linked_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;