ALTER TYPE "public"."participant_status" ADD VALUE 'waitlisted' BEFORE 'checked_in';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "ratings_applied_at" timestamp with time zone;