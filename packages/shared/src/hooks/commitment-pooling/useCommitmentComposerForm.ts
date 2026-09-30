/**
 * Commitment Composer Form Hook
 *
 * React Hook Form + Zod for the member's create-a-commitment flow and the
 * steward's seeding. The translation from these answers to the payload the
 * contract takes is `modules/commitment-pooling/creation-payload`, re-exported
 * here as `buildCommitmentCreationPayload`.
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

import {
  COMMITMENT_NOTE_MAX_LENGTH,
  COMMITMENT_TITLE_MAX_LENGTH,
  COMMITMENT_UNIT_LABEL_MAX_LENGTH,
} from "../../modules/commitment-pooling/metadata";
import { MAX_LINKED_WORKS_PER_COMMITMENT } from "../../modules/commitment-pooling/acts";
import { parseUsdCents } from "../../modules/wallet/good-dollar-price";

/**
 * The module's own ceiling (`CommitmentPoolingCommonLib.MAX_REQUIREMENTS`).
 * A validation limit, never a planning rule: no surface presents it as how
 * many a commitment should have.
 */
export const MAX_COMMITMENT_REQUIREMENTS = 40;

/**
 * The most separate commitments one seeding answer creates: the sending's limit,
 * not the chain's. Fifty is five bundled approvals, or fifty prompts one by one.
 */
export const MAX_COMMITMENT_SET_SIZE = 50;

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
 * Message ids the steward's seeding console resolves through `formatMessage`.
 * It renders the schema's message directly, so an id is the only way a Spanish
 * or Portuguese steward reads one in their language. The rules the console
 * added carry ids, and so do the title, unit and note rules, whose fields it
 * shares with the member composer. The member composer never shows a schema
 * message: it says the missing thing in its own words instead.
 */
export const COMMITMENT_COMPOSER_ERROR_IDS = {
  titleRequired: "cockpit.garden.pool.seed.error.titleRequired",
  titleTooLong: "cockpit.garden.pool.seed.error.titleTooLong",
  unitRequired: "cockpit.garden.pool.seed.error.unitRequired",
  unitTooLong: "cockpit.garden.pool.seed.error.unitTooLong",
  noteTooLong: "cockpit.garden.pool.seed.error.noteTooLong",
  confirmersTooMany: "cockpit.garden.pool.seed.error.confirmersTooMany",
  thresholdAtLeastOne: "cockpit.garden.pool.seed.error.thresholdAtLeastOne",
  thresholdAboveGroup: "cockpit.garden.pool.seed.error.thresholdAboveGroup",
  considerationSource: "cockpit.garden.pool.seed.error.considerationSource",
  considerationToken: "cockpit.garden.pool.seed.error.considerationToken",
  considerationAmount: "cockpit.garden.pool.seed.error.considerationAmount",
  countAtLeastOne: "cockpit.garden.pool.seed.error.countAtLeastOne",
  countTooMany: "cockpit.garden.pool.seed.error.countTooMany",
  considerationUsd: "cockpit.garden.pool.seed.error.considerationUsd",
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
    title: z
      .string()
      .trim()
      .min(1, COMMITMENT_COMPOSER_ERROR_IDS.titleRequired)
      .max(COMMITMENT_TITLE_MAX_LENGTH, COMMITMENT_COMPOSER_ERROR_IDS.titleTooLong),
    /** Optional context, in the member's words. Goes into the metadata document as `note`. */
    note: z
      .string()
      .trim()
      .max(COMMITMENT_NOTE_MAX_LENGTH, COMMITMENT_COMPOSER_ERROR_IDS.noteTooLong)
      .optional(),
    /** Web addresses that belong with it. */
    links: z.array(webLink).max(10, "That is a lot of links"),
    /** What is being counted, in the member's own words: "hours", "rides". */
    unitLabel: z
      .string()
      .trim()
      .min(1, COMMITMENT_COMPOSER_ERROR_IDS.unitRequired)
      .max(COMMITMENT_UNIT_LABEL_MAX_LENGTH, COMMITMENT_COMPOSER_ERROR_IDS.unitTooLong),
    targetUnits: z.number().int().positive("How many?"),
    /** How many separate commitments (seeding only; absent is one); `targetUnits` is each one's. */
    count: z
      .number({ error: COMMITMENT_COMPOSER_ERROR_IDS.countAtLeastOne })
      .int(COMMITMENT_COMPOSER_ERROR_IDS.countAtLeastOne)
      .min(1, COMMITMENT_COMPOSER_ERROR_IDS.countAtLeastOne)
      .max(MAX_COMMITMENT_SET_SIZE, COMMITMENT_COMPOSER_ERROR_IDS.countTooMany)
      .optional(),
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
    /**
     * A G$ reward in dollars, as the steward typed it (seeding only, PRD-1022 D13).
     * While set it stands in for `considerationAmount`, converted at Create.
     */
    considerationUsd: z.string().trim().optional(),
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
    if (values.considerationRail === "CELO_SETTLEMENT" && values.considerationUsd !== undefined) {
      const cents = parseUsdCents(values.considerationUsd);
      if (cents === null || cents === 0n) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["considerationUsd"],
          message: COMMITMENT_COMPOSER_ERROR_IDS.considerationUsd,
        });
      }
    } else if (values.considerationRail !== "NONE") {
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
    if (open) applyLateComposerDefaults(form, initial);
  }, [form, open, initial]);
}

/**
 * Give the form answers that arrived after it was built: a default only a query
 * could supply, or the commitment it is being composed again from.
 *
 * Field by field, and only where nobody has typed, so a late answer never
 * overwrites the person's own.
 */
export function applyLateComposerDefaults(
  form: UseFormReturn<CommitmentComposerValues>,
  values: Partial<CommitmentComposerValues>
): void {
  for (const [field, value] of Object.entries(values)) {
    const name = field as keyof CommitmentComposerValues;
    if (value === undefined || form.getFieldState(name).isDirty) continue;
    if (form.getValues(name) === value) continue;
    // Not dirty: this is the default arriving, not an answer being given.
    form.setValue(name, value as never, { shouldDirty: false });
  }
}

/** Built beside the other commitment modules; callers import it from the form they fill. */
export { buildCommitmentCreationPayload } from "../../modules/commitment-pooling/creation-payload";
