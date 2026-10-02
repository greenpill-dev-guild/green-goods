/**
 * Composer answers to a creation payload
 *
 * The one translation from what a person filled in to the payload the
 * contract takes. Keeping it here rather than in a view is what stops the two
 * directions drifting apart: an Offer and a Request differ by one enum and by
 * who ends up confirming, and every other field is identical. Two hand-built
 * payloads in two components is how they stop being identical. The composer
 * re-exports it, so its callers import it from the form they fill.
 *
 * @module modules/commitment-pooling/creation-payload
 */

import type { CommitmentComposerValues } from "../../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../../types/domain";
import { parseUsdCents } from "../wallet/good-dollar-price";
import { CONSIDERATION_RAIL_ORDINAL, type CommitmentCreationPayload } from "./job-types";
import {
  buildCommitmentMetadata,
  COMMITMENT_REWARD_RECORD_VERSION,
  type CommitmentDisplayGroup,
  type CommitmentRewardRecord,
} from "./metadata";

/** ICommitmentPoolingModule enum ordinals. */
const DIRECTION = { OFFER: 0, REQUEST: 1 } as const;
const COMMITMENT_TYPE = { DOMAIN_IMPACT: 0, SUPPORT_SERVICE: 1, SEASON_CAMPAIGN: 2 } as const;
const CLAIM_TYPE_INDIVIDUAL = 1;
const CLAIM_MODE = { OPEN: 0, APPROVAL_GATED: 1 } as const;
const CONTRIBUTOR_POLICY = { OPEN: 0, LEAD_MANAGED: 1 } as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

/**
 * The dollars a G$ reward was typed in, beside the amount they became, for the
 * metadata to keep (D13). Only a reward entered in dollars has one.
 */
function rewardRecordOf(
  values: Pick<
    CommitmentComposerValues,
    "considerationRail" | "considerationUsd" | "considerationAmount"
  >
): CommitmentRewardRecord | undefined {
  if (values.considerationRail !== "CELO_SETTLEMENT" || values.considerationUsd === undefined) {
    return undefined;
  }
  const cents = parseUsdCents(values.considerationUsd);
  const amount = /^\d+$/.test(values.considerationAmount) ? BigInt(values.considerationAmount) : 0n;
  if (cents === null || cents === 0n || amount === 0n) return undefined;
  return {
    version: COMMITMENT_REWARD_RECORD_VERSION,
    usdCents: cents.toString(),
    goodDollarWei: amount.toString(),
  };
}

/**
 * Turn a filled-in form into the creation payload.
 *
 * `creationRequestKey` is deliberately absent: the queue derives it from
 * `clientCommitmentId`, so a retry behind the same button reuses the key rather
 * than minting a second commitment.
 *
 * Requirement rows are carried in the order the member listed them, action UID
 * zero included, and no domain tag is ever authored here: the contract derives
 * domains from the action registry and would reject or ignore a caller's.
 */
export function buildCommitmentCreationPayload(input: {
  values: CommitmentComposerValues;
  clientCommitmentId: string;
  poolId: bigint;
  /**
   * Who is composing, as the calling surface knows them. It does not travel in
   * the payload: `CreationChecksLib.resolveCreator` takes the creator from
   * `msg.sender` and rejects a caller-named one outside capture (`capturedFor`).
   */
  creator: Address;
  gardenAddress: Address;
  /** Seconds since epoch at build time; passed in so the result stays pure. */
  nowSeconds: number;
  /** A set's deadline, fixed at its first Create; otherwise `dueInDays` from `nowSeconds`. */
  dueDate?: bigint;
  /** The set this copy belongs to, written into its metadata so it reads as one group. */
  displayGroup?: CommitmentDisplayGroup;
  /**
   * A steward seeding from the console may gate an offer (the protocol pool
   * defaults to steward review); a member composing alone may not.
   */
  allowGatedOffers?: boolean;
  /**
   * Delegated creation, and only for a `StewardCaptured` commitment: the member
   * whose contribution a steward is capturing. Every other type must send the
   * zero address — `CreationChecksLib.resolveCreator` reverts
   * `UnauthorizedCaller` on a non-zero `onBehalfOf` — so this stays unset for
   * everything this composer builds today.
   */
  capturedFor?: Address;
}): Omit<CommitmentCreationPayload, "creationRequestKey"> {
  const { values, clientCommitmentId, poolId, gardenAddress } = input;
  const dueDate = input.dueDate ?? BigInt(input.nowSeconds + values.dueInDays * 24 * 60 * 60);
  const isGardenWork = values.kind === "GARDEN_WORK";
  const confirmers = [
    ...new Set(values.confirmers.map((address) => address.toLowerCase() as Address)),
  ];
  const rail = values.considerationRail;
  const consideration = {
    rail: CONSIDERATION_RAIL_ORDINAL[rail],
    // Only the external rail carries its own source and token; Celo settlement
    // derives both from the module and None carries nothing.
    source: rail === "ARBITRUM_EXTERNAL" ? (values.considerationSource as Address) : ZERO_ADDRESS,
    token: rail === "ARBITRUM_EXTERNAL" ? (values.considerationToken as Address) : ZERO_ADDRESS,
    amount: rail === "NONE" ? 0n : BigInt(values.considerationAmount || "0"),
  };
  const reward = rewardRecordOf(values);

  return {
    clientCommitmentId,
    poolId,
    cycleId: BigInt(values.cycleId),
    commitmentSeriesId: 0n,
    direction: values.direction === "REQUEST" ? DIRECTION.REQUEST : DIRECTION.OFFER,
    commitmentType: isGardenWork
      ? COMMITMENT_TYPE.DOMAIN_IMPACT
      : values.kind === "SEASON_CAMPAIGN"
        ? COMMITMENT_TYPE.SEASON_CAMPAIGN
        : COMMITMENT_TYPE.SUPPORT_SERVICE,
    claimType: CLAIM_TYPE_INDIVIDUAL,
    // Only an asker chooses who may take it up; an offer is open to be taken,
    // unless a steward is seeding it from the console.
    claimMode:
      (values.direction === "REQUEST" || input.allowGatedOffers === true) &&
      values.claimMode === "APPROVAL_GATED"
        ? CLAIM_MODE.APPROVAL_GATED
        : CLAIM_MODE.OPEN,
    contributorPolicy: values.openTeam ? CONTRIBUTOR_POLICY.OPEN : CONTRIBUTOR_POLICY.LEAD_MANAGED,
    // Direct creation, so the module reads the creator from `msg.sender`. Naming
    // anyone here reverts `UnauthorizedCaller` unless the type is StewardCaptured.
    onBehalfOf: input.capturedFor ?? ZERO_ADDRESS,
    domainTags: [],
    requirements: isGardenWork
      ? values.requirements.map((row) => ({
          actionUID: BigInt(row.actionUID),
          requiredCount: row.requiredCount,
        }))
      : [],
    unitLabel: values.unitLabel.trim(),
    targetUnits: BigInt(values.targetUnits),
    requiresAssessment: false,
    dueDate,
    // Empty on purpose: the words travel with the job and the executor publishes
    // them, so composing works with no signal.
    metadataCID: "",
    metadata: buildCommitmentMetadata({
      title: values.title,
      note: values.note,
      links: values.links.map((url) => ({ url })),
      ...(input.displayGroup ? { displayGroup: input.displayGroup } : {}),
      ...(reward ? { reward } : {}),
    }),
    needUID: ZERO_BYTES32,
    counterCommitmentId: 0n,
    // With nobody named, the ordinary rule decides who confirms: on an Offer
    // whoever takes it up, on a Request whoever asked.
    confirmers,
    confirmationThreshold: confirmers.length === 0 ? 1 : values.confirmationThreshold,
    protocolFallbackEnabled: values.protocolFallbackEnabled,
    consideration,
    declaredUnitValue: 0n,
    declaredValueBasis: "",
    gardenAddress,
  };
}
