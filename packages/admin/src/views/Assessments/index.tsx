import {
  DEFAULT_CHAIN_ID,
  Domain,
  formatDateRange,
  getEASExplorerUrl,
  useAdminStore,
  useAllAssessments,
  useGardens,
  type EASGardenAssessment,
  type Garden,
} from "@green-goods/shared";
import { RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { SortSelect } from "@/components/ui/SortSelect";

type SortOrder = "date" | "title";

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
      <div className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-stroke-soft"
            aria-label={intl.formatMessage({ id: "admin.assessments.title" })}
          >
            <thead className="bg-bg-weak">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                >
                  {intl.formatMessage({ id: "admin.assessments.table.garden" })}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                >
                  {intl.formatMessage({ id: "admin.assessments.table.title" })}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                >
                  {intl.formatMessage({ id: "admin.assessments.table.type" })}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                >
                  {intl.formatMessage({ id: "admin.assessments.table.dateRange" })}
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">{intl.formatMessage({ id: "app.actions.view" })}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke-soft bg-bg-white">
              {filteredAssessments.map((assessment) => (
                <AssessmentRow
                  key={assessment.id}
                  assessment={assessment}
                  gardenName={
                    getGardenName(assessment.gardenAddress, gardens) ??
                    intl.formatMessage({ id: "admin.assessments.unknownGarden" })
                  }
                  chainId={selectedChainId}
                />
              ))}
            </tbody>
          </table>
        </div>
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

function AssessmentRow({
  assessment,
  gardenName,
  chainId,
}: {
  assessment: EASGardenAssessment;
  gardenName: string;
  chainId: number;
}) {
  const intl = useIntl();

  return (
    <tr>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">{gardenName}</td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
        {assessment.title || `Assessment ${assessment.id.slice(0, 6)}`}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
        {getDomainLabel(assessment.domain)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
        {formatDateRange(assessment.startDate, assessment.endDate)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <a
          href={getEASExplorerUrl(chainId, assessment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary-dark transition hover:text-primary-darker"
        >
          {intl.formatMessage({ id: "app.actions.view" })}{" "}
          <RiExternalLinkLine className="ml-1 h-4 w-4" />
        </a>
      </td>
    </tr>
  );
}
