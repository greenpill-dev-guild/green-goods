import type { Address, GardenRole } from "@green-goods/shared";

export type GardenTab = "overview" | "impact" | "work" | "community";
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
