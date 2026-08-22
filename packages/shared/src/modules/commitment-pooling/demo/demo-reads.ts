/**
 * Fixture-backed implementations of the pooling reads, for demo mode.
 *
 * Each function answers the same question as its real counterpart in the
 * data modules, over the world in demo-world.ts, with the same filters the
 * indexer query would apply. Loaded only through the dynamic import in
 * data.ts, and only when demo mode is on.
 *
 * @module modules/commitment-pooling/demo/demo-reads
 */

import type { Address } from "../../../types/domain";
import type {
  CommitmentClaimRequestRecord,
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "../types-core";
import type {
  CommitmentCycleDetail,
  CommitmentDetail,
  CommitmentPoolDetail,
  CommitmentWorkAttributionRecord,
} from "../types-relations";
import { demoViewer } from "./demo-mode";
import { buildDemoWorld, type DemoDocument, type DemoWorld } from "./demo-world";

let cached: DemoWorld | null = null;

function world(): DemoWorld {
  const viewer = demoViewer();
  if (!cached || cached.viewer.toLowerCase() !== viewer.toLowerCase()) {
    cached = buildDemoWorld(viewer);
  }
  return cached;
}

function same(left: Address | null | undefined, right: Address): boolean {
  return Boolean(left) && left!.toLowerCase() === right.toLowerCase();
}

/** Everything an account is a party to, as the real query defines party. */
function isParty(w: DemoWorld, commitment: CommitmentReadModel, account: Address): boolean {
  if (same(commitment.creator, account)) return true;
  if (same(commitment.leadProvider, account)) return true;
  if (same(commitment.counterparty, account)) return true;
  if (commitment.confirmers.some((entry) => same(entry, account))) return true;
  return w.contributors.some(
    (entry) =>
      entry.commitmentId === commitment.commitmentId &&
      entry.active &&
      same(entry.contributor, account)
  );
}

export async function getCommitments(input: {
  chainId: number;
  poolId?: bigint;
  cycleId?: bigint;
  seriesId?: bigint;
  state?: string;
  account?: Address;
}): Promise<CommitmentReadModel[]> {
  const w = world();
  return w.commitments
    .filter((row) => row.chainId === input.chainId)
    .filter((row) => input.poolId === undefined || row.poolId === input.poolId)
    .filter((row) => input.cycleId === undefined || row.cycleId === input.cycleId)
    .filter((row) => input.seriesId === undefined || row.commitmentSeriesId === input.seriesId)
    .filter((row) => !input.state || row.onchainState === input.state)
    .filter((row) => !input.account || isParty(w, row, input.account))
    .sort((left, right) => Number(right.commitmentId - left.commitmentId));
}

export async function getCommitmentDetail(
  chainId: number,
  commitmentId: bigint
): Promise<CommitmentDetail | null> {
  const w = world();
  const commitment = w.commitments.find(
    (row) => row.chainId === chainId && row.commitmentId === commitmentId
  );
  if (!commitment) return null;
  return {
    commitment,
    requirements: w.requirements
      .filter((row) => row.commitmentId === commitmentId)
      .sort((left, right) => left.requirementIndex - right.requirementIndex),
    contributors: w.contributors.filter((row) => row.commitmentId === commitmentId),
    assignments: [],
    workAttributions: w.workAttributions.filter((row) => row.commitmentId === commitmentId),
    evidenceAttributions: [],
    claimRequests: w.claimRequests.filter((row) => row.commitmentId === commitmentId),
    counterpartCommitments: [],
  };
}

export async function getCommitmentWorkAttributionsByWork(
  chainId: number,
  workUID: string
): Promise<CommitmentWorkAttributionRecord[]> {
  return world().workAttributions.filter(
    (row) => row.chainId === chainId && row.workUID.toLowerCase() === workUID.toLowerCase()
  );
}

export async function getCommitmentClaimRequests(
  chainId: number,
  commitmentId: bigint,
  state?: string
): Promise<CommitmentClaimRequestRecord[]> {
  return world()
    .claimRequests.filter((row) => row.chainId === chainId && row.commitmentId === commitmentId)
    .filter((row) => !state || row.state === state)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getCommitmentPools(
  chainId: number,
  garden?: Address
): Promise<CommitmentPoolRecord[]> {
  return world()
    .pools.filter((row) => row.chainId === chainId)
    .filter((row) => !garden || same(row.garden, garden))
    .sort((left, right) => Number(left.poolId - right.poolId));
}

export async function getCommitmentPoolDetail(
  chainId: number,
  poolId: bigint
): Promise<CommitmentPoolDetail | null> {
  const pool = world().pools.find((row) => row.chainId === chainId && row.poolId === poolId);
  return pool ? { pool, unitSummaries: [], providerExposures: [] } : null;
}

export async function getCommitmentCycles(input: {
  chainId: number;
  poolId: bigint;
  cycleType?: string;
  state?: string;
}): Promise<CommitmentCycleRecord[]> {
  return world()
    .cycles.filter((row) => row.chainId === input.chainId && row.poolId === input.poolId)
    .filter((row) => !input.cycleType || row.cycleType === input.cycleType)
    .filter((row) => !input.state || row.state === input.state)
    .sort((left, right) => Number(left.cycleId - right.cycleId));
}

export async function getCommitmentCycleDetail(
  chainId: number,
  cycleId: bigint
): Promise<CommitmentCycleDetail | null> {
  const cycle = world().cycles.find((row) => row.chainId === chainId && row.cycleId === cycleId);
  return cycle ? { cycle, unitSummaries: [], seriesSummaries: [] } : null;
}

/** The documents behind the fixture CIDs; null for any CID the world does not know. */
export function demoDocument(cid: string): DemoDocument | null {
  return world().documents[cid.trim()] ?? null;
}
