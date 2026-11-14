CREATE TABLE "event_completion" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "raffle_prize" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raffle_prize_quantity_positive" CHECK ("raffle_prize"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "raffle_win" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_prize_id" text NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "prize_title" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "prize_description" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "raffle_drawn_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_completion" ADD CONSTRAINT "event_completion_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completion" ADD CONSTRAINT "event_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prize" ADD CONSTRAINT "raffle_prize_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_win" ADD CONSTRAINT "raffle_win_raffle_prize_id_raffle_prize_id_fk" FOREIGN KEY ("raffle_prize_id") REFERENCES "public"."raffle_prize"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_win" ADD CONSTRAINT "raffle_win_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_win" ADD CONSTRAINT "raffle_win_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_completion_user_event_idx" ON "event_completion" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "event_completion_event_idx" ON "event_completion" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_prize_event_title_idx" ON "raffle_prize" USING btree ("event_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_win_event_user_idx" ON "raffle_win" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "badge_redemption_event_idx" ON "badge_redemption" USING btree ("event_id");