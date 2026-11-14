import { Kysely, PostgresDialect, type Generated, type ColumnType, type Transaction } from "kysely";
import { pool } from "@workspace/db";
import type { CharacterAppearance, Avatar3D, SessionMessage } from "@workspace/api-zod";

type Time = ColumnType<Date, Date | string | undefined, Date | string>;
interface Users {
  id: Generated<string>;
  auth_id: string;
  created_at: Time;
}
interface Characters {
  user_id: string;
  name: string;
  normalized_name: string;
  age: number;
  gender: string;
  preset_id: string;
  country_code: string | null;
  appearance: CharacterAppearance | null;
  avatar_3d: Avatar3D | null;
  updated_at: Time;
}
interface Sessions {
  id: Generated<string>;
  room_code: string;
  host_id: string;
  mission_id: string;
  status: string;
  scene: Generated<number>;
  revision: Generated<number>;
  created_at: Time;
}
interface Members {
  id: Generated<string>;
  session_id: string;
  user_id: string;
  active: Generated<boolean>;
  ready: Generated<boolean>;
  continue_ready: Generated<boolean>;
  accepted: Generated<boolean>;
  last_message: SessionMessage | null;
  joined_at: Time;
}
interface Friends {
  id: Generated<string>;
  left_id: string;
  right_id: string;
  requested_by: string;
  status: Generated<string>;
  created_at: Time;
}
interface Invites {
  id: Generated<string>;
  session_id: string;
  from_id: string;
  to_id: string;
  status: Generated<string>;
  expires_at: Time;
  created_at: Time;
}
export interface GameDatabase {
  game_session_fuel_loads: {
    session_id: string;
    opened: Generated<boolean>;
    completed: Generated<boolean>;
    connected: Generated<boolean>;
    target_kg: Generated<number>;
    loaded_kg: Generated<number>;
    spent: Generated<number>;
    flowing_at: Date | null;
  };
  game_session_science_loadouts: {
    session_id: string;
    opened: Generated<boolean>;
    completed: Generated<boolean>;
    instrument_ids: Generated<string[]>;
    proposals: Generated<Record<string, string[]>>;
    spent: Generated<number>;
  };
  game_session_builds: {
    session_id: string;
    screen: Generated<string>;
    selected_hull_id: string | null;
    spent: Generated<number>;
    elapsed_months: Generated<number>;
    votes: Generated<Record<string, string>>;
  };
  game_session_rocket_assemblies: {
    session_id: string;
    selections: Generated<Record<string,string>>;
    proposals: Generated<Record<string,Record<string,string>>>;
    completed: Generated<boolean>;
  };
  game_session_messages: {
    id: string;
    session_id: string;
    user_id: string;
    sender_name: string;
    text: string;
    created_at: Time;
    expires_at: Time;
  };
  avatar_uploads: {
    id: Generated<string>;
    user_id: string;
    kind: "model" | "portrait";
    size: number;
    upload_path: string;
    asset_path: string | null;
    created_at: Time;
  };
  users: Users;
  user_characters: Characters;
  character_presets: { id: string; label: string; image: string };
  missions: { id: string; definition: unknown };
  story_scenes: { id: number; definition: unknown };
  friendships: Friends;
  game_sessions: Sessions;
  game_session_players: Members;
  game_invitations: Invites;
}
export const gameDb = new Kysely<GameDatabase>({ dialect: new PostgresDialect({ pool }) });
export type GameConnection = Kysely<GameDatabase> | Transaction<GameDatabase>;

export class GameError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export function requireCondition(condition: unknown, statusCode: number, message: string): asserts condition {
  if (!condition) throw new GameError(statusCode, message);
}
