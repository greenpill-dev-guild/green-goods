import {
  useAuth,
  useBrowserNavigation,
  useGardens,
  useNavigateToTop,
} from "@green-goods/shared/hooks";
import { cn, gardenHasMember } from "@green-goods/shared/utils";
import { RiFilterLine } from "@remixicon/react";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/UI/Button";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";
import { ModalDrawer } from "@/components/UI/ModalDrawer/ModalDrawer";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

type GardenFilterScope = "all" | "mine";
type GardenSortOrder = "default" | "name" | "recent";

type GardenFiltersState = {
  scope: GardenFilterScope;
  sort: GardenSortOrder;
};

type FilterOptionButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  description?: string;
};

const FilterOptionButton = ({
  label,
  selected,
  onClick,
  disabled = false,
  description,
}: FilterOptionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full rounded-2xl border border-stroke-soft-200 bg-white p-3 text-left text-sm transition-all duration-200 min-h-[56px] flex flex-col justify-center tap-feedback",
      selected ? "border-primary bg-primary/10 text-primary shadow-sm" : "",
      disabled && "cursor-not-allowed opacity-60"
    )}
    aria-pressed={selected}
  >
    <span className="font-medium leading-tight">{label}</span>
    {description ? <span className="mt-1 block text-xs text-slate-500">{description}</span> : null}
  </button>
);

type GardensFilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: GardenFiltersState;
  onScopeChange: (scope: GardenFilterScope) => void;
  onSortChange: (sort: GardenSortOrder) => void;
  onReset: () => void;
  canFilterMine: boolean;
  myGardensCount: number;
  isFilterActive: boolean;
};

const GardensFilterDrawer = ({
  isOpen,
  onClose,
  filters,
  onScopeChange,
  onSortChange,
  onReset,
  canFilterMine,
  myGardensCount,
  isFilterActive,
}: GardensFilterDrawerProps) => {
  const intl = useIntl();

  const scopeOptions: Array<{
    id: GardenFilterScope;
    label: string;
    description?: string;
    disabled?: boolean;
  }> = [
    {
      id: "all",
      label: intl.formatMessage({
        id: "app.home.filters.scope.all",
        defaultMessage: "All gardens",
      }),
    },
    {
      id: "mine",
      label: intl.formatMessage(
        {
          id: "app.home.filters.scope.mine",
          defaultMessage: "My gardens ({count})",
        },
        { count: myGardensCount }
      ),
      description: !canFilterMine
        ? intl.formatMessage({
            id: "app.home.filters.scope.mineDisabled",
            defaultMessage: "Sign in or connect a wallet to filter by your gardens.",
          })
        : myGardensCount === 0
          ? intl.formatMessage({
              id: "app.home.filters.scope.mineEmpty",
              defaultMessage: "No gardens assigned yet.",
            })
          : undefined,
      disabled: !canFilterMine,
    },
  ];

  const sortOptions: Array<{ id: GardenSortOrder; label: string }> = [
    {
      id: "default",
      label: intl.formatMessage({
        id: "app.home.filters.sort.default",
        defaultMessage: "Default order",
      }),
    },
    {
      id: "recent",
      label: intl.formatMessage({
        id: "app.home.filters.sort.recent",
        defaultMessage: "Newest first",
      }),
    },
    {
      id: "name",
      label: intl.formatMessage({
        id: "app.home.filters.sort.name",
        defaultMessage: "Name (A-Z)",
      }),
    },
  ];

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: intl.formatMessage({
          id: "app.home.filters.title",
          defaultMessage: "Filter Gardens",
        }),
        description: intl.formatMessage({
          id: "app.home.filters.description",
          defaultMessage: "Filter by membership or sort order.",
        }),
      }}
    >
      <div className="flex flex-col gap-6">
        <section>
          <h6 className="mb-3 text-sm font-semibold text-slate-600">
            {intl.formatMessage({
              id: "app.home.filters.scopeTitle",
              defaultMessage: "Show",
            })}
          </h6>
          <div className="grid grid-cols-1 gap-2">
            {scopeOptions.map(({ id, ...option }) => (
              <FilterOptionButton
                key={id}
                {...option}
                selected={filters.scope === id}
                onClick={() => onScopeChange(id)}
              />
            ))}
          </div>
        </section>

        <section>
          <h6 className="mb-3 text-sm font-semibold text-slate-600">
            {intl.formatMessage({
              id: "app.home.filters.sortTitle",
              defaultMessage: "Sort by",
            })}
          </h6>
          <div className="grid grid-cols-1 gap-2">
            {sortOptions.map(({ id, ...option }) => (
              <FilterOptionButton
                key={id}
                {...option}
                selected={filters.sort === id}
                onClick={() => onSortChange(id)}
              />
            ))}
          </div>
        </section>

        <Button
          label={intl.formatMessage({
            id: "app.home.filters.reset",
            defaultMessage: "Reset filters",
          })}
          variant="neutral"
          mode="stroke"
          size="xsmall"
          onClick={onReset}
          disabled={!isFilterActive}
          type="button"
        />
      </div>
    </ModalDrawer>
  );
};

const Gardens: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const { data: gardensResolved = [], isLoading } = useGardens();
  const intl = useIntl();
  const { smartAccountAddress, walletAddress } = useAuth();
  const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "default" });
  const [isFilterOpen, setFilterOpen] = useState(false);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  const selectedGardenId = useMemo(() => location.pathname.split("/")[2], [location.pathname]);
  const primaryAddress = useMemo(() => {
    const address = smartAccountAddress ?? walletAddress;
    return address ? address.toLowerCase() : null;
  }, [smartAccountAddress, walletAddress]);

  const myGardensCount = useMemo(() => {
    if (!primaryAddress) return 0;
    return gardensResolved.reduce(
      (count, garden) =>
        count + (gardenHasMember(primaryAddress, garden.gardeners, garden.operators) ? 1 : 0),
      0
    );
  }, [gardensResolved, primaryAddress]);

  const { scope, sort } = filters;

  const filteredGardens = useMemo(() => {
    let working = gardensResolved;

    if (scope === "mine") {
      if (!primaryAddress) {
        return [];
      }

      working = working.filter((garden) =>
        gardenHasMember(primaryAddress, garden.gardeners, garden.operators)
      );
    }

    if (sort === "name") {
      return [...working].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );
    }

    if (sort === "recent") {
      return [...working].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    return [...working];
  }, [gardensResolved, scope, sort, primaryAddress]);

  const isScopeFiltered = scope !== "all";
  const isSortFiltered = sort !== "default";
  const isFilterActive = isScopeFiltered || isSortFiltered;
  const activeFilterCount = (isScopeFiltered ? 1 : 0) + (isSortFiltered ? 1 : 0);

  useEffect(() => {
    if (location.pathname !== "/home") {
      setFilterOpen(false);
    }
  }, [location.pathname]);

  function handleCardClick(id: string) {
    navigate(`/home/${id}`);
    document.getElementsByTagName("article")[0]?.scrollIntoView();
  }

  const handleScopeChange = (nextScope: GardenFilterScope) => {
    setFilters((current) =>
      current.scope === nextScope ? current : { ...current, scope: nextScope }
    );
  };

  const handleSortChange = (nextSort: GardenSortOrder) => {
    setFilters((current) => (current.sort === nextSort ? current : { ...current, sort: nextSort }));
  };

  const handleResetFilters = () => {
    setFilters({ scope: "all", sort: "default" });
  };

  const renderGardens = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <GardenCardSkeleton key={idx} media="large" height="home" />
          ))}
        </div>
      );
    }

    if (scope === "mine" && !primaryAddress) {
      return (
        <p className="grid place-items-center text-center text-sm italic text-slate-500">
          {intl.formatMessage({
            id: "app.home.filters.scope.mineDisabled",
            defaultMessage: "Sign in or connect a wallet to filter by your gardens.",
          })}
        </p>
      );
    }

    if (!filteredGardens.length) {
      if (scope === "mine" && primaryAddress) {
        return (
          <p className="grid place-items-center text-center text-sm italic text-slate-500">
            {intl.formatMessage({
              id: "app.home.gardens.mineEmpty",
              defaultMessage: "You don't steward any gardens yet.",
            })}
          </p>
        );
      }

      if (isFilterActive) {
        return (
          <p className="grid place-items-center text-center text-sm italic text-slate-500">
            {intl.formatMessage({
              id: "app.home.filters.empty",
              defaultMessage: "No gardens match your filters.",
            })}
          </p>
        );
      }

      return (
        <p className="grid place-items-center text-sm italic">
          {intl.formatMessage({
            id: "app.home.messages.noGardensFound",
            description: "No gardens found",
          })}
        </p>
      );
    }

    return filteredGardens.map((garden: Garden) => (
      <GardenCard
        key={garden.id}
        garden={garden}
        media="large"
        height="home"
        showOperators={true}
        selected={garden.id === selectedGardenId}
        {...garden}
        onClick={() => handleCardClick(garden.id)}
      />
    ));
  };

  return (
    <article className={"mb-6"}>
      {location.pathname === "/home" ? (
        <>
          <div className="flex items-center justify-between w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="font-semibold flex-1">{intl.formatMessage({ id: "app.home" })}</h4>
            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={cn(
                  "relative p-1 rounded-lg border transition-all duration-200 tap-feedback",
                  "active:scale-95",
                  "flex items-center justify-center w-8 h-8 tap-target-lg",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
                  isFilterActive ? "border-primary text-primary" : "border-slate-200 text-slate-500"
                )}
                aria-label={intl.formatMessage({
                  id: "app.home.filters.button",
                  defaultMessage: "Filters",
                })}
              >
                <RiFilterLine className="h-4 w-4" />
                {isFilterActive ? (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <WorkDashboardIcon />
            </div>
          </div>
          <div className={"padded flex-1 flex flex-col gap-4 overflow-y-scroll overflow-x-hidden"}>
            {renderGardens()}
          </div>
          <GardensFilterDrawer
            isOpen={isFilterOpen}
            onClose={() => setFilterOpen(false)}
            filters={filters}
            onScopeChange={handleScopeChange}
            onSortChange={handleSortChange}
            onReset={handleResetFilters}
            canFilterMine={Boolean(primaryAddress)}
            myGardensCount={myGardensCount}
            isFilterActive={isFilterActive}
          />
        </>
      ) : null}
      <Outlet />
    </article>
  );
};

export default Gardens;
