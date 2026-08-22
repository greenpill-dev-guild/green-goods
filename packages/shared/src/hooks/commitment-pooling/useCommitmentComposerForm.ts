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
 * Two kinds ride through here. A service names no garden actions and is kept
 * by proof and the person it was for. Garden work names one or more of the
 * garden's registered actions, each with how many approved submissions it
 * needs, and is kept by the Work rails approving them. The rows are what the
 * contract calls requirements; the member reads them as "what has to be
 * approved".
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
const COMMITMENT_TYPE = { DOMAIN_IMPACT: 0, SUPPORT_SERVICE: 1, SEASON_CAMPAIGN: 2 } as const;
const CLAIM_TYPE_INDIVIDUAL = 1;
const CLAIM_MODE = { OPEN: 0, APPROVAL_GATED: 1 } as const;
const CONTRIBUTOR_POLICY = { OPEN: 0, LEAD_MANAGED: 1 } as const;
const CONSIDERATION_RAIL = { NONE: 0, ARBITRUM_EXTERNAL: 1, CELO_SETTLEMENT: 2 } as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

/**
 * The module's own ceiling (`CommitmentPoolingCommonLib.MAX_REQUIREMENTS`).
 * A validation limit, never a planning rule: no surface presents it as how
 * many a commitment should have.
 */
export const MAX_COMMITMENT_REQUIREMENTS = 40;

/** A decimal action UID. Zero is a real action in the registry. */
const actionUIDSchema = z.string().regex(/^\d+$/, "Choose an action");

const requirementSchema = z.object({
  actionUID: actionUIDSchema,
  requiredCount: z.number().int().min(1, "Needs a count of at least 1"),
});

const webLink = z.string().trim().url("Enter a web address").startsWith("http", {
  message: "Enter a web address",
});

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Enter an address");
/** Base units of the token, as the contract stores them. */
const amountSchema = z.string().regex(/^\d+$/, "Enter a whole amount");

/** Static English; the view renders its own translated messages. */
export const commitmentComposerSchema = z
  .object({
    direction: z.enum(["OFFER", "REQUEST"]),
    /**
     * Garden work names actions and is kept by approvals; a service is kept by
     * proof; a season or campaign commitment is the pool's own, seeded by a
     * steward (uiux-spec §6.3).
     */
    kind: z.enum(["SERVICE", "GARDEN_WORK", "SEASON_CAMPAIGN"]),
    /** What this is called. The contract stores only a CID, so the words are the metadata. */
    title: z.string().trim().min(1, "Give it a name").max(120, "Keep the name short"),
    /** Optional context, in the member's words. Goes into the metadata document as `note`. */
    note: z.string().trim().max(2000, "That is very long").optional(),
    /** Web addresses that belong with it. */
    links: z.array(webLink).max(10, "That is a lot of links"),
    /** What is being counted, in the member's own words: "hours", "rides". */
    unitLabel: z
      .string()
      .trim()
      .min(1, "Say what you are counting")
      .max(40, "Keep the label short"),
    targetUnits: z.number().int().positive("How many?"),
    /** Days from now. A commitment with no end never lapses and never settles. */
    dueInDays: z.number().int().positive("Give it an end"),
    /** Which season or campaign holds it. "0" is neither. Decimal, for the form's sake. */
    cycleId: z.string().regex(/^\d+$/, "Choose where it runs"),
    /** Who can take it up. Only a request may ask stewards to review that. */
    claimMode: z.enum(["OPEN", "APPROVAL_GATED"]),
    /** The garden actions this needs, each with its approved count. Garden work only. */
    requirements: z.array(requirementSchema).max(MAX_COMMITMENT_REQUIREMENTS, "Too many rows"),
    openTeam: z.boolean(),
    /** Structural, not time-based: nobody local may be eligible to confirm. */
    protocolFallbackEnabled: z.boolean(),
    /**
     * The steward's extras (uiux-spec §6.3 steps 3 and 4). A named confirmer
     * group with its threshold, and exactly one consideration rail. All
     * default to the member composer's answers: nobody named, no money.
     */
    confirmers: z.array(addressSchema).max(40, "Too many confirmers"),
    confirmationThreshold: z.number().int().min(1, "At least one"),
    considerationRail: z.enum(["NONE", "ARBITRUM_EXTERNAL", "CELO_SETTLEMENT"]),
    considerationSource: z.string().trim(),
    considerationToken: z.string().trim(),
    considerationAmount: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.kind === "GARDEN_WORK") {
      if (values.requirements.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requirements"],
          message: "Add at least one action",
        });
      }
      const seen = new Set<string>();
      values.requirements.forEach((row, index) => {
        if (seen.has(row.actionUID)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["requirements", index, "actionUID"],
            message: "That action is already listed",
          });
        }
        seen.add(row.actionUID);
      });
    }
    if (values.confirmers.length > 0 && values.confirmationThreshold > values.confirmers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationThreshold"],
        message: "More confirmations than confirmers",
      });
    }
    if (values.considerationRail === "ARBITRUM_EXTERNAL") {
      if (!addressSchema.safeParse(values.considerationSource).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationSource"],
          message: "Name where the payout comes from",
        });
      }
      if (!addressSchema.safeParse(values.considerationToken).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationToken"],
          message: "Name the token",
        });
      }
    }
    if (values.considerationRail !== "NONE") {
      const amount = amountSchema.safeParse(values.considerationAmount);
      if (!amount.success || BigInt(values.considerationAmount) === 0n) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationAmount"],
          message: "Enter a whole amount above zero",
        });
      }
    }
  });

export type CommitmentComposerValues = z.infer<typeof commitmentComposerSchema>;
export type CommitmentComposerRequirement = z.infer<typeof requirementSchema>;

export const COMMITMENT_COMPOSER_DEFAULTS: CommitmentComposerValues = {
  direction: "OFFER",
  kind: "SERVICE",
  title: "",
  note: "",
  links: [],
  unitLabel: "",
  targetUnits: 1,
  dueInDays: 14,
  cycleId: "0",
  claimMode: "OPEN",
  requirements: [],
  openTeam: true,
  // On by default for the pilot: a garden with nobody eligible to confirm would
  // otherwise take a commitment that can never be kept.
  protocolFallbackEnabled: true,
  confirmers: [],
  confirmationThreshold: 1,
  considerationRail: "NONE",
  considerationSource: "",
  considerationToken: "",
  considerationAmount: "",
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
 *
 * Requirement rows are carried in the order the member listed them, action UID
 * zero included, and no domain tag is ever authored here: the contract derives
 * domains from the action registry and would reject or ignore a caller's.
 */
export function buildCommitmentCreationPayload(input: {
  values: CommitmentComposerValues;
  clientCommitmentId: string;
  poolId: bigint;
  creator: Address;
  gardenAddress: Address;
  /** Seconds since epoch at build time; passed in so the result stays pure. */
  nowSeconds: number;
  /**
   * A steward seeding from the console may gate an offer (the protocol pool
   * defaults to steward review); a member composing alone may not.
   */
  allowGatedOffers?: boolean;
}): Omit<CommitmentCreationPayload, "creationRequestKey"> {
  const { values, clientCommitmentId, poolId, creator, gardenAddress } = input;
  const dueDate = BigInt(input.nowSeconds + values.dueInDays * 24 * 60 * 60);
  const isGardenWork = values.kind === "GARDEN_WORK";
  const confirmers = [
    ...new Set(values.confirmers.map((address) => address.toLowerCase() as Address)),
  ];
  const rail = values.considerationRail;
  const consideration = {
    rail: CONSIDERATION_RAIL[rail],
    // Only the external rail carries its own source and token; Celo settlement
    // derives both from the module and None carries nothing.
    source: rail === "ARBITRUM_EXTERNAL" ? (values.considerationSource as Address) : ZERO_ADDRESS,
    token: rail === "ARBITRUM_EXTERNAL" ? (values.considerationToken as Address) : ZERO_ADDRESS,
    amount: rail === "NONE" ? 0n : BigInt(values.considerationAmount || "0"),
  };

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
    onBehalfOf: creator,
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
