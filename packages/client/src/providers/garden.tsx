import { useQuery } from "@tanstack/react-query";
import React, { useContext, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "@/config";
import { useWorks } from "@/hooks/useWorks";
import { getGardenAssessments } from "@/modules/eas";
import { getActions, getGardeners, getGardens } from "@/modules/greengoods";

import { useUser } from "./user";
import { useWork } from "./work";

interface GardenDataProps {
  isOperator: boolean;
  garden?: Garden;
  gardenStatus: "error" | "success" | "pending";
  isFetching: boolean;
  isLoading: boolean;
  gardeners: GardenerCard[];
  error?: Error | null;
  refetch: () => void;
}

interface GardensDataProps {
  actions: Action[];
  gardens: Garden[];
  actionsStatus: "error" | "success" | "pending";
  gardensStatus: "error" | "success" | "pending";
  gardenersStatus: "error" | "success" | "pending";
  gardenersMap: Map<string, GardenerCard>;
}

export const useGarden = (id: string): GardenDataProps => {
  const { gardens, gardenersMap } = useGardens();
  const { workApprovalMap } = useWork();
  const { eoa, smartAccountAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  // Use merged works hook to get both online and offline work
  const { works: mergedWorks, isLoading: worksLoading } = useWorks(id);

  const {
    data: garden,
    error,
    status: gardenStatus,
    isFetching,
    isLoading,
    refetch,
  } = useQuery<Garden, Error, Garden, [string, string, number]>({
    initialData: gardens.find((garden) => garden.id === id),
    queryKey: ["gardens", id, chainId],
    queryFn: async ({ queryKey }) => {
      const [_, id, chainId] = queryKey;
      const garden = gardens.find((garden) => garden.id === id);

      if (!garden) throw new Error("Garden not found");

      const assessments = await getGardenAssessments(id, chainId);

      // Return garden with assessments, works will be merged separately
      return { ...garden, assessments };
    },
    throwOnError: true,
    // Remove circular dependency - no longer wait for works
  });

  const isOperator = useMemo(
    () =>
      (!!eoa?.address && !!garden?.operators.includes(eoa.address)) ||
      (!!smartAccountAddress && !!garden?.operators.includes(smartAccountAddress)),
    [garden, eoa, smartAccountAddress]
  );

  // Apply work approval status to merged works
  const processedWorks: Work[] = mergedWorks.map((work) => {
    const workApproval = workApprovalMap[work.id];
    return {
      ...work,
      status: workApproval ? (workApproval.approved ? "approved" : "rejected") : work.status,
    };
  });

  return {
    isOperator,
    garden: garden ? { ...garden, works: processedWorks } : undefined,
    gardenStatus,
    gardeners:
      garden?.gardeners.reduce<GardenerCard[]>((acc, id) => {
        const user = gardenersMap.get(id);
        if (user) acc.push(user);
        else acc.push({ id, account: id, registeredAt: Math.floor(Date.now() / 1000) });
        return acc;
      }, []) ?? [],
    isFetching: isFetching || worksLoading,
    isLoading: isLoading || worksLoading,
    error,
    refetch,
  };
};

const GardensContext = React.createContext<GardensDataProps>({
  actions: [],
  gardens: [],
  actionsStatus: "pending",
  gardensStatus: "pending",
  gardenersStatus: "pending",
  gardenersMap: new Map(),
});

export const useGardens = () => {
  return useContext(GardensContext);
};

export const GardensProvider = ({ children }: { children: React.ReactNode }) => {
  const chainId = DEFAULT_CHAIN_ID;

  // QUERIES
  const { data: actions, status: actionsStatus } = useQuery<Action[]>({
    queryKey: ["actions", chainId],
    queryFn: () => getActions(),
  });

  const { data: gardens, status: gardensStatus } = useQuery<Garden[]>({
    queryKey: ["gardens", chainId],
    queryFn: () => getGardens(),
  });
  const { data: gardeners, status: gardenersStatus } = useQuery<GardenerCard[]>({
    queryKey: ["gardeners"],
    queryFn: getGardeners,
  });

  return (
    <GardensContext.Provider
      value={{
        actions: actions || [],
        gardens: gardens || [],
        actionsStatus,
        gardensStatus,
        gardenersStatus,
        gardenersMap: new Map(gardeners?.map((gardener) => [gardener.id, gardener]) || []),
      }}
    >
      {children}
    </GardensContext.Provider>
  );
};
