import { useMemo } from "react";
import type { CookieJar } from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import { adminRoutes } from "../../utils/navigation/admin-routes";
import {
  type GardenRole,
  GARDEN_ROLE_ORDER,
  getRoleLabel,
} from "../../utils/blockchain/garden-roles";
import { expandDomainMask } from "../../utils/domain";
import { formatTokenAmount, getVaultAssetSymbol } from "../../utils/blockchain/vaults";
import {
  isJarClaimLimitLow,
  JAR_LIMIT_ROUTE_ITEM_PREFIX,
} from "../../utils/cookie-jar-claim-limit";
import { toWorkDisplayTitle } from "../../utils/work/workTitles";
import type {
  ActivityFilter,
  GardenActivityEvent,
  GardenDetailTab,
  GardenRange,
  RoleDirectoryEntry,
  TabBadgeSeverity,
  TabBadgeState,
} from "../../types/garden-detail";
import {
  aggregateBadges,
  DOMAIN_LABEL_IDS,
  RANGE_TO_MS,
  summarizeReviewQueue,
  toMs,
} from "../../utils/garden-detail";

interface OverviewAlert {
  key: string;
  severity: "warn" | "critical";
  label: string;
  description?: string;
  onAction: () => void;
}

interface DerivedStateInput {
  garden: { id: string; domainMask?: number; name: string; chainId: number };
  works: Array<{
    id: string;
    title?: string;
    status: string;
    createdAt: number;
    reviewedAt?: number;
  }>;
  /** False when `works` is only the newest page of the garden's submissions. */
  worksComplete?: boolean;
  assessments: Array<{
    id: string;
    title?: string | null;
    assessmentType?: string | null;
    createdAt: number;
  }>;
  hypercerts: Array<{
    id: string;
    title?: string | null;
    mintedAt?: number | null;
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
  /** The garden's cookie jars. Omit where the surface shows no alerts. */
  cookieJars?: CookieJar[];
  roleMembers: Record<GardenRole, Address[]>;
  selectedRange: GardenRange;
  activityFilter: ActivityFilter;
  memberSearch: string;
  section: string | undefined;
  canAccessCommunity?: boolean;
  formatMessage: (descriptor: { id: string }, values?: Record<string, any>) => string;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
}

export function useGardenDerivedState({
  garden,
  works,
  worksComplete = true,
  assessments,
  hypercerts,
  allocations,
  gardenVaults,
  vaultNetDeposited,
  cookieJars = [],
  roleMembers,
  selectedRange,
  activityFilter,
  memberSearch,
  section,
  canAccessCommunity = true,
  formatMessage,
  openSection,
}: DerivedStateInput) {
  const now = Date.now();
  const rangeStart = now - RANGE_TO_MS[selectedRange];
  const previousRangeStart = rangeStart - RANGE_TO_MS[selectedRange];

  const pendingWorks = works.filter((work) => work.status === "pending");
  const approvedWorks = works.filter((work) => work.status === "approved");
  // Work age is metadata, not an alarm: the queue warns once work has waited a
  // week, and turns critical only when review has stalled (DL-044).
  const reviewQueue = summarizeReviewQueue(works, now, { complete: worksComplete });

  const approvedInRangeCount = approvedWorks.filter(
    (work) => toMs(work.createdAt) >= rangeStart
  ).length;
  const approvedInPreviousRangeCount = approvedWorks.filter((work) => {
    const createdAtMs = toMs(work.createdAt);
    return createdAtMs >= previousRangeStart && createdAtMs < rangeStart;
  }).length;

  const impactVelocityDelta = approvedInRangeCount - approvedInPreviousRangeCount;

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
  // The treasury's alert opens Community, so a viewer without Community access
  // gets no alert. Its badge and health contributions go with it: a warning
  // status must always have the alert that explains it.
  const treasuryAttention: TabBadgeSeverity = canAccessCommunity ? treasurySeverity : "none";

  const workBadge: TabBadgeState = reviewQueue.stalled
    ? { severity: "critical", count: reviewQueue.pendingCount }
    : reviewQueue.waitingOverWeekCount > 0
      ? { severity: "warn", count: reviewQueue.waitingOverWeekCount }
      : { severity: "none" };

  const impactBadge: TabBadgeState = isImpactStale
    ? { severity: "warn", count: 1 }
    : { severity: "none" };

  const communityBadge: TabBadgeState =
    treasuryAttention === "none" ? { severity: "none" } : { severity: treasuryAttention, count: 1 };

  const hasNoDomains = garden.domainMask === 0;
  const domainBadge: TabBadgeState = hasNoDomains
    ? { severity: "warn", count: 1 }
    : { severity: "none" };

  const overviewBadge = aggregateBadges([impactBadge, workBadge, communityBadge, domainBadge]);

  const tabBadges: Record<GardenDetailTab, TabBadgeState> = {
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
    workBadge.severity === "critical" || treasuryAttention === "critical"
      ? "critical"
      : workBadge.severity === "warn" ||
          treasuryAttention === "warn" ||
          impactBadge.severity === "warn" ||
          hasNoDomains
        ? "warn"
        : "none";

  const gardenHealthLabel =
    gardenHealthSeverity === "critical"
      ? formatMessage({ id: "app.garden.detail.health.status.critical" })
      : gardenHealthSeverity === "warn"
        ? formatMessage({ id: "app.garden.detail.health.status.attention" })
        : formatMessage({ id: "app.garden.detail.health.status.healthy" });

  const alertCandidates: Array<OverviewAlert | null> = [
    reviewQueue.stalled
      ? {
          key: "work-critical",
          severity: "critical" as const,
          label: formatMessage(
            { id: "app.garden.detail.alert.workCritical" },
            { count: reviewQueue.pendingCount }
          ),
          onAction: () => openSection("work", "queue"),
        }
      : reviewQueue.waitingOverWeekCount > 0
        ? {
            key: "work-warning",
            severity: "warn" as const,
            label: formatMessage(
              { id: "app.garden.detail.alert.workWarning" },
              { count: reviewQueue.waitingOverWeekCount }
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
    treasuryAttention === "critical"
      ? {
          key: "treasury-critical",
          severity: "critical" as const,
          label: formatMessage({ id: "app.garden.detail.alert.treasuryEmpty" }),
          onAction: () => openSection("community", "endowment"),
        }
      : treasuryAttention === "warn"
        ? {
            key: "treasury-warning",
            severity: "warn" as const,
            label: formatMessage({ id: "app.garden.detail.alert.treasuryMissing" }),
            onAction: () => openSection("community", "endowment"),
          }
        : null,
    hasNoDomains
      ? {
          key: "domain-empty",
          severity: "warn" as const,
          label: formatMessage({ id: "app.garden.detail.alert.noDomains" }),
          onAction: () => openSection("overview", "health"),
        }
      : null,
    // Computed from the jar itself, so it clears once the limit is raised: nothing to dismiss
    // or store. Critical while the jar holds funds a gardener could be claiming a cent at a time.
    ...cookieJars
      .filter((jar) => canAccessCommunity && isJarClaimLimitLow(jar, garden.chainId || undefined))
      .map((jar) => {
        const asset = getVaultAssetSymbol(jar.assetAddress, garden.chainId || undefined);
        const funded = jar.balance > 0n;
        return {
          key: `jar-limit-low-${jar.jarAddress.toLowerCase()}`,
          severity: funded ? ("critical" as const) : ("warn" as const),
          label: formatMessage(
            { id: "app.garden.detail.alert.jarLimitLow" },
            { asset, limit: formatTokenAmount(jar.maxWithdrawal, jar.decimals) }
          ),
          description: funded
            ? formatMessage(
                { id: "app.garden.detail.alert.jarLimitLowFunded" },
                { asset, balance: formatTokenAmount(jar.balance, jar.decimals) }
              )
            : formatMessage({ id: "app.garden.detail.alert.jarLimitLowEmpty" }),
          onAction: () =>
            openSection("community", "payouts", `${JAR_LIMIT_ROUTE_ITEM_PREFIX}${jar.jarAddress}`),
        };
      }),
  ];
  const overviewAlerts = alertCandidates.filter((entry): entry is OverviewAlert => entry !== null);

  const gardenAddress = garden.id;
  const activityEvents: GardenActivityEvent[] = [
    ...works.map((work) => ({
      id: `work-${work.id}`,
      category: "work" as const,
      title: toWorkDisplayTitle(work.title, formatMessage({ id: "app.admin.work.untitledWork" })),
      // Descriptions carry no date: each row shows its time once, beside the title.
      description: formatMessage(
        { id: "app.garden.detail.activity.workStatus" },
        { status: formatMessage({ id: `app.admin.work.filter.${work.status}` }) }
      ),
      timestamp: toMs(work.createdAt),
      href: adminRoutes.hubWorkDetail(work.id, { gardenId: gardenAddress }),
      itemId: work.id,
    })),
    ...assessments.map((assessment) => ({
      id: `assessment-${assessment.id}`,
      category: "impact" as const,
      title:
        assessment.title ||
        assessment.assessmentType ||
        formatMessage({ id: "app.garden.admin.assessmentFallback" }),
      description: formatMessage({ id: "app.garden.detail.activity.assessmentCreated" }),
      timestamp: toMs(assessment.createdAt),
      href: adminRoutes.gardenImpact({
        gardenAddress,
        section: "assessments",
        item: assessment.id,
      }),
      itemId: assessment.id,
    })),
    ...hypercerts.map((hypercert) => ({
      id: `hypercert-${hypercert.id}`,
      category: "impact" as const,
      title: hypercert.title?.trim() || formatMessage({ id: "app.hypercerts.list.fallbackTitle" }),
      description: formatMessage({ id: "app.garden.detail.activity.hypercertMinted" }),
      timestamp: hypercert.mintedAt ? toMs(hypercert.mintedAt) : 0,
      href: adminRoutes.gardenHypercertDetail(hypercert.id, { gardenId: gardenAddress }),
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
      href: canAccessCommunity
        ? adminRoutes.communityPayouts({ gardenId: gardenAddress, item: allocation.txHash })
        : undefined,
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
    approvedWorks,
    reviewQueue,
    approvedInRangeCount,
    impactVelocityDelta,
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
