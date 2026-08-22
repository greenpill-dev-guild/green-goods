import type { CommitmentComposerValues } from "@green-goods/shared";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";

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

/** A confirmer entry is only addable once it is a well-formed 20-byte address. */
export const CONFIRMER_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

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
