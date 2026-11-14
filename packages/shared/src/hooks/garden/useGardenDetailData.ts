import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isAddress } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import type { GardenListPages } from "../../types/garden-detail";
import { WeightScheme } from "../../types/gardens-community";
import { compareAddresses } from "../../utils/blockchain/address";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { summarizeNetDepositsByAsset } from "../../utils/blockchain/vaults";
import { useGardenAssessments } from "../assessment/useGardenAssessments";
import { useGardens } from "../blockchain/useBaseLists";
import { useConvictionStrategies } from "../conviction/useConvictionStrategies";
import { useGardenCookieJars } from "../cookie-jar/useGardenCookieJars";
import { useCreateGardenPools } from "../conviction/useCreateGardenPools";
import { useGardenCommunity } from "../conviction/useGardenCommunity";
import { useGardenPools } from "../conviction/useGardenPools";
import { useHypercerts } from "../hypercerts/useHypercerts";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { useGardenVaults } from "../vault/useGardenVaults";
import { useGardenReviewQueue } from "../work/useGardenReviewQueue";
import { useWorks } from "../work/useWorks";
import { useYieldAllocations } from "../yield/useYieldAllocations";
import type { GardenOperationResult } from "./createGardenOperation";
import { useGardenOperations } from "./useGardenOperations";
import { useGardenPermissions } from "./useGardenPermissions";
import { useEligibleAdminGardens } from "./useEligibleAdminGardens";

export function useGardenDetailData(id: string | undefined) {
  const queryClient = useQueryClient();
  const gardenPermissions = useGardenPermissions();

  const {
    data: gardens = [],
    isLoading: fetching,
    isFetching: gardensFetching,
    error,
    isError,
    refetch: refreshGardens,
  } = useGardens();
  const {
    eligibleGardens,
    hasStaleBaseList,
    isError: eligibleGardenBaseListError,
  } = useEligibleAdminGardens();
  const baseGarden = gardens.find((g) => compareAddresses(g.id, id)) ?? null;
  const recoveredEligibleGarden = eligibleGardens.find((g) => compareAddresses(g.id, id)) ?? null;
  const garden = baseGarden ?? recoveredEligibleGarden ?? undefined;
  const isRecoveredEligibleGarden = baseGarden === null && recoveredEligibleGarden !== null;

  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(() => {
    const keysToInvalidate = queryInvalidation.invalidateGardens(DEFAULT_CHAIN_ID);
    keysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }, 5000);

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    isFetching: assessmentsFetching,
    error: assessmentsError,
    refetch: refreshAssessments,
  } = useGardenAssessments(id);

  const assessments = assessmentList;
  const gardenId = id ?? "";

  const {
    addGardener,
    removeGardener,
    addSteward,
    removeSteward,
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
  const canManageStewards = garden ? gardenPermissions.canManageStewards(garden) : false;
  const isOwner = garden ? gardenPermissions.isOwnerOfGarden(garden) : false;

  const vaultGardenAddress = id && isAddress(id) ? id : undefined;
  const { vaults: gardenVaults = [], isLoading: vaultsLoading } = useGardenVaults(
    vaultGardenAddress,
    {
      enabled: Boolean(vaultGardenAddress),
    }
  );
  // Steward alerts read the jars' claim limits; stewards are the only ones shown alerts.
  const { jars: cookieJars, hasNoJar: hasNoPayoutJar } = useGardenCookieJars(id, {
    enabled: Boolean(id) && canManage,
  });

  const { strategies: convictionStrategies } = useConvictionStrategies(
    (id as `0x${string}`) ?? undefined,
    { enabled: Boolean(id) && canManage }
  );

  const { community, isLoading: communityLoading } = useGardenCommunity(id as Address | undefined, {
    enabled: Boolean(id),
  });
  const {
    pools,
    poolsRead,
    poolsUnread,
    refetch: refetchPools,
  } = useGardenPools(id as Address | undefined, { enabled: Boolean(id) });
  const { mutate: createPools, isPending: isCreatingPools } = useCreateGardenPools(
    id as Address | undefined
  );
  const {
    allocations,
    atLimit: allocationsAtLimit,
    isLoading: allocationsLoading,
    data: allocationsRead,
    isError: allocationsFailed,
  } = useYieldAllocations(id as Address | undefined, { enabled: Boolean(id) });
  // A failed first read leaves no history at all, which must not read as none paid out.
  const allocationsUnread = allocationsFailed && allocationsRead === undefined;

  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

  // Endowment amounts stay per asset: WETH and DAI base units never add up.
  const { endowmentByAsset, hasEndowment, vaultHarvestCount, vaultDepositorCount } = useMemo(() => {
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of gardenVaults) {
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    const byAsset = summarizeNetDepositsByAsset(gardenVaults, garden?.chainId ?? DEFAULT_CHAIN_ID);
    return {
      endowmentByAsset: byAsset,
      hasEndowment: byAsset.some((entry) => entry.amount > 0n),
      vaultHarvestCount: harvestCount,
      vaultDepositorCount: depositorCount,
    };
  }, [gardenVaults, garden?.chainId]);

  const {
    works,
    isLoading: worksLoading,
    isFetching: worksFetching,
    isError: isWorksError,
    isPaused: isWorksPaused,
    error: worksError,
    refetch: refreshWorks,
    hasOlderWork,
    loadOlderWork,
    isLoadingOlder: isLoadingOlderWork,
    lastSuccessfulRefresh: worksReadAt,
    hasUnknownStatuses,
    readThisSession: worksReadThisSession,
  } = useWorks(gardenId);
  // Rows whose statuses are current. A row whose approval could not be read
  // shows a cached or fallback status, a failed or paused refresh leaves the
  // last rows read, and rows restored from an earlier session may be days old.
  // A refresh in flight is fine: the rows are as current as they were a moment
  // before it started.
  const worksCurrent =
    !hasUnknownStatuses && !isWorksError && !isWorksPaused && worksReadThisSession;
  // A widened read in flight has nothing older to show until it lands, so its
  // rows are not the whole history yet.
  const olderWorkUnread = hasOlderWork || isLoadingOlderWork;
  const gardenReviewQueue = useGardenReviewQueue(gardenId, { enabled: olderWorkUnread });
  const {
    hypercerts,
    isLoading: hypercertsLoading,
    isFetching: hypercertsFetching,
    error: hypercertsError,
    refetch: refetchHypercerts,
    hasOlder: hasOlderHypercerts,
    loadOlder: loadOlderHypercerts,
    isLoadingOlder: isLoadingOlderHypercerts,
    listReadAt: hypercertsReadAt,
  } = useHypercerts({ gardenId: id });

  const roleMembers: Record<GardenRole, Address[]> = {
    owner: garden?.owners ?? [],
    steward: garden?.stewards ?? [],
    evaluator: garden?.evaluators ?? [],
    gardener: garden?.gardeners ?? [],
    funder: garden?.funders ?? [],
    community: garden?.communities ?? [],
  };

  const roleActions = {
    owner: { add: addOwner, remove: removeOwner },
    steward: { add: addSteward, remove: removeSteward },
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
    baseGarden,
    isRecoveredEligibleGarden,
    hasStaleBaseList,
    baseListError: error ?? null,
    isBaseListError: isError || eligibleGardenBaseListError,
    fetching,
    error,
    // A failed garden list read fails every Hub tab, so their refresh rereads it.
    refreshGardens,
    gardensFetching,
    gardenId,
    canManage,
    canReview,
    canManageRoles,
    canManageStewards,
    isOwner,
    assessments,
    fetchingAssessments,
    assessmentsFetching,
    assessmentsError,
    refreshAssessments,
    roleMembers,
    roleActions,
    isOperationLoading,
    community,
    communityLoading,
    weightSchemeLabel,
    pools,
    poolsRead,
    poolsUnread,
    rereadPools: () => void refetchPools(),
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    cookieJars,
    hasNoPayoutJar,
    endowmentByAsset,
    hasEndowment,
    vaultHarvestCount,
    vaultDepositorCount,
    allocations,
    allocationsAtLimit,
    allocationsLoading,
    allocationsUnread,
    works,
    // Current rows prove a stall alone only when they hold the whole history.
    worksComplete: worksCurrent && !olderWorkUnread,
    // Past the newest page, the garden's whole queue speaks for older work.
    // Beside its list, the rows add only decisions, which stay true however old
    // the rows are. Beside a floor, their own waiting work counts too, so it
    // must be current.
    gardenReviewQueue:
      olderWorkUnread && (gardenReviewQueue?.waiting !== null || worksCurrent)
        ? gardenReviewQueue
        : undefined,
    worksLoading,
    worksFetching,
    isWorksError,
    isWorksPaused,
    worksError,
    refreshWorks,
    // Each list holds the garden's newest page until a steward asks for older records.
    workPages: {
      hasOlder: hasOlderWork,
      loadOlder: loadOlderWork,
      reread: refreshWorks,
      isLoadingOlder: isLoadingOlderWork,
      readAt: worksReadAt,
    } satisfies GardenListPages,
    hypercerts,
    hypercertsLoading,
    hypercertsFetching,
    hypercertsError,
    refreshHypercerts: refetchHypercerts,
    hypercertPages: {
      hasOlder: hasOlderHypercerts,
      loadOlder: loadOlderHypercerts,
      reread: () => void refetchHypercerts(),
      isLoadingOlder: isLoadingOlderHypercerts,
      readAt: hypercertsReadAt,
    } satisfies GardenListPages,
    convictionStrategyCount: convictionStrategies.length,
    scheduleBackgroundRefetch,
  };
}
