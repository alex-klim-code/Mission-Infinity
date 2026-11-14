ALTER TABLE "user_characters" DROP CONSTRAINT "character_age_range";--> statement-breakpoint
ALTER TABLE "user_characters" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "user_characters" ADD COLUMN "appearance" jsonb;--> statement-breakpoint
ALTER TABLE "user_characters" ADD CONSTRAINT "character_age_range" CHECK ("user_characters"."age" >= 14 and "user_characters"."age" <= 60);