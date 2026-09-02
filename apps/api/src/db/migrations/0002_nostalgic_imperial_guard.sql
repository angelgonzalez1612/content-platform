ALTER TABLE `places` ADD `alcaldia_slug` text;--> statement-breakpoint
ALTER TABLE `events` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `events` ADD `alcaldia_slug` text;
