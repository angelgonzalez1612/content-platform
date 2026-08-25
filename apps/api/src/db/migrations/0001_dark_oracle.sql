CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_slug_unique` ON `sites` (`slug`);--> statement-breakpoint
CREATE TABLE `alertas` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`alerta_status` text NOT NULL,
	`category_id` text,
	`alcaldia_slug` text,
	`updated_at` integer NOT NULL,
	`description` text NOT NULL,
	`updates` text DEFAULT '[]' NOT NULL,
	`seo` text,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alertas_slug_unique` ON `alertas` (`slug`);--> statement-breakpoint
CREATE TABLE `guias` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`dek` text NOT NULL,
	`group_slug` text NOT NULL,
	`category_id` text,
	`updated_at` integer NOT NULL,
	`reading_time` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`official_source` text,
	`quick_facts` text DEFAULT '[]' NOT NULL,
	`seo` text,
	`toc` text DEFAULT '[]' NOT NULL,
	`content` text DEFAULT '[]' NOT NULL,
	`faq` text DEFAULT '[]' NOT NULL,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guias_slug_unique` ON `guias` (`slug`);--> statement-breakpoint
CREATE TABLE `lamira_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`tag` text NOT NULL,
	`category_id` text,
	`evento_status` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`location` text NOT NULL,
	`alcaldia_slug` text,
	`price` text NOT NULL,
	`description` text NOT NULL,
	`organizer` text NOT NULL,
	`official_url` text,
	`seo` text,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lamira_eventos_slug_unique` ON `lamira_eventos` (`slug`);--> statement-breakpoint
CREATE TABLE `lamira_lugares` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`category_id` text,
	`alcaldia_slug` text NOT NULL,
	`colonia` text,
	`description` text NOT NULL,
	`seo` text,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lamira_lugares_slug_unique` ON `lamira_lugares` (`slug`);--> statement-breakpoint
CREATE TABLE `noticias` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`dek` text NOT NULL,
	`category_id` text,
	`alcaldia_slug` text,
	`colonia` text,
	`author_slug` text NOT NULL,
	`published_at` integer NOT NULL,
	`updated_at` integer,
	`reading_time` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_kind` text,
	`external_source` text,
	`youtube_id` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`seo` text,
	`toc` text DEFAULT '[]' NOT NULL,
	`content` text DEFAULT '[]' NOT NULL,
	`image_caption` text,
	`featured` integer DEFAULT false NOT NULL,
	`tag` text,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `noticias_slug_unique` ON `noticias` (`slug`);--> statement-breakpoint
CREATE TABLE `reportajes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`dek` text NOT NULL,
	`author_slug` text NOT NULL,
	`category_id` text,
	`published_at` integer NOT NULL,
	`reading_time` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`source_kind` text,
	`seo` text,
	`image_caption` text NOT NULL,
	`toc` text DEFAULT '[]' NOT NULL,
	`content` text DEFAULT '[]' NOT NULL,
	`category_data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reportajes_slug_unique` ON `reportajes` (`slug`);--> statement-breakpoint
CREATE TABLE `content_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`category_id` text,
	`mode` text NOT NULL,
	`source_context` text,
	`input_facts` text,
	`ai_model` text NOT NULL,
	`ai_output` text NOT NULL,
	`checks_run` text DEFAULT '[]' NOT NULL,
	`decision` text NOT NULL,
	`status_before` text,
	`status_after` text NOT NULL,
	`actor_id` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`tokens_used` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `site_id` text REFERENCES sites(id);--> statement-breakpoint
ALTER TABLE `categories` ADD `field_schema` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `places` ADD `category_data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `places` ADD `seo` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `canonical_url` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `og_image_url` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `category_data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `category_data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `seo` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `category_data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `rankings` ADD `seo` text;