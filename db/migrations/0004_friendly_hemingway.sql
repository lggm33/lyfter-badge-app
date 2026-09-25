CREATE TABLE "qr_display" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"badge_id" text,
	"link_token_hash" text NOT NULL,
	"device_token_hash" text,
	"expires_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qr_display_link_token_hash_unique" UNIQUE("link_token_hash"),
	CONSTRAINT "qr_display_device_token_hash_unique" UNIQUE("device_token_hash")
);
--> statement-breakpoint
ALTER TABLE "qr_display" ADD CONSTRAINT "qr_display_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_display" ADD CONSTRAINT "qr_display_badge_id_badge_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge"("id") ON DELETE cascade ON UPDATE no action;