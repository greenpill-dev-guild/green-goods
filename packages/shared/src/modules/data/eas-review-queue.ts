/**
 * A garden's whole review queue, in one bounded request.
 *
 * The garden screen reads only its newest page of work, which cannot show
 * whether older work still waits or when the latest review landed. This read
 * answers both for the whole garden. EAS cannot join a work to its decision,
 * which names its work only inside its decoded data, so the waiting list comes
 * from reading every work and every decision, up to REVIEW_HISTORY_LIMIT of
 * each. Past that, counts bound the waiting work instead.
 *
 * Decisions are found by garden: the approval resolver refuses a decision
 * whose recipient is not its work's garden (`NotInWorkRegistry`), so a
 * garden's decisions are exactly those attested to it.
 *
 * @module modules/data/eas-review-queue
 */

import { getEASConfig } from "../../config/blockchain";
import type { GardenReviewQueue, GardenWaitingWork } from "../../types/garden-detail";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";
import { REVIEW_STALL_WINDOW_MS } from "../../utils/garden-detail";
import { logger } from "../app/logger";
import { parseDataToWorkApproval, parseEasCreationTime } from "./eas-parse";
import { EASFetchError, easStoredAddress, validatedAttestations } from "./eas-read-validation";
import { easGraphQL } from "./graphql";
import { createEasClient, type GraphQLReader } from "./graphql-client";

/**
 * The most works, and the most decisions, one read lists: four work-list
 * pages, so checking a garden's health never downloads an unbounded history.
 */
export const REVIEW_HISTORY_LIMIT = 200;

const OPERATION = "getGardenReviewQueue";

const QUERY = easGraphQL(/* GraphQL */ `
  query GardenReviewQueue(
    $works: AttestationWhereInput
    $worksOverWeek: AttestationWhereInput
    $decisions: AttestationWhereInput
    $take: Int!
  ) {
    works: attestations(where: $works, orderBy: [{ timeCreated: asc }, { id: asc }], take: $take) {
      id
      timeCreated
    }
    decisions: attestations(
      where: $decisions
      orderBy: [{ timeCreated: desc }, { id: asc }]
      take: $take
    ) {
      id
      attester
      recipient
      timeCreated
      decodedDataJson
    }
    workCount: aggregateAttestation(where: $works) {
      _count {
        _all
      }
    }
    workOverWeekCount: aggregateAttestation(where: $worksOverWeek) {
      _count {
        _all
      }
    }
    decisionCount: aggregateAttestation(where: $decisions) {
      _count {
        _all
      }
    }
  }
`);

/** A work row carries only its id and time, so it is checked here, not as a full attestation. */
function waitingWork(row: unknown): GardenWaitingWork | null {
  const { id, timeCreated } = (row ?? {}) as { id?: unknown; timeCreated?: unknown };
  try {
    if (typeof id !== "string" || id === "") throw new TypeError("EAS attestation has no id");
    return { id, submittedAt: parseEasCreationTime(timeCreated) };
  } catch (error) {
    logger.warn("Skipping malformed EAS attestation", {
      source: "eas",
      operation: OPERATION,
      attestationId: typeof id === "string" ? id : undefined,
      error,
    });
    return null;
  }
}

/** Works less decisions, or no floor at all when either count is missing. */
function floorOf(works: number | undefined, decisions: number | undefined): number {
  return works === undefined || decisions === undefined ? 0 : Math.max(0, works - decisions);
}

/**
 * When a garden's latest decision landed, and which of its works no decision
 * has settled.
 */
export async function readGardenReviewQueue(
  gardenAddress: string,
  { chainId, now = Date.now() }: { chainId?: number | string; now?: number } = {},
  reader: GraphQLReader = createEasClient(chainId)
): Promise<GardenReviewQueue> {
  const easConfig = getEASConfig(chainId);
  if (isZeroBytes32(easConfig.WORK.uid)) return { lastReviewedAt: null, waiting: [] };
  const toGarden = { equals: easStoredAddress(gardenAddress) };
  const works = {
    schemaId: { equals: easConfig.WORK.uid },
    recipient: toGarden,
    revoked: { equals: false },
  };
  const weekAgo = Math.floor((now - REVIEW_STALL_WINDOW_MS) / 1000);
  const { data, error } = await reader.query(
    QUERY,
    {
      works,
      worksOverWeek: { ...works, timeCreated: { lte: weekAgo } },
      decisions: {
        schemaId: { equals: easConfig.WORK_APPROVAL.uid },
        recipient: toGarden,
        revoked: { equals: false },
      },
      // The extra row says the history is longer than one read lists.
      take: REVIEW_HISTORY_LIMIT + 1,
    },
    OPERATION
  );
  if (error || !Array.isArray(data?.works) || !Array.isArray(data?.decisions)) {
    throw new EASFetchError(
      `Failed to fetch garden review queue: ${error?.message ?? "Invalid attestations response"}`,
      OPERATION,
      error
    );
  }

  const decisions = validatedAttestations(data.decisions, OPERATION);
  // Newest first, so the first row is the latest review even past the limit.
  const lastReviewedAt = decisions.length > 0 ? Number(decisions[0].timeCreated) : null;

  if (data.works.length > REVIEW_HISTORY_LIMIT || data.decisions.length > REVIEW_HISTORY_LIMIT) {
    const decided = data.decisionCount?._count?._all;
    return {
      lastReviewedAt,
      waiting: null,
      waitingAtLeast: floorOf(data.workCount?._count?._all, decided),
      waitingOverWeekAtLeast: floorOf(data.workOverWeekCount?._count?._all, decided),
    };
  }

  const settled = new Set(
    decisions.map(({ id, attester, recipient, timeCreated, decodedDataJson }) =>
      parseDataToWorkApproval(
        id,
        { attester, recipient, time: Number(timeCreated) },
        decodedDataJson
      ).workUID.toLowerCase()
    )
  );
  return {
    lastReviewedAt,
    waiting: data.works.flatMap((row) => {
      const work = waitingWork(row);
      return work && !settled.has(work.id.toLowerCase()) ? [work] : [];
    }),
  };
}
