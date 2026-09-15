CREATE TABLE `radar_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`hints` text DEFAULT '' NOT NULL,
	`category_label` text,
	`sites` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `radar_topics_title_unique` ON `radar_topics` (`title`);