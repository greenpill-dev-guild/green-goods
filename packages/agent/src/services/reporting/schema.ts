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
];
