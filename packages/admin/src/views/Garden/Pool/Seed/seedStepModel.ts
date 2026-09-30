import {
  COMMITMENT_COMPOSER_ERROR_IDS,
  type CommitmentComposerValues,
  MAX_COMMITMENT_SET_SIZE,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { CycleMetadataNameResolution } from "@green-goods/shared/modules/commitment-pooling/cycle-metadata";
import {
  COMMITMENT_NOTE_MAX_LENGTH,
  COMMITMENT_TITLE_MAX_LENGTH,
  COMMITMENT_UNIT_LABEL_MAX_LENGTH,
} from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { Action, Address } from "@green-goods/shared/types/domain";
import { hasActionEnded } from "@green-goods/shared/utils/action/window";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { defineMessage } from "react-intl";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import type { SeedMember } from "./SeedConfirmerList";
import { cycleName } from "../poolPresentation";

export type StepId = "what" | "howMuch" | "proof" | "review";
export const STEPS: StepId[] = ["what", "howMuch", "proof", "review"];

export const STEP_FIELDS: Record<StepId, Array<keyof CommitmentComposerValues>> = {
  what: ["kind", "direction", "cycleId", "title", "note"],
  howMuch: ["count", "unitLabel", "targetUnits", "dueInDays", "requirements", "openTeam"],
  proof: [
    "confirmers",
    "confirmationThreshold",
    "protocolFallbackEnabled",
    "claimMode",
    "considerationRail",
    "considerationSource",
    "considerationToken",
    "considerationAmount",
    "considerationUsd",
  ],
  review: [],
};

/**
 * The fields a step checks before the wizard moves on. Garden work is counted
 * in hours, set when the kind is chosen, so its How Much step asks no unit.
 */
export function stepFieldsFor(
  step: StepId,
  kind: CommitmentComposerValues["kind"]
): Array<keyof CommitmentComposerValues> {
  const fields = STEP_FIELDS[step];
  return step === "howMuch" && kind === "GARDEN_WORK"
    ? fields.filter((field) => field !== "unitLabel")
    : fields;
}

/** Why creating is off, the first reason first, or null when it may go ahead. */
export function seedBlockedReason(input: {
  poolOpen: boolean;
  capacityOver: boolean;
  /** A reward is in dollars and today's G$ price can't be read to convert it. */
  priceUnavailable: boolean;
}): { id: string; defaultMessage: string } | null {
  if (!input.poolOpen)
    return defineMessage({
      id: "cockpit.garden.pool.seed.blocked.poolClosed",
      defaultMessage: "Open the pool before seeding into it.",
    });
  if (input.capacityOver)
    return defineMessage({
      id: "cockpit.garden.pool.seed.blocked.capacity",
      defaultMessage: "That is more offers than this pool has room for.",
    });
  if (input.priceUnavailable)
    return defineMessage({
      id: "cockpit.garden.pool.seed.blocked.price",
      defaultMessage: "A reward is in dollars, and today's G$ price can't be read to convert it.",
    });
  return null;
}

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

/** Who is offered as a confirmer, in this order. */
const MEMBER_ROLES = ["steward", "evaluator", "gardener", "owner"] as const satisfies GardenRole[];

type GardenPeople = Partial<
  Record<"stewards" | "evaluators" | "gardeners" | "owners", readonly Address[]>
>;

/** The garden's people to offer as confirmers: each person once, under their first role. */
export function seedMembers(garden: GardenPeople | undefined): SeedMember[] {
  if (!garden) return [];
  const seen = new Set<string>();
  const lists: Record<(typeof MEMBER_ROLES)[number], readonly Address[]> = {
    steward: garden.stewards ?? [],
    evaluator: garden.evaluators ?? [],
    gardener: garden.gardeners ?? [],
    owner: garden.owners ?? [],
  };
  return MEMBER_ROLES.flatMap((role) =>
    lists[role].flatMap((address) => {
      const key = address.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ address, role }];
    })
  );
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

/** A translated message, with the numbers it names taken from their constants. */
interface SeedErrorMessage {
  id: string;
  defaultMessage: string;
  values?: Record<string, number>;
}

/**
 * The composer's messages for the text fields and the rules this console added
 * are message ids, so a steward reads them in their own language rather than
 * the schema's developer English. Anything else the schema says is passed
 * through as it is.
 */
const SEED_ERROR_MESSAGES = {
  titleRequired: {
    id: "cockpit.garden.pool.seed.error.titleRequired",
    defaultMessage: "Give it a name.",
  },
  titleTooLong: {
    id: "cockpit.garden.pool.seed.error.titleTooLong",
    defaultMessage: "Shorten the title to {max, number} characters or fewer.",
    values: { max: COMMITMENT_TITLE_MAX_LENGTH },
  },
  unitRequired: {
    id: "cockpit.garden.pool.seed.error.unitRequired",
    defaultMessage: "Say what you are counting.",
  },
  unitTooLong: {
    id: "cockpit.garden.pool.seed.error.unitTooLong",
    defaultMessage: "Shorten the unit to {max, number} characters or fewer.",
    values: { max: COMMITMENT_UNIT_LABEL_MAX_LENGTH },
  },
  noteTooLong: {
    id: "cockpit.garden.pool.seed.error.noteTooLong",
    defaultMessage: "Shorten the note to {max, number} characters or fewer.",
    values: { max: COMMITMENT_NOTE_MAX_LENGTH },
  },
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
    defaultMessage: "Enter an amount above zero.",
  },
  countAtLeastOne: {
    id: "cockpit.garden.pool.seed.error.countAtLeastOne",
    defaultMessage: "Create at least one promise.",
  },
  countTooMany: {
    id: "cockpit.garden.pool.seed.error.countTooMany",
    defaultMessage: "Create {max, number} promises or fewer at once.",
    values: { max: MAX_COMMITMENT_SET_SIZE },
  },
  considerationUsd: {
    id: "cockpit.garden.pool.seed.error.considerationUsd",
    defaultMessage: "Enter an amount in dollars above zero, like 5.00.",
  },
} satisfies Record<keyof typeof COMMITMENT_COMPOSER_ERROR_IDS, SeedErrorMessage>;

/** What the schema said, keyed by the id it said it with. */
const SEED_ERROR_DESCRIPTOR_BY_ID = new Map<string, SeedErrorMessage>(
  Object.entries(COMMITMENT_COMPOSER_ERROR_IDS).map(([rule, id]) => [
    id,
    SEED_ERROR_MESSAGES[rule as keyof typeof SEED_ERROR_MESSAGES],
  ])
);

/**
 * What the composer said, in the steward's words: an id is translated, with
 * any limit it names; the composer's remaining messages are English prose and
 * are shown as they are.
 */
export function seedErrorText(message: string, formatMessage: FormatMessage): string {
  const descriptor = SEED_ERROR_DESCRIPTOR_BY_ID.get(message);
  if (!descriptor) return message;
  const { values, ...messageDescriptor } = descriptor;
  return formatMessage(messageDescriptor, values);
}

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

/** Chosen garden actions whose inclusive Work window has already ended. */
export function closedSeedActions(
  values: CommitmentComposerValues,
  actions: readonly Action[],
  chainId: number,
  now: number
): Action[] {
  if (values.kind !== "GARDEN_WORK") return [];
  return values.requirements.flatMap(({ actionUID }) => {
    const action = actions.find((candidate) => actionUIDOf(candidate.id, chainId) === actionUID);
    return action && hasActionEnded(action, now) ? [action] : [];
  });
}

/** The first closed chosen action across the current draft and parked tray. */
export function closedSeedActionMessage(input: {
  rows: readonly CommitmentComposerValues[];
  actions: readonly Action[];
  chainId: number;
  now: number;
  formatMessage: FormatMessage;
}): string | null {
  const { rows, actions, chainId, now, formatMessage } = input;
  const closed = rows.flatMap((row) => closedSeedActions(row, actions, chainId, now))[0];
  return closed
    ? formatMessage(
        {
          id: "app.compose.blocked.closedAction",
          defaultMessage:
            "{action} has closed and can't take work any more. Remove it to continue.",
        },
        { action: closed.title }
      )
    : null;
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
        id: "cockpit.garden.pool.seed.step.whatPromiseHint",
        defaultMessage: "The kind of promise, in its words",
      }),
    },
    {
      id: "howMuch",
      title: formatMessage({
        id: "cockpit.garden.pool.seed.step.howMuch",
        defaultMessage: "How Much",
      }),
      description: formatMessage({
        id: "cockpit.garden.pool.seed.step.howManyHint",
        defaultMessage: "How many, what each asks, and the team",
      }),
    },
    {
      id: "proof",
      title: formatMessage({
        id: "cockpit.garden.pool.seed.step.proof",
        defaultMessage: "Proof & Confirmation",
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
