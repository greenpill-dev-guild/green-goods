/** Step model, date helpers, and stepper copy for the W11 pool setup flow. */

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
            defaultMessage: "How it works",
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
                defaultMessage: "The campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.setup.step.season",
                defaultMessage: "The season",
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
            defaultMessage: "The split",
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
            defaultMessage: "Check, then write",
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
        defaultMessage: "Set up commitments",
      })
    : isCampaign
      ? formatMessage({
          id: "cockpit.garden.pool.setup.campaignTitle",
          defaultMessage: "Start a campaign",
        })
      : formatMessage({
          id: "cockpit.garden.pool.setup.seasonTitle",
          defaultMessage: "Start a season",
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
  switch (id) {
    case "how":
      return input.purpose.trim().length > 0 && input.capValue !== null && input.capValue > 0n;
    case "cycle":
      return input.name.trim().length > 0 && input.datesValid && !input.secondSeasonBlocked;
    case "split":
      return input.splitValid;
    case "open":
      return true;
  }
}
