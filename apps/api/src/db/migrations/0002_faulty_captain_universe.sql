ALTER TABLE "places" ADD COLUMN "zone" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "rating" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;