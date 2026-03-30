import {
  cn,
  useAdminStore,
  useGardenDerivedState,
  useGardenDetailData,
  useGardens,
} from "@green-goods/shared";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CockpitWorkspaceSelectionState } from "@/components/Layout/CockpitWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { WorkTab } from "@/views/Gardens/Garden/WorkTab";
import "../Gardens/Garden/GardenDetailLayout.css";

type WorkViewMode = "queue" | "decisions";

function parseWorkView(value: string | null): WorkViewMode {
  return value === "decisions" ? "decisions" : "queue";
}

export default function WorkView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: gardens = [] } = useGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const [lastWorkRefreshAt, setLastWorkRefreshAt] = useState(() => Date.now());

  const view = parseWorkView(searchParams.get("view"));
  const selectedItem = searchParams.get("item") ?? undefined;

  const {
    garden,
    canManage,
    canReview,
    works,
    worksLoading,
    worksFetching,
    refreshWorks,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const updateSearch = useCallback(
    (
      updates: Partial<Record<"garden" | "view" | "item", string | undefined>>,
      replace = true
    ) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(updates)) {
            if (!value) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const openSection = useCallback(
    (
      tab: "overview" | "impact" | "work" | "community",
      section: string,
      itemId?: string
    ) => {
      if (!selectedGarden) return;

      if (tab === "work") {
        updateSearch(
          {
            view: section === "decisions" ? "decisions" : "queue",
            item: itemId,
          },
          false
        );
        return;
      }

      if (tab === "impact" || tab === "overview") {
        const targetView = tab === "impact" ? "impact" : "overview";
        navigate(
          `/garden?garden=${selectedGarden.id}&view=${targetView}${itemId ? `&item=${itemId}` : ""}`
        );
        return;
      }

      const card =
        section === "members" ? "members" : section === "yield" ? "yield" : "treasury";
      navigate(
        `/community?garden=${selectedGarden.id}&card=${card}${itemId ? `&item=${itemId}` : ""}`
      );
    },
    [navigate, selectedGarden, updateSearch]
  );

  const derived = useGardenDerivedState({
    garden: garden ?? { id: selectedGarden?.id ?? "", domainMask: 0, name: "", chainId: 0 },
    works,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch: "",
    section: view === "decisions" ? "decisions" : "queue",
    formatMessage,
    openSection,
  });

  useEffect(() => {
    if (!worksLoading) {
      setLastWorkRefreshAt(Date.now());
    }
  }, [works.length, worksLoading]);

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.work.title", defaultMessage: "Work Pipeline" })}
        description={formatMessage({
          id: "cockpit.work.description",
          defaultMessage: "Review and manage work submissions across your gardens",
        })}
        metadata={selectedGarden?.name}
        sticky
        actions={
          selectedGarden && canManage ? (
            <Button size="sm" asChild>
              <Link to={`/gardens/${selectedGarden.id}/submit-work`}>
                {formatMessage({ id: "app.admin.work.submitWork" })}
              </Link>
            </Button>
          ) : undefined
        }
        toolbar={
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label={formatMessage({
              id: "cockpit.work.viewSwitcher",
              defaultMessage: "Work views",
            })}
          >
            {(
              [
                { id: "queue", labelId: "cockpit.work.queue", defaultMessage: "Queue" },
                {
                  id: "decisions",
                  labelId: "cockpit.work.decisions",
                  defaultMessage: "Decisions",
                },
              ] as const
            ).map((option) => {
              const active = view === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateSearch({ view: option.id, item: undefined })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-alpha-16 text-primary-darker"
                      : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                  )}
                >
                  {formatMessage({ id: option.labelId, defaultMessage: option.defaultMessage })}
                </button>
              );
            })}
          </div>
        }
      />

      {!selectedGarden ? (
        <CockpitWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.work", defaultMessage: "Work" })}
          gardens={gardens.map((gardenItem) => ({
            id: gardenItem.id,
            name: gardenItem.name,
            location: gardenItem.location,
          }))}
          onSelectGarden={(gardenItem) => {
            const fullGarden = gardens.find((entry) => entry.id === gardenItem.id);
            setSelectedGarden(fullGarden ?? null);
          }}
        />
      ) : (
        <div className="mt-6 px-4 sm:px-6">
          <WorkTab
            garden={{ id: selectedGarden.id }}
            canReview={canReview}
            section={view}
            showSectionStateCard={false}
            selectedItem={selectedItem}
            clearSection={() => updateSearch({ view: "queue", item: undefined }, false)}
            openSection={openSection}
            works={works}
            worksLoading={worksLoading}
            worksFetching={worksFetching}
            refreshWorkData={() => {
              void refreshWorks().finally(() => {
                setLastWorkRefreshAt(Date.now());
              });
            }}
            lastWorkRefreshAt={lastWorkRefreshAt}
            pendingWorks={derived.pendingWorks}
            pendingWarningCount={derived.pendingWarningCount}
            pendingCriticalCount={derived.pendingCriticalCount}
            reviewedWorks={derived.reviewedWorks}
            approvedWorks={derived.approvedWorks}
            medianReviewAgeHours={derived.medianReviewAgeHours}
          />
        </div>
      )}
    </div>
  );
}
