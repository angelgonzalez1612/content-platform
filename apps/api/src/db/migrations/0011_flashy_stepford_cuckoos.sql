CREATE TABLE `automation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`site` text,
	`category_slugs` text DEFAULT '[]' NOT NULL,
	`content_types` text DEFAULT '[]' NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`daily_limit` integer DEFAULT 3 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text,
	`rule_name` text,
	`ran_at` integer NOT NULL,
	`topic` text NOT NULL,
	`category_label` text,
	`site` text,
	`content_type` text,
	`outcome` text NOT NULL,
	`content_id` text,
	`detail` text,
	FOREIGN KEY (`rule_id`) REFERENCES `automation_rules`(`id`) ON UPDATE no action ON DELETE set null
);
