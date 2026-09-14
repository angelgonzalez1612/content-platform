CREATE TABLE `search_phrases` (
	`id` text PRIMARY KEY NOT NULL,
	`phrase` text NOT NULL,
	`category_label` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`candidate_links` text DEFAULT '[]' NOT NULL,
	`researched_at` integer,
	`chosen_url` text,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_phrases_phrase_unique` ON `search_phrases` (`phrase`);