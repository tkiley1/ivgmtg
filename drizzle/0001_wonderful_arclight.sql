ALTER TYPE "public"."tournament_format" ADD VALUE 'standard';
--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_structure_check";
--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_structure_check" CHECK (
  "round_count" BETWEEN 1 AND 20
  AND "games_per_match" IN (1, 3)
  AND "round_time_limit_minutes" BETWEEN 10 AND 240
  AND ("capacity" IS NULL OR "capacity" >= 2)
  AND ("top_cut_size" IS NULL OR "top_cut_size" IN (2, 4, 8, 16, 32, 64))
  AND (
    ("format" = 'commander' AND "commander_mode" IS NOT NULL)
    OR ("format" <> 'commander' AND "commander_mode" IS NULL AND "pod_size" IS NULL)
  )
  AND ("commander_mode" <> 'pods' OR "pod_size" IN (3, 4))
);
