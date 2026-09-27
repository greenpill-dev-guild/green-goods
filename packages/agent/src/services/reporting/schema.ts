import { BROWSER_AND_DELIVERY_TABLES } from "./schema-delivery";
import { IDENTITY_AND_INTAKE_TABLES } from "./schema-identity";
import { WORKFLOW_TABLES } from "./schema-workflow";

export interface ReportingMigration {
  version: number;
  name: string;
  statements: readonly string[];
}

/** Append-only. Each migration runs in one IMMEDIATE transaction with its `user_version` bump. */
export const REPORTING_MIGRATIONS: readonly ReportingMigration[] = [
  {
    version: 1,
    name: "reporting core",
    statements: [...IDENTITY_AND_INTAKE_TABLES, ...WORKFLOW_TABLES, ...BROWSER_AND_DELIVERY_TABLES],
  },
];
