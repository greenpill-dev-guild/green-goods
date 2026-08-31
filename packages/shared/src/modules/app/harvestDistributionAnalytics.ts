import { ANALYTICS_EVENTS, createTracker, type AuthMode } from "./analytics-events";

type HarvestDistributionSafeMetadata = {
  chainId: number;
  assetSymbol: string;
  authMode: Exclude<AuthMode, null>;
  startedWithHarvest: boolean;
  hadPendingYield: boolean;
  thresholdMetBefore: boolean;
};

const options = { includeSessionId: false };

export const trackHarvestDistributionStarted = createTracker<HarvestDistributionSafeMetadata>(
  ANALYTICS_EVENTS.ADMIN_HARVEST_DISTRIBUTION_STARTED,
  options
);

export const trackHarvestDistributionHarvest = createTracker<
  HarvestDistributionSafeMetadata & {
    outcome: "confirmed" | "submitted" | "failed";
    durationMs: number;
    errorCategory?: string;
  }
>(ANALYTICS_EVENTS.ADMIN_HARVEST_DISTRIBUTION_HARVEST, options);

export const trackHarvestDistributionOutcome = createTracker<
  HarvestDistributionSafeMetadata & {
    outcome: "distributed" | "submitted" | "waiting" | "pending" | "unverified" | "failed";
    durationMs: number;
    errorCategory?: string;
  }
>(ANALYTICS_EVENTS.ADMIN_HARVEST_DISTRIBUTION_OUTCOME, options);
