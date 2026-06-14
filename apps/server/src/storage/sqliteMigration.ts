import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db.js";

const sqliteDir = path.join(dataDir, "sqlite");

function sqlString(value: unknown) {
  if (value === undefined || value === null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonValue(value: unknown) {
  return sqlString(JSON.stringify(value ?? null));
}

async function readJson<T>(filename: string, fallback: T) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, filename), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function exportSqliteMigration() {
  await fs.mkdir(sqliteDir, { recursive: true });
  const schema = `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  layer TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  priority TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  source_run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_history (
  run_id TEXT PRIMARY KEY,
  input TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  default_options_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS long_term_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  horizon TEXT NOT NULL,
  status TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  review_cycle TEXT NOT NULL,
  next_review_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS periodic_reviews (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  wins_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  next_actions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

  const memories = await readJson<Record<string, unknown>[]>("memories.json", []);
  const conversations = await readJson<Record<string, unknown>[]>("conversations.json", []);
  const calendar = await readJson<Record<string, unknown>[]>("calendar-events.json", []);
  const runs = await readJson<Record<string, unknown>[]>("run-history.json", []);
  const templates = await readJson<Record<string, unknown>[]>("scenario-templates.json", []);
  const goals = await readJson<Record<string, unknown>[]>("long-term-goals.json", []);
  const reviews = await readJson<Record<string, unknown>[]>("periodic-reviews.json", []);

  const inserts = [
    ...memories.map(
      (item) =>
        `INSERT OR REPLACE INTO memories VALUES (${sqlString(item.id)}, ${sqlString(item.type)}, ${sqlString(item.key)}, ${sqlString(item.value)}, ${item.confidence ?? 0}, ${sqlString(item.source)}, ${sqlString(item.status ?? "active")}, ${sqlString(item.layer ?? "long")}, ${item.hitCount ?? 0}, ${sqlString(item.lastHitAt)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    ),
    ...conversations.map(
      (item) =>
        `INSERT OR REPLACE INTO conversations VALUES (${sqlString(item.id)}, ${sqlString(item.title)}, ${jsonValue(item.messages)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    ),
    ...calendar.map(
      (item) =>
        `INSERT OR REPLACE INTO calendar_events VALUES (${sqlString(item.id)}, ${sqlString(item.taskId)}, ${sqlString(item.title)}, ${sqlString(item.start)}, ${sqlString(item.end)}, ${sqlString(item.priority)}, ${sqlString(item.description)}, ${sqlString(item.source)}, ${sqlString(item.sourceRunId)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    ),
    ...runs.map(
      (item) =>
        `INSERT OR REPLACE INTO run_history VALUES (${sqlString(item.runId)}, ${sqlString(item.input)}, ${jsonValue(item)}, ${sqlString(item.createdAt)});`
    ),
    ...templates.map(
      (item) =>
        `INSERT OR REPLACE INTO scenario_templates VALUES (${sqlString(item.id)}, ${sqlString(item.title)}, ${sqlString(item.category)}, ${sqlString(item.prompt)}, ${jsonValue(item.defaultOptions)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    ),
    ...goals.map(
      (item) =>
        `INSERT OR REPLACE INTO long_term_goals VALUES (${sqlString(item.id)}, ${sqlString(item.title)}, ${sqlString(item.description)}, ${sqlString(item.horizon)}, ${sqlString(item.status)}, ${jsonValue(item.tags)}, ${sqlString(item.reviewCycle)}, ${sqlString(item.nextReviewAt)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    ),
    ...reviews.map(
      (item) =>
        `INSERT OR REPLACE INTO periodic_reviews VALUES (${sqlString(item.id)}, ${sqlString(item.goalId)}, ${sqlString(item.title)}, ${sqlString(item.summary)}, ${jsonValue(item.wins)}, ${jsonValue(item.blockers)}, ${jsonValue(item.nextActions)}, ${sqlString(item.createdAt)}, ${sqlString(item.updatedAt)});`
    )
  ].join("\n");

  await fs.writeFile(path.join(sqliteDir, "schema.sql"), schema, "utf8");
  await fs.writeFile(
    path.join(sqliteDir, "seed.sql"),
    `${schema}\n\nBEGIN TRANSACTION;\n${inserts}\nCOMMIT;\n`,
    "utf8"
  );
  return { schema: path.join(sqliteDir, "schema.sql"), seed: path.join(sqliteDir, "seed.sql") };
}

if (process.argv[1]?.endsWith("sqliteMigration.ts") || process.argv[1]?.endsWith("sqliteMigration.js")) {
  const result = await exportSqliteMigration();
  console.log(`SQLite migration files written:\n${result.schema}\n${result.seed}`);
}
