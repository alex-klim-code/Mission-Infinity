CREATE TABLE "avatar_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"size" integer NOT NULL,
	"upload_path" text NOT NULL,
	"asset_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_upload_kind" CHECK ("avatar_uploads"."kind" in ('model','portrait')),
	CONSTRAINT "avatar_upload_size" CHECK ("avatar_uploads"."size" >= 20 and "avatar_uploads"."size" <= 20971520)
);
--> statement-breakpoint
ALTER TABLE "user_characters" ADD COLUMN "avatar_3d" jsonb;--> statement-breakpoint
ALTER TABLE "avatar_uploads" ADD CONSTRAINT "avatar_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avatar_uploads_owner_idx" ON "avatar_uploads" USING btree ("user_id","created_at");