CREATE TYPE "public"."draft_status" AS ENUM('not_started', 'seating', 'drafting', 'deck_building', 'complete');--> statement-breakpoint
CREATE TABLE "draft_pod_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pod_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_pods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"pod_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_rating_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"format" "tournament_format" NOT NULL,
	"rating_delta" integer NOT NULL,
	"wins_delta" integer DEFAULT 0 NOT NULL,
	"losses_delta" integer DEFAULT 0 NOT NULL,
	"draws_delta" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "match_players_match_user_unique";--> statement-breakpoint
ALTER TABLE "match_players" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_participants" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "match_players" ADD COLUMN "participant_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD COLUMN "guest_name" varchar(80);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_status" "draft_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_pack" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_pick" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_pick_time_seconds" integer DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "deck_building_time_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_step_ends_at" timestamp with time zone;--> statement-breakpoint
UPDATE "match_players" AS mp
SET "participant_id" = tp."id"
FROM "matches" AS m, "tournament_participants" AS tp
WHERE mp."match_id" = m."id"
  AND tp."tournament_id" = m."tournament_id"
  AND tp."user_id" = mp."user_id";--> statement-breakpoint
ALTER TABLE "match_players" ALTER COLUMN "participant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "draft_pod_seats" ADD CONSTRAINT "draft_pod_seats_pod_id_draft_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."draft_pods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_pod_seats" ADD CONSTRAINT "draft_pod_seats_participant_id_tournament_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_pods" ADD CONSTRAINT "draft_pods_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rating_adjustments" ADD CONSTRAINT "match_rating_adjustments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rating_adjustments" ADD CONSTRAINT "match_rating_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_pod_seats_pod_seat_unique" ON "draft_pod_seats" USING btree ("pod_id","seat");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_pod_seats_participant_unique" ON "draft_pod_seats" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "draft_pod_seats_pod_idx" ON "draft_pod_seats" USING btree ("pod_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_pods_tournament_number_unique" ON "draft_pods" USING btree ("tournament_id","pod_number");--> statement-breakpoint
CREATE INDEX "draft_pods_tournament_idx" ON "draft_pods" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_rating_adjustments_match_user_unique" ON "match_rating_adjustments" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_rating_adjustments_match_idx" ON "match_rating_adjustments" USING btree ("match_id");--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_participant_id_tournament_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_participant_unique" ON "match_players" USING btree ("match_id","participant_id");--> statement-breakpoint
CREATE INDEX "match_players_participant_idx" ON "match_players" USING btree ("participant_id");
