import type { GardenRange, TabBadgeSeverity } from "@green-goods/shared/types/garden-detail";

export const RANGE_OPTIONS: GardenRange[] = ["7d", "30d", "90d"];

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
