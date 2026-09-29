import { type ChannelControl, channelControl, REPORTING_CHANNELS } from "./channels";
import { inTransaction } from "./database";
import type { ReportingCore } from "./runtime";

/**
 * Independent operating switches, changed at runtime through the operator routes. Intake pause
 * stops new domain intake; model pause falls back to deterministic questions; the documents and
 * voice switches decide whether PDFs, Word files and voice notes are read at all; each chat
 * channel takes reports only while its `channel_<name>` switch is on; publication pause fences
 * unsent reservations; message pause holds the outbox. Provider statuses, execution outcomes and
 * receipt reconciliation keep running under every pause, and a pause can never revoke bytes
 * already signed or broadcast.
 */
export type ControlName =
  | "intake"
  | "model_processing"
  | "documents"
  | "voice"
  | "publication"
  | "outbound_messages"
  | ChannelControl;

export const CONTROL_NAMES: readonly ControlName[] = [
  "intake",
  "model_processing",
  "documents",
  "voice",
  "publication",
  "outbound_messages",
  ...REPORTING_CHANNELS.map(channelControl),
];

/** A new database starts with everything off but replies; each switch is an operator decision. */
export const INITIAL_CONTROLS: Readonly<Record<ControlName, boolean>> = {
  intake: false,
  model_processing: false,
  documents: false,
  voice: false,
  publication: false,
  outbound_messages: true,
  channel_whatsapp: false,
  channel_telegram: false,
};

export interface ControlState {
  enabled: boolean;
  version: number;
}

interface ControlRow {
  enabled: number;
  version: number;
}

/** Seeds missing switches; an existing operator decision survives restarts. */
export function ensureControls(
  core: ReportingCore,
  defaults: Readonly<Record<ControlName, boolean>>
): void {
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
