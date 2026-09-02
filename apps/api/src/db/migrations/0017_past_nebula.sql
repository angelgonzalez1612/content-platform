ALTER TABLE `automation_rules` ADD `include_search_phrases` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_runs` ADD `source` text DEFAULT 'report' NOT NULL;