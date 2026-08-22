/**
 * Pool console model
 *
 * The steward's read of one pool (uiux-spec §6.2, W7): what the pool is
 * doing, the one season and the campaigns beside it, what needs the steward,
 * and which rows the Open · Confirmed · Past chips hold. One answer derived
 * from the read models, so the view's cards render from it instead of each
 * re-asking the record.
 *
 * The status names say what is true for members, never the on-chain word
 * (`hifi/screens/admin.ts` W7 pool chip): the view maps them to copy.
 *
 * @module modules/commitment-pooling/pool-console
 */

import { selectDueLiveCommitments, selectPoolClosureEligibility } from "./selectors";
import type { CommitmentCycleRecord, CommitmentPoolRecord, CommitmentReadModel } from "./types";

export type PoolConsoleStatus =
  | "unregistered"
  | "not-ready"
  | "ready"
  | "open"
  | "paused"
  | "closed"
  | "composted"
  | "unknown";

export interface PoolConsoleModel {
  status: PoolConsoleStatus;
  /** The app-side preflight: charter written, non-zero cap. The chain checks the same two. */
  readiness: { charter: boolean; cap: boolean };
  /** First-run setup is offered until the pool has been marked ready. */
  canSetUp: boolean;
  /** The one non-terminal season, Seeded or Open. */
  season: CommitmentCycleRecord | null;
  /** Non-terminal campaigns, any number, beside the season. */
  campaigns: CommitmentCycleRecord[];
  /** Reconciled, Composted or Cancelled cycles, newest first. */
  finishedCycles: CommitmentCycleRecord[];
  /** A Ready or Open pool with no season running may seed one. */
  canSeedSeason: boolean;
  /** Campaigns need an Open pool. */
  canStartCampaign: boolean;
  closure: ReturnType<typeof selectPoolClosureEligibility>;
  /** Live and past their due: each carries Expire now. */
  dueLive: CommitmentReadModel[];
  counts: { claimsWaiting: number; needsRecovery: number; pastDue: number };
  groups: {
    open: CommitmentReadModel[];
    confirmed: CommitmentReadModel[];
    past: CommitmentReadModel[];
  };
  isPaused: boolean;
}

const TERMINAL_CYCLE_STATES = new Set<string>(["RECONCILED", "COMPOSTED", "CANCELLED"]);
const LIVE_COMMITMENT_STATES = new Set<string>([
  "OFFERED",
  "REQUESTED",
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
  "DISPUTED",
]);

function statusOf(pool: CommitmentPoolRecord | null): PoolConsoleStatus {
  if (!pool) return "unregistered";
  switch (pool.state) {
    case "NOT_READY":
      return "not-ready";
    case "READY":
      return "ready";
    case "OPEN":
      return "open";
    case "PAUSED":
      return "paused";
    case "CLOSED":
      return "closed";
    case "COMPOSTED":
      return "composted";
    default:
      return "unknown";
  }
}

export function selectPoolConsoleModel(input: {
  pool: CommitmentPoolRecord | null;
  cycles: readonly CommitmentCycleRecord[];
  commitments: readonly CommitmentReadModel[];
  pendingClaimCount: number;
  /** Unix seconds. */
  now: bigint;
}): PoolConsoleModel {
  const { pool, cycles, commitments } = input;
  const status = statusOf(pool);
  const readiness = {
    charter: Boolean(pool?.charterCID && pool.charterCID.trim().length > 0),
    cap: (pool?.providerOpenCommitmentCap ?? 0n) > 0n,
  };
  const live = cycles.filter((row) => !TERMINAL_CYCLE_STATES.has(row.state ?? ""));
  const season = live.find((row) => row.cycleType === "SEASON") ?? null;
  const campaigns = live
    .filter((row) => row.cycleType === "CAMPAIGN")
    .sort((left, right) => Number(left.cycleId - right.cycleId));
  const finishedCycles = cycles
    .filter((row) => TERMINAL_CYCLE_STATES.has(row.state ?? ""))
    .sort((left, right) => Number(right.cycleId - left.cycleId));
  const cycleEndTimes = new Map(cycles.map((row) => [row.cycleId.toString(), row.endTime]));
  const dueLive = selectDueLiveCommitments({ commitments, cycleEndTimes, now: input.now });
  const open = commitments.filter((row) => LIVE_COMMITMENT_STATES.has(row.onchainState));
  const confirmed = commitments.filter(
    (row) => row.onchainState === "FULFILLED" || row.derivedState === "RECONCILED"
  );
  const past = commitments.filter(
    (row) => row.onchainState === "CANCELLED" || row.onchainState === "EXPIRED"
  );
  const disputed = commitments.filter((row) => row.onchainState === "DISPUTED").length;
  return {
    status,
    readiness,
    canSetUp: status === "not-ready",
    season,
    campaigns,
    finishedCycles,
    canSeedSeason: (status === "ready" || status === "open") && season === null,
    canStartCampaign: status === "open",
    closure: selectPoolClosureEligibility({
      liveCommitmentCount: pool?.liveCommitmentCount ?? 0n,
      nonTerminalCycleCount: pool?.nonTerminalCycleCount ?? 0n,
    }),
    dueLive,
    counts: {
      claimsWaiting: input.pendingClaimCount,
      needsRecovery: disputed + dueLive.length,
      pastDue: dueLive.length,
    },
    groups: { open, confirmed, past },
    isPaused: status === "paused",
  };
}
