CREATE TABLE `bankroll_log` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text NOT NULL,
	`table_id` text NOT NULL,
	`hand_number` integer NOT NULL,
	`agent_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`buy_in` integer NOT NULL,
	`final_stack` integer NOT NULL,
	`delta` integer NOT NULL,
	`bankroll_after` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `bankroll` integer DEFAULT 1000 NOT NULL;