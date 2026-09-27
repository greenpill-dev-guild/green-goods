import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { REPORTING_MIGRATIONS, type ReportingMigration } from "./schema";

/**
 * The reporting workflow keeps its own SQLite file beside the legacy agent database. The legacy
 * schema rewrites `user_version` on every open and holds custodial key material; these records
 * need a real migration version and must stay apart from that data.
 */
export class ReportingSchemaVersionError extends Error {}

export function openReportingDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { strict: true, create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  // Intake acknowledges a provider only after commit, so a commit must survive power loss.
  db.exec("PRAGMA synchronous = FULL");
  migrateReportingDatabase(db);
  return db;
}

export function migrateReportingDatabase(
  db: Database,
  migrations: readonly ReportingMigration[] = REPORTING_MIGRATIONS
): number {
  const { user_version: current } = db.query("PRAGMA user_version").get() as {
    user_version: number;
  };
  const latest = migrations.at(-1)?.version ?? 0;
  if (current > latest) {
    // An unknown future schema pauses service rather than guessing at its meaning.
    throw new ReportingSchemaVersionError(
      `Reporting database schema ${current} is newer than this build supports (${latest})`
    );
  }
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      for (const statement of migration.statements) db.exec(statement);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }).immediate();
  }
  return latest;
}

/** Runs synchronous work in one IMMEDIATE transaction; nested calls become savepoints. */
export function inTransaction<T>(db: Database, work: () => T): T {
  return db.transaction(work).immediate();
}
