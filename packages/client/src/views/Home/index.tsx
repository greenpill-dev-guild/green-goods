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
import { GardenCard, GardenCardSkeleton } from "@/components/Cards";
import {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
  GardensFilterDrawer,
} from "./GardenFilters";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const Home: React.FC = () => {
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

export default Home;
