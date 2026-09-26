import type { Address } from "./domain";
import type { GardenRole } from "../utils/blockchain/garden-roles";

export type GardenDetailTab = "overview" | "impact" | "work" | "community";
export type GardenRange = "7d" | "30d" | "90d";
export type TabBadgeSeverity = "none" | "warn" | "critical";
export type ActivityFilter = "all" | "work" | "impact" | "community";

export interface TabBadgeState {
  severity: TabBadgeSeverity;
  count?: number;
}

export interface TabAction {
  key: string;
  label: string;
  to?: string;
  onSelect?: () => void;
}

export interface GardenActivityEvent {
  id: string;
  category: Exclude<ActivityFilter, "all">;
  title: string;
  description: string;
  timestamp: number;
  href?: string;
  itemId?: string;
}

export interface RoleDirectoryEntry {
  address: Address;
  roles: GardenRole[];
}

/** A work no decision has settled yet. */
export interface GardenWaitingWork {
  id: string;
  /** When it was submitted, in seconds as the indexer reports it. */
  submittedAt: number;
}

/**
 * A garden's review queue as its whole indexed history reports it, for a
 * garden with more work than the newest page a screen reads.
 */
export type GardenReviewQueue = {
  /** When the garden's latest decision was indexed, in seconds; null when it has none. */
  lastReviewedAt: number | null;
} & (
  | {
      /** Every work no decision has settled, oldest first. */
      waiting: GardenWaitingWork[];
    }
  | {
      /** The history is longer than one read lists, so only counts are known. */
      waiting: null;
      /**
       * Each decision settles at most one work, and a work can be decided more
       * than once, so the garden's works less its decisions is a floor.
       */
      waitingAtLeast: number;
      /** The same floor for work submitted a week or more before the read. */
      waitingOverWeekAtLeast: number;
    }
);
