CREATE TABLE `content_radar_published` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`site` text,
	`content_type` text,
	`content_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_radar_published_title_unique` ON `content_radar_published` (`title`);