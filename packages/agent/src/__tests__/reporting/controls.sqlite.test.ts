import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureControls,
  INITIAL_CONTROLS,
  readControl,
  setControl,
} from "../../services/reporting/controls";
import { openReportingDatabase } from "../../services/reporting/database";
import { createReportingKeyring } from "../../services/reporting/keyring";
import {
  DEFAULT_REPORTING_SETTINGS,
  randomIds,
  type ReportingCore,
  systemClock,
} from "../../services/reporting/runtime";
import { REPORTING_MIGRATIONS } from "../../services/reporting/schema";
import { fixedGardens, TEST_KEYS } from "./support/fixtures";

/** Operator switches live in the database, so a schema upgrade must keep every earlier decision. */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gg-reporting-controls-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function coreFor(path: string): ReportingCore {
  return {
    db: openReportingDatabase(path),
    keyring: createReportingKeyring(TEST_KEYS),
    clock: systemClock,
    ids: randomIds,
    settings: {
      ...DEFAULT_REPORTING_SETTINGS,
      chainId: 42161,
      browserOrigin: "https://greengoods.test",
    },
    gardens: fixedGardens([]),
  };
}

describe("operator controls", () => {
  it("keeps earlier decisions when the document, voice and channel switches are added", () => {
    const path = join(dir, "reporting.db");
    const first = new Database(path, { create: true, strict: true });
    for (const statement of REPORTING_MIGRATIONS[0]?.statements ?? []) first.exec(statement);
    first.exec("PRAGMA user_version = 1");
    first
      .query(
        `INSERT INTO operating_controls (name, enabled, version, updated_by, updated_at)
         VALUES ('publication', 1, 3, 'operator', 1)`
      )
      .run();
    first.close();

    const core = coreFor(path);
    ensureControls(core, INITIAL_CONTROLS);
    expect(core.db.query("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(readControl(core, "publication")).toEqual({ enabled: true, version: 3 });
    expect(readControl(core, "voice")).toEqual({ enabled: false, version: 1 });
    expect(setControl(core, "voice", true, { actor: "operator", reason: "pilot" })).toEqual({
      enabled: true,
      version: 2,
    });
    expect(readControl(core, "channel_telegram")).toEqual({ enabled: false, version: 1 });
    expect(
      setControl(core, "channel_telegram", true, { actor: "operator", reason: "pilot" }).enabled
    ).toBe(true);
    core.db.close();
  });
});
