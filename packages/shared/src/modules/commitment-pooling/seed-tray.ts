/**
 * The seeding tray: several commitments a steward composes in one sitting, sent
 * one after another.
 *
 * A row gets its id when it joins the tray and keeps it through every edit and
 * every send. The queue dedupes a creation by that id and the chain by the key
 * derived from it, so however many times a row is sent it can only ever become
 * one commitment. An id minted at send time is how a retry becomes a second one.
 *
 * One row is always in hand: the one the wizard's form holds. It joins `rows`
 * once its answers pass the composer's rules, which is why every move below
 * takes those answers and keeps them first.
 *
 * @module modules/commitment-pooling/seed-tray
 */

import type { CommitmentComposerValues } from "../../hooks/commitment-pooling/useCommitmentComposerForm";
import type { CommitmentSendReport } from "../../hooks/commitment-pooling/useCommitmentJobs";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { isSameAccount } from "./selectors";
import type { CommitmentProviderExposureRecord } from "./types-core";

export interface SeedTrayRow {
  /** Minted when the row joins the tray, never at send time. */
  clientCommitmentId: string;
  /** Answers that passed the composer's rules. */
  values: CommitmentComposerValues;
  /** The last send created nothing for this row. Cleared when its answers change. */
  notSent?: true;
}

export interface SeedTray {
  /** The kept rows, oldest first. */
  rows: readonly SeedTrayRow[];
  /** The row in hand. It is not in `rows` until its answers are kept. */
  currentId: string;
}

/** What one pass over the tray did, by row id. */
export interface SeedTraySendResult {
  sent: string[];
  failed: string[];
}

/**
 * Where one row stands in a pass: waiting its turn, being prepared, at the
 * wallet, confirming on the chain, or how it ended: created, queued to send
 * later (its row stays on the pool tab), or not sent.
 */
export type SeedRowStatus =
  | "waiting"
  | "preparing"
  | "wallet"
  | "confirming"
  | "created"
  | "later"
  | "not-sent";

export interface SeedRowProgress {
  clientCommitmentId: string;
  /** The row's name, as the steward wrote it. */
  title: string;
  status: SeedRowStatus;
  /** The transaction that carried it, once the wallet has returned one. */
  txHash: string | null;
}

/** What happens to one row during a pass. */
export type SeedRowEvent =
  | { type: "start" }
  | { type: "report"; report: CommitmentSendReport }
  | { type: "settled" }
  | { type: "failed" };

const ENDED = new Set<SeedRowStatus>(["created", "later", "not-sent"]);

/** Every row of a pass waiting its turn, in tray order. */
export function startSeedPass(rows: readonly SeedTrayRow[]): SeedRowProgress[] {
  return rows.map((row) => ({
    clientCommitmentId: row.clientCommitmentId,
    title: row.values.title,
    status: "waiting",
    txHash: null,
  }));
}

function nextRow(row: SeedRowProgress, event: SeedRowEvent): SeedRowProgress {
  if (ENDED.has(row.status)) return row;
  switch (event.type) {
    case "start":
      return { ...row, status: "preparing" };
    case "failed":
      return { ...row, status: "not-sent" };
    case "settled":
      // Resolved without saying how: it did not fail, so its row waits on the pool tab.
      return { ...row, status: "later" };
    case "report": {
      const { report } = event;
      switch (report.stage) {
        case "wallet":
          return { ...row, status: "wallet" };
        case "confirming":
          return { ...row, status: "confirming", txHash: report.txHash };
        case "landed":
          return { ...row, status: "created", txHash: report.txHash ?? row.txHash };
        case "queued":
          return { ...row, status: "later" };
      }
    }
  }
}

/** One row moves on; the others stay where they are. A row that ended stays ended. */
export function advanceSeedRow(
  pass: readonly SeedRowProgress[],
  clientCommitmentId: string,
  event: SeedRowEvent
): SeedRowProgress[] {
  return pass.map((row) =>
    row.clientCommitmentId === clientCommitmentId ? nextRow(row, event) : row
  );
}

export function startSeedTray(clientCommitmentId: string): SeedTray {
  return { rows: [], currentId: clientCommitmentId };
}

/** Composer answers hold only strings, numbers, booleans and lists of them. */
function sameAnswers(left: CommitmentComposerValues, right: CommitmentComposerValues): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Keep the answers of the row in hand: a new row joins the end, a known one keeps its place. */
export function keepCurrentRow(tray: SeedTray, values: CommitmentComposerValues): SeedTray {
  const known = tray.rows.some((row) => row.clientCommitmentId === tray.currentId);
  if (!known) {
    return { ...tray, rows: [...tray.rows, { clientCommitmentId: tray.currentId, values }] };
  }
  return {
    ...tray,
    rows: tray.rows.map((row) => {
      if (row.clientCommitmentId !== tray.currentId) return row;
      return sameAnswers(row.values, values)
        ? row
        : { clientCommitmentId: row.clientCommitmentId, values };
    }),
  };
}

/**
 * Keep the row in hand and start another with an id of its own. The wizard's
 * form carries the same answers over, so the new row starts as a copy.
 */
export function addAnotherRow(
  tray: SeedTray,
  values: CommitmentComposerValues,
  clientCommitmentId: string
): SeedTray {
  return { ...keepCurrentRow(tray, values), currentId: clientCommitmentId };
}

/** Keep the row in hand and take an earlier one back, to change its answers. */
export function takeUpRow(
  tray: SeedTray,
  values: CommitmentComposerValues,
  clientCommitmentId: string
): SeedTray {
  if (!tray.rows.some((row) => row.clientCommitmentId === clientCommitmentId)) return tray;
  return { ...keepCurrentRow(tray, values), currentId: clientCommitmentId };
}

/**
 * Drop a row. When the one in hand goes, the newest of the rest takes its place.
 * The last row is never dropped: an empty tray is a closed wizard.
 */
export function removeTrayRow(tray: SeedTray, clientCommitmentId: string): SeedTray {
  const rest = tray.rows.filter((row) => row.clientCommitmentId !== clientCommitmentId);
  if (clientCommitmentId !== tray.currentId) return { ...tray, rows: rest };
  const next = rest.at(-1);
  return next ? { rows: rest, currentId: next.clientCommitmentId } : tray;
}

/** The kept rows beside the one in hand. */
export function otherTrayRows(tray: SeedTray): readonly SeedTrayRow[] {
  return tray.rows.filter((row) => row.clientCommitmentId !== tray.currentId);
}

/** The kept answers of the row in hand, if it has any yet. */
export function currentTrayRow(tray: SeedTray): SeedTrayRow | undefined {
  return tray.rows.find((row) => row.clientCommitmentId === tray.currentId);
}

/**
 * Send the rows one after another. `send` rejects when nothing was created,
 * and may report where the row stands as it goes; `onRow` hears each row's
 * start, reports and ending, so a view can follow the pass row by row.
 *
 * Nothing ends the pass early, neither a row the chain refuses nor a wallet
 * prompt the steward declines: the rows are separate commitments, and what
 * happens to one says nothing about the next.
 */
export async function sendSeedTray(
  rows: readonly SeedTrayRow[],
  send: (row: SeedTrayRow, report: (event: CommitmentSendReport) => void) => Promise<unknown>,
  onRow?: (clientCommitmentId: string, event: SeedRowEvent) => void
): Promise<SeedTraySendResult> {
  const result: SeedTraySendResult = { sent: [], failed: [] };
  for (const row of rows) {
    const id = row.clientCommitmentId;
    onRow?.(id, { type: "start" });
    try {
      await send(row, (report) => onRow?.(id, { type: "report", report }));
      onRow?.(id, { type: "settled" });
      result.sent.push(row.clientCommitmentId);
    } catch (error) {
      onRow?.(id, { type: "failed" });
      // Recorded here so that moving on to the next row never loses why this one failed.
      logger.error("[seed-tray] a row was not sent", {
        clientCommitmentId: row.clientCommitmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      result.failed.push(row.clientCommitmentId);
    }
  }
  return result;
}

/**
 * The tray after a pass: what was sent leaves, what failed stays and says so,
 * and the hand moves to a row that is still here. Null when nothing is left.
 */
export function settleSeedTray(tray: SeedTray, result: SeedTraySendResult): SeedTray | null {
  const sent = new Set(result.sent);
  const failed = new Set(result.failed);
  const rows = tray.rows
    .filter((row) => !sent.has(row.clientCommitmentId))
    .map((row) => (failed.has(row.clientCommitmentId) ? { ...row, notSent: true as const } : row));
  const first = rows[0];
  if (!first) return null;
  const stillInHand = rows.some((row) => row.clientCommitmentId === tray.currentId);
  return { rows, currentId: stillInHand ? tray.currentId : first.clientCommitmentId };
}

/**
 * How many more open commitments the steward may hold in this pool, or null
 * while the numbers are not read yet. Unknown never refuses anything: the
 * registry enforces the cap whatever this says.
 *
 * `CommitmentRegistry.commitUnits` counts an open commitment against whoever is
 * to provide it, per pool. Offers still queued on this device have not been
 * counted by the chain yet, and will be.
 */
export function selectSeedTrayRoom(input: {
  /** The pool's `providerOpenCommitmentCap`. */
  cap: bigint | undefined;
  exposures:
    | readonly Pick<CommitmentProviderExposureRecord, "provider" | "openCommitmentCount">[]
    | null;
  viewer: Address | null | undefined;
  queuedOffers: number;
}): number | null {
  const { cap, exposures, viewer, queuedOffers } = input;
  if (cap === undefined || cap <= 0n || !exposures || !viewer) return null;
  const open = exposures.find((row) => isSameAccount(row.provider, viewer))?.openCommitmentCount;
  const room = cap - (open ?? 0n) - BigInt(queuedOffers);
  return room > 0n ? Number(room) : 0;
}

/**
 * Whether the tray fits the room. Only an offer uses any: the creator provides
 * it, so it is counted the moment it is created. A request is counted against
 * whoever takes it up, later.
 */
export function selectSeedTrayCapacity(input: {
  room: number | null;
  others: readonly SeedTrayRow[];
  currentDirection: CommitmentComposerValues["direction"];
}): { offers: number; full: boolean; over: boolean } {
  const { room, others, currentDirection } = input;
  const offers =
    others.filter((row) => row.values.direction === "OFFER").length +
    (currentDirection === "OFFER" ? 1 : 0);
  return {
    offers,
    /** One more offer would not fit. */
    full: room !== null && offers >= room,
    /** The offers already here do not fit. */
    over: room !== null && offers > room,
  };
}
