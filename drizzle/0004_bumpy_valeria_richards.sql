CREATE TABLE "user_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"format" "tournament_format" NOT NULL,
	"name" varchar(120) NOT NULL,
	"list_text" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_lists" ADD COLUMN "source_deck_id" uuid;--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_decks_owner_format_idx" ON "user_decks" USING btree ("user_id","format");--> statement-breakpoint
CREATE INDEX "user_decks_public_profile_idx" ON "user_decks" USING btree ("user_id","is_public","updated_at");--> statement-breakpoint
ALTER TABLE "deck_lists" ADD CONSTRAINT "deck_lists_source_deck_id_user_decks_id_fk" FOREIGN KEY ("source_deck_id") REFERENCES "public"."user_decks"("id") ON DELETE set null ON UPDATE no action;