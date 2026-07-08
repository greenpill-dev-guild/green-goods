import type { GardenDetailTab, GardenRange, TabBadgeSeverity } from "@green-goods/shared";

export const TAB_TRIGGER_BASE =
  "garden-tab-trigger border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-soft transition-colors hover:border-stroke-sub hover:text-text-sub data-[state=active]:border-primary-base data-[state=active]:text-primary-dark";

export const RANGE_OPTIONS: GardenRange[] = ["7d", "30d", "90d"];

export const TAB_SECTIONS: Record<GardenDetailTab, string[]> = {
  overview: ["health", "activity"],
  impact: ["hypercerts", "assessments", "reporting"],
  work: ["queue", "decisions", "history"],
  community: ["endowment", "payouts", "coordination", "members"],
};

export const BADGE_TONE_CLASSES: Record<Exclude<TabBadgeSeverity, "none">, string> = {
  warn: "bg-warning-lighter text-warning-dark",
  critical: "bg-error-lighter text-error-dark",
};

export const ALERT_LABEL_CLASSES: Record<Exclude<TabBadgeSeverity, "none">, string> = {
  warn: "text-warning-dark",
  critical: "text-error-dark",
};

export const SECTION_CARD_MIN_HEIGHT = "min-h-[14rem]";
export const ACTIVITY_CARD_CLASS = "min-h-[24rem] flex-1";
export const IMPACT_HYPERCERT_CARD_CLASS = "min-h-[24rem] lg:min-h-[calc(100svh-22rem)] flex-1";
