import { BROWSER_AND_DELIVERY_TABLES } from "./schema-delivery";
import { IDENTITY_AND_INTAKE_TABLES } from "./schema-identity";
import { WORKFLOW_TABLES } from "./schema-workflow";

export interface ReportingMigration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * SQLite cannot change a CHECK constraint in place, so the switch list is rebuilt: existing rows,
 * with their operator decisions and versions, are copied into a table that also accepts the
 * document and voice switches and one `channel_<name>` switch per chat channel.
 */
const DOCUMENT_VOICE_AND_CHANNEL_CONTROLS: readonly string[] = [
  `CREATE TABLE operating_controls_next (
    name TEXT PRIMARY KEY CHECK (
      name IN ('intake','model_processing','documents','voice','publication','outbound_messages')
      OR name GLOB 'channel_[a-z]*'
    ),
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    version INTEGER NOT NULL CHECK (version >= 1),
    reason TEXT,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `INSERT INTO operating_controls_next (name, enabled, version, reason, updated_by, updated_at)
   SELECT name, enabled, version, reason, updated_by, updated_at FROM operating_controls`,
  "DROP TABLE operating_controls",
  "ALTER TABLE operating_controls_next RENAME TO operating_controls",
];

/** Preserve historical attempts and outcomes while naming the dual-authority first-report send. */
const ACTIVATION_ATTEMPTS: readonly string[] = [
  "CREATE TEMP TABLE activation_outcomes_backup AS SELECT * FROM attempt_outcomes",
  "DROP TABLE attempt_outcomes",
  (WORKFLOW_TABLES.find((sql) => sql.startsWith("CREATE TABLE execution_attempts (")) as string)
    .replace("CREATE TABLE execution_attempts", "CREATE TABLE execution_attempts_next")
    .replace("('owner','delegated')", "('owner','delegated','activation')")
    .replace(
      "(authorization_mode = 'delegated')",
      "(authorization_mode IN ('delegated','activation'))"
    ),
  "INSERT INTO execution_attempts_next SELECT * FROM execution_attempts",
  "DROP TABLE execution_attempts",
  "ALTER TABLE execution_attempts_next RENAME TO execution_attempts",
  WORKFLOW_TABLES.find((sql) =>
    sql.startsWith("CREATE UNIQUE INDEX execution_attempts_one_unresolved")
  ) as string,
  WORKFLOW_TABLES.find((sql) => sql.startsWith("CREATE TABLE attempt_outcomes (")) as string,
  "INSERT INTO attempt_outcomes SELECT * FROM activation_outcomes_backup",
  "DROP TABLE activation_outcomes_backup",
];

/** Append-only. Each migration runs in one IMMEDIATE transaction with its `user_version` bump. */
export const REPORTING_MIGRATIONS: readonly ReportingMigration[] = [
  {
    version: 1,
    name: "reporting core",
    statements: [...IDENTITY_AND_INTAKE_TABLES, ...WORKFLOW_TABLES, ...BROWSER_AND_DELIVERY_TABLES],
  },
  {
    version: 2,
    name: "document, voice and channel controls",
    statements: DOCUMENT_VOICE_AND_CHANNEL_CONTROLS,
  },
  { version: 3, name: "first-report grant activation attempts", statements: ACTIVATION_ATTEMPTS },
];
