import {
  type Address,
  expandDomainMask,
  formatDate,
  formatTokenAmount,
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared";
import { useMemo } from "react";
import type { IntlShape } from "react-intl";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { DOMAIN_LABEL_IDS, RANGE_TO_MS } from "./gardenDetail.constants";
import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenRange,
  GardenTab,
  RoleDirectoryEntry,
  TabBadgeSeverity,
  TabBadgeState,
} from "./gardenDetail.types";
import { aggregateBadges, getMedian, hoursSince, toMs } from "./gardenDetail.utils";

interface DerivedStateInput {
  garden: { id: string; domainMask?: number; name: string; chainId: number };
  works: Array<{
    id: string;
    title?: string;
    status: string;
    createdAt: number;
  }>;
  assessments: Array<{
    id: string;
    title?: string;
    assessmentType?: string;
    createdAt: number;
  }>;
  hypercerts: Array<{
    id: string;
    title?: string;
    mintedAt?: number;
  }>;
  allocations: Array<{
    txHash: string;
    timestamp: number;
    cookieJarAmount: bigint;
    fractionsAmount: bigint;
    juiceboxAmount: bigint;
  }>;
  gardenVaults: Array<unknown>;
  vaultNetDeposited: bigint;
  roleMembers: Record<GardenRole, Address[]>;
  selectedRange: GardenRange;
  activityFilter: ActivityFilter;
  memberSearch: string;
  section: string | undefined;
  formatMessage: IntlShape["formatMessage"];
  openSection: (tab: GardenTab, section: string, itemId?: string) => void;
}

export function useGardenDerivedState({
  garden,
  works,
  assessments,
  hypercerts,
  allocations,
  gardenVaults,
  vaultNetDeposited,
  roleMembers,
  selectedRange,
  activityFilter,
  memberSearch,
  section,
  formatMessage,
  openSection,
}: DerivedStateInput) {
  const now = Date.now();
  const rangeStart = now - RANGE_TO_MS[selectedRange];
  const previousRangeStart = rangeStart - RANGE_TO_MS[selectedRange];

  const pendingWorks = works.filter((work) => work.status === "pending");
  const reviewedWorks = works
    .filter((work) => work.status !== "pending")
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const approvedWorks = works.filter((work) => work.status === "approved");

  const pendingWarningCount = pendingWorks.filter(
    (work) => hoursSince(work.createdAt) >= 24
  ).length;
  const pendingCriticalCount = pendingWorks.filter(
    (work) => hoursSince(work.createdAt) >= 72
  ).length;

  const approvedInRangeCount = approvedWorks.filter(
    (work) => toMs(work.createdAt) >= rangeStart
  ).length;
  const approvedInPreviousRangeCount = approvedWorks.filter((work) => {
    const createdAtMs = toMs(work.createdAt);
    return createdAtMs >= previousRangeStart && createdAtMs < rangeStart;
  }).length;

  const impactVelocityDelta = approvedInRangeCount - approvedInPreviousRangeCount;

  const reviewAges = reviewedWorks.map((work) => hoursSince(work.createdAt));
  const medianReviewAgeHours = getMedian(reviewAges);

  const approvedInLastThirtyDays = approvedWorks.filter(
    (work) => toMs(work.createdAt) >= now - RANGE_TO_MS["30d"]
  ).length;
  const isImpactStale = approvedInLastThirtyDays === 0;

  const hasVaults = gardenVaults.length > 0;
  const treasurySeverity: TabBadgeSeverity = !hasVaults
    ? "warn"
    : vaultNetDeposited === 0n
      ? "critical"
      : "none";

  const workBadge: TabBadgeState =
    pendingCriticalCount > 0
      ? { severity: "critical", count: pendingCriticalCount }
      : pendingWarningCount > 0
        ? { severity: "warn", count: pendingWarningCount }
        : { severity: "none" };

  const impactBadge: TabBadgeState = isImpactStale
    ? { severity: "warn", count: 1 }
    : { severity: "none" };

  const communityBadge: TabBadgeState =
    treasurySeverity === "none" ? { severity: "none" } : { severity: treasurySeverity, count: 1 };

  const overviewBadge = aggregateBadges([impactBadge, workBadge, communityBadge]);

  const tabBadges: Record<GardenTab, TabBadgeState> = {
    overview: overviewBadge,
    impact: impactBadge,
    work: workBadge,
    community: communityBadge,
  };

  const domainLabels =
    typeof garden.domainMask === "number"
      ? expandDomainMask(garden.domainMask).map((domain) =>
          formatMessage({ id: DOMAIN_LABEL_IDS[domain] })
        )
      : [];

  const gardenHealthSeverity: TabBadgeSeverity =
    workBadge.severity === "critical" || treasurySeverity === "critical"
      ? "critical"
      : workBadge.severity === "warn" ||
          treasurySeverity === "warn" ||
          impactBadge.severity === "warn"
        ? "warn"
        : "none";

  const gardenHealthLabel =
    gardenHealthSeverity === "critical"
      ? formatMessage({ id: "app.garden.detail.health.status.critical" })
      : gardenHealthSeverity === "warn"
        ? formatMessage({ id: "app.garden.detail.health.status.attention" })
        : formatMessage({ id: "app.garden.detail.health.status.healthy" });

  const overviewAlerts = [
    pendingCriticalCount > 0
      ? {
          key: "work-critical",
          severity: "critical" as const,
          label: formatMessage(
            { id: "app.garden.detail.alert.workCritical" },
            { count: pendingCriticalCount }
          ),
          onAction: () => openSection("work", "queue"),
        }
      : pendingWarningCount > 0
        ? {
            key: "work-warning",
            severity: "warn" as const,
            label: formatMessage(
              { id: "app.garden.detail.alert.workWarning" },
              { count: pendingWarningCount }
            ),
            onAction: () => openSection("work", "queue"),
          }
        : null,
    isImpactStale
      ? {
          key: "impact-stale",
          severity: "warn" as const,
          label: formatMessage({ id: "app.garden.detail.alert.impactStale" }),
          onAction: () => openSection("impact", "reporting"),
        }
      : null,
    treasurySeverity === "critical"
      ? {
          key: "treasury-critical",
          severity: "critical" as const,
          label: formatMessage({ id: "app.garden.detail.alert.treasuryEmpty" }),
          onAction: () => openSection("community", "treasury"),
        }
      : treasurySeverity === "warn"
        ? {
            key: "treasury-warning",
            severity: "warn" as const,
            label: formatMessage({ id: "app.garden.detail.alert.treasuryMissing" }),
            onAction: () => openSection("community", "treasury"),
          }
        : null,
  ].filter(
    (
      entry
    ): entry is {
      key: string;
      severity: "warn" | "critical";
      label: string;
      onAction: () => void;
    } => entry !== null
  );

  const activityEvents: GardenActivityEvent[] = [
    ...works.map((work) => ({
      id: `work-${work.id}`,
      category: "work" as const,
      title: work.title || formatMessage({ id: "app.admin.work.untitledWork" }),
      description: formatMessage(
        { id: "app.garden.detail.activity.workStatus" },
        {
          status: formatMessage({ id: `app.admin.work.filter.${work.status}` }),
          date: formatDate(work.createdAt, { dateStyle: "medium" }),
        }
      ),
      timestamp: toMs(work.createdAt),
      href: `/gardens/${garden.id}/work/${work.id}`,
      itemId: work.id,
    })),
    ...assessments.map((assessment) => ({
      id: `assessment-${assessment.id}`,
      category: "impact" as const,
      title:
        assessment.title ||
        assessment.assessmentType ||
        formatMessage({ id: "app.garden.admin.assessmentFallback" }),
      description: formatMessage(
        { id: "app.garden.detail.activity.assessmentCreated" },
        { date: formatDate(assessment.createdAt, { dateStyle: "medium" }) }
      ),
      timestamp: toMs(assessment.createdAt),
      href: `/gardens/${garden.id}/assessments`,
      itemId: assessment.id,
    })),
    ...hypercerts.map((hypercert) => ({
      id: `hypercert-${hypercert.id}`,
      category: "impact" as const,
      title: hypercert.title?.trim() || formatMessage({ id: "app.hypercerts.list.fallbackTitle" }),
      description: formatMessage(
        { id: "app.garden.detail.activity.hypercertMinted" },
        {
          date: hypercert.mintedAt
            ? formatDate(hypercert.mintedAt * 1000, { dateStyle: "medium" })
            : formatMessage({ id: "app.hypercerts.list.dateUnknown" }),
        }
      ),
      timestamp: hypercert.mintedAt ? toMs(hypercert.mintedAt) : 0,
      href: `/gardens/${garden.id}/hypercerts/${hypercert.id}`,
      itemId: hypercert.id,
    })),
    ...allocations.map((allocation) => ({
      id: `allocation-${allocation.txHash}`,
      category: "community" as const,
      title: formatMessage({ id: "app.garden.detail.activity.yieldAllocated" }),
      description: formatMessage(
        { id: "app.garden.detail.activity.yieldAllocationAmount" },
        {
          amount: formatTokenAmount(
            allocation.cookieJarAmount + allocation.fractionsAmount + allocation.juiceboxAmount
          ),
        }
      ),
      timestamp: toMs(allocation.timestamp),
      href: `/gardens/${garden.id}?tab=community&section=yield`,
      itemId: allocation.txHash,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const filteredActivityEvents =
    activityFilter === "all"
      ? activityEvents
      : activityEvents.filter((event) => event.category === activityFilter);

  const roleSummary = GARDEN_ROLE_ORDER.map((role) => ({
    role,
    count: roleMembers[role].length,
    firstMember: roleMembers[role][0],
  }));

  const directoryEntries: RoleDirectoryEntry[] = useMemo(() => {
    const map = new Map<Address, RoleDirectoryEntry>();

    for (const role of GARDEN_ROLE_ORDER) {
      for (const memberAddress of roleMembers[role]) {
        const existing = map.get(memberAddress);
        if (existing) {
          existing.roles.push(role);
          continue;
        }

        map.set(memberAddress, { address: memberAddress, roles: [role] });
      }
    }

    return Array.from(map.values());
  }, [roleMembers]);

  const filteredDirectory = directoryEntries.filter((entry) => {
    const normalizedSearch = memberSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;

    if (entry.address.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    return entry.roles.some((role) => {
      const label = getRoleLabel(role, formatMessage);
      return (
        label.singular.toLowerCase().includes(normalizedSearch) ||
        label.plural.toLowerCase().includes(normalizedSearch)
      );
    });
  });

  const visibleDirectory =
    section === "members" ? filteredDirectory : filteredDirectory.slice(0, 8);

  return {
    pendingWorks,
    reviewedWorks,
    approvedWorks,
    pendingWarningCount,
    pendingCriticalCount,
    approvedInRangeCount,
    impactVelocityDelta,
    medianReviewAgeHours,
    approvedInLastThirtyDays,
    isImpactStale,
    hasVaults,
    treasurySeverity,
    workBadge,
    impactBadge,
    communityBadge,
    overviewBadge,
    tabBadges,
    domainLabels,
    gardenHealthSeverity,
    gardenHealthLabel,
    overviewAlerts,
    activityEvents,
    filteredActivityEvents,
    roleSummary,
    directoryEntries,
    filteredDirectory,
    visibleDirectory,
  };
}
