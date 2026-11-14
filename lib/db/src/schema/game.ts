import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, check } from "drizzle-orm/pg-core";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").notNull().unique(),
  createdAt: created(),
});

export const characterPresets = pgTable("character_presets", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  image: text("image").notNull(),
});

export const userCharacters = pgTable("user_characters", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  presetId: text("preset_id").notNull().references(() => characterPresets.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("character_age_range", sql`${t.age} >= 21 and ${t.age} <= 60`),
  check("character_gender", sql`${t.gender} in ('female','male','unspecified')`),
]);

export const missions = pgTable("missions", {
  id: text("id").primaryKey(),
  definition: jsonb("definition").notNull(),
});

export const storyScenes = pgTable("story_scenes", {
  id: integer("id").primaryKey(),
  definition: jsonb("definition").notNull(),
});

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  leftId: uuid("left_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rightId: uuid("right_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: created(),
}, t => [
  uniqueIndex("friendship_pair_unique").on(t.leftId, t.rightId),
  index("friendships_right_idx").on(t.rightId),
  check("ordered_friendship_pair", sql`${t.leftId} < ${t.rightId}`),
  check("friendship_status", sql`${t.status} in ('pending','accepted')`),
  check("friendship_requester", sql`${t.requestedBy} = ${t.leftId} or ${t.requestedBy} = ${t.rightId}`),
]);

export const gameSessions = pgTable("game_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: text("room_code").notNull().unique(),
  hostId: uuid("host_id").notNull().references(() => users.id),
  missionId: text("mission_id").notNull().references(() => missions.id),
  status: text("status").notNull().default("LOBBY"),
  scene: integer("scene").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  createdAt: created(),
}, t => [
  index("sessions_host_idx").on(t.hostId),
  check("session_scene_range", sql`${t.scene} >= 0`),
  check("session_status", sql`${t.status} in ('LOBBY','STORY','MISSION_BRIEFING','MISSION_ACCEPTANCE','READY_TO_START','MISSION_STARTED','CLOSED')`),
]);

export const gameSessionPlayers = pgTable("game_session_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  active: boolean("active").notNull().default(true),
  ready: boolean("ready").notNull().default(false),
  continueReady: boolean("continue_ready").notNull().default(false),
  accepted: boolean("accepted").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("session_player_unique").on(t.sessionId, t.userId),
  uniqueIndex("one_active_session_per_user").on(t.userId).where(sql`${t.active} = true`),
  index("session_members_idx").on(t.sessionId),
]);

export const gameInvitations = pgTable("game_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  fromId: uuid("from_id").notNull().references(() => users.id),
  toId: uuid("to_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
}, t => [
  uniqueIndex("one_pending_game_invitation").on(t.sessionId, t.toId).where(sql`${t.status} = 'pending'`),
  index("invitations_recipient_idx").on(t.toId, t.status),
  check("invitation_not_self", sql`${t.fromId} <> ${t.toId}`),
  check("invitation_status", sql`${t.status} in ('pending','accepted','declined','expired')`),
]);
