import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "@/auth-schema";

export const company = pgTable("company", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyMember = pgTable(
  "company_member",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("company_member_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
  ],
);

export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    status: text("status").notNull().default("DRAFT"),
    prizeTitle: text("prize_title"), // null = no general prize
    prizeDescription: text("prize_description"),
    raffleDrawnAt: timestamp("raffle_drawn_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("event_company_slug_idx").on(table.companyId, table.slug)],
);

export const badge = pgTable(
  "badge",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    rarity: text("rarity").notNull(),
    icon: text("icon"),
    xp: integer("xp").notNull(),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("badge_event_name_idx").on(table.eventId, table.name)],
);

export const eventMembership = pgTable(
  "event_membership",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_membership_user_event_idx").on(table.userId, table.eventId),
  ],
);

export const badgeRedemption = pgTable(
  "badge_redemption",
  {
    id: text("id").primaryKey(),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badge.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("badge_redemption_user_badge_idx").on(table.userId, table.badgeId),
    index("badge_redemption_event_idx").on(table.eventId),
  ],
);

export const eventCompletion = pgTable(
  "event_completion",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  (table) => [
    uniqueIndex("event_completion_user_event_idx").on(table.userId, table.eventId),
    index("event_completion_event_idx").on(table.eventId),
  ],
);

export const rafflePrize = pgTable(
  "raffle_prize",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("raffle_prize_event_title_idx").on(table.eventId, table.title),
    check("raffle_prize_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const raffleWin = pgTable(
  "raffle_win",
  {
    id: text("id").primaryKey(),
    rafflePrizeId: text("raffle_prize_id")
      .notNull()
      .references(() => rafflePrize.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  // One prize per person per event.
  (table) => [uniqueIndex("raffle_win_event_user_idx").on(table.eventId, table.userId)],
);

export const xpLedger = pgTable("xp_ledger", {
  id: text("id").primaryKey(),
  redemptionId: text("redemption_id")
    .notNull()
    .unique()
    .references(() => badgeRedemption.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qrDisplay = pgTable("qr_display", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  badgeId: text("badge_id").references(() => badge.id, { onDelete: "cascade" }), // null = check-in
  linkTokenHash: text("link_token_hash").notNull().unique(),
  deviceTokenHash: text("device_token_hash").unique(),
  expiresAt: timestamp("expires_at").notNull(),
  claimedAt: timestamp("claimed_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
