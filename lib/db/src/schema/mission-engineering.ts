import {pgTable,uuid,jsonb,integer,text,boolean,timestamp,index} from "drizzle-orm/pg-core";
import {gameSessions,users} from "./game";
export const gameSessionEngineering=pgTable("game_session_engineering",{
  sessionId:uuid("session_id").primaryKey().references(()=>gameSessions.id,{onDelete:"cascade"}),
  state:jsonb("state").notNull(),
});
export const gameSessionFundingRequests=pgTable("game_session_funding_requests",{
  id:uuid("id").primaryKey(),
  sessionId:uuid("session_id").notNull().references(()=>gameSessions.id,{onDelete:"cascade"}),
  userId:uuid("user_id").references(()=>users.id,{onDelete:"set null"}),
  amount:integer("amount").notNull(),
  reason:text("reason").notNull(),
  approved:boolean("approved").notNull(),
  submittedAt:timestamp("submitted_at",{withTimezone:true}).notNull().defaultNow(),
  decidedAt:timestamp("decided_at",{withTimezone:true}),
},t=>[index("funding_session_idx").on(t.sessionId)]);
