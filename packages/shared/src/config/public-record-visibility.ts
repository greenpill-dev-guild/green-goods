import type { Address } from "../types/domain";
import type { EASWork } from "../types/eas-responses";

/** Reviewed production rehearsals. Operational history and settlement stay intact. */
const COMMUNITY_GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a";
const AIYELOJA_FAMILY_GARDEN = "0xf7b892886998dae960d64a9db488336684f137a0";
// Register a rehearsal before creating its first commitment. Every indexed
// descendant inherits this classification, including records created later.
const REHEARSAL_CYCLES = [{ chainId: 42161, poolId: 1n, cycleId: 1n }] as const;

export function publicRehearsalCycles(chainId: number, poolId?: bigint) {
  return REHEARSAL_CYCLES.filter(
    (cycle) => cycle.chainId === chainId && (poolId === undefined || cycle.poolId === poolId)
  );
}

// Single promises that review found to be tests. They were made outside any cycle, so the cycle
// rule above cannot reach them. Each is named by its own id, never by its garden, author or label.
const REHEARSAL_COMMITMENTS = [
  // A QA check in the Aiyeloja Family Garden pool, kept on 8 November 2026 (PRD-1097).
  { chainId: 42161, poolId: 2n, commitmentId: 85n },
] as const;

export function publicRehearsalCommitments(chainId: number, poolId?: bigint) {
  return REHEARSAL_COMMITMENTS.filter(
    (commitment) =>
      commitment.chainId === chainId && (poolId === undefined || commitment.poolId === poolId)
  );
}

// Gardens whose stewards agreed to publish a passport. Taking part in a pool is not consent to
// public reporting, so a garden joins this list only on its stewards' recorded yes, and leaves it
// on their no. Nothing is inferred from an open pool, a listing or a kept promise.
const PASSPORT_GARDENS: Readonly<Record<number, readonly string[]>> = {
  // The garden's owner agreed on 21 November 2026 (PRD-1097).
  42161: [AIYELOJA_FAMILY_GARDEN],
};

export function isPublicPassportPublished(chainId: number, garden: Address): boolean {
  return (PASSPORT_GARDENS[chainId] ?? []).includes(garden.toLowerCase());
}

// Explicitly reviewed records only, keyed by garden then work UID: never infer rehearsal status
// from a name, author, rejection, missing evidence, or an entire garden's history.
type WorkReviewStatus = "test" | "pending-review";
const WORK_REVIEW: Readonly<Record<string, Readonly<Record<string, WorkReviewStatus>>>> = {
  [COMMUNITY_GARDEN]: {
    "0x15916dfa15db19351c79a2af1fd4f484cd5792b6f90ea701727b43fd67dac01c": "test",
    "0x241dbdbcba1f0023c7c4afd08f3e07f82dbc552126b33e69ad2fd4daaabdeb9c": "test",
    "0xfbbdd55a70c78d05ccd84e18a79621a2f6f4b8d0df963b87bda4c209502748f2": "test",
    "0x6494524cb4c50c236be288837bd62144484cf47b8d687412f5ca013f0577c157": "test",
    "0x226d34b1d4d4bf193acedb696e75ee3dbaa103ab06900ec35e78bfb219a65f51": "test",
    "0x5db91be5ad17144250cc04a9339318a017cb7dd0f895c8b75efdcd3d9a959d97": "pending-review",
    "0x99825947035f5db6e50a21bce712461b8f26217f34aeeed04b734da42c5f07b4": "pending-review",
    "0x01cf55be4951d29f6cd6ce32f88b8947a443f053f59fb627b7b8923336fd7496": "pending-review",
    "0x1acdaaf01114786bc6eb60692677d6e77c1a2758aa29f9a28f4914ccc9d4148c": "pending-review",
    "0x9a68fe3efc1d1d9a7b8e1e7a5cf728f54580fdfefb05ad3f5c1808f761d0fd6d": "pending-review",
    "0x2bac9f5031d583c9cfc6717eb406788cd5102e7808f097365a4787ea4d5eb9d5": "pending-review",
    "0x76fe1b2111263a16544eb136ba35b0061550366279b426b6ea061740fda234d9": "pending-review",
    "0x7a25afc492a47c0d7d881ccee0bdc2f17e454f392df66c1979f3e7fbb26e23a9": "pending-review",
    "0x6593bde8038f71c3284d9bcea2353a8f9158b36c5080cec6c4684201c1928b31": "pending-review",
    "0x44d493c79aeae9d80f40e5e0f24e361eddb8a3c1d09c0bb6fc67682eda5a6c55": "pending-review",
    "0xc460b5e2e899bf64fbdd44eab1ed974a03c17bfaa5c96c821ca0a59f8d601856": "pending-review",
    "0x369d08499bb7f7768563297785686d493d6f9d292108e0d796697d5ef49e1f20": "pending-review",
    "0x779aa33351e3fea960dd43423176bba4ce32660737614d1b851069a61c6e0171": "pending-review",
    "0xe4d67e81bce5caf6d7d72ea5c445aa516eb5b3342b7431066380928fcd4e2cac": "pending-review",
  },
  [AIYELOJA_FAMILY_GARDEN]: {
    // A QA demo fixture approved on 14 November 2026, hidden in the PRD-1262 report rehearsal.
    "0x6fce9a2a5647cbee87300d1a5874e2d196afda0433cc8f6926f192390be16b58": "test",
  },
};

export function publicReviewedWorkExclusionIds(chainId: number): string[] {
  return chainId === 42161 ? Object.values(WORK_REVIEW).flatMap((works) => Object.keys(works)) : [];
}

export function publicWorkReviewStatus(
  work: Pick<EASWork, "id" | "gardenAddress">,
  chainId: number
): WorkReviewStatus | undefined {
  return chainId === 42161
    ? WORK_REVIEW[work.gardenAddress.toLowerCase()]?.[work.id.toLowerCase()]
    : undefined;
}
