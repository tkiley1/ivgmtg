CREATE TYPE "public"."commander_mode" AS ENUM('duel', 'pods');--> statement-breakpoint
CREATE TYPE "public"."deck_list_status" AS ENUM('draft', 'submitted', 'locked');--> statement-breakpoint
CREATE TYPE "public"."match_kind" AS ENUM('head_to_head', 'commander_pod');--> statement-breakpoint
CREATE TYPE "public"."match_player_result" AS ENUM('win', 'loss', 'draw', 'bye', 'placement');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'reported', 'confirmed', 'complete');--> statement-breakpoint
CREATE TYPE "public"."organizer_role" AS ENUM('owner', 'organizer', 'judge');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('registered', 'checked_in', 'active', 'dropped', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('pending', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('draft', 'sealed', 'commander');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'registration', 'check_in', 'active', 'top_cut', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120),
	"commander_name" varchar(120),
	"list_text" text,
	"status" "deck_list_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"result" "match_player_result",
	"placement" integer,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_drawn" integer DEFAULT 0 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"kind" "match_kind" NOT NULL,
	"table_number" integer,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"reported_by_id" uuid,
	"is_admin_override" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"format" "tournament_format" NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(30) NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"avatar_url" text,
	"bio" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"stage" varchar(32) DEFAULT 'swiss' NOT NULL,
	"is_top_cut" boolean DEFAULT false NOT NULL,
	"status" "round_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organizer_role" DEFAULT 'organizer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "participant_status" DEFAULT 'registered' NOT NULL,
	"seed_rating" integer DEFAULT 1200 NOT NULL,
	"final_standing" integer,
	"checked_in_at" timestamp with time zone,
	"dropped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"format" "tournament_format" NOT NULL,
	"commander_mode" "commander_mode",
	"pod_size" integer,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"access_key" varchar(32) NOT NULL,
	"invite_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_at" timestamp with time zone,
	"timezone" varchar(64) DEFAULT 'America/New_York' NOT NULL,
	"venue" varchar(160),
	"registration_ends_at" timestamp with time zone,
	"check_in_opens_at" timestamp with time zone,
	"capacity" integer,
	"round_count" integer NOT NULL,
	"games_per_match" integer DEFAULT 3 NOT NULL,
	"round_time_limit_minutes" integer DEFAULT 50 NOT NULL,
	"top_cut_size" integer,
	"deck_lists_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_lists" ADD CONSTRAINT "deck_lists_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_lists" ADD CONSTRAINT "deck_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_organizers" ADD CONSTRAINT "tournament_organizers_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_organizers" ADD CONSTRAINT "tournament_organizers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_tournament_idx" ON "audit_events" USING btree ("tournament_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_lists_tournament_user_unique" ON "deck_lists" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_user_unique" ON "match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_seat_unique" ON "match_players" USING btree ("match_id","seat");--> statement-breakpoint
CREATE INDEX "match_players_user_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_round_idx" ON "matches" USING btree ("round_id","status");--> statement-breakpoint
CREATE INDEX "matches_tournament_idx" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_ratings_user_format_unique" ON "player_ratings" USING btree ("user_id","format");--> statement-breakpoint
CREATE INDEX "player_ratings_leaderboard_idx" ON "player_ratings" USING btree ("format","rating");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_unique" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_tournament_number_unique" ON "rounds" USING btree ("tournament_id","round_number");--> statement-breakpoint
CREATE INDEX "rounds_active_idx" ON "rounds" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_organizers_unique" ON "tournament_organizers" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "tournament_organizers_user_idx" ON "tournament_organizers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participants_unique" ON "tournament_participants" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "tournament_participants_tournament_idx" ON "tournament_participants" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "tournament_participants_user_idx" ON "tournament_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_access_key_unique" ON "tournaments" USING btree ("access_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_invite_token_unique" ON "tournaments" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "tournaments_discovery_idx" ON "tournaments" USING btree ("is_public","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "tournaments_owner_idx" ON "tournaments" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_structure_check" CHECK (
  "round_count" BETWEEN 1 AND 20
  AND "games_per_match" BETWEEN 1 AND 7
  AND "round_time_limit_minutes" BETWEEN 10 AND 240
  AND ("capacity" IS NULL OR "capacity" >= 2)
  AND ("top_cut_size" IS NULL OR "top_cut_size" IN (2, 4, 8, 16, 32, 64))
  AND (
    ("format" = 'commander' AND "commander_mode" IS NOT NULL)
    OR ("format" <> 'commander' AND "commander_mode" IS NULL AND "pod_size" IS NULL)
  )
  AND ("commander_mode" <> 'pods' OR "pod_size" IN (3, 4))
);--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_score_check" CHECK (
  "seat" > 0
  AND "games_won" >= 0
  AND "games_drawn" >= 0
  AND ("placement" IS NULL OR "placement" > 0)
);--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_number_check" CHECK ("round_number" > 0);--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_seed_rating_check" CHECK ("seed_rating" >= 0);
