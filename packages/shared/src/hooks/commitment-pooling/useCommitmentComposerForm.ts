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
import { useEffect, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import type { CommitmentCreationPayload } from "../../modules/commitment-pooling/jobs";
import { buildCommitmentMetadata } from "../../modules/commitment-pooling/metadata";
import { MAX_LINKED_WORKS_PER_COMMITMENT } from "../../modules/commitment-pooling/acts";
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

/** `requiredCount` is a contract uint32; a larger number cannot be encoded. */
const MAX_REQUIRED_COUNT = 4_294_967_295;

const requirementSchema = z.object({
  actionUID: actionUIDSchema,
  requiredCount: z
    .number()
    .int()
    .min(1, "Needs a count of at least 1")
    .max(MAX_REQUIRED_COUNT, "That count is too large"),
});

/**
 * Only real http(s) addresses. A generic URL check accepts any scheme, and a
 * `startsWith("http")` test also passes `httpx://`, which the metadata builder
 * then drops — so the pinned document would differ from what was approved.
 */
const webLink = z
  .string()
  .trim()
  .url("Enter a web address")
  .refine((value) => /^https?:\/\//i.test(value), { message: "Enter a web address" });

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Enter an address");
/** Base units of the token, as the contract stores them. */
const amountSchema = z.string().regex(/^\d+$/, "Enter a whole amount");

/**
 * A named confirmer, never the zero address.
 *
 * `CreditLib.eligibleNamedConfirmerCount` skips the zero address while counting
 * who may still confirm, so naming it buys nothing and costs the commitment:
 * a group of one zero address leaves the threshold unreachable and
 * `assertConfirmationReachable` reverts `ConfirmationThresholdUnreachable`,
 * which cannot be repaired once the commitment is accepted.
 */
const confirmerAddressSchema = addressSchema.refine(
  (value) => !/^0x0{40}$/i.test(value),
  "Enter a confirmer's own address"
);

/**
 * Message ids for the rules the steward's seeding console added, resolved by the
 * view through `formatMessage`.
 *
 * The composer's older messages are developer English that no surface shows —
 * the member composer says the missing thing in its own words instead. These
 * rules have no such restatement: the seeding console renders the schema's
 * message directly, so an id is the only way a Spanish or Portuguese steward
 * reads them in their language.
 */
export const COMMITMENT_COMPOSER_ERROR_IDS = {
  confirmersTooMany: "cockpit.garden.pool.seed.error.confirmersTooMany",
  thresholdAtLeastOne: "cockpit.garden.pool.seed.error.thresholdAtLeastOne",
  thresholdAboveGroup: "cockpit.garden.pool.seed.error.thresholdAboveGroup",
  considerationSource: "cockpit.garden.pool.seed.error.considerationSource",
  considerationToken: "cockpit.garden.pool.seed.error.considerationToken",
  considerationAmount: "cockpit.garden.pool.seed.error.considerationAmount",
} as const;

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
    confirmers: z
      .array(confirmerAddressSchema)
      .max(40, COMMITMENT_COMPOSER_ERROR_IDS.confirmersTooMany),
    confirmationThreshold: z
      .number()
      .int()
      .min(1, COMMITMENT_COMPOSER_ERROR_IDS.thresholdAtLeastOne),
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
      // The contract caps linked work per commitment, and counts what is
      // required as well as what is attached (CreationChecksLib,
      // TooManyLinkedWorks). Rows may be few and still ask for too much.
      const totalRequired = values.requirements.reduce((sum, row) => sum + row.requiredCount, 0);
      if (totalRequired > MAX_LINKED_WORKS_PER_COMMITMENT) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requirements"],
          message: "That is more work than one commitment can hold",
        });
      }
    }
    if (values.confirmers.length > 0 && values.confirmationThreshold > values.confirmers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationThreshold"],
        message: COMMITMENT_COMPOSER_ERROR_IDS.thresholdAboveGroup,
      });
    }
    if (values.considerationRail === "ARBITRUM_EXTERNAL") {
      if (!addressSchema.safeParse(values.considerationSource).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationSource"],
          message: COMMITMENT_COMPOSER_ERROR_IDS.considerationSource,
        });
      }
      if (!addressSchema.safeParse(values.considerationToken).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationToken"],
          message: COMMITMENT_COMPOSER_ERROR_IDS.considerationToken,
        });
      }
    }
    if (values.considerationRail !== "NONE") {
      const amount = amountSchema.safeParse(values.considerationAmount);
      if (!amount.success || BigInt(values.considerationAmount) === 0n) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationAmount"],
          message: COMMITMENT_COMPOSER_ERROR_IDS.considerationAmount,
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
 * Keep a composer honest inside a dialog that outlives one attempt at filling it.
 *
 * Two things go wrong otherwise, and both end in a commitment nobody meant to
 * queue. A dialog whose `open` prop merely toggles keeps the last attempt, so
 * cancelling or seeding and then reopening resumes the abandoned answers on the
 * step they were abandoned at, and the same commitment can go into the queue
 * twice. And react-hook-form reads `defaultValues` once, on the first render:
 * a default that only a query can supply — the pool's open season, whether a
 * protocol pool is registered — is captured as the cold-load placeholder and
 * never corrected, so an untouched form submits the placeholder while the view
 * shows the resolved choice.
 *
 * `initial` is the same object the form was built with, applied field by field
 * and only where nobody has typed, so a late answer never overwrites a steward's.
 */
export function useCommitmentComposerSession(input: {
  form: UseFormReturn<CommitmentComposerValues>;
  /** The dialog's own flag. A closed composer is left alone. */
  open: boolean;
  /** What the draft belongs to. A different garden or context starts a fresh one. */
  sessionKey: string;
  /** The form's initial values, including the ones a query resolves late. */
  initial: Partial<CommitmentComposerValues>;
  /** Clears what the view holds beside the form: step, drafts, submission errors. */
  onRestart: () => void;
}): void {
  const { form, open, sessionKey, initial, onRestart } = input;
  const startedSession = useRef<string | null>(null);
  const latest = useRef({ initial, onRestart });
  useEffect(() => {
    latest.current = { initial, onRestart };
  });

  useEffect(() => {
    if (!open) {
      // Closing ends the session, so the next open starts over even if the
      // steward reopens the very same garden.
      startedSession.current = null;
      return;
    }
    if (startedSession.current === sessionKey) return;
    startedSession.current = sessionKey;
    form.reset({ ...COMMITMENT_COMPOSER_DEFAULTS, ...latest.current.initial });
    latest.current.onRestart();
  }, [form, open, sessionKey]);

  useEffect(() => {
    if (!open) return;
    for (const [field, value] of Object.entries(initial)) {
      const name = field as keyof CommitmentComposerValues;
      if (value === undefined || form.getFieldState(name).isDirty) continue;
      if (form.getValues(name) === value) continue;
      // Not dirty: this is the default arriving, not an answer being given.
      form.setValue(name, value as never, { shouldDirty: false });
    }
  }, [form, open, initial]);
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
