CREATE TABLE "badge_redemption" (
	"id" text PRIMARY KEY NOT NULL,
	"badge_id" text NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"redemption_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xp_ledger_redemption_id_unique" UNIQUE("redemption_id")
);
--> statement-breakpoint
ALTER TABLE "badge_redemption" ADD CONSTRAINT "badge_redemption_badge_id_badge_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_redemption" ADD CONSTRAINT "badge_redemption_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_redemption" ADD CONSTRAINT "badge_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_redemption_id_badge_redemption_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."badge_redemption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badge_redemption_user_badge_idx" ON "badge_redemption" USING btree ("user_id","badge_id");