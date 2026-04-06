import {
  cn,
  formatTokenAmount,
  useAdminStore,
  useGardenDerivedState,
  useGardenDetailData,
  useGardens,
} from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiGroupLine,
  RiMoneyDollarCircleLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CockpitWorkspaceSelectionState } from "@/components/Layout/CockpitWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CommunityTab } from "@/views/Gardens/Garden/CommunityTab";
import "../Gardens/Garden/GardenDetailLayout.css";

type CommunityWorkspaceCard = "treasury" | "members" | "pools" | "yield";

function parseCommunityCard(value: string | null): CommunityWorkspaceCard {
  if (value === "members" || value === "pools" || value === "yield") {
    return value;
  }
  return "treasury";
}

export default function CommunityView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: gardens = [] } = useGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const [memberSearch, setMemberSearch] = useState("");

  const card = parseCommunityCard(searchParams.get("card"));
  const pool = searchParams.get("pool") ?? "hypercert";

  const {
    garden,
    fetching,
    error,
    gardenId,
    canManage,
    isOwner,
    community,
    communityLoading,
    pools,
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    allocations,
    allocationsLoading,
    roleMembers,
    works,
    assessments,
    hypercerts,
    scheduleBackgroundRefetch,
  } = useGardenDetailData(selectedGarden?.id);

  const updateSearch = useCallback(
    (updates: Partial<Record<"garden" | "card" | "pool", string | undefined>>, replace = true) => {
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
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;

      if (tab === "community") {
        const nextCard =
          section === "members"
            ? "members"
            : section === "yield"
              ? "yield"
              : section === "pools"
                ? "pools"
                : "treasury";
        updateSearch({ card: nextCard }, false);
        return;
      }

      if (tab === "work") {
        navigate(`/work?garden=${selectedGarden.id}&view=queue${itemId ? `&item=${itemId}` : ""}`);
        return;
      }

      navigate(
        `/garden?garden=${selectedGarden.id}&view=${tab === "impact" ? "impact" : "overview"}${
          itemId ? `&item=${itemId}` : ""
        }`
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
    memberSearch,
    section: card,
    formatMessage,
    openSection,
  });

  const totalMembers = derived.directoryEntries.length;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        description={formatMessage({
          id: "cockpit.community.description",
          defaultMessage: "Manage treasury, members, and signal pools",
        })}
        metadata={selectedGarden?.name}
        sticky
        actions={
          selectedGarden ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/gardens/${selectedGarden.id}/vault`}>
                  {formatMessage({ id: "app.treasury.manageVault" })}
                </Link>
              </Button>
              {card === "pools" ? (
                <Button size="sm" asChild>
                  <Link to={`/gardens/${selectedGarden.id}/signal-pool/${pool}`}>
                    {pool === "action"
                      ? formatMessage({ id: "app.signal.viewActionPool" })
                      : formatMessage({ id: "app.signal.viewHypercertPool" })}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
        toolbar={
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label={formatMessage({
              id: "cockpit.community.viewSwitcher",
              defaultMessage: "Community views",
            })}
          >
            {(
              [
                {
                  id: "treasury",
                  labelId: "cockpit.community.treasury",
                  defaultMessage: "Treasury",
                },
                {
                  id: "members",
                  labelId: "cockpit.community.members",
                  defaultMessage: "Members",
                },
                {
                  id: "pools",
                  labelId: "cockpit.community.pools",
                  defaultMessage: "Signal Pools",
                },
                { id: "yield", labelId: "app.yield.title", defaultMessage: "Yield" },
              ] as const
            ).map((option) => {
              const active = card === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    updateSearch({
                      card: option.id,
                      pool: option.id === "pools" ? pool : undefined,
                    })
                  }
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
          workspaceLabel={formatMessage({
            id: "cockpit.nav.community",
            defaultMessage: "Community",
          })}
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
      ) : fetching ? (
        <div className="mt-6 px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-live="polite">
            <div className="h-40 rounded-lg skeleton-shimmer" />
            <div className="h-40 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.08s" }} />
            <div
              className="h-72 rounded-lg skeleton-shimmer lg:col-span-2"
              style={{ animationDelay: "0.16s" }}
            />
          </div>
        </div>
      ) : !garden || error ? (
        <div className="mt-6 px-4 sm:px-6">
          <Alert variant="error">
            {error?.message ??
              formatMessage({
                id: "cockpit.community.loadFailed",
                defaultMessage: "Unable to load this community workspace.",
              })}
          </Alert>
        </div>
      ) : (
        <div className="mt-6 space-y-6 px-4 sm:px-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<RiMoneyDollarCircleLine className="h-5 w-5" />}
              label={formatMessage({ id: "app.treasury.totalValueLocked" })}
              value={derived.hasVaults ? formatTokenAmount(vaultNetDeposited) : "0"}
              colorScheme="info"
            />
            <StatCard
              icon={<RiUserLine className="h-5 w-5" />}
              label={formatMessage({ id: "cockpit.community.members", defaultMessage: "Members" })}
              value={totalMembers}
              colorScheme="success"
            />
            <StatCard
              icon={<RiGroupLine className="h-5 w-5" />}
              label={formatMessage({
                id: "cockpit.community.pools",
                defaultMessage: "Signal Pools",
              })}
              value={pools.length}
              colorScheme="warning"
            />
          </section>

          {card === "pools" ? (
            <Alert variant="info">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {formatMessage({
                    id: "cockpit.community.poolsHint",
                    defaultMessage:
                      "Open a specific signal pool to manage registrations and conviction weights.",
                  })}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={pool === "hypercert" ? "primary" : "secondary"}
                    asChild
                  >
                    <Link to={`/gardens/${garden.id}/signal-pool/hypercert`}>
                      {formatMessage({ id: "app.signal.viewHypercertPool" })}
                    </Link>
                  </Button>
                  <Button size="sm" variant={pool === "action" ? "primary" : "secondary"} asChild>
                    <Link to={`/gardens/${garden.id}/signal-pool/action`}>
                      {formatMessage({ id: "app.signal.viewActionPool" })}
                    </Link>
                  </Button>
                </div>
              </div>
            </Alert>
          ) : null}

          <CommunityTab
            garden={{ id: garden.id, name: garden.name }}
            gardenId={gardenId}
            canManage={canManage}
            isOwner={isOwner}
            section={card}
            showSectionStateCard={false}
            clearSection={() => updateSearch({ card: "treasury", pool: undefined }, false)}
            openSection={openSection}
            community={community}
            communityLoading={communityLoading}
            pools={pools}
            createPools={async () => {
              createPools();
            }}
            isCreatingPools={isCreatingPools}
            vaultsLoading={vaultsLoading}
            hasVaults={derived.hasVaults}
            vaultNetDeposited={vaultNetDeposited}
            treasurySeverity={derived.treasurySeverity}
            allocations={allocations}
            allocationsLoading={allocationsLoading}
            roleSummary={derived.roleSummary}
            roleIcons={{
              owner: RiShieldCheckLine,
              operator: RiUserLine,
              evaluator: RiCheckboxCircleLine,
              gardener: RiSeedlingLine,
              funder: RiMoneyDollarCircleLine,
              community: RiGroupLine,
            }}
            filteredDirectory={derived.filteredDirectory}
            visibleDirectory={
              card === "members" ? derived.filteredDirectory : derived.visibleDirectory
            }
            memberSearch={memberSearch}
            setMemberSearch={setMemberSearch}
            openMembersModal={() => {
              updateSearch({ card: "members" }, false);
            }}
            scheduleBackgroundRefetch={scheduleBackgroundRefetch}
          />
        </div>
      )}
    </div>
  );
}
