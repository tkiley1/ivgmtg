ALTER TABLE "draft_pod_seats" ADD CONSTRAINT "draft_pod_seats_number_check" CHECK ("draft_pod_seats"."seat" > 0);--> statement-breakpoint
ALTER TABLE "draft_pods" ADD CONSTRAINT "draft_pods_number_check" CHECK ("draft_pods"."pod_number" > 0);--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_identity_check" CHECK (
      ("tournament_participants"."user_id" IS NOT NULL AND "tournament_participants"."guest_name" IS NULL)
      OR ("tournament_participants"."user_id" IS NULL AND "tournament_participants"."guest_name" IS NOT NULL AND length(trim("tournament_participants"."guest_name")) > 0)
    );--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_draft_timing_check" CHECK (
      "tournaments"."draft_pack" BETWEEN 0 AND 3
      AND "tournaments"."draft_pick" BETWEEN 0 AND 30
      AND "tournaments"."draft_pick_time_seconds" BETWEEN 10 AND 300
      AND "tournaments"."draft_picks_per_pack" BETWEEN 1 AND 30
      AND "tournaments"."deck_building_time_minutes" BETWEEN 5 AND 120
    );
