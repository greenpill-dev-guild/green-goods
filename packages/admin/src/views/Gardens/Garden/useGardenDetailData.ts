import {
  type Address,
  DEFAULT_CHAIN_ID,
  type GardenOperationResult,
  type GardenRole,
  getNetDeposited,
  queryInvalidation,
  useConvictionStrategies,
  useCreateGardenPools,
  useDelayedInvalidation,
  useGardenAssessments,
  useGardenCommunity,
  useGardenOperations,
  useGardenPermissions,
  useGardenPools,
  useGardens,
  useGardenVaults,
  useHypercerts,
  useWorks,
  useYieldAllocations,
  WeightScheme,
} from "@green-goods/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

export function useGardenDetailData(id: string | undefined) {
  const queryClient = useQueryClient();
  const gardenPermissions = useGardenPermissions();

  const { data: gardens = [], isLoading: fetching, error } = useGardens();
  const garden = gardens.find((g) => g.id === id);

  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(() => {
    const keysToInvalidate = queryInvalidation.invalidateGardens(DEFAULT_CHAIN_ID);
    keysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }, 5000);

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    error: assessmentsError,
  } = useGardenAssessments(id);

  const assessments = assessmentList;
  const gardenId = id ?? "";

  const {
    addGardener,
    removeGardener,
    addOperator,
    removeOperator,
    addEvaluator,
    removeEvaluator,
    addOwner,
    removeOwner,
    addFunder,
    removeFunder,
    addCommunity,
    removeCommunity,
    isLoading: isOperationLoading,
  } = useGardenOperations(gardenId);

  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;
  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canManageRoles = garden ? gardenPermissions.canAddMembers(garden) : false;
  const isOwner = garden ? gardenPermissions.isOwnerOfGarden(garden) : false;

  const { vaults: gardenVaults = [], isLoading: vaultsLoading } = useGardenVaults(id, {
    enabled: Boolean(id),
  });

  const { strategies: convictionStrategies } = useConvictionStrategies(
    (id as `0x${string}`) ?? undefined,
    { enabled: Boolean(id) && canManage }
  );

  const { community, isLoading: communityLoading } = useGardenCommunity(id as Address | undefined, {
    enabled: Boolean(id),
  });
  const { pools } = useGardenPools(id as Address | undefined, { enabled: Boolean(id) });
  const { createPools, isCreating: isCreatingPools } = useCreateGardenPools(
    id as Address | undefined
  );
  const { allocations, isLoading: allocationsLoading } = useYieldAllocations(
    id as Address | undefined,
    { enabled: Boolean(id) }
  );

  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

  const { vaultNetDeposited, vaultHarvestCount, vaultDepositorCount } = useMemo(() => {
    let netDeposited = 0n;
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of gardenVaults) {
      netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    return {
      vaultNetDeposited: netDeposited,
      vaultHarvestCount: harvestCount,
      vaultDepositorCount: depositorCount,
    };
  }, [gardenVaults]);

  const {
    works,
    isLoading: worksLoading,
    isFetching: worksFetching,
    refetch: refreshWorks,
  } = useWorks(gardenId);
  const { hypercerts, isLoading: hypercertsLoading } = useHypercerts({ gardenId: id });

  const roleMembers: Record<GardenRole, Address[]> = {
    owner: garden?.owners ?? [],
    operator: garden?.operators ?? [],
    evaluator: garden?.evaluators ?? [],
    gardener: garden?.gardeners ?? [],
    funder: garden?.funders ?? [],
    community: garden?.communities ?? [],
  };

  const roleActions = {
    owner: { add: addOwner, remove: removeOwner },
    operator: { add: addOperator, remove: removeOperator },
    evaluator: { add: addEvaluator, remove: removeEvaluator },
    gardener: { add: addGardener, remove: removeGardener },
    funder: { add: addFunder, remove: removeFunder },
    community: { add: addCommunity, remove: removeCommunity },
  } satisfies Record<
    GardenRole,
    {
      add: (address: Address) => Promise<GardenOperationResult>;
      remove: (address: Address) => Promise<GardenOperationResult>;
    }
  >;

  return {
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
    convictionStrategyCount: convictionStrategies.length,
    scheduleBackgroundRefetch,
  };
}
