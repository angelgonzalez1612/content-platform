PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` integer,
	`end_date` integer,
	`place_id` text,
	`category_id` text,
	`location_name` text,
	`alcaldia_slug` text,
	`image_url` text,
	`image_credit` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`category_data` text DEFAULT '{}' NOT NULL,
	`seo` text,
	`content` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "slug", "name", "description", "start_date", "end_date", "place_id", "category_id", "location_name", "alcaldia_slug", "image_url", "image_credit", "status", "category_data", "seo", "content", "created_at") SELECT "id", "slug", "name", "description", "start_date", "end_date", "place_id", "category_id", "location_name", "alcaldia_slug", "image_url", "image_credit", "status", "category_data", "seo", "content", "created_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);