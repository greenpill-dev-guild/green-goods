import type { Address } from "../../types/domain";
import type { CommitmentReadModel } from "./types";

export type ConfirmQueueEligibility =
  | "ORDINARY"
  | "POOL_FALLBACK"
  | "PROTOCOL_FALLBACK"
  | "DISPUTED";

export interface ConfirmQueueProjectionRow {
  commitment: CommitmentReadModel;
  /** The garden whose authority performs the confirmation or dispute act. */
  garden: Address;
  gardenName: string;
  eligibility: ConfirmQueueEligibility;
  title: string | null;
  poolGarden?: Address | null;
  canDispute?: boolean;
}

export interface ConfirmQueueProjectionInput {
  groups: ReadonlyArray<{
    garden: Address;
    gardenName: string;
    rows: ReadonlyArray<{
      commitment: CommitmentReadModel;
      poolGarden?: Address | null;
      canDispute?: boolean;
    }>;
  }>;
  fallback?: ReadonlyArray<{
    commitment: CommitmentReadModel;
    path: "POOL_FALLBACK" | "PROTOCOL_FALLBACK";
    garden: Address;
    gardenName: string;
    poolGarden?: Address | null;
    canDispute?: boolean;
  }>;
  disputed?: ReadonlyArray<{
    commitment: CommitmentReadModel;
    garden: Address;
    gardenName: string;
  }>;
}

type MetadataTitleMap = ReadonlyMap<string, { title?: string | null }>;

export function selectConfirmQueueRows(input: {
  toConfirm: ConfirmQueueProjectionInput;
  byCID: MetadataTitleMap;
  search: string;
  include?: readonly ConfirmQueueEligibility[];
}): ConfirmQueueProjectionRow[] {
  const { toConfirm, byCID, search, include } = input;
  const titleOf = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && byCID.get(commitment.metadataCID.trim())?.title) ?? null;

  const ordinary = toConfirm.groups.flatMap((group) =>
    group.rows.map((row) => ({
      commitment: row.commitment,
      garden: group.garden,
      gardenName: group.gardenName,
      eligibility: "ORDINARY" as const,
      title: titleOf(row.commitment),
      poolGarden: row.poolGarden,
      canDispute: row.canDispute,
    }))
  );
  const fallback = (toConfirm.fallback ?? []).map((row) => ({
    commitment: row.commitment,
    garden: row.garden,
    gardenName: row.gardenName,
    eligibility: row.path,
    title: titleOf(row.commitment),
    poolGarden: row.poolGarden,
    canDispute: row.canDispute,
  }));
  const disputed = (toConfirm.disputed ?? []).map((row) => ({
    commitment: row.commitment,
    garden: row.garden,
    gardenName: row.gardenName,
    eligibility: "DISPUTED" as const,
    title: titleOf(row.commitment),
    poolGarden: row.garden,
    canDispute: true,
  }));
  const included = include ? new Set(include) : null;
  const rows = [...ordinary, ...fallback, ...disputed].filter(
    (row) => !included || included.has(row.eligibility)
  );
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      (row.title ?? "").toLowerCase().includes(needle) ||
      row.gardenName.toLowerCase().includes(needle)
  );
}
