CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text NOT NULL,
	`table_id` text NOT NULL,
	`seat_index` integer NOT NULL,
	`position` integer NOT NULL,
	`agent_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`street` text NOT NULL,
	`seq` integer NOT NULL,
	`payment_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`archetype` text NOT NULL,
	`did` text NOT NULL,
	`address` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `balances` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`label` text,
	`owner_type` text,
	`currency` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hands` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`number` integer NOT NULL,
	`seed` text NOT NULL,
	`button` integer NOT NULL,
	`small_blind` integer NOT NULL,
	`big_blind` integer NOT NULL,
	`board` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'in-progress' NOT NULL,
	`seed_receipt_id` text,
	`referee_receipt_id` text,
	`commentary_receipt_id` text,
	`referee_valid` integer,
	`history` text,
	`winners` text,
	`commentary` text,
	`started_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`idempotency_key` text,
	`kind` text,
	`intent` text NOT NULL,
	`from_id` text NOT NULL,
	`from_address` text NOT NULL,
	`from_label` text NOT NULL,
	`to_id` text NOT NULL,
	`to_address` text NOT NULL,
	`to_label` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`reference` text NOT NULL,
	`tx_hash` text,
	`status` text NOT NULL,
	`hand_id` text,
	`service` text,
	`unlocks` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receipt_graphs` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text NOT NULL,
	`table_id` text NOT NULL,
	`nodes` text NOT NULL,
	`edges` text NOT NULL,
	`summary` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`method` text NOT NULL,
	`intent` text NOT NULL,
	`reference` text NOT NULL,
	`settlement_amount` integer NOT NULL,
	`settlement_currency` text NOT NULL,
	`status` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`idempotency_key` text,
	`source` text NOT NULL,
	`recipient` text NOT NULL,
	`channel_id` text,
	`raw` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text,
	`service` text NOT NULL,
	`provider_id` text NOT NULL,
	`request` text,
	`response` text,
	`payment_id` text,
	`receipt_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`table_id` text NOT NULL,
	`currency` text NOT NULL,
	`deposit` integer NOT NULL,
	`max_deposit` integer NOT NULL,
	`spent` integer DEFAULT 0 NOT NULL,
	`units` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`max_seats` integer NOT NULL,
	`starting_chips` integer NOT NULL,
	`small_blind` integer NOT NULL,
	`big_blind` integer NOT NULL,
	`seat_fee` integer NOT NULL,
	`per_hand_fee` integer NOT NULL,
	`per_action_fee` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`hands_played` integer DEFAULT 0 NOT NULL,
	`wallet_address` text NOT NULL,
	`created_at` text NOT NULL
);
