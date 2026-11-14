CREATE TABLE "character_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"image" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"left_id" uuid NOT NULL,
	"right_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordered_friendship_pair" CHECK ("friendships"."left_id" < "friendships"."right_id"),
	CONSTRAINT "friendship_status" CHECK ("friendships"."status" in ('pending','accepted')),
	CONSTRAINT "friendship_requester" CHECK ("friendships"."requested_by" = "friendships"."left_id" or "friendships"."requested_by" = "friendships"."right_id")
);
--> statement-breakpoint
CREATE TABLE "game_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_not_self" CHECK ("game_invitations"."from_id" <> "game_invitations"."to_id"),
	CONSTRAINT "invitation_status" CHECK ("game_invitations"."status" in ('pending','accepted','declined','expired'))
);
--> statement-breakpoint
CREATE TABLE "game_session_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"continue_ready" boolean DEFAULT false NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"host_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"status" text DEFAULT 'LOBBY' NOT NULL,
	"scene" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_room_code_unique" UNIQUE("room_code"),
	CONSTRAINT "session_scene_range" CHECK ("game_sessions"."scene" >= 0),
	CONSTRAINT "session_status" CHECK ("game_sessions"."status" in ('LOBBY','STORY','MISSION_BRIEFING','MISSION_ACCEPTANCE','READY_TO_START','MISSION_STARTED','CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_scenes" (
	"id" integer PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_characters" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" text NOT NULL,
	"preset_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_characters_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "character_age_range" CHECK ("user_characters"."age" >= 21 and "user_characters"."age" <= 60),
	CONSTRAINT "character_gender" CHECK ("user_characters"."gender" in ('female','male','unspecified'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id")
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_left_id_users_id_fk" FOREIGN KEY ("left_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_right_id_users_id_fk" FOREIGN KEY ("right_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invitations" ADD CONSTRAINT "game_invitations_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invitations" ADD CONSTRAINT "game_invitations_from_id_users_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invitations" ADD CONSTRAINT "game_invitations_to_id_users_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_players" ADD CONSTRAINT "game_session_players_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_players" ADD CONSTRAINT "game_session_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_preset_id_character_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."character_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_unique" ON "friendships" USING btree ("left_id","right_id");--> statement-breakpoint
CREATE INDEX "friendships_right_idx" ON "friendships" USING btree ("right_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_game_invitation" ON "game_invitations" USING btree ("session_id","to_id") WHERE "game_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "invitations_recipient_idx" ON "game_invitations" USING btree ("to_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_player_unique" ON "game_session_players" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_session_per_user" ON "game_session_players" USING btree ("user_id") WHERE "game_session_players"."active" = true;--> statement-breakpoint
CREATE INDEX "session_members_idx" ON "game_session_players" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_host_idx" ON "game_sessions" USING btree ("host_id");