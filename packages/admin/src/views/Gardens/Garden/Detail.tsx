import {
  type Address,
  ConfirmDialog,
  Domain,
  ErrorBoundary,
  expandDomainMask,
  formatAddress,
  formatDate,
  formatRelativeTime,
  formatTokenAmount,
  GARDEN_ROLE_COLORS,
  GARDEN_ROLE_ORDER,
  getStatusColors,
  type GardenRole,
  toastService,
} from "@green-goods/shared";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  RiAddLine,
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiGroupLine,
  RiMore2Line,
  RiRefreshLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AddressDisplay } from "@/components/AddressDisplay";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { GardenAssessmentsPanel } from "@/components/Garden/GardenAssessmentsPanel";
import { GardenCommunityCard } from "@/components/Garden/GardenCommunityCard";
import { GardenHypercertsPanel } from "@/components/Garden/GardenHypercertsPanel";
import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import { GardenRolesPanel } from "@/components/Garden/GardenRolesPanel";
import { GardenYieldCard } from "@/components/Garden/GardenYieldCard";
import { MembersModal } from "@/components/Garden/MembersModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { CookieJarPayoutPanel } from "@/components/Work/CookieJarPayoutPanel";
import { WorkSubmissionsView } from "@/components/Work/WorkSubmissionsView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useGardenDetailData } from "./useGardenDetailData";
import "./GardenDetailLayout.css";

type GardenTab = "overview" | "impact" | "work" | "community";
type GardenRange = "7d" | "30d" | "90d";
type TabBadgeSeverity = "none" | "warn" | "critical";
type ActivityFilter = "all" | "work" | "impact" | "community";

interface TabBadgeState {
  severity: TabBadgeSeverity;
  count?: number;
}

interface TabAction {
  key: string;
  label: string;
  to?: string;
  onSelect?: () => void;
}

interface GardenActivityEvent {
  id: string;
  category: Exclude<ActivityFilter, "all">;
  title: string;
  description: string;
  timestamp: number;
  href?: string;
  itemId?: string;
}

interface RoleDirectoryEntry {
  address: Address;
  roles: GardenRole[];
}

const TAB_TRIGGER_BASE =
  "garden-tab-trigger border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-soft transition-colors hover:border-stroke-sub hover:text-text-sub data-[state=active]:border-primary-base data-[state=active]:text-primary-dark";

const RANGE_OPTIONS: GardenRange[] = ["7d", "30d", "90d"];

const RANGE_TO_MS: Record<GardenRange, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const TAB_SECTIONS: Record<GardenTab, string[]> = {
  overview: ["metadata", "health", "activity"],
  impact: ["hypercerts", "assessments", "reporting"],
  work: ["queue", "decisions", "history"],
  community: ["treasury", "yield", "cookie-jars", "pools", "roles", "members"],
};

const DOMAIN_LABEL_IDS: Record<Domain, string> = {
  [Domain.SOLAR]: "app.domain.tab.solar",
  [Domain.AGRO]: "app.domain.tab.agro",
  [Domain.EDU]: "app.domain.tab.education",
  [Domain.WASTE]: "app.domain.tab.waste",
};

const BADGE_TONE_CLASSES: Record<Exclude<TabBadgeSeverity, "none">, string> = {
  warn: "bg-warning-lighter text-warning-dark",
  critical: "bg-error-lighter text-error-dark",
};

const ALERT_LABEL_CLASSES: Record<Exclude<TabBadgeSeverity, "none">, string> = {
  warn: "text-warning-dark",
  critical: "text-error-dark",
};

const SECTION_CARD_MIN_HEIGHT = "min-h-[18rem]";

function toMs(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function hoursSince(timestamp: number): number {
  return (Date.now() - toMs(timestamp)) / (1000 * 60 * 60);
}

function parseGardenTab(tab: string | null): GardenTab {
  if (tab === "overview" || tab === "impact" || tab === "work" || tab === "community") {
    return tab;
  }
  return "overview";
}

function parseGardenRange(range: string | null): GardenRange {
  if (range === "7d" || range === "30d" || range === "90d") {
    return range;
  }
  return "30d";
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function getSeverityRank(severity: TabBadgeSeverity): number {
  if (severity === "critical") return 2;
  if (severity === "warn") return 1;
  return 0;
}

function aggregateBadges(badges: TabBadgeState[]): TabBadgeState {
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

function TabBadge({ badge }: { badge: TabBadgeState }) {
  if (badge.severity === "none" || !badge.count) {
    return null;
  }

  return (
    <span
      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${BADGE_TONE_CLASSES[badge.severity]}`}
    >
      {badge.count}
    </span>
  );
}

function ActionMenu({
  actions,
  triggerAriaLabel,
}: {
  actions: TabAction[];
  triggerAriaLabel: string;
}) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" variant="secondary" aria-label={triggerAriaLabel}>
          <RiMore2Line className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-lg border border-stroke-sub bg-bg-white p-1 shadow-xl"
        >
          {actions.map((action) => {
            if (action.to) {
              return (
                <DropdownMenu.Item key={action.key} asChild>
                  <Link
                    to={action.to}
                    className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-text-sub outline-none transition-colors hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
                  >
                    {action.label}
                  </Link>
                </DropdownMenu.Item>
              );
            }

            return (
              <DropdownMenu.Item
                key={action.key}
                onSelect={(event) => {
                  event.preventDefault();
                  action.onSelect?.();
                }}
                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-text-sub outline-none transition-colors hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
              >
                {action.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface TabActionCardProps {
  title: string;
  description: string;
  primaryAction: React.ReactNode;
  overflowActions: TabAction[];
  menuAriaLabel: string;
}

function TabActionCard({
  title,
  description,
  primaryAction,
  overflowActions,
  menuAriaLabel,
}: TabActionCardProps) {
  return (
    <Card className="garden-tab-action-card">
      <Card.Body className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="label-md text-text-strong sm:text-lg">{title}</h2>
          <p className="mt-1 text-sm text-text-sub">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {primaryAction}
          <ActionMenu actions={overflowActions} triggerAriaLabel={menuAriaLabel} />
        </div>
      </Card.Body>
    </Card>
  );
}

interface SectionStateProps {
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
}

function SectionStateCard({ title, description, closeLabel, onClose }: SectionStateProps) {
  return (
    <Card colorAccent="info">
      <Card.Body className="flex items-start justify-between gap-3">
        <div>
          <h3 className="label-md text-text-strong">{title}</h3>
          <p className="mt-1 text-sm text-text-sub">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel}>
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </Card.Body>
    </Card>
  );
}

interface AlertRowProps {
  severity: Exclude<TabBadgeSeverity, "none">;
  label: string;
  actionLabel: string;
  onAction: () => void;
}

function AlertRow({ severity, label, actionLabel, onAction }: AlertRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <RiAlertLine className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ALERT_LABEL_CLASSES[severity]}`} />
        <p className="text-sm text-text-sub">{label}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
      >
        {actionLabel}
        <RiArrowRightSLine className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    garden,
    fetching,
    error,
    gardenId,
    canManage,
    canReview,
    canManageRoles,
    isOwner,
    assessments,
    fetchingAssessments,
    assessmentsError,
    roleMembers,
    roleActions,
    isOperationLoading,
    community,
    communityLoading,
    weightSchemeLabel,
    pools,
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    vaultHarvestCount,
    vaultDepositorCount,
    allocations,
    allocationsLoading,
    works,
    worksLoading,
    worksFetching,
    refreshWorks,
    hypercerts,
    hypercertsLoading,
    convictionStrategyCount,
    scheduleBackgroundRefetch,
  } = useGardenDetailData(id);

  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<GardenRole>("gardener");
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersModalType, setMembersModalType] = useState<GardenRole>("gardener");
  const [memberToRemove, setMemberToRemove] = useState<{
    address: Address;
    role: GardenRole;
  } | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [lastWorkRefreshAt, setLastWorkRefreshAt] = useState<number>(Date.now());

  const searchKey = searchParams.toString();
  const activeTab = parseGardenTab(searchParams.get("tab"));
  const selectedRange = parseGardenRange(searchParams.get("range"));
  const requestedSection = searchParams.get("section");
  const section =
    requestedSection && TAB_SECTIONS[activeTab].includes(requestedSection)
      ? requestedSection
      : undefined;
  const selectedItem = section ? (searchParams.get("item") ?? undefined) : undefined;

  useEffect(() => {
    const normalized = new URLSearchParams(searchParams);
    let changed = false;

    if (searchParams.get("tab") !== activeTab) {
      normalized.set("tab", activeTab);
      changed = true;
    }

    if (searchParams.get("range") !== selectedRange) {
      normalized.set("range", selectedRange);
      changed = true;
    }

    const activeSection = normalized.get("section");
    if (activeSection && !TAB_SECTIONS[activeTab].includes(activeSection)) {
      normalized.delete("section");
      normalized.delete("item");
      changed = true;
    }

    if (!activeSection && normalized.has("item")) {
      normalized.delete("item");
      changed = true;
    }

    if (changed) {
      setSearchParams(normalized, { replace: true });
    }
  }, [activeTab, searchKey, searchParams, selectedRange, setSearchParams]);

  const updateQueryState = useCallback(
    (
      updates: Partial<Record<"tab" | "range" | "section" | "item", string | undefined>>,
      replace = false
    ) => {
      const next = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  const openSection = useCallback(
    (tab: GardenTab, nextSection: string, itemId?: string) => {
      updateQueryState({ tab, section: nextSection, item: itemId }, false);
    },
    [updateQueryState]
  );

  const clearSection = useCallback(() => {
    updateQueryState({ section: undefined, item: undefined }, false);
  }, [updateQueryState]);

  const setTab = useCallback(
    (tab: GardenTab) => {
      updateQueryState({ tab, section: undefined, item: undefined }, false);
    },
    [updateQueryState]
  );

  const refreshWorkData = useCallback(() => {
    void refreshWorks().finally(() => {
      setLastWorkRefreshAt(Date.now());
    });
  }, [refreshWorks]);

  useEffect(() => {
    if (worksLoading) return;
    setLastWorkRefreshAt(Date.now());
  }, [works.length, worksLoading]);

  useEffect(() => {
    if (activeTab !== "work") return;
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      refreshWorkData();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, refreshWorkData]);

  const openAddMemberModal = (type: GardenRole) => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const openMembersModal = (type: GardenRole) => {
    setMembersModalType(type);
    setMembersModalOpen(true);
  };

  const roleIcons = {
    owner: RiShieldCheckLine,
    operator: RiUserLine,
    evaluator: RiCheckboxCircleLine,
    gardener: RiUserLine,
    funder: RiUserLine,
    community: RiGroupLine,
  } as const;

  const activeRole = membersModalType;
  const ActiveRoleIcon = roleIcons[activeRole];

  const baseHeaderProps = {
    backLink: { to: "/gardens", label: formatMessage({ id: "app.garden.admin.backToGardens" }) },
    sticky: true,
  } as const;

  if (fetching) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.garden.admin.loadingGarden" })}
          description={formatMessage({ id: "app.garden.admin.loadingDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6" role="status" aria-live="polite">
          <span className="sr-only">{formatMessage({ id: "app.garden.admin.loadingGarden" })}</span>
          <div className="space-y-4 rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
            <div className="h-8 w-1/4 rounded skeleton-shimmer" />
            <div className="h-44 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg skeleton-shimmer"
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.garden" })}
          description={formatMessage({ id: "app.garden.admin.unableToLoad" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <Card className="mx-auto max-w-lg" role="alert">
            <Card.Body className="flex flex-col items-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-lighter">
                <RiErrorWarningLine className="h-6 w-6 text-error-base" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold text-text-strong">
                {formatMessage({ id: "app.garden.admin.notFound" })}
              </h2>
              <p className="mt-2 text-sm text-text-sub">
                {error?.message ?? formatMessage({ id: "app.garden.admin.unableToLoad" })}
              </p>
              <Button variant="secondary" className="mt-6" asChild>
                <Link to="/gardens">{formatMessage({ id: "app.garden.admin.backToGardens" })}</Link>
              </Button>
            </Card.Body>
          </Card>
        </div>
      </div>
    );
  }

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
  ].filter((entry): entry is NonNullable<(typeof overviewAlerts)[number]> => entry !== null);

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

  const overviewActionMenu: TabAction[] = [
    {
      key: "to-impact",
      label: formatMessage({ id: "app.garden.detail.action.goToImpact" }),
      onSelect: () => setTab("impact"),
    },
    {
      key: "to-work",
      label: formatMessage({ id: "app.garden.detail.action.goToWork" }),
      onSelect: () => setTab("work"),
    },
    {
      key: "to-community",
      label: formatMessage({ id: "app.garden.detail.action.goToCommunity" }),
      onSelect: () => setTab("community"),
    },
  ];

  const impactActionMenu: TabAction[] = [
    {
      key: "impact-view-assessments",
      label: formatMessage({ id: "app.garden.detail.action.viewAssessments" }),
      to: `/gardens/${gardenId}/assessments`,
    },
    {
      key: "impact-view-hypercerts",
      label: formatMessage({ id: "app.garden.detail.action.viewHypercerts" }),
      to: `/gardens/${gardenId}/hypercerts`,
    },
    {
      key: "impact-reporting",
      label: formatMessage({ id: "app.garden.detail.action.openReporting" }),
      onSelect: () => openSection("impact", "reporting"),
    },
  ];

  const workActionMenu: TabAction[] = [
    {
      key: "work-open-decisions",
      label: formatMessage({ id: "app.garden.detail.action.openDecisions" }),
      onSelect: () => openSection("work", "decisions"),
    },
    {
      key: "work-open-history",
      label: formatMessage({ id: "app.garden.detail.action.openHistory" }),
      onSelect: () => openSection("work", "history"),
    },
    {
      key: "work-go-community",
      label: formatMessage({ id: "app.garden.detail.action.goToFunding" }),
      onSelect: () => setTab("community"),
    },
  ];

  const communityActionMenu: TabAction[] = [
    {
      key: "community-manage-strategies",
      label: formatMessage({ id: "app.garden.detail.action.manageStrategies" }),
      to: `/gardens/${gardenId}/strategies`,
    },
    {
      key: "community-open-roles",
      label: formatMessage({ id: "app.garden.detail.action.manageRoles" }),
      onSelect: () => openSection("community", "roles"),
    },
    {
      key: "community-open-members",
      label: formatMessage({ id: "app.garden.detail.action.viewMembers" }),
      onSelect: () => openSection("community", "members"),
    },
  ];

  const renderOverviewTab = () => (
    <div className="garden-tab-shell">
      <TabActionCard
        title={formatMessage({ id: "app.garden.detail.overview.actionTitle" })}
        description={formatMessage({ id: "app.garden.detail.overview.actionDescription" })}
        primaryAction={
          <Button size="sm" onClick={() => openSection("overview", "metadata")}>
            {formatMessage({ id: "app.garden.detail.action.manageProfile" })}
          </Button>
        }
        overflowActions={overviewActionMenu}
        menuAriaLabel={formatMessage({ id: "app.garden.detail.action.more" })}
      />

      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          <Card>
            <Card.Body className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="label-xs uppercase tracking-wide text-text-soft">
                  {formatMessage({ id: "app.garden.detail.domains" })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {domainLabels.length > 0 ? (
                    domainLabels.map((domainLabel) => (
                      <span
                        key={domainLabel}
                        className="inline-flex items-center rounded-full bg-primary-lighter px-2.5 py-1 text-xs font-medium text-primary-dark"
                      >
                        {domainLabel}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-text-soft">
                      {formatMessage({ id: "app.garden.detail.domainsNone" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-soft">
                <span className="rounded-md bg-bg-weak px-2 py-1">
                  {formatMessage({ id: "app.garden.detail.chain" }, { chainId: garden.chainId })}
                </span>
                <button
                  type="button"
                  onClick={() => openSection("overview", "metadata")}
                  className="inline-flex items-center gap-1 rounded-md border border-stroke-sub px-2.5 py-1 text-text-sub hover:bg-bg-weak"
                >
                  {formatMessage({ id: "app.garden.detail.action.viewMetadata" })}
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </div>
            </Card.Body>
          </Card>

          {section === "metadata" ? (
            <GardenMetadata
              gardenId={garden.id}
              tokenAddress={garden.tokenAddress}
              tokenId={garden.tokenID}
              chainId={garden.chainId}
            />
          ) : null}

          {(section === undefined || section === "health") && (
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.health.title" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">{gardenHealthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {RANGE_OPTIONS.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => updateQueryState({ range })}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedRange === range
                          ? "bg-primary-alpha-16 text-primary-darker"
                          : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                      }`}
                    >
                      {formatMessage({ id: `app.garden.detail.range.${range}` })}
                    </button>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.gardenHealth" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {gardenHealthLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.impactVelocity" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {approvedInRangeCount}
                    </p>
                    <p className="mt-0.5 text-xs text-text-soft">
                      {impactVelocityDelta === 0
                        ? formatMessage({ id: "app.garden.detail.metric.noDelta" })
                        : formatMessage(
                            {
                              id:
                                impactVelocityDelta > 0
                                  ? "app.garden.detail.metric.deltaUp"
                                  : "app.garden.detail.metric.deltaDown",
                            },
                            { count: Math.abs(impactVelocityDelta) }
                          )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                    <p className="label-xs text-text-soft">
                      {formatMessage({ id: "app.garden.detail.metric.executionThroughput" })}
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                      {medianReviewAgeHours > 0
                        ? formatMessage(
                            { id: "app.garden.detail.metric.hoursValue" },
                            { hours: Math.round(medianReviewAgeHours) }
                          )
                        : formatMessage({ id: "app.garden.detail.metric.notAvailable" })}
                    </p>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {(section === undefined || section === "activity") && (
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.activity.title" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">
                    {formatMessage({ id: "app.garden.detail.activity.description" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "work", "impact", "community"] as ActivityFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActivityFilter(filter)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        activityFilter === filter
                          ? "bg-primary-alpha-16 text-primary-darker"
                          : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                      }`}
                    >
                      {formatMessage({ id: `app.garden.detail.activity.filter.${filter}` })}
                    </button>
                  ))}
                </div>
              </Card.Header>
              <Card.Body>
                {filteredActivityEvents.length === 0 ? (
                  <EmptyState
                    icon={<RiTimeLine className="h-6 w-6" />}
                    title={formatMessage({ id: "app.garden.detail.activity.empty" })}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredActivityEvents
                      .slice(0, section === "activity" ? 14 : 8)
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-lg border border-stroke-soft bg-bg-weak p-3 ${
                            selectedItem && event.itemId === selectedItem
                              ? "ring-1 ring-primary-base"
                              : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-text-strong">
                                {event.title}
                              </p>
                              <p className="mt-1 text-xs text-text-soft">{event.description}</p>
                            </div>
                            <span className="text-xs text-text-soft">
                              {formatRelativeTime(event.timestamp)}
                            </span>
                          </div>
                          {event.href ? (
                            <div className="mt-2">
                              <Link
                                to={event.href}
                                onClick={() => {
                                  if (event.category === "work") {
                                    openSection("work", "queue", event.itemId);
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                              >
                                {formatMessage({ id: "app.garden.detail.activity.view" })}
                                <RiArrowRightSLine className="h-4 w-4" />
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.alerts.title" })}
                </h3>
              </Card.Header>
              <Card.Body>
                {overviewAlerts.length === 0 ? (
                  <p className="text-sm text-text-soft">
                    {formatMessage({ id: "app.garden.detail.alerts.none" })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {overviewAlerts.map((alert) => (
                      <AlertRow
                        key={alert.key}
                        severity={alert.severity}
                        label={alert.label}
                        actionLabel={formatMessage({ id: "app.actions.view" })}
                        onAction={alert.onAction}
                      />
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.quickLinks" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTab("impact")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.garden.admin.tab.impact" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTab("work")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.garden.admin.tab.work" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTab("community")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.garden.admin.tab.community" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );

  const renderImpactTab = () => {
    const recentAssessments = assessments.slice(0, 5);
    const recentHypercerts = hypercerts.slice(0, 4);

    return (
      <div className="garden-tab-shell">
        <TabActionCard
          title={formatMessage({ id: "app.garden.detail.impact.actionTitle" })}
          description={formatMessage({ id: "app.garden.detail.impact.actionDescription" })}
          primaryAction={
            canReview ? (
              <Button size="sm" asChild>
                <Link to={`/gardens/${gardenId}/assessments/create`}>
                  <RiFileList3Line className="h-4 w-4" />
                  {formatMessage({ id: "app.garden.admin.newAssessment" })}
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/gardens/${gardenId}/assessments`}>
                  {formatMessage({ id: "app.garden.admin.viewAssessments" })}
                </Link>
              </Button>
            )
          }
          overflowActions={impactActionMenu}
          menuAriaLabel={formatMessage({ id: "app.garden.detail.action.more" })}
        />

        <div className="garden-tab-layout">
          <div className="garden-tab-main">
            {section ? (
              <SectionStateCard
                title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
                description={formatMessage({
                  id: `app.garden.detail.section.${section}.description`,
                })}
                closeLabel={formatMessage({ id: "app.common.close" })}
                onClose={clearSection}
              />
            ) : null}

            {(section === undefined || section === "hypercerts") && (
              <Card className={SECTION_CARD_MIN_HEIGHT}>
                <Card.Header className="flex-wrap gap-3">
                  <div>
                    <h3 className="label-md text-text-strong sm:text-lg">
                      {formatMessage({ id: "app.garden.detail.impact.hypercertHighlights" })}
                    </h3>
                    <p className="mt-1 text-sm text-text-sub">
                      {formatMessage({
                        id: "app.garden.detail.impact.hypercertHighlightsDescription",
                      })}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/gardens/${gardenId}/hypercerts`}>
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Link>
                  </Button>
                </Card.Header>
                <Card.Body>
                  {hypercertsLoading ? (
                    <div className="space-y-2" role="status" aria-live="polite">
                      <span className="sr-only">
                        {formatMessage({ id: "app.hypercerts.list.title" })}
                      </span>
                      {[0, 1, 2].map((index) => (
                        <div
                          key={index}
                          className="h-14 rounded-lg skeleton-shimmer"
                          style={{ animationDelay: `${index * 0.08}s` }}
                        />
                      ))}
                    </div>
                  ) : recentHypercerts.length === 0 ? (
                    <EmptyState
                      icon={<RiFileList3Line className="h-6 w-6" />}
                      title={formatMessage({ id: "app.hypercerts.list.empty.title" })}
                    />
                  ) : (
                    <div className="space-y-2">
                      {recentHypercerts.map((record) => (
                        <div
                          key={record.id}
                          className={`flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5 ${
                            selectedItem && record.id === selectedItem
                              ? "ring-1 ring-primary-base"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-strong">
                              {record.title?.trim() ||
                                formatMessage({ id: "app.hypercerts.list.fallbackTitle" })}
                            </p>
                            <p className="mt-0.5 text-xs text-text-soft">
                              {record.mintedAt
                                ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                                : formatMessage({ id: "app.hypercerts.list.dateUnknown" })}
                            </p>
                          </div>
                          <Link
                            to={`/gardens/${gardenId}/hypercerts/${record.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                          >
                            {formatMessage({ id: "app.actions.view" })}
                            <RiArrowRightSLine className="h-4 w-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {(section === undefined || section === "reporting") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <div>
                    <h3 className="label-md text-text-strong sm:text-lg">
                      {formatMessage({ id: "app.garden.detail.impact.reportingTitle" })}
                    </h3>
                    <p className="mt-1 text-sm text-text-sub">
                      {formatMessage({ id: "app.garden.detail.impact.reportingDescription" })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openSection("impact", "reporting")}
                  >
                    {formatMessage({ id: "app.garden.detail.action.openReporting" })}
                  </Button>
                </Card.Header>
                <Card.Body>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                      <p className="label-xs text-text-soft">
                        {formatMessage({ id: "app.garden.detail.metric.assessments" })}
                      </p>
                      <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                        {assessments.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                      <p className="label-xs text-text-soft">
                        {formatMessage({ id: "app.garden.detail.metric.hypercerts" })}
                      </p>
                      <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                        {hypercerts.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                      <p className="label-xs text-text-soft">
                        {formatMessage({ id: "app.garden.detail.metric.approvedIn30d" })}
                      </p>
                      <p className="mt-1 font-heading text-lg font-semibold text-text-strong">
                        {approvedInLastThirtyDays}
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {section === "assessments" ? (
              <GardenAssessmentsPanel
                assessments={assessments}
                isLoading={fetchingAssessments}
                error={assessmentsError}
                gardenId={gardenId}
                chainId={garden.chainId}
              />
            ) : null}

            {section === "hypercerts" ? (
              <GardenHypercertsPanel
                gardenId={gardenId}
                gardenAddress={garden.id as Address}
                hypercerts={hypercerts}
                isLoading={hypercertsLoading}
                canManage={canManage}
              />
            ) : null}
          </div>

          <aside className="garden-tab-rail">
            <div className="garden-tab-rail-sticky">
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <h3 className="label-md text-text-strong">
                    {formatMessage({ id: "app.garden.admin.recentAssessments" })}
                  </h3>
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/gardens/${gardenId}/assessments`}>
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Link>
                  </Button>
                </Card.Header>
                <Card.Body>
                  {fetchingAssessments ? (
                    <div className="space-y-2" role="status" aria-live="polite">
                      {[0, 1, 2].map((index) => (
                        <div
                          key={index}
                          className="h-12 rounded-lg skeleton-shimmer"
                          style={{ animationDelay: `${index * 0.08}s` }}
                        />
                      ))}
                    </div>
                  ) : recentAssessments.length === 0 ? (
                    <p className="text-sm text-text-soft">
                      {formatMessage({ id: "app.garden.admin.noAssessments" })}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentAssessments.map((assessment) => (
                        <button
                          key={assessment.id}
                          type="button"
                          onClick={() => openSection("impact", "assessments", assessment.id)}
                          className={`w-full rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 text-left hover:bg-bg-soft ${
                            selectedItem && assessment.id === selectedItem
                              ? "ring-1 ring-primary-base"
                              : ""
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-text-strong">
                            {assessment.title ||
                              assessment.assessmentType ||
                              formatMessage({ id: "app.garden.admin.assessmentFallback" })}
                          </p>
                          <p className="mt-0.5 text-xs text-text-soft">
                            {formatDate(assessment.createdAt, { dateStyle: "medium" })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>

              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong">
                    {formatMessage({ id: "app.garden.detail.domains" })}
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="flex flex-wrap gap-2">
                    {domainLabels.length > 0 ? (
                      domainLabels.map((domainLabel) => (
                        <span
                          key={domainLabel}
                          className="inline-flex items-center rounded-full bg-primary-lighter px-2 py-0.5 text-xs font-medium text-primary-dark"
                        >
                          {domainLabel}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-text-soft">
                        {formatMessage({ id: "app.garden.detail.domainsNone" })}
                      </p>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    );
  };

  const renderWorkTab = () => (
    <div className="garden-tab-shell">
      <TabActionCard
        title={formatMessage({ id: "app.garden.detail.work.actionTitle" })}
        description={formatMessage({ id: "app.garden.detail.work.actionDescription" })}
        primaryAction={
          <Button size="sm" onClick={() => openSection("work", "queue")}>
            {formatMessage({ id: "app.garden.detail.action.reviewPending" })}
          </Button>
        }
        overflowActions={workActionMenu}
        menuAriaLabel={formatMessage({ id: "app.garden.detail.action.more" })}
      />

      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          {(section === undefined || section === "decisions") && (
            <Card>
              <Card.Header className="flex-wrap gap-3">
                <h3 className="label-md text-text-strong sm:text-lg">
                  {formatMessage({ id: "app.garden.detail.work.recentDecisions" })}
                </h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openSection("work", "decisions")}
                >
                  {formatMessage({ id: "app.actions.view" })}
                </Button>
              </Card.Header>
              <Card.Body>
                {reviewedWorks.length === 0 ? (
                  <p className="text-sm text-text-soft">
                    {formatMessage({ id: "app.garden.detail.work.noDecisions" })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reviewedWorks.slice(0, section === "decisions" ? 12 : 5).map((work) => (
                      <div
                        key={work.id}
                        className={`flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 ${
                          selectedItem && work.id === selectedItem ? "ring-1 ring-primary-base" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-strong">
                            {work.title || formatMessage({ id: "app.admin.work.untitledWork" })}
                          </p>
                          <p className="mt-0.5 text-xs text-text-soft">
                            {formatDate(work.createdAt, { dateStyle: "medium" })}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColors(work.status).combined}`}
                        >
                          {formatMessage({ id: `app.admin.work.filter.${work.status}` })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {(section === undefined || section === "queue" || section === "history") && (
            <WorkSubmissionsView
              gardenId={garden.id}
              canManage={canReview}
              works={works}
              isLoading={worksLoading}
              isRefreshing={worksFetching}
              onRefresh={refreshWorkData}
              lastUpdatedAt={lastWorkRefreshAt}
              initialFilter={section === "history" ? "all" : "pending"}
              highlightWorkId={selectedItem}
            />
          )}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header className="flex-wrap gap-3">
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.work.commandCenter" })}
                </h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={refreshWorkData}
                  loading={worksFetching}
                >
                  {!worksFetching && <RiRefreshLine className="h-4 w-4" />}
                  {formatMessage({ id: "app.garden.detail.action.refresh" })}
                </Button>
              </Card.Header>
              <Card.Body>
                <p className="text-xs text-text-soft">
                  {formatMessage(
                    { id: "app.garden.detail.work.lastUpdated" },
                    { when: formatRelativeTime(lastWorkRefreshAt) }
                  )}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pendingQueue" })}</span>
                    <span className="font-semibold text-text-strong">{pendingWorks.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pending24h" })}</span>
                    <span className="font-semibold text-text-strong">{pendingWarningCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSection("work", "queue")}
                    className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub hover:bg-bg-soft"
                  >
                    <span>{formatMessage({ id: "app.garden.detail.metric.pending72h" })}</span>
                    <span className="font-semibold text-text-strong">{pendingCriticalCount}</span>
                  </button>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.work.thresholds" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2 text-sm text-text-sub">
                <p>{formatMessage({ id: "app.garden.detail.work.thresholdWarning" })}</p>
                <p>{formatMessage({ id: "app.garden.detail.work.thresholdCritical" })}</p>
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );

  const renderCommunityTab = () => (
    <div className="garden-tab-shell">
      <TabActionCard
        title={formatMessage({ id: "app.garden.detail.community.actionTitle" })}
        description={formatMessage({ id: "app.garden.detail.community.actionDescription" })}
        primaryAction={
          <Button size="sm" asChild>
            <Link to={`/gardens/${gardenId}/vault`}>
              {formatMessage({ id: "app.treasury.manageVault" })}
            </Link>
          </Button>
        }
        overflowActions={communityActionMenu}
        menuAriaLabel={formatMessage({ id: "app.garden.detail.action.more" })}
      />

      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          <ErrorBoundary context="GardenDetail.CommunityRevamp">
            {(section === undefined || section === "treasury" || section === "pools") && (
              <GardenCommunityCard
                community={community}
                communityLoading={communityLoading}
                pools={pools}
                gardenId={gardenId}
                canManage={canManage}
                gardenName={garden.name}
                convictionStrategyCount={convictionStrategyCount}
                vaultsLoading={vaultsLoading}
                hasVaults={gardenVaults.length > 0}
                isCreatingPools={isCreatingPools}
                onCreatePools={createPools}
                onScheduleRefetch={scheduleBackgroundRefetch}
              />
            )}

            {(section === undefined || section === "yield") && (
              <GardenYieldCard allocations={allocations} allocationsLoading={allocationsLoading} />
            )}

            {(section === undefined || section === "cookie-jars") && (
              <CookieJarPayoutPanel
                gardenAddress={garden.id as Address}
                canManage={canManage}
                isOwner={isOwner}
              />
            )}

            {(section === undefined || section === "roles") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.community.rolesSummary" })}
                  </h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openSection("community", "roles")}
                  >
                    {formatMessage({ id: "app.garden.detail.action.manageRoles" })}
                  </Button>
                </Card.Header>
                <Card.Body>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {roleSummary.map((entry) => {
                      const roleLabel = getRoleLabel(entry.role, formatMessage);
                      const Icon = roleIcons[entry.role];
                      return (
                        <div
                          key={entry.role}
                          className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-text-strong">
                              <Icon className="h-4 w-4 text-text-soft" />
                              {roleLabel.plural}
                            </p>
                            <span className="text-sm font-semibold text-text-strong">
                              {entry.count}
                            </span>
                          </div>
                          {entry.firstMember ? (
                            <button
                              type="button"
                              onClick={() => openMembersModal(entry.role)}
                              className="mt-1 inline-flex text-xs text-primary-base hover:text-primary-darker"
                            >
                              {formatAddress(entry.firstMember)}
                            </button>
                          ) : (
                            <p className="mt-1 text-xs text-text-soft">
                              {formatMessage(
                                { id: "app.admin.roles.empty" },
                                { role: roleLabel.plural }
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            )}

            {section === "roles" ? (
              <GardenRolesPanel
                roleMembers={roleMembers}
                canManageRoles={canManageRoles}
                isLoading={isOperationLoading}
                onOpenAddMember={openAddMemberModal}
                onOpenMembersModal={openMembersModal}
                onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
              />
            ) : null}

            {(section === undefined || section === "members") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <div>
                    <h3 className="label-md text-text-strong sm:text-lg">
                      {formatMessage({ id: "app.garden.detail.community.membersTitle" })}
                    </h3>
                    <p className="mt-1 text-sm text-text-sub">
                      {formatMessage({ id: "app.garden.detail.community.membersDescription" })}
                    </p>
                  </div>
                  {section !== "members" && filteredDirectory.length > 8 ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openSection("community", "members")}
                    >
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Button>
                  ) : null}
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <input
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder={formatMessage({
                        id: "app.garden.detail.community.memberSearch",
                      })}
                      className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                    />
                  </div>

                  {visibleDirectory.length === 0 ? (
                    <EmptyState
                      icon={<RiUserLine className="h-6 w-6" />}
                      title={formatMessage({ id: "app.garden.detail.community.membersEmpty" })}
                    />
                  ) : (
                    <div className="space-y-2">
                      {visibleDirectory.map((entry) => (
                        <div
                          key={entry.address}
                          className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <AddressDisplay address={entry.address} className="min-w-0 flex-1" />
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entry.roles.map((role) => {
                                const label = getRoleLabel(role, formatMessage);
                                return (
                                  <button
                                    key={`${entry.address}-${role}`}
                                    type="button"
                                    onClick={() => openMembersModal(role)}
                                    className="inline-flex items-center rounded-full bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-text-sub hover:bg-bg-sub"
                                  >
                                    {label.singular}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}
          </ErrorBoundary>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.community.treasuryStatus" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <div className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2">
                  <p className="text-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.totalValueLocked" })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-strong">
                    {hasVaults
                      ? formatTokenAmount(vaultNetDeposited)
                      : formatMessage({ id: "app.garden.detail.community.noVault" })}
                  </p>
                </div>
                {treasurySeverity !== "none" ? (
                  <p
                    className={`text-sm ${
                      treasurySeverity === "critical" ? "text-error-dark" : "text-warning-dark"
                    }`}
                  >
                    {treasurySeverity === "critical"
                      ? formatMessage({ id: "app.garden.detail.alert.treasuryEmpty" })
                      : formatMessage({ id: "app.garden.detail.alert.treasuryMissing" })}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => openSection("community", "treasury")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.actions.view" })}
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.quickLinks" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <button
                  type="button"
                  onClick={() => openSection("community", "yield")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.yield.title" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openSection("community", "cookie-jars")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.cookieJar.payoutTitle" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openSection("community", "roles")}
                  className="flex w-full items-center justify-between rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak"
                >
                  <span>{formatMessage({ id: "app.garden.detail.community.rolesSummary" })}</span>
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => {
        setTab(parseGardenTab(value));
      }}
      className="garden-detail-container pb-6"
    >
      <PageHeader title={garden.name} description={garden.description} {...baseHeaderProps}>
        <Tabs.List className="garden-tabs-list -mb-[1px] flex">
          <Tabs.Trigger value="overview" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.overview" })}
            <TabBadge badge={tabBadges.overview} />
          </Tabs.Trigger>
          <Tabs.Trigger value="impact" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.impact" })}
            <TabBadge badge={tabBadges.impact} />
          </Tabs.Trigger>
          <Tabs.Trigger value="work" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.work" })}
            <TabBadge badge={tabBadges.work} />
          </Tabs.Trigger>
          <Tabs.Trigger value="community" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.community" })}
            <TabBadge badge={tabBadges.community} />
          </Tabs.Trigger>
        </Tabs.List>
      </PageHeader>

      <div className="px-4 sm:px-6">
        <Tabs.Content
          value="overview"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.overview" })}
        >
          {renderOverviewTab()}
        </Tabs.Content>

        <Tabs.Content
          value="impact"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.impact" })}
        >
          {renderImpactTab()}
        </Tabs.Content>

        <Tabs.Content
          value="work"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.work" })}
        >
          {renderWorkTab()}
        </Tabs.Content>

        <Tabs.Content
          value="community"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.community" })}
        >
          {renderCommunityTab()}
        </Tabs.Content>
      </div>

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        memberType={memberType}
        onAdd={async (address: Address) => {
          const result = await roleActions[memberType].add(address);
          if (result.success) {
            scheduleBackgroundRefetch();
          }
        }}
        isLoading={isOperationLoading}
      />

      <MembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={formatMessage(
          { id: "app.admin.roles.all" },
          { role: getRoleLabel(activeRole, formatMessage).plural }
        )}
        members={roleMembers[activeRole]}
        canManage={canManageRoles}
        onRemove={async (member: string) => {
          const result = await roleActions[activeRole].remove(member);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: getRoleLabel(activeRole, formatMessage).singular }
              ),
              message:
                result.error?.message ??
                formatMessage(
                  { id: "app.admin.roles.removeFailed" },
                  { role: getRoleLabel(activeRole, formatMessage).singular }
                ),
            });
          }
        }}
        isLoading={isOperationLoading}
        icon={<ActiveRoleIcon className="h-5 w-5" />}
        colorScheme={GARDEN_ROLE_COLORS[activeRole]}
      />

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        title={formatMessage({ id: "app.admin.roles.confirmRemoveTitle" })}
        description={formatMessage(
          { id: "app.admin.roles.confirmRemoveDescription" },
          {
            address: formatAddress(memberToRemove?.address),
            role: memberToRemove ? getRoleLabel(memberToRemove.role, formatMessage).singular : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.admin.roles.confirmRemoveAction" })}
        variant="danger"
        isLoading={isOperationLoading}
        onConfirm={async () => {
          if (!memberToRemove) return;
          const removeMemberRole = memberToRemove.role;
          const removeMemberAddress = memberToRemove.address;
          const roleLabel = getRoleLabel(removeMemberRole, formatMessage);
          setMemberToRemove(null);

          const result = await roleActions[removeMemberRole].remove(removeMemberAddress);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: roleLabel.singular }
              ),
              message:
                result.error?.message ??
                formatMessage({ id: "app.admin.roles.removeFailed" }, { role: roleLabel.singular }),
            });
          }
        }}
      />
    </Tabs.Root>
  );
}
