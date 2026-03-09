import {
  ActionBannerFallback,
  DEFAULT_CHAIN_ID,
  Domain,
  type EASGardenAssessment,
  formatDateRange,
  type Garden,
  getEASExplorerUrl,
  useAdminStore,
  useAllAssessments,
  useGardens,
} from "@green-goods/shared";
import {
  RiCalendarLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiMapPinLine,
  RiPlantLine,
} from "@remixicon/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { SortSelect } from "@/components/ui/SortSelect";

type SortOrder = "date" | "title";

const DOMAIN_BADGE_STYLES: Record<number, string> = {
  [Domain.SOLAR]: "bg-away-lighter text-away-dark",
  [Domain.AGRO]: "bg-success-lighter text-success-dark",
  [Domain.EDU]: "bg-information-lighter text-information-dark",
  [Domain.WASTE]: "bg-warning-lighter text-warning-dark",
};

function getGardenName(gardenAddress: string, gardens: Garden[]): string | null {
  const garden = gardens.find((g) => g.id.toLowerCase() === gardenAddress.toLowerCase());
  return garden?.name ?? null;
}

function getDomainLabel(domain: number): string {
  const label = Domain[domain];
  if (!label) return "---";
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export default function Assessments() {
  const intl = useIntl();
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const setSelectedChainId = useAdminStore((state) => state.setSelectedChainId);

  useEffect(() => {
    if (selectedChainId !== DEFAULT_CHAIN_ID) {
      setSelectedChainId(DEFAULT_CHAIN_ID);
    }
  }, [selectedChainId, setSelectedChainId]);

  const {
    data: assessments = [],
    isLoading: assessmentsLoading,
    error: assessmentsError,
  } = useAllAssessments(selectedChainId);

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();

  const isLoading = assessmentsLoading || gardensLoading;

  const [search, setSearch] = useState("");
  const [gardenFilter, setGardenFilter] = useState("all");
  const [sort, setSort] = useState<SortOrder>("date");

  // Build garden options from assessments that have gardens
  const gardenOptions = useMemo(() => {
    const uniqueAddresses = [...new Set(assessments.map((a) => a.gardenAddress))];
    const options = uniqueAddresses
      .map((addr) => ({
        value: addr,
        label: getGardenName(addr, gardens) ?? `${addr.slice(0, 6)}...${addr.slice(-4)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [
      {
        value: "all",
        label: intl.formatMessage({ id: "admin.assessments.allGardens" }),
      },
      ...options,
    ];
  }, [assessments, gardens, intl]);

  const sortOptions = [
    {
      value: "date" as const,
      label: intl.formatMessage({ id: "admin.assessments.sort.date" }),
    },
    {
      value: "title" as const,
      label: intl.formatMessage({ id: "admin.assessments.sort.title" }),
    },
  ];

  // Filter and sort assessments
  const filteredAssessments = useMemo(() => {
    let result = assessments;

    // Garden filter
    if (gardenFilter !== "all") {
      result = result.filter((a) => a.gardenAddress.toLowerCase() === gardenFilter.toLowerCase());
    }

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          (getGardenName(a.gardenAddress, gardens) ?? "").toLowerCase().includes(query)
      );
    }

    // Sort
    const sorted = [...result];
    if (sort === "date") {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }

    return sorted;
  }, [assessments, gardenFilter, search, sort, gardens]);

  const hasFiltersApplied = search.trim() !== "" || gardenFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setGardenFilter("all");
  };

  const showToolbar = !isLoading && !assessmentsError && assessments.length > 0;

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div role="status" aria-live="polite">
        <span className="sr-only">{intl.formatMessage({ id: "admin.assessments.loading" })}</span>
        <SkeletonGrid count={6} columns={3} />
      </div>
    );
  } else if (assessmentsError) {
    content = (
      <Alert variant="error">
        {intl.formatMessage({ id: "admin.assessments.error" })}:{" "}
        {assessmentsError instanceof Error
          ? assessmentsError.message
          : intl.formatMessage({ id: "app.error.unknown" })}
      </Alert>
    );
  } else if (assessments.length === 0) {
    content = (
      <EmptyState
        icon={<RiFileList3Line className="h-6 w-6" />}
        title={intl.formatMessage({ id: "admin.assessments.empty.title" })}
        description={intl.formatMessage({ id: "admin.assessments.empty.description" })}
      />
    );
  } else if (filteredAssessments.length === 0 && hasFiltersApplied) {
    content = (
      <EmptyState
        icon={<RiFileList3Line className="h-6 w-6" />}
        title={intl.formatMessage({ id: "admin.assessments.noResults" })}
        action={{
          label: intl.formatMessage({ id: "admin.assessments.resetFilters" }),
          onClick: resetFilters,
        }}
      />
    );
  } else {
    content = (
      <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAssessments.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            gardenName={
              getGardenName(assessment.gardenAddress, gardens) ??
              intl.formatMessage({ id: "admin.assessments.unknownGarden" })
            }
            chainId={selectedChainId}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={intl.formatMessage({ id: "admin.assessments.title" })}
        description={intl.formatMessage({ id: "admin.assessments.description" })}
        sticky
        toolbar={
          showToolbar ? (
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={intl.formatMessage({
                id: "admin.assessments.searchPlaceholder",
              })}
            >
              <SortSelect
                value={gardenFilter}
                onChange={setGardenFilter}
                options={gardenOptions}
                aria-label={intl.formatMessage({
                  id: "admin.assessments.filterGarden",
                })}
              />
              <SortSelect value={sort} onChange={setSort} options={sortOptions} />
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">{content}</div>
    </div>
  );
}

function AssessmentCard({
  assessment,
  gardenName,
  chainId,
}: {
  assessment: EASGardenAssessment;
  gardenName: string;
  chainId: number;
}) {
  const intl = useIntl();
  const title = assessment.title || `Assessment ${assessment.id.slice(0, 6)}`;
  const domainLabel = getDomainLabel(assessment.domain);
  const domainEnum = assessment.domain as Domain;
  const badgeStyle = DOMAIN_BADGE_STYLES[assessment.domain] ?? "bg-bg-soft text-text-sub";

  return (
    <a
      href={getEASExplorerUrl(chainId, assessment.id)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="assessment-card"
      className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm transition-shadow hover:shadow-md hover:border-primary-base"
    >
      {/* Domain-colored gradient header */}
      <div className="relative h-24 overflow-hidden">
        <ActionBannerFallback domain={domainEnum} title={title} />
      </div>

      {/* Card content */}
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3
            className="text-lg font-medium text-text-strong group-hover:text-primary-dark line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <RiExternalLinkLine className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled group-hover:text-primary-dark transition-colors" />
        </div>

        {assessment.description && (
          <p className="mb-3 text-sm text-text-sub line-clamp-2">{assessment.description}</p>
        )}

        {/* Domain badge */}
        <span
          className={`mb-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}
        >
          {domainLabel}
        </span>

        {/* Metadata */}
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-text-soft">
          <div className="flex items-center gap-1.5">
            <RiPlantLine className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{gardenName}</span>
          </div>
          {(assessment.startDate || assessment.endDate) && (
            <div className="flex items-center gap-1.5">
              <RiCalendarLine className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDateRange(assessment.startDate, assessment.endDate)}</span>
            </div>
          )}
          {assessment.location && (
            <div className="flex items-center gap-1.5">
              <RiMapPinLine className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{assessment.location}</span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
