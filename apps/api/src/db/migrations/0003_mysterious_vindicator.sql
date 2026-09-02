CREATE TABLE `locations` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL
);
