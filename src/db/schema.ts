import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";

/** /auth — accounts */
export const accounts = pgTable("nc_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  dob: text("dob").notNull(),
  role: text("role").notNull().default("player"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** /auth — sessions (token based, httpOnly cookie) */
export const sessions = pgTable("nc_sessions", {
  token: text("token").primaryKey(),
  accountId: integer("account_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** /players — persistent profile */
export const profiles = pgTable("nc_profiles", {
  accountId: integer("account_id").primaryKey(),
  displayName: text("display_name").notNull().default("Rookie"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  money: integer("money").notNull().default(750),
  bank: integer("bank").notNull().default(2500),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  job: text("job").notNull().default("unemployed"),
  jobRank: integer("job_rank").notNull().default(0),
  wanted: integer("wanted").notNull().default(0),
  currentMap: text("current_map").notNull().default("novacity"),
  characterDone: integer("character_done").notNull().default(0),
  tutorialDone: integer("tutorial_done").notNull().default(0),
  character: jsonb("character").notNull().default({}),
  inventory: jsonb("inventory").notNull().default([]),
  vehicles: jsonb("vehicles").notNull().default([]),
  properties: jsonb("properties").notNull().default([]),
  jobXp: jsonb("job_xp").notNull().default({}),
  stats: jsonb("stats").notNull().default({}),
  achievements: jsonb("achievements").notNull().default([]),
  settings: jsonb("settings").notNull().default({}),
  transactions: jsonb("transactions").notNull().default([]),
  crimeHistory: jsonb("crime_history").notNull().default([]),
});

/** /multiplayer — live presence heartbeat */
export const presence = pgTable(
  "nc_presence",
  {
    accountId: integer("account_id").primaryKey(),
    username: text("username").notNull(),
    map: text("map").notNull().default("novacity"),
    x: doublePrecision("x").notNull().default(0),
    z: doublePrecision("z").notNull().default(0),
    heading: doublePrecision("heading").notNull().default(0),
    job: text("job").notNull().default("unemployed"),
    wanted: integer("wanted").notNull().default(0),
    inVehicle: text("in_vehicle").notNull().default(""),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("nc_presence_updated_idx").on(t.updatedAt)],
);

/** /dispatch — shared world events between all connected players */
export const worldEvents = pgTable(
  "nc_world_events",
  {
    id: serial("id").primaryKey(),
    map: text("map").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: integer("priority").notNull().default(2),
    department: text("department").notNull().default("police"),
    x: doublePrecision("x").notNull(),
    z: doublePrecision("z").notNull(),
    status: text("status").notNull().default("open"),
    assigned: jsonb("assigned").notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("nc_events_map_idx").on(t.map, t.status)],
);

/** /admin — server-wide announcements & moderation flags */
export const serverLog = pgTable("nc_server_log", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  actor: text("actor").notNull().default("system"),
  message: text("message").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
