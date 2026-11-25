CREATE TABLE "scan_hold" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scan_hold_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "scan_hold_kind_known" CHECK ("scan_hold"."kind" IN ('badge', 'checkin'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disabled_at" timestamp;