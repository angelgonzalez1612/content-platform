CREATE TABLE `auth_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer,
	`updated_at` integer NOT NULL
);
