import { inTransaction } from "./database";
import type { ReportingCore } from "./runtime";

/**
 * Independent operating switches. Intake pause stops new domain intake; model pause falls back to
 * deterministic questions; publication pause fences unsent reservations; message pause holds the
 * outbox. Provider statuses, execution outcomes and receipt reconciliation keep running under
 * every pause, and a pause can never revoke bytes already signed or broadcast.
 */
export type ControlName = "intake" | "model_processing" | "publication" | "outbound_messages";

export const CONTROL_NAMES: readonly ControlName[] = [
  "intake",
  "model_processing",
  "publication",
  "outbound_messages",
];

export interface ControlState {
  enabled: boolean;
  version: number;
}

interface ControlRow {
  enabled: number;
  version: number;
}

/** Seeds missing switches; an existing operator decision survives restarts. */
export function ensureControls(core: ReportingCore, defaults: Record<ControlName, boolean>): void {
  inTransaction(core.db, () => {
    for (const name of CONTROL_NAMES) {
      core.db
        .query(
          `INSERT OR IGNORE INTO operating_controls (name, enabled, version, updated_by, updated_at)
           VALUES ($name, $enabled, 1, 'configuration', $now)`
        )
        .run({ name, enabled: defaults[name] ? 1 : 0, now: core.clock.now() });
    }
  });
}

export function readControl(core: ReportingCore, name: ControlName): ControlState {
  const row = core.db
    .query("SELECT enabled, version FROM operating_controls WHERE name = $name")
    .get({ name }) as ControlRow | null;
  // An unseeded switch is closed: a missing setting never selects an unrestricted default.
  return row
    ? { enabled: row.enabled === 1, version: row.version }
    : { enabled: false, version: 0 };
}

export function setControl(
  core: ReportingCore,
  name: ControlName,
  enabled: boolean,
  change: { actor: string; reason: string }
): ControlState {
  return inTransaction(core.db, () => {
    core.db
      .query(
        `UPDATE operating_controls
         SET enabled = $enabled, version = version + 1, reason = $reason,
             updated_by = $actor, updated_at = $now
         WHERE name = $name`
      )
      .run({
        name,
        enabled: enabled ? 1 : 0,
        reason: change.reason,
        actor: change.actor,
        now: core.clock.now(),
      });
    core.db
      .query(
        `INSERT INTO audit_events (id, kind, subject_kind, subject_id, detail_json, created_at)
         VALUES ($id, 'control_changed', 'control', $name, $detail, $now)`
      )
      .run({
        id: core.ids.id(),
        name,
        detail: JSON.stringify({ enabled, actor: change.actor }),
        now: core.clock.now(),
      });
    return readControl(core, name);
  });
}
