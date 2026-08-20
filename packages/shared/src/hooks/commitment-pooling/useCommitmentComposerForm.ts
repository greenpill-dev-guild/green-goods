/**
 * Commitment Composer Form Hook
 *
 * React Hook Form + Zod for the member's create-a-commitment flow, plus the
 * translation from what a person filled in to the payload the contract takes.
 *
 * Keeping the payload build here rather than in the view is what stops the two
 * directions drifting apart: an Offer and a Request differ by one enum and by
 * who ends up confirming, and every other field is identical. Two hand-built
 * payloads in two components is how they stop being identical.
 *
 * @module hooks/commitment-pooling/useCommitmentComposerForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { CommitmentCreationPayload } from "../../modules/commitment-pooling/jobs";
import { buildCommitmentMetadata } from "../../modules/commitment-pooling/metadata";
import type { Address } from "../../types/domain";

/** ICommitmentPoolingModule enum ordinals. */
const DIRECTION = { OFFER: 0, REQUEST: 1 } as const;
const COMMITMENT_TYPE = { DOMAIN_IMPACT: 0, SUPPORT_SERVICE: 1 } as const;
const CLAIM_TYPE_INDIVIDUAL = 1;
const CLAIM_MODE = { OPEN: 0, APPROVAL_GATED: 1 } as const;
const CONTRIBUTOR_POLICY = { OPEN: 0, LEAD_MANAGED: 1 } as const;
const CONSIDERATION_RAIL_NONE = 0;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

/** Static English; the view renders its own translated messages. */
export const commitmentComposerSchema = z.object({
  direction: z.enum(["OFFER", "REQUEST"]),
  /** What this is called. The contract stores only a CID, so the words are the metadata. */
  title: z.string().trim().min(1, "Give it a name").max(120, "Keep the name short"),
  description: z.string().trim().max(2000, "That is very long").optional(),
  /** What is being counted, in the member's own words: "hours", "rides". */
  unitLabel: z.string().trim().min(1, "Say what you are counting").max(40, "Keep the label short"),
  targetUnits: z.number().int().positive("How many?"),
  /** Days from now. A commitment with no end never lapses and never settles. */
  dueInDays: z.number().int().positive("Give it an end"),
  openTeam: z.boolean(),
  /** Structural, not time-based: nobody local may be eligible to confirm. */
  protocolFallbackEnabled: z.boolean(),
});

export type CommitmentComposerValues = z.infer<typeof commitmentComposerSchema>;

export const COMMITMENT_COMPOSER_DEFAULTS: CommitmentComposerValues = {
  direction: "OFFER",
  title: "",
  description: "",
  unitLabel: "",
  targetUnits: 1,
  dueInDays: 14,
  openTeam: true,
  // On by default for the pilot: a garden with nobody eligible to confirm would
  // otherwise take a commitment that can never be kept.
  protocolFallbackEnabled: true,
};

export function useCommitmentComposerForm(initial?: Partial<CommitmentComposerValues>) {
  return useForm<CommitmentComposerValues>({
    resolver: zodResolver(commitmentComposerSchema),
    mode: "onChange",
    defaultValues: { ...COMMITMENT_COMPOSER_DEFAULTS, ...initial },
  });
}

/**
 * Turn a filled-in form into the creation payload.
 *
 * `creationRequestKey` is deliberately absent: the queue derives it from
 * `clientCommitmentId`, so a retry behind the same button reuses the key rather
 * than minting a second commitment.
 */
export function buildCommitmentCreationPayload(input: {
  values: CommitmentComposerValues;
  clientCommitmentId: string;
  poolId: bigint;
  cycleId: bigint;
  creator: Address;
  gardenAddress: Address;
  /** Seconds since epoch at build time; passed in so the result stays pure. */
  nowSeconds: number;
}): Omit<CommitmentCreationPayload, "creationRequestKey"> {
  const { values, clientCommitmentId, poolId, cycleId, creator, gardenAddress } = input;
  const dueDate = BigInt(input.nowSeconds + values.dueInDays * 24 * 60 * 60);

  return {
    clientCommitmentId,
    poolId,
    cycleId,
    commitmentSeriesId: 0n,
    direction: values.direction === "REQUEST" ? DIRECTION.REQUEST : DIRECTION.OFFER,
    // A member's own commitment names no garden actions, so it rides the
    // service rail. Action-bound commitments come from the requirement composer.
    commitmentType: COMMITMENT_TYPE.SUPPORT_SERVICE,
    claimType: CLAIM_TYPE_INDIVIDUAL,
    claimMode: CLAIM_MODE.OPEN,
    contributorPolicy: values.openTeam ? CONTRIBUTOR_POLICY.OPEN : CONTRIBUTOR_POLICY.LEAD_MANAGED,
    onBehalfOf: creator,
    domainTags: [],
    requirements: [],
    unitLabel: values.unitLabel.trim(),
    targetUnits: BigInt(values.targetUnits),
    requiresAssessment: false,
    dueDate,
    // Empty on purpose: the words travel with the job and the executor publishes
    // them, so composing works with no signal.
    metadataCID: "",
    metadata: buildCommitmentMetadata({
      title: values.title,
      description: values.description,
    }),
    needUID: ZERO_BYTES32,
    counterCommitmentId: 0n,
    // Nobody is named, so the ordinary rule decides who confirms: on an Offer
    // whoever takes it up, on a Request whoever asked.
    confirmers: [],
    confirmationThreshold: 1,
    protocolFallbackEnabled: values.protocolFallbackEnabled,
    consideration: {
      rail: CONSIDERATION_RAIL_NONE,
      source: ZERO_ADDRESS,
      token: ZERO_ADDRESS,
      amount: 0n,
    },
    declaredUnitValue: 0n,
    declaredValueBasis: "",
    gardenAddress,
  };
}
