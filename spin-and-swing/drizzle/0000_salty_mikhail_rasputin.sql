CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` integer PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`salt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
