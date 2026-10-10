/** Step model, date helpers, and stepper copy for the W11 pool setup flow. */

import { POOL_PURPOSE_MAX_LENGTH } from "@green-goods/shared/modules/commitment-pooling/pool-charter";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export type PoolSetupIntent = "first-run" | "season" | "campaign" | "open-season" | "open-campaign";

export type StepId = "how" | "cycle" | "split" | "open";

export const STEPS_BY_INTENT: Record<PoolSetupIntent, StepId[]> = {
  "first-run": ["how", "cycle", "split", "open"],
  season: ["cycle", "split", "open"],
  campaign: ["cycle", "split", "open"],
  "open-season": ["split", "open"],
  "open-campaign": ["split", "open"],
};

export const DEFAULT_CAP = "24";
export const DAY = 24 * 60 * 60;

export function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/**
 * The range a fresh open of the flow starts from: today, running a month.
 * Read again on every open, so a discarded edit never comes back and a flow
 * left mounted for days does not offer last week's dates.
 */
export function defaultCycleDates(): { start: string; end: string } {
  const now = Math.floor(Date.now() / 1000);
  return { start: isoDate(now), end: isoDate(now + 30 * DAY) };
}

export function startOfDaySeconds(iso: string): bigint | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const value = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(value) ? BigInt(Math.floor(value / 1000)) : null;
}

export function endOfDaySeconds(iso: string): bigint | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const value = Date.parse(`${iso}T23:59:59`);
  return Number.isFinite(value) ? BigInt(Math.floor(value / 1000)) : null;
}

export interface SetupStepConfig {
  id: StepId;
  title: string;
  description: string;
}

/** The stepper rail: one title and supporting line per step of the chosen intent. */
export function buildStepConfigs(
  steps: StepId[],
  isCampaign: boolean,
  formatMessage: FormatMessage
): SetupStepConfig[] {
  return steps.map((id) => {
    switch (id) {
      case "how":
        return {
          id,
          title: formatMessage({
            id: "cockpit.garden.pool.setup.step.how",
            defaultMessage: "How It Works",
          }),
          description: formatMessage({
            id: "cockpit.garden.pool.setup.step.howHint",
            defaultMessage: "The agreement and the limit",
          }),
        };
      case "cycle":
        return {
          id,
          title: isCampaign
            ? formatMessage({
                id: "cockpit.garden.pool.setup.step.campaign",
                defaultMessage: "The Campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.setup.step.season",
                defaultMessage: "The Season",
              }),
          description: formatMessage({
            id: "cockpit.garden.pool.setup.step.cycleHint",
            defaultMessage: "Name and dates",
          }),
        };
      case "split":
        return {
          id,
          title: formatMessage({
            id: "cockpit.garden.pool.setup.step.split",
            defaultMessage: "The Split",
          }),
          description: formatMessage({
            id: "cockpit.garden.pool.setup.step.splitHint",
            defaultMessage: "Six roles, one hundred percent",
          }),
        };
      case "open":
        return {
          id,
          title: formatMessage({
            id: "cockpit.garden.pool.setup.step.open",
            defaultMessage: "Open",
          }),
          description: formatMessage({
            id: "cockpit.garden.pool.setup.step.openHint",
            defaultMessage: "Check, then sign",
          }),
        };
    }
  });
}

/** The dialog's own title: what this run of the flow is doing. */
export function setupFlowTitle(
  intent: PoolSetupIntent,
  isCampaign: boolean,
  formatMessage: FormatMessage
): string {
  return intent === "first-run"
    ? formatMessage({
        id: "cockpit.garden.pool.setup.title",
        defaultMessage: "Set Up Commitments",
      })
    : isCampaign
      ? formatMessage({
          id: "cockpit.garden.pool.setup.campaignTitle",
          defaultMessage: "Start a Campaign",
        })
      : formatMessage({
          id: "cockpit.garden.pool.setup.seasonTitle",
          defaultMessage: "Start a Season",
        });
}

export interface StepValidity {
  purpose: string;
  capValue: bigint | null;
  name: string;
  datesValid: boolean;
  secondSeasonBlocked: boolean;
  splitValid: boolean;
}

/** Whether a step holds enough to move on. The last step always does. */
export function isStepValid(id: StepId, input: StepValidity): boolean {
  return stepBlockedReason(id, input) === null;
}

/** What a step still needs, as a message, or null when it may move on. */
export interface StepBlockedReason {
  id: string;
  defaultMessage: string;
  values?: Record<string, number>;
}

/** The first thing a step still needs, in the order its fields appear. */
export function stepBlockedReason(id: StepId, input: StepValidity): StepBlockedReason | null {
  switch (id) {
    case "how":
      if (input.purpose.trim().length === 0)
        return {
          id: "cockpit.garden.pool.setup.blocked.purpose",
          defaultMessage: "Say what this pool is for.",
        };
      // An agreement written before the limit can load longer than it, and
      // setup pins it again, so it has to fit before the flow moves on.
      if (input.purpose.length > POOL_PURPOSE_MAX_LENGTH)
        return {
          id: "cockpit.garden.pool.setup.blocked.purposeTooLong",
          defaultMessage: "Shorten the agreement to {max, number} characters or fewer.",
          values: { max: POOL_PURPOSE_MAX_LENGTH },
        };
      if (input.capValue === null || input.capValue <= 0n)
        return {
          id: "cockpit.garden.pool.setup.blocked.cap",
          defaultMessage: "Say how many commitments one person can hold at once.",
        };
      return null;
    case "cycle":
      if (input.name.trim().length === 0)
        return { id: "cockpit.garden.pool.setup.blocked.name", defaultMessage: "Give it a name." };
      if (!input.datesValid)
        return {
          id: "cockpit.garden.pool.setup.blocked.dates",
          defaultMessage: "Choose an end date after the start.",
        };
      if (input.secondSeasonBlocked)
        return {
          id: "cockpit.garden.pool.setup.blocked.secondSeason",
          defaultMessage: "A season is already running here, so open a campaign instead.",
        };
      return null;
    case "split":
      return input.splitValid
        ? null
        : {
            id: "cockpit.garden.pool.setup.blocked.split",
            defaultMessage: "Make each split add up to 100%.",
          };
    case "open":
      return null;
  }
}
