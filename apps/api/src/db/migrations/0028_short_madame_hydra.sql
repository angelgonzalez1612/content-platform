ALTER TABLE `automation_state` ADD `lock_owner` text;--> statement-breakpoint
ALTER TABLE `automation_state` ADD `lock_expires_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;
