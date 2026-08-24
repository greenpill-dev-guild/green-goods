import {
  COMMITMENT_COMPOSER_ERROR_IDS,
  type CommitmentComposerValues,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { CycleMetadataNameResolution } from "@green-goods/shared/modules/commitment-pooling/cycle-metadata";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import { cycleName } from "../poolPresentation";

export type StepId = "what" | "howMuch" | "proof" | "review";
export const STEPS: StepId[] = ["what", "howMuch", "proof", "review"];

export const STEP_FIELDS: Record<StepId, Array<keyof CommitmentComposerValues>> = {
  what: ["kind", "direction", "cycleId", "title", "note"],
  howMuch: ["unitLabel", "targetUnits", "dueInDays", "requirements", "openTeam"],
  proof: [
    "confirmers",
    "confirmationThreshold",
    "protocolFallbackEnabled",
    "claimMode",
    "considerationRail",
    "considerationSource",
    "considerationToken",
    "considerationAmount",
  ],
  review: [],
};

export const SELECT_CLASS =
  "w-full rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] disabled:opacity-[0.38]";

/**
 * A confirmer entry is only addable once it is a well-formed 20-byte address,
 * and never the zero address: `CreditLib.eligibleNamedConfirmerCount` skips
 * that one while counting who may confirm, so naming it leaves the threshold
 * unreachable and the commitment cannot be repaired once accepted.
 */
export const CONFIRMER_ADDRESS_PATTERN = /^0x(?!0{40}$)[0-9a-fA-F]{40}$/;

/**
 * The named group with one more confirmer, or null when the draft is not an
 * addable address or is already in the group.
 */
export function withConfirmer(current: string[], draft: string): string[] | null {
  const candidate = draft.trim();
  if (!CONFIRMER_ADDRESS_PATTERN.test(candidate)) return null;
  const alreadyNamed = current.some((address) => address.toLowerCase() === candidate.toLowerCase());
  return alreadyNamed ? null : [...current, candidate];
}

/** One entry of the seeding console's cycle selector: the season, a campaign, or cycle-less. */
export interface SeedCycleOption {
  value: string;
  label: string;
}

/** Reads a composer field's validation message, or undefined while it is clean. */
export type SeedFieldError = (field: keyof CommitmentComposerValues) => string | undefined;

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

/**
 * The composer's messages for the rules this console added are message ids, so
 * a steward reads them in their own language rather than the schema's
 * developer English. Anything else the schema says is passed through as it is.
 */
const SEED_ERROR_MESSAGES = {
  confirmersTooMany: {
    id: "cockpit.garden.pool.seed.error.confirmersTooMany",
    defaultMessage: "That is more confirmers than one commitment can name.",
  },
  thresholdAtLeastOne: {
    id: "cockpit.garden.pool.seed.error.thresholdAtLeastOne",
    defaultMessage: "At least one confirmation is needed.",
  },
  thresholdAboveGroup: {
    id: "cockpit.garden.pool.seed.error.thresholdAboveGroup",
    defaultMessage: "That asks for more confirmations than there are named confirmers.",
  },
  considerationSource: {
    id: "cockpit.garden.pool.seed.error.considerationSource",
    defaultMessage: "Name the address the payout comes from.",
  },
  considerationToken: {
    id: "cockpit.garden.pool.seed.error.considerationToken",
    defaultMessage: "Name the token address.",
  },
  considerationAmount: {
    id: "cockpit.garden.pool.seed.error.considerationAmount",
    defaultMessage: "Enter a whole amount above zero.",
  },
} satisfies Record<
  keyof typeof COMMITMENT_COMPOSER_ERROR_IDS,
  { id: string; defaultMessage: string }
>;

/** What the schema said, keyed by the id it said it with. */
export const SEED_ERROR_DESCRIPTOR_BY_ID = new Map(
  Object.entries(COMMITMENT_COMPOSER_ERROR_IDS).map(([rule, id]) => [
    id as string,
    SEED_ERROR_MESSAGES[rule as keyof typeof SEED_ERROR_MESSAGES],
  ])
);

/**
 * The seeding console's cycle selector: the one season, then the campaigns
 * beside it, then cycle-less last.
 */
export function buildSeedCycleOptions(input: {
  season: CommitmentCycleRecord | null;
  campaigns: readonly CommitmentCycleRecord[];
  cycleNames: ReadonlyMap<string, CycleMetadataNameResolution>;
  formatMessage: FormatMessage;
}): SeedCycleOption[] {
  const { season, campaigns, cycleNames, formatMessage } = input;
  const seasonKind = formatMessage({
    id: "cockpit.garden.pool.cycle.season",
    defaultMessage: "Season",
  });
  const campaignKind = formatMessage({
    id: "cockpit.garden.pool.cycle.campaign",
    defaultMessage: "Campaign",
  });
  return [
    ...(season
      ? [
          {
            value: season.cycleId.toString(),
            label: `${seasonKind} · ${cycleName(season, cycleNames, formatMessage)}`,
          },
        ]
      : []),
    ...campaigns.map((campaign) => ({
      value: campaign.cycleId.toString(),
      label: `${campaignKind} · ${cycleName(campaign, cycleNames, formatMessage)}`,
    })),
    {
      value: "0",
      label: formatMessage({
        id: "cockpit.garden.pool.seed.cycleless",
        defaultMessage: "No cycle (runs on its own)",
      }),
    },
  ];
}

export function actionUIDOf(actionId: string, chainId: number): string | null {
  const prefix = `${chainId}-`;
  if (!actionId.startsWith(prefix)) return null;
  const uid = actionId.slice(prefix.length);
  return /^\d+$/.test(uid) ? uid : null;
}

/** The four steps of the seeding console, in order, as the flow shell wants them. */
export function buildSeedStepConfigs(formatMessage: FormatMessage): ActionFlowStep[] {
  return [
    {
      id: "what",
      title: formatMessage({ id: "cockpit.garden.pool.seed.step.what", defaultMessage: "What" }),
      description: formatMessage({
        id: "cockpit.garden.pool.seed.step.whatHint",
        defaultMessage: "The kind of commitment, in its words",
      }),
    },
    {
      id: "howMuch",
      title: formatMessage({
        id: "cockpit.garden.pool.seed.step.howMuch",
        defaultMessage: "How much",
      }),
      description: formatMessage({
        id: "cockpit.garden.pool.seed.step.howMuchHint",
        defaultMessage: "Units, target, due, and the team",
      }),
    },
    {
      id: "proof",
      title: formatMessage({
        id: "cockpit.garden.pool.seed.step.proof",
        defaultMessage: "Proof & confirmation",
      }),
      description: formatMessage({
        id: "cockpit.garden.pool.seed.step.proofHint",
        defaultMessage: "Who confirms, how it's claimed",
      }),
    },
    {
      id: "review",
      title: formatMessage({
        id: "cockpit.garden.pool.seed.step.review",
        defaultMessage: "Review",
      }),
      description: formatMessage({
        id: "cockpit.garden.pool.seed.step.reviewHint",
        defaultMessage: "Sectioned check, then seed",
      }),
    },
  ];
}
