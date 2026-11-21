CREATE TABLE "event_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "modality" text;--> statement-breakpoint
ALTER TABLE "event_photo" ADD CONSTRAINT "event_photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_photo_event_created_idx" ON "event_photo" USING btree ("event_id","created_at");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_modality_known" CHECK ("event"."modality" IS NULL OR "event"."modality" IN ('IN_PERSON', 'VIRTUAL', 'HYBRID'));