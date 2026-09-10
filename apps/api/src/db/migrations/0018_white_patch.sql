CREATE TABLE `planazo_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text,
	`intro` text,
	`sections` text DEFAULT '[]' NOT NULL,
	`category_label` text NOT NULL,
	`read_time` text NOT NULL,
	`image_url` text,
	`image_alt` text,
	`image_credit` text,
	`excerpt` text,
	`budget` text,
	`duration` text,
	`audience` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planazo_guides_slug_unique` ON `planazo_guides` (`slug`);