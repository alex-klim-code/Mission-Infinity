import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessions, users } from "./game";

export const gameSessionMessages = pgTable("game_session_messages", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  senderName: text("sender_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [index("session_messages_timeline_idx").on(t.sessionId, t.createdAt, t.id)]);

export const insertGameSessionMessageSchema = createInsertSchema(gameSessionMessages);
export type InsertGameSessionMessage = z.infer<typeof insertGameSessionMessageSchema>;
export type GameSessionMessage = typeof gameSessionMessages.$inferSelect;
