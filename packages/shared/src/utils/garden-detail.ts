import type {
  GardenDetailTab,
  GardenRange,
  TabBadgeSeverity,
  TabBadgeState,
} from "../types/garden-detail";
import { Domain } from "../types/domain";

export function toMs(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

export function hoursSince(timestamp: number): number {
  return (Date.now() - toMs(timestamp)) / (1000 * 60 * 60);
}

export function parseGardenDetailTab(tab: string | null): GardenDetailTab {
  if (tab === "overview" || tab === "impact" || tab === "work" || tab === "community") {
    return tab;
  }
  return "overview";
}

export function parseGardenRange(range: string | null): GardenRange {
  if (range === "7d" || range === "30d" || range === "90d") {
    return range;
  }
  return "30d";
}

export function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function getSeverityRank(severity: TabBadgeSeverity): number {
  if (severity === "critical") return 2;
  if (severity === "warn") return 1;
  return 0;
}

export function aggregateBadges(badges: TabBadgeState[]): TabBadgeState {
  const nonNone = badges.filter((badge) => badge.severity !== "none");
  if (nonNone.length === 0) {
    return { severity: "none" };
  }

  const highestSeverity = nonNone.reduce<TabBadgeSeverity>((highest, badge) => {
    return getSeverityRank(badge.severity) > getSeverityRank(highest) ? badge.severity : highest;
  }, "none");

  const count = nonNone.reduce((total, badge) => total + (badge.count ?? 0), 0);

  return { severity: highestSeverity, count: count > 0 ? count : undefined };
}

export const RANGE_TO_MS: Record<GardenRange, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export const DOMAIN_LABEL_IDS: Record<Domain, string> = {
  [Domain.SOLAR]: "app.domain.tab.solar",
  [Domain.AGRO]: "app.domain.tab.agro",
  [Domain.EDU]: "app.domain.tab.education",
  [Domain.WASTE]: "app.domain.tab.waste",
};
