import { Database, type SQLQueryBindings } from "bun:sqlite";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openReportingDatabase } from "../../services/reporting/database";
import { REPORTING_MIGRATIONS } from "../../services/reporting/schema";
import { TAS } from "./support/fixtures";
import { ADA, Harness } from "./support/harness";
import { confirmedKernelReport, KERNEL, prepareActivation } from "./support/activation";

let harness: Harness;
let upgraded: Database;
let rollbackPath: string;
beforeEach(async () => {
  harness = new Harness();
  harness.chain.kernels.add(KERNEL);
  harness.chain.grantRole(TAS.address, KERNEL, { gardener: true });
  harness.delegationModules.push({
    moduleRef: "kernel-0.3.1-permission-v0.0.4",
    chainId: 42161,
    validatorAddress: "0x0000000000000000000000000000000000007a11",
    validatorCodeHash: `0x${"ab".repeat(32)}`,
  });
  await confirmedKernelReport(harness);
  await harness.press(ADA, "Allow reporting in chat");
  const prepared = await prepareActivation(harness);
  harness.core.db.query("UPDATE execution_attempts SET authorization_mode = 'delegated'").run();
  harness.core.db
    .query(`INSERT INTO attempt_outcomes VALUES ($attempt, 'historical-outcome', 'historical-digest',
    'uncertain', '{"ok":true,"attemptState":"uncertain"}', 1)`)
    .run({ attempt: prepared.signatureBody.attemptId });
  const path = join(harness.dir, "legacy.db");
  const old = new Database(path, { create: true, strict: true });
  for (const migration of REPORTING_MIGRATIONS.slice(0, 2))
    for (const sql of migration.statements) old.exec(sql);
  // Copy genuine workflow fixtures into the exact historical schema; dependency ordering is already
  // checked when the upgraded connection enables foreign keys and runs foreign_key_check below.
  const tables = old.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
    name: string;
  }>;
  for (const { name } of tables)
    for (const row of harness.core.db.query(`SELECT * FROM "${name}"`).all() as Record<
      string,
      SQLQueryBindings
    >[]) {
      const columns = Object.keys(row);
      old
        .query(
          `INSERT INTO "${name}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`
        )
        .run(...Object.values(row));
    }
  old.exec("PRAGMA user_version = 2");
  old.close();
  rollbackPath = join(harness.dir, "rollback.db");
  copyFileSync(path, rollbackPath);
  upgraded = openReportingDatabase(path);
});
afterEach(() => {
  upgraded?.close();
  harness.close();
});

describe("populated reporting v2 upgrade", () => {
  it("preserves historical attempts, outcome replay records, budgets and foreign keys", () => {
    expect(upgraded.query("PRAGMA user_version").get()).toEqual({ user_version: 4 });
    expect(upgraded.query("PRAGMA foreign_key_check").all()).toEqual([]);
    for (const table of ["execution_attempts", "attempt_outcomes", "execution_grants"])
      expect(upgraded.query(`SELECT * FROM ${table}`).all()).toEqual(
        harness.core.db.query(`SELECT * FROM ${table}`).all()
      );
  });
  it("keeps owner attempts unable to claim a grant", () => {
    expect(() =>
      upgraded.query("UPDATE execution_attempts SET authorization_mode = 'owner'").run()
    ).toThrow();
    expect(upgraded.query("SELECT authorization_mode FROM execution_attempts").get()).toEqual({
      authorization_mode: "delegated",
    });
  });
  it("keeps delegated and activation attempts unable to omit their grant", () => {
    expect(() =>
      upgraded.query("UPDATE execution_attempts SET execution_grant_id = NULL").run()
    ).toThrow();
    upgraded.query("UPDATE execution_attempts SET authorization_mode = 'activation'").run();
    expect(() =>
      upgraded.query("UPDATE execution_attempts SET execution_grant_id = NULL").run()
    ).toThrow();
  });
  it("preserves unresolved-attempt uniqueness and outcome parent deletion protection", () => {
    expect(() => upgraded.query("DELETE FROM execution_attempts").run()).toThrow();
    const attempt = upgraded.query("SELECT id FROM execution_attempts").get() as { id: string };
    expect(() =>
      upgraded
        .query(`INSERT INTO execution_attempts SELECT 'duplicate', operation_id, attempt_number + 1,
      authorization_mode, execution_grant_id, policy_digest, payload_digest, identity_epoch, expected_account, from_block,
      nonce_ref, signed_operation_ciphertext, user_operation_hash, transaction_hash, gas_reserved, state, reason_code,
      submitted_at, resolved_at, observed_block_hash, attested_log_index, created_at, updated_at
      FROM execution_attempts WHERE id = $id`)
        .run({ id: attempt.id })
    ).toThrow();
  });
  it("rolls a mid-migration failure back with historical constraints, rows and schema version intact", () => {
    const statements = REPORTING_MIGRATIONS[2]!.statements as string[];
    statements.push("INSERT INTO deliberately_missing_migration_table VALUES (1)");
    try {
      expect(() => openReportingDatabase(rollbackPath)).toThrow();
    } finally {
      statements.pop();
    }
    const preserved = new Database(rollbackPath, { strict: true });
    preserved.exec("PRAGMA foreign_keys = ON");
    expect(preserved.query("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(preserved.query("PRAGMA foreign_key_check").all()).toEqual([]);
    for (const table of ["execution_attempts", "attempt_outcomes", "execution_grants"])
      expect(preserved.query(`SELECT * FROM ${table}`).all()).toEqual(
        harness.core.db.query(`SELECT * FROM ${table}`).all()
      );
    expect(() =>
      preserved.query("UPDATE execution_attempts SET authorization_mode = 'activation'").run()
    ).toThrow();
    preserved.close();
    const retried = openReportingDatabase(rollbackPath);
    expect(retried.query("PRAGMA user_version").get()).toEqual({ user_version: 4 });
    retried.close();
  });
});
